export const draftKey = (userId) => `gg-tournament-draft-v1:${userId}`
export const reminderKey = (userId) => `gg-tournament-reminder-v1:${userId}`
export const DRAFT_EVENT = 'gg:tournament-draft'

export function readDraft(userId) {
  try {
    const data = JSON.parse(localStorage.getItem(draftKey(userId)))
    return data?.form && data?.creationKey && Number.isInteger(data.step) && data.step >= 0 && data.step < 6 ? data : null
  } catch { return null }
}

export function writeDraft(userId, data) {
  localStorage.setItem(draftKey(userId), JSON.stringify(data))
  window.dispatchEvent(new Event(DRAFT_EVENT))
}

export function clearDraft(userId) {
  localStorage.removeItem(draftKey(userId))
  localStorage.removeItem(reminderKey(userId))
  window.dispatchEvent(new Event(DRAFT_EVENT))
}

