import mongoose from 'mongoose'

// Cuenta de juego verificada (por ahora solo Mobile Legends). La llave es
// ID + servidor (roleId + zoneId), nunca el nickname: el nick es texto libre
// en el juego y se puede cambiar cuando se quiera.
//
// Ciclo: pending_code (se pidio el codigo al correo del juego) ->
// pending_confirm (el codigo fue correcto, se le muestran los datos de la
// cuenta) -> verified. 'revoked' = desconectada o reclamada por su dueno real.
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  game: { type: String, enum: ['mlbb'], required: true },
  roleId: { type: String, required: true, trim: true, match: /^\d{4,12}$/ },
  zoneId: { type: String, required: true, trim: true, match: /^\d{1,6}$/ },
  status: { type: String, enum: ['pending_code', 'pending_confirm', 'verified', 'revoked'], required: true },
  // Datos que devuelve el juego al iniciar sesion con el codigo.
  nickname: { type: String, default: '', trim: true, maxlength: 60 },
  avatar: { type: String, default: '', trim: true, maxlength: 500 },
  level: { type: Number, default: null },
  rankLevel: { type: Number, default: null },
  historyRankLevel: { type: Number, default: null },
  country: { type: String, default: '', trim: true, maxlength: 8 },
  codeSentAt: { type: Date, default: null },
  codeAttempts: { type: Number, default: 0, min: 0 },
  checkedAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: String, enum: ['ingame_code', 'admin', ''], default: '' },
  revokedAt: { type: Date, default: null },
  revokedReason: { type: String, enum: ['disconnected', 'claimed_by_owner', 'replaced', 'admin', ''], default: '' },
}, { timestamps: true })

// Un ID + servidor solo puede estar verificado en una cuenta de GlitchGang,
// y cada usuario tiene como mucho una cuenta verificada por juego.
schema.index({ game: 1, roleId: 1, zoneId: 1 }, { unique: true, partialFilterExpression: { status: 'verified' } })
schema.index({ user: 1, game: 1 }, { unique: true, partialFilterExpression: { status: 'verified' } })

export const GameAccount = mongoose.model('GameAccount', schema)
