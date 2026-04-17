import type { ReactNode } from 'react'

export function GlassCard({
  children,
  className = '',
  hoverLift = true,
}: {
  children: ReactNode
  className?: string
  hoverLift?: boolean
}) {
  return (
    <div
      className={`floating-card pointer-events-auto p-5 transition-all duration-300 ease-in-out ${
        hoverLift ? 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-ambient-lg)]' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
