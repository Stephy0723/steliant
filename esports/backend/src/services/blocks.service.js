import { User } from '../models/User.js'

function idValue(value) {
  return String(value?._id || value || '')
}

export async function isBlockedEitherWay(aId, bId) {
  const a = idValue(aId)
  const b = idValue(bId)
  if (!a || !b || a === b) return false

  const count = await User.countDocuments({
    $or: [
      { _id: a, blockedUsers: b },
      { _id: b, blockedUsers: a },
    ],
  })
  return count > 0
}

export function hasBlocked(user, targetId) {
  const target = idValue(targetId)
  return Boolean(target && (user?.blockedUsers || []).some(id => idValue(id) === target))
}

export async function breakUserRelations(aId, bId) {
  const a = idValue(aId)
  const b = idValue(bId)
  if (!a || !b || a === b) return

  await User.updateOne({ _id: a }, {
    $pull: {
      friends: b,
      'friendRequests.sent': b,
      'friendRequests.received': b,
      followers: b,
      following: b,
    },
  })
  await User.updateOne({ _id: b }, {
    $pull: {
      friends: a,
      'friendRequests.sent': a,
      'friendRequests.received': a,
      followers: a,
      following: a,
    },
  })
}
