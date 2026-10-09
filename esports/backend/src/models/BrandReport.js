import mongoose from 'mongoose'

const brandReportSchema = new mongoose.Schema({
  publicCode:  { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  internalCode:{ type: String, unique: true, sparse: true, uppercase: true, trim: true },

  brandId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  sentBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  type:        { type: String, enum: ['stats', 'document', 'message', 'alcance'], default: 'message' },
  title:       { type: String, required: true, trim: true },
  body:        { type: String, default: '' },

  // For type:'stats' / type:'alcance'
  statsData:   {
    impressions: { type: Number, default: 0 },
    clicks:      { type: Number, default: 0 },
    ctr:         { type: Number, default: 0 },
    reach:       { type: Number, default: 0 },
    period:      { type: String, default: '' },  // e.g. "Junio 2026"
  },

  // For type:'document'
  fileData:    { type: String, default: '' },   // base64
  fileName:    { type: String, default: '' },
  mimeType:    { type: String, default: '' },

  // Read tracking
  readAt:      { type: Date, default: null },
}, { timestamps: true, versionKey: false })

export const BrandReport = mongoose.model('BrandReport', brandReportSchema)
