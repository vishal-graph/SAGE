import { useState, type ReactNode } from 'react'
import { MaterialIcon } from './MaterialIcon'

export function FloatingPanelShell({
  title,
  icon,
  defaultCollapsed = false,
  children,
  className = '',
}: {
  title: string
  icon?: string
  defaultCollapsed?: boolean
  children: ReactNode
  className?: string
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  return (
    <div
      className={`floating-card pointer-events-auto overflow-hidden transition-all duration-300 ease-out ${className}`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-white/30"
      >
        <span className="flex items-center gap-2">
          {icon && <MaterialIcon name={icon} className="text-on-surface-variant text-lg" />}
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface/50">{title}</span>
        </span>
        <MaterialIcon
          name="expand_more"
          className={`text-on-surface-variant transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="max-h-[min(70vh,520px)] overflow-y-auto px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
