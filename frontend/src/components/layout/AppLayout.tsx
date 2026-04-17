import type { ReactNode } from 'react'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-dvh w-full overflow-hidden spatial-grid-bg text-on-surface">
      {children}
    </div>
  )
}
