import mongoose from 'mongoose'

// Catálogo de universidades editable desde el panel admin. Vive en la
// colección `universities` (donde ya estaba el catálogo anterior); el modelo
// University (cédulas) comparte la colección pero solo lee documentos con `user`.
const UniversityCatalogSchema = new mongoose.Schema(
  {
    id:       { type: String, required: true, lowercase: true, trim: true },
    tag:      { type: String, required: true, trim: true },
    name:     { type: String, required: true, trim: true },
    region:   { type: String, default: 'rd' },
    city:     { type: String, default: '' },
    founded:  { type: Number, default: null },
    logo:     { type: String, default: '' },
    color:    { type: String, default: '#333333' },
    verified: { type: Boolean, default: false },
    bio:      { type: String, default: '' },
    games:    { type: [String], default: [] },
    programs: { type: [String], default: [] },
    campuses: { type: [String], default: [] },
    offers:   { type: [String], default: [] },
    // Dominios del correo institucional (ej. intec.edu.do). Sin dominios la
    // universidad no puede verificar estudiantes.
    allowedDomains: { type: [String], default: [] },
    active:    { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'universities' }
)

UniversityCatalogSchema.index({ id: 1 }, { unique: true, sparse: true, name: 'catalog_id_unique' })

export const UniversityCatalog = mongoose.model('UniversityCatalog', UniversityCatalogSchema)
