const KEY = 'mt:bus-ticket:draft'

export function saveBusTicketDraft(draft) {
  if (typeof sessionStorage === 'undefined') return draft
  sessionStorage.setItem(KEY, JSON.stringify(draft))
  return draft
}

export function loadBusTicketDraft() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function loadBusTicketByOrder(orderId) {
  if (!orderId) return null
  const draft = loadBusTicketDraft()
  if (!draft) return null
  return String(draft.orderId || '') === String(orderId) ? draft : null
}

export function patchBusTicketDraft(patch) {
  const prev = loadBusTicketDraft() || {}
  return saveBusTicketDraft({ ...prev, ...patch })
}
