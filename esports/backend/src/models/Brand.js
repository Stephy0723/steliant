import mongoose from 'mongoose'

const brandSchema = new mongoose.Schema({
  code:         { type: String, required: true, unique: true, trim: true },
  internalCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  name:         { type: String, required: true, trim: true },
  industry:     { type: String, required: true, trim: true },
  tier:         { type: String, enum: ['platinum', 'gold', 'silver'], default: 'silver' },
  logoInitials: { type: String, default: '' },
  color:        { type: String, default: '#F0A500' },
  tagline:      { type: String, default: '' },
  website:      { type: String, default: '' },
  logoUrl:      { type: String, default: '' },
  contactName:  { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  contactPhone: { type: String, default: '' },
  status:       { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },
  since:        { type: Date, default: Date.now },

  // Pending profile changes submitted by the brand, awaiting admin approval
  pendingChanges: {
    logoUrl:      { type: String, default: '' },
    logoInitials: { type: String, default: '' },
    tagline:      { type: String, default: '' },
    website:      { type: String, default: '' },
    contactName:  { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    submittedAt:  { type: Date, default: null },
  },
}, { timestamps: true, versionKey: false })

export const Brand = mongoose.model('Brand', brandSchema)
