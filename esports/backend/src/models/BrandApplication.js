import mongoose from 'mongoose'

const brandApplicationSchema = new mongoose.Schema({
  publicCode:    { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  internalCode:  { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  systemTicket:  { type: mongoose.Schema.Types.ObjectId, ref: 'SystemTicket', default: null },

  // Applicant info
  companyName:   { type: String, required: true, trim: true },
  industry:      { type: String, required: true, trim: true },
  tierInterest:  { type: String, enum: ['platinum', 'gold', 'silver'], default: 'silver' },
  website:       { type: String, default: '' },
  logoUrl:       { type: String, default: '' },     // base64 or URL
  logoInitials:  { type: String, default: '' },
  color:         { type: String, default: '#F0A500' },
  tagline:       { type: String, default: '' },

  // Contact
  contactName:   { type: String, required: true, trim: true },
  contactEmail:  { type: String, required: true, trim: true, lowercase: true },
  contactPhone:  { type: String, default: '' },

  // Message from applicant
  message:       { type: String, default: '' },

  // Status tracking
  status:        { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: { type: String, default: '' },

  // Set on approval
  brandId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', default: null },
  reviewedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:    { type: Date, default: null },
}, { timestamps: true, versionKey: false })

export const BrandApplication = mongoose.model('BrandApplication', brandApplicationSchema)
