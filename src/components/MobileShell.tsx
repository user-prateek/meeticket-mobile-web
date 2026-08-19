import type { ReactNode } from 'react'
import './MobileShell.css'

type MobileShellProps = {
  children: ReactNode
}

export function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="mt-shell-wrap">
      <div className="mt-shell">{children}</div>
    </div>
  )
}
