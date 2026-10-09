import mongoose from 'mongoose'

const newsSchema = new mongoose.Schema({
  publicCode:   { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  internalCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },

  title:    { type: String, required: true, trim: true, maxlength: 200 },
  slug:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  excerpt:  { type: String, required: true, trim: true, maxlength: 400 },
  body:     { type: String, required: true },
  image:    { type: String, default: '' },
  cover:    { type: String, default: '' },
  photo:    { type: String, default: '' },
  status:   { type: String, default: 'borrador', enum: ['borrador', 'publicado'] },
  category: { type: String, trim: true, default: 'general' },
  game:     { type: String, trim: true, default: '' },
  tags:     [{ type: String, trim: true }],
  links:    [{ label: { type: String, default: '' }, url: { type: String, default: '' } }],
  featured: { type: Boolean, default: false },
  views:    { type: Number, default: 0, min: 0 },
  clicks:   { type: Number, default: 0, min: 0 },
  shares:   { type: Number, default: 0, min: 0 },
  readingTime: { type: Number, default: 2 },
  scheduledDate: { type: String, default: '' },
  seoDescription: { type: String, default: '' },
  date:     { type: String, default: '' },
  author:   { type: String, default: 'GlitchGang', trim: true },
  createdBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
  versionKey: false,
})

// slug already indexed via unique:true in schema
newsSchema.index({ featured: -1, createdAt: -1 })
newsSchema.index({ category: 1 })

export const News = mongoose.model('News', newsSchema)
