import mongoose from 'mongoose'

const UniversityApplicationSchema = new mongoose.Schema(
  {
    publicCode:  { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    internalCode:{ type: String, unique: true, sparse: true, uppercase: true, trim: true },
    systemTicket:{ type: mongoose.Schema.Types.ObjectId, ref: 'SystemTicket', default: null },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    universityId:   { type: String, required: true, index: true },
    universityTag:  { type: String, required: true },
    universityName: { type: String, required: true },
    region:         { type: String, required: true },
    city:           { type: String, default: '' },
    campus:         { type: String, required: true },
    // La matrícula ya no se pide (la verificación es por correo institucional).
    studentId:      { type: String, index: true },
    program:        { type: String, required: true },
    academicLevel:  { type: String, required: true },
    admissionYear:  { type: Number, default: null },
    institutionalEmail: { type: String },
    verificationSource: { type: String, enum: ['manual', 'microsoft', 'admin', 'email'], default: 'manual' },
    microsoft: {
      id:          { type: String, default: '' },
      tenantId:    { type: String, default: '' },
      email:       { type: String, default: '' },
      displayName: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectReason: { type: String, default: '' },
    submittedAt:  { type: Date, default: Date.now },
    reviewedAt:   { type: Date, default: null },
    reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

// Composite index for quick uni+student lookups
UniversityApplicationSchema.index(
  { universityId: 1, studentId: 1 },
  { name: 'uni_student_lookup' }
)

// Prevent duplicate active student IDs (pending or approved)
UniversityApplicationSchema.index(
  { studentId: 1 },
  {
    unique: true,
    name: 'uni_student_unique_active',
    partialFilterExpression: {
      studentId: { $exists: true, $type: 'string' },
      status:    { $in: ['pending', 'approved'] },
    },
  }
)

// Prevent duplicate active institutional emails
UniversityApplicationSchema.index(
  { institutionalEmail: 1 },
  {
    unique: true,
    name: 'uni_email_unique_active',
    partialFilterExpression: {
      institutionalEmail: { $exists: true, $type: 'string' },
      status:             { $in: ['pending', 'approved'] },
    },
  }
)

export const UniversityApplication = mongoose.model('UniversityApplication', UniversityApplicationSchema)
