import metroPng from '../assets/icons/metro.png'
import busPng from '../assets/icons/bus.png'
import walkPng from '../assets/icons/walk.png'

export function BackIcon({ size = 22, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15.5 5.5 8.5 12l7 6.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Three descending lines — Sort By control. */
export function SortIcon({ size = 16, color = 'currentColor', className, style, ...rest }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ color, ...style }}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d="M4 7h16M4 12h11M4 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const MODE_PNG = {
  metro: metroPng,
  bus: busPng,
  walk: walkPng,
}

/** White metro glyph for dark capsules (no circular plate). */
export function MetroGlyph({ size = 14, className, style, ...rest }) {
  return (
    <SvgIcon size={size} color="currentColor" className={className} style={style} viewBox="0 0 12 14" {...rest}>
      <path d="M1.5 14V13.2632L2.625 12.5263C1.8875 12.5263 1.26562 12.2776 0.759375 11.7803C0.253125 11.2829 0 10.6719 0 9.94737V2.94737C0 1.92807 0.48125 1.18202 1.44375 0.709211C2.40625 0.236404 3.925 0 6 0C8.15 0 9.6875 0.227193 10.6125 0.681579C11.5375 1.13596 12 1.89123 12 2.94737V9.94737C12 10.6719 11.7469 11.2829 11.2406 11.7803C10.7344 12.2776 10.1125 12.5263 9.375 12.5263L10.5 13.2632V14H1.5ZM1.5 5.89474H10.5V3.68421H1.5V5.89474ZM6.79688 9.99342C7.01562 9.77851 7.125 9.51754 7.125 9.21053C7.125 8.90351 7.01562 8.64254 6.79688 8.42763C6.57812 8.21272 6.3125 8.10526 6 8.10526C5.6875 8.10526 5.42188 8.21272 5.20312 8.42763C4.98438 8.64254 4.875 8.90351 4.875 9.21053C4.875 9.51754 4.98438 9.77851 5.20312 9.99342C5.42188 10.2083 5.6875 10.3158 6 10.3158C6.3125 10.3158 6.57812 10.2083 6.79688 9.99342Z" fill="currentColor"/>
    </SvgIcon>
  )
}

/** White bus glyph for dark capsules. */
export function BusGlyph({ size = 14, className, style, ...rest }) {
  return (
    <SvgIcon size={size} color="currentColor" className={className} style={style} viewBox="0 0 14 14" {...rest}>
      <path
        fill="currentColor"
        d="M2.5 1.5h9c.83 0 1.5.67 1.5 1.5v6.5c0 .83-.67 1.5-1.5 1.5h-.4l.4 1.5h-1.5l-.35-1.5H4.35L4 12.5H2.5l.4-1.5H2.5c-.83 0-1.5-.67-1.5-1.5V3c0-.83.67-1.5 1.5-1.5Zm1 2v3h7v-3h-7Zm1.15 4.75a.85.85 0 1 0 0 1.7.85.85 0 0 0 0-1.7Zm5.7 0a.85.85 0 1 0 0 1.7.85.85 0 0 0 0-1.7Z"
      />
    </SvgIcon>
  )
}

export function MetroIcon({ size = 36, className }) {
  return <ModePng mode="metro" size={size} className={className} />
}

export function BusIcon({ size = 36, className }) {
  return <ModePng mode="bus" size={size} className={className} />
}

export function WalkIcon({ size = 36, className }) {
  return <ModePng mode="walk" size={size} className={className} />
}

function ModePng({ mode, size = 36, className }) {
  return (
    <img
      className={className}
      src={MODE_PNG[mode]}
      alt=""
      width={size}
      height={size}
      draggable={false}
    />
  )
}

