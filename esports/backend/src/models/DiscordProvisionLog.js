import mongoose from 'mongoose'

const discordProvisionLogSchema = new mongoose.Schema({
  event:      { type: mongoose.Schema.Types.ObjectId, ref: 'IntegrationEvent', default: null, index: true },
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null, index: true },
  team:       { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
  action:     { type: String, required: true, trim: true },
  status:     { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
  message:    { type: String, default: '', trim: true, maxlength: 2000 },
  discordObjectType: { type: String, default: '', trim: true },
  discordObjectId:   { type: String, default: '', trim: true },
}, { timestamps: true, versionKey: false })

export const DiscordProvisionLog = mongoose.model('DiscordProvisionLog', discordProvisionLogSchema)
