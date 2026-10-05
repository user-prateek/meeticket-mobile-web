const STORAGE_KEY = 'mt:metro-pass:v1'

export const METRO_PASS_PRICE_INR = 150

export const ID_PROOF_TYPES = [
  { id: 'aadhar', label: 'Aadhar' },
  { id: 'pan', label: 'PAN Card' },
  { id: 'dl', label: 'Driving licence' },
  { id: 'voter', label: 'Voter ID Card' },
  { id: 'passport', label: 'Passport' },
]

export const METRO_PASS_TERMS = [
  'The Metro Pass is issued only to the registered pass holder and is non-transferable.',
  'The passenger must carry the valid Metro Pass while travelling and present it when requested by Metro officials.',
  'The passenger details and ID proof submitted during registration must be accurate and valid.',
  'The pass is valid only for the period and travel conditions specified at the time of purchase.',
  'The pass must not be altered, copied, tampered with, or used by another person.',
  'Pass holders must follow all Hyderabad Metro Rail safety, security and travel regulations.',
  'Misuse, fraudulent use, or use of incorrect information may result in cancellation of the pass and applicable penalties.',
  'Refunds, cancellations and replacement of passes are subject to the applicable Hyderabad Metro Rail rules.',
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatPassDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`
}

export function formatPassCardDate(value) {
  return formatPassDate(value).toUpperCase()
}

export function maskIdProof(value) {
  const raw = String(value || '').replace(/\s/g, '')
  if (!raw) return ''
  if (raw.length <= 4) return raw
  const visible = raw.slice(-4)
  return `${'X'.repeat(Math.max(8, raw.length - 4))}${visible}`
}

export function idProofLabel(id) {
  return ID_PROOF_TYPES.find((item) => item.id === id)?.label || 'ID Proof'
}

export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

export function loadMetroPass() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveMetroPass(pass) {
  if (typeof sessionStorage === 'undefined') return pass
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pass))
  return pass
}

export function issueMetroPass(form) {
  const now = new Date()
  const validTill = new Date(now)
  validTill.setMonth(validTill.getMonth() + 1)
  const pass = {
    fullName: String(form.fullName || '').trim(),
    mobile: digitsOnly(form.mobile).slice(-10),
    idProofType: form.idProofType,
    idProofNumber: String(form.idProofNumber || '').trim(),
    photoName: form.photoName || '',
    photoUrl: form.photoUrl || '',
    passNumber: `APST${String(Math.floor(100000 + Math.random() * 900000))}`,
    issuer: 'Hyderabad Metro Rail Limited: HMRL',
    priceInr: METRO_PASS_PRICE_INR,
    issuedAt: now.toISOString(),
    validTill: validTill.toISOString(),
  }
  return saveMetroPass(pass)
}
