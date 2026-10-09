import mongoose from 'mongoose'

// Una Creatividad es un asset gráfico (banner, strip, flotante).
// Puede existir de dos maneras:
//   1. Suelta en la galería privada de la marca (campaignId = null, status = 'approved' tras revisión)
//   2. Vinculada a una Campaña (campaignId set, adType obligatorio, linkUrl propio)
//
// Cuando la campaña se aprueba → status pasa a 'active' → el banner aparece en la plataforma.
// Cuando la campaña expira   → status pasa a 'expired' → métricas congeladas.

// Genera el ID compuesto del anuncio al activarse:
// Formato: [BrandCode]_[AdTypeCode]-[seq]_[YYYYMMDD]_[seq3]
// Ejemplo: BRD001_BNR-01_20260620_001
export function buildAdId(brandCode, adType, seqInCampaign, dailySeq) {
  const TYPE_CODE = { banner: 'BNR', strip: 'STP', floating: 'FLT' }
  const code  = (brandCode || 'BRD').replace(/-/g, '').slice(0, 6).toUpperCase()
  const type  = TYPE_CODE[adType] || 'ADS'
  const date  = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const seq   = String(seqInCampaign || 1).padStart(2, '0')
  const daily = String(dailySeq || 1).padStart(3, '0')
  return `${code}_${type}-${seq}_${date}_${daily}`
}

const STATUSES = [
  'review',    // subida, esperando revisión standalone del admin
  'approved',  // aprobada → en galería, disponible para vincular a campaña
  'rejected',  // rechazada por el admin (con motivo)
  'active',    // vinculada a campaña activa → visible en la plataforma
  'expired',   // la campaña a la que pertenecía expiró
]

const creativeSchema = new mongoose.Schema({
  brandId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },

  // Vínculo a campaña (opcional — null = galería suelta)
  campaignId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },

  // Metadatos del archivo
  name:             { type: String, required: true },
  format:           { type: String, default: '' },    // Ej: "PNG 1920×320"
  sizeBytes:        { type: Number, default: 0 },
  mimeType:         { type: String, default: '' },
  fileData:         { type: String, default: '' },    // base64 data URI

  // Tipo de despliegue (obligatorio cuando está vinculada a campaña)
  adType:           { type: String, enum: ['banner', 'strip', 'floating', ''], default: '' },

  // URL de destino al hacer click (específica por creatividad)
  linkUrl:          { type: String, default: '' },

  // ID compuesto generado al activarse: BRD001_BNR-01_20260620_001
  adId:             { type: String, default: '' },
  internalCode:     { type: String, unique: true, sparse: true, uppercase: true, trim: true },

  // Estado en el ciclo de vida
  status:           { type: String, enum: STATUSES, default: 'review' },
  rejectionReason:  { type: String, default: '' },

  // Métricas reales (incrementadas por el backend al renderizar/clickar)
  impressions:      { type: Number, default: 0 },
  clicks:           { type: Number, default: 0 },

}, { timestamps: true, versionKey: false })

// Índice para queries rápidas de banners activos por tipo
creativeSchema.index({ status: 1, adType: 1 })
creativeSchema.index({ campaignId: 1 })
creativeSchema.index({ adId: 1 })

export const Creative = mongoose.model('Creative', creativeSchema)