function SvgIcon({
  size = 20,
  color = '#666666',
  className,
  style,
  viewBox = '0 0 20 20',
  children,
  ...rest
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={color === 'currentColor' ? style : { color, ...style }}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

/** Cab / taxi — Figma export (20×20). */
export function CabIcon({ size = 20, color = '#666666', className, style, ...rest }) {
  return (
    <SvgIcon size={size} color={color} className={className} style={style} {...rest}>
      <path
        d="M5 15.8333V16.6667C5 16.9028 4.92014 17.1007 4.76042 17.2604C4.60069 17.4201 4.40278 17.5 4.16667 17.5H3.33333C3.09722 17.5 2.89931 17.4201 2.73958 17.2604C2.57986 17.1007 2.5 16.9028 2.5 16.6667V10L4.25 5C4.33333 4.75 4.48264 4.54861 4.69792 4.39583C4.91319 4.24306 5.15278 4.16667 5.41667 4.16667H7.5V2.5H12.5V4.16667H14.5833C14.8472 4.16667 15.0868 4.24306 15.3021 4.39583C15.5174 4.54861 15.6667 4.75 15.75 5L17.5 10V16.6667C17.5 16.9028 17.4201 17.1007 17.2604 17.2604C17.1007 17.4201 16.9028 17.5 16.6667 17.5H15.8333C15.5972 17.5 15.3993 17.4201 15.2396 17.2604C15.0799 17.1007 15 16.9028 15 16.6667V15.8333H5ZM4.83333 8.33333H15.1667L14.2917 5.83333H5.70833L4.83333 8.33333ZM6.25 13.3333C6.59722 13.3333 6.89236 13.2118 7.13542 12.9688C7.37847 12.7257 7.5 12.4306 7.5 12.0833C7.5 11.7361 7.37847 11.441 7.13542 11.1979C6.89236 10.9549 6.59722 10.8333 6.25 10.8333C5.90278 10.8333 5.60764 10.9549 5.36458 11.1979C5.12153 11.441 5 11.7361 5 12.0833C5 12.4306 5.12153 12.7257 5.36458 12.9688C5.60764 13.2118 5.90278 13.3333 6.25 13.3333ZM13.75 13.3333C14.0972 13.3333 14.3924 13.2118 14.6354 12.9688C14.8785 12.7257 15 12.4306 15 12.0833C15 11.7361 14.8785 11.441 14.6354 11.1979C14.3924 10.9549 14.0972 10.8333 13.75 10.8333C13.4028 10.8333 13.1076 10.9549 12.8646 11.1979C12.6215 11.441 12.5 11.7361 12.5 12.0833C12.5 12.4306 12.6215 12.7257 12.8646 12.9688C13.1076 13.2118 13.4028 13.3333 13.75 13.3333Z"
        fill="currentColor"
      />
    </SvgIcon>
  )
}

/** Auto-rickshaw — Figma export (20×20). */
export function AutoIcon({ size = 20, color = '#666666', className, style, ...rest }) {
  return (
    <SvgIcon size={size} color={color} className={className} style={style} {...rest}>
      <path
        d="M4.54545 17C3.95455 17 3.42803 16.8259 2.96591 16.4777C2.50379 16.1295 2.18182 15.6845 2 15.1429H1.81818C1.31818 15.1429 0.890151 14.961 0.534091 14.5973C0.17803 14.2336 0 13.7964 0 13.2857V5.85714C0 5.34643 0.17803 4.90923 0.534091 4.54554C0.890151 4.18185 1.31818 4 1.81818 4H12.7727C13.0455 4 13.303 4.05417 13.5455 4.1625C13.7879 4.27083 14 4.43333 14.1818 4.65L17.7727 9.06071C17.9091 9.23095 18.0114 9.4128 18.0795 9.60625C18.1477 9.7997 18.1818 10.0048 18.1818 10.2214V11.5679C18.7121 11.7536 19.1477 12.0902 19.4886 12.5777C19.8295 13.0652 20 13.6107 20 14.2143C20 14.9881 19.7348 15.6458 19.2045 16.1875C18.6742 16.7292 18.0303 17 17.2727 17C16.6818 17 16.1477 16.8259 15.6705 16.4777C15.1932 16.1295 14.8636 15.6845 14.6818 15.1429H7.13636C6.92424 15.6845 6.58712 16.1295 6.125 16.4777C5.66288 16.8259 5.13636 17 4.54545 17ZM1.81818 8.64286H5.45455V5.85714H1.81818V8.64286ZM7.27273 13.2857H11.8182V5.85714H7.27273V8.64286H10V10.5H7.27273V13.2857ZM13.6364 9.57143H15.8182L13.6364 6.87857V9.57143ZM5.19318 14.8759C5.36742 14.6979 5.45455 14.4774 5.45455 14.2143C5.45455 13.9512 5.36742 13.7307 5.19318 13.5527C5.01894 13.3747 4.80303 13.2857 4.54545 13.2857C4.28788 13.2857 4.07197 13.3747 3.89773 13.5527C3.72348 13.7307 3.63636 13.9512 3.63636 14.2143C3.63636 14.4774 3.72348 14.6979 3.89773 14.8759C4.07197 15.0539 4.28788 15.1429 4.54545 15.1429C4.80303 15.1429 5.01894 15.0539 5.19318 14.8759ZM17.9205 14.8759C18.0947 14.6979 18.1818 14.4774 18.1818 14.2143C18.1818 13.9512 18.0947 13.7307 17.9205 13.5527C17.7462 13.3747 17.5303 13.2857 17.2727 13.2857C17.0152 13.2857 16.7992 13.3747 16.625 13.5527C16.4508 13.7307 16.3636 13.9512 16.3636 14.2143C16.3636 14.4774 16.4508 14.6979 16.625 14.8759C16.7992 15.0539 17.0152 15.1429 17.2727 15.1429C17.5303 15.1429 17.7462 15.0539 17.9205 14.8759Z"
        fill="currentColor"
      />
    </SvgIcon>
  )
}

/** Bike / motorcycle — Figma export (20×20). */
export function BikeIcon({ size = 20, color = '#666666', className, style, ...rest }) {
  return (
    <SvgIcon size={size} color={color} className={className} style={style} {...rest}>
      <path
        d="M4.16667 15.8337C3.01389 15.8337 2.03125 15.4274 1.21875 14.6149C0.40625 13.8024 0 12.8198 0 11.667C0 10.5142 0.40625 9.53158 1.21875 8.71908C2.03125 7.90658 3.01389 7.50033 4.16667 7.50033H13.8333L12.1667 5.83366H9.16667V4.16699H12.1458C12.3681 4.16699 12.5799 4.20866 12.7812 4.29199C12.9826 4.37533 13.1597 4.49338 13.3125 4.64616L16.2083 7.54199C17.2917 7.62533 18.1944 8.06283 18.9167 8.85449C19.6389 9.64616 20 10.5837 20 11.667C20 12.8198 19.5938 13.8024 18.7812 14.6149C17.9688 15.4274 16.9861 15.8337 15.8333 15.8337C14.6806 15.8337 13.6979 15.4274 12.8854 14.6149C12.0729 13.8024 11.6667 12.8198 11.6667 11.667C11.6667 11.417 11.684 11.1705 11.7188 10.9274C11.7535 10.6844 11.8194 10.4448 11.9167 10.2087L9.625 12.5003H8.25C8.05556 13.4725 7.57639 14.2712 6.8125 14.8962C6.04861 15.5212 5.16667 15.8337 4.16667 15.8337ZM15.8333 14.167C16.5278 14.167 17.1181 13.9239 17.6042 13.4378C18.0903 12.9517 18.3333 12.3614 18.3333 11.667C18.3333 10.9725 18.0903 10.3823 17.6042 9.89616C17.1181 9.41005 16.5278 9.16699 15.8333 9.16699C15.1389 9.16699 14.5486 9.41005 14.0625 9.89616C13.5764 10.3823 13.3333 10.9725 13.3333 11.667C13.3333 12.3614 13.5764 12.9517 14.0625 13.4378C14.5486 13.9239 15.1389 14.167 15.8333 14.167ZM4.16667 14.167C4.69444 14.167 5.17014 14.0142 5.59375 13.7087C6.01736 13.4031 6.31944 13.0003 6.5 12.5003H4.16667V10.8337H6.5C6.31944 10.3337 6.01736 9.93088 5.59375 9.62533C5.17014 9.31977 4.69444 9.16699 4.16667 9.16699C3.47222 9.16699 2.88194 9.41005 2.39583 9.89616C1.90972 10.3823 1.66667 10.9725 1.66667 11.667C1.66667 12.3614 1.90972 12.9517 2.39583 13.4378C2.88194 13.9239 3.47222 14.167 4.16667 14.167Z"
        fill="currentColor"
      />
    </SvgIcon>
  )
}

const MODE_ICONS = {
  metro: MetroIcon,
  bus: BusIcon,
  walk: WalkIcon,
  cab: CabIcon,
  auto: AutoIcon,
  bike: BikeIcon,
}

const MODE_PNG_KEYS = new Set(['metro', 'bus', 'walk'])

export function PhoneIcon({ size = 22, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.2 3.8h3.2l1.2 3.2-1.8 1.2a12.5 12.5 0 0 0 6 6l1.2-1.8 3.2 1.2v3.2c0 .9-.7 1.7-1.6 1.8C9.8 19.4 4.6 14.2 3.4 5.4c-.1-.9.7-1.6 1.6-1.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CashIcon({ size = 22, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#0fa146" />
      <rect x="5" y="8" width="14" height="8" rx="1.4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.5" fill="#fff" />
    </svg>
  )
}

export function AppLogo({ size = 36, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="18" fill="#060496" />
      <circle cx="14" cy="16" r="7" fill="#0fa146" />
      <circle cx="22" cy="16" r="7" fill="#3d5bff" />
      <path d="M18 11.5v14" stroke="#fff" strokeWidth="1.6" />
    </svg>
  )
}

export function PinIcon({ size = 16, color = 'currentColor', className, style, ...rest }) {
  return (
    <SvgIcon size={size} color={color} className={className} style={style} viewBox="0 0 16 16" {...rest}>
      <path
        fill="currentColor"
        d="M8 1.2A4.4 4.4 0 0 0 3.6 5.6C3.6 8.7 8 14.8 8 14.8s4.4-6.1 4.4-9.2A4.4 4.4 0 0 0 8 1.2Zm0 6.2A1.8 1.8 0 1 1 8 3.8a1.8 1.8 0 0 1 0 3.6Z"
      />
    </SvgIcon>
  )
}

export function ClockIcon({ size = 16, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4.2l2.8 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronIcon({ size = 16, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 5.5 16 12l-7 6.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CloseIcon({ size = 20, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 7l10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function PencilIcon({ size = 14, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14.2 5.2 18.8 9.8M4 20l4.2-.7L19.5 8 15 3.5 3.7 14.8 3 19.1 4 20Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Metro train change / interchange (not a walk). */
export function InterchangeIcon({ size = 36, className, style, ...rest }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      aria-hidden="true"
      {...rest}
    >
      <rect width="36" height="36" rx="18" fill="white" />
      <rect
        x="0.9"
        y="0.9"
        width="34.2"
        height="34.2"
        rx="17.1"
        stroke="black"
        strokeOpacity="0.2"
        strokeWidth="1.8"
      />
      <path
        d="M11.4 27L7 22.4667L8.54 20.8233L10.3 22.6367V14.5333C10.3 13.2867 10.7308 12.2194 11.5925 11.3317C12.4542 10.4439 13.49 10 14.7 10C15.91 10 16.9458 10.4439 17.8075 11.3317C18.6692 12.2194 19.1 13.2867 19.1 14.5333V22.4667C19.1 23.09 19.3154 23.6236 19.7463 24.0675C20.1771 24.5114 20.695 24.7333 21.3 24.7333C21.905 24.7333 22.4229 24.5114 22.8538 24.0675C23.2846 23.6236 23.5 23.09 23.5 22.4667V14.3633L21.74 16.1767L20.2 14.5333L24.6 10L29 14.5333L27.46 16.1767L25.7 14.3633V22.4667C25.7 23.7133 25.2692 24.7806 24.4075 25.6683C23.5458 26.5561 22.51 27 21.3 27C20.09 27 19.0542 26.5561 18.1925 25.6683C17.3308 24.7806 16.9 23.7133 16.9 22.4667V14.5333C16.9 13.91 16.6846 13.3764 16.2537 12.9325C15.8229 12.4886 15.305 12.2667 14.7 12.2667C14.095 12.2667 13.5771 12.4886 13.1462 12.9325C12.7154 13.3764 12.5 13.91 12.5 14.5333V22.6367L14.26 20.8233L15.8 22.4667L11.4 27Z"
        fill="#1F1F1F"
      />
    </svg>
  )
}

export function ModeIcon({ mode, size, color, className, style }) {
  if (mode === 'interchange') {
    return (
      <InterchangeIcon
        size={size ?? 36}
        className={className}
        style={style}
      />
    )
  }

  if (MODE_PNG_KEYS.has(mode)) {
    return <ModePng mode={mode} size={size ?? 36} className={className} />
  }

  const Icon = MODE_ICONS[mode]
  if (!Icon) return null

  return (
    <Icon
      size={size ?? 20}
      color={color ?? 'currentColor'}
      className={className}
      style={style}
    />
  )
}
