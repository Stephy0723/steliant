import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
  post:         { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  author:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorNick:   { type: String, required: true },
  authorAvatar: { type: String },
  text:         { type: String, required: true },
  parentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null }, // Support nested replies
  likes:        { type: Number, default: 0 },
  likedBy:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reports:      [{
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  reported:     { type: Boolean, default: false },
  blockedBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Users who hid this comment
}, {
  timestamps: true,
  versionKey: false
})

export const Comment = mongoose.model('Comment', commentSchema)
