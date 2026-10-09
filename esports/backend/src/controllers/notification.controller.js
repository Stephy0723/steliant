import { Notification } from '../models/Notification.js'

export async function listNotifications(req, res, next) {
  try {
    // page/limit vienen como texto: ?limit=abc o ?page=0 daban NaN/skip
    // negativo (error 500) y ?limit=100000 traia todo el historial.
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30))
    const filter = { userId: req.user._id }
    if (req.query.unreadOnly === 'true') filter.read = false

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: req.user._id, read: false }),
    ])
    res.json({ notifications, unreadCount })
  } catch (err) { next(err) }
}

export async function markRead(req, res, next) {
  try {
    const n = await Notification.findOne({ _id: req.params.id, userId: req.user._id })
    if (!n) return res.status(404).json({ message: 'Notification not found' })
    await Notification.updateOne({ _id: n._id }, { read: true })
    res.json({ message: 'Marked as read' })
  } catch (err) { next(err) }
}

export async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true })
    res.json({ message: 'All notifications marked as read' })
  } catch (err) { next(err) }
}

export async function archiveNotification(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { archived: true, read: true },
      { new: true },
    )
    if (!notification) return res.status(404).json({ message: 'Notification not found' })
    res.json({ notification })
  } catch (err) { next(err) }
}

export async function deleteNotification(req, res, next) {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
    if (!notification) return res.status(404).json({ message: 'Notification not found' })
    res.json({ message: 'Notification deleted' })
  } catch (err) { next(err) }
}
