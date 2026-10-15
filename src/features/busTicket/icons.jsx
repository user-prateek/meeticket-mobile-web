import busFront from '../../assets/bus-ticket/bus-front.png'
import busSide from '../../assets/bus-ticket/bus-side.png'
import pinMark from '../../assets/bus-ticket/pin.png'
import editMark from '../../assets/bus-ticket/edit.png'

export function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.2 5.2 8.4 12l6.8 6.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8.4 4.7h2l1 2.4-1.5 1.2a11.5 11.5 0 0 0 5.8 5.8l1.2-1.5 2.4 1v2c0 .6-.4 1.1-1 1.2A13.2 13.2 0 0 1 7.2 5.7c.1-.6.6-1 1.2-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PinIcon() {
  return <img className="bt-pin" src={pinMark} alt="" width="36" height="36" />
}

export function NamePencil() {
  return (
    <svg className="bt-name-pencil" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 16.5V20h3.5L18.8 8.7l-3.5-3.5L4 16.5Z"
        fill="none"
        stroke="#2eae4f"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 9 4.2-1.8 7-4.8 7-9V6l-7-3Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.5 12 2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5V7M16 3.5V7M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function PersonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 19c1.2-3 3.2-4.5 6-4.5S16.8 16 18 19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function IdIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="12" r="1.6" fill="currentColor" />
      <path d="M13 11h5M13 14h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function PencilIcon() {
  return <img className="bt-edit__icon" src={editMark} alt="" width="36" height="36" />
}

export function BusArt({ side = false }) {
  return (
    <img
      className={side ? 'bt-bus-art bt-bus-art--side' : 'bt-bus-art'}
      src={side ? busSide : busFront}
      alt=""
    />
  )
}
