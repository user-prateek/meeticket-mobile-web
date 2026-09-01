import QRCode from 'react-qr-code'

/** Scannable QR encoding a plain-text OTP / verification code (cab). */
export function OtpQrCode({ value, size = 200, className }) {
  const text = String(value || '').trim()
  if (!text) return null

  return (
    <QRCode
      value={text}
      size={size}
      className={className}
      bgColor="#ffffff"
      fgColor="#111111"
      level="M"
      aria-label={`QR code for PIN ${text}`}
    />
  )
}
