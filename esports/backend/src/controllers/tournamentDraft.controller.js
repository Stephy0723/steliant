import { TournamentDraft } from '../models/TournamentDraft.js'
import { Tournament } from '../models/Tournament.js'

export async function getTournamentDraft(req, res, next) {
  try {
    const draft = await TournamentDraft.findOne({ owner: req.user._id }).lean()
    if (draft && await Tournament.exists({ organizer: req.user._id, creationKey: draft.creationKey })) {
      await TournamentDraft.deleteOne({ _id: draft._id })
      return res.json({ draft: null })
    }
    res.json({ draft })
  } catch (err) { next(err) }
}

export async function saveTournamentDraft(req, res, next) {
  try {
    const { form, step, creationKey, savedAt } = req.body
    if (!form || typeof form !== 'object' || Array.isArray(form) || JSON.stringify(form).length > 120000 ||
        !Number.isInteger(step) || step < 0 || step > 5 || typeof creationKey !== 'string' || !creationKey || creationKey.length > 80 ||
        !Number.isFinite(savedAt) || savedAt > Date.now() + 60000) {
      return res.status(400).json({ message: 'Borrador invalido o demasiado grande.' })
    }
    if (await Tournament.exists({ organizer: req.user._id, creationKey })) return res.status(409).json({ message: 'Este torneo ya fue creado.' })
    const draft = await TournamentDraft.findOneAndUpdate(
      { owner: req.user._id, savedAt: { $lte: savedAt } }, { $set: { form, step, creationKey, savedAt } },
      { upsert: true, new: true, runValidators: true },
    )
    res.json({ draft })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Hay un borrador mas reciente. Recarga antes de continuar.' })
    next(err)
  }
}

export async function deleteTournamentDraft(req, res, next) {
  try {
    await TournamentDraft.deleteOne({ owner: req.user._id, creationKey: req.params.key })
    res.json({ deleted: true })
  } catch (err) { next(err) }
}
