import './MobileShell.css'

export function MobileShell({ children }) {
  return (
    <div className="mt-shell-wrap">
      <div className="mt-shell">{children}</div>
    </div>
  )
}
