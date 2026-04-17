import type { ReactNode } from 'react'
import { MaterialIcon } from './MaterialIcon'

export function ModalWrapper({
  open,
  onClose,
  title,
  icon,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  icon?: string
  children: ReactNode
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-on-surface/15 backdrop-blur-md px-4"
      role="dialog"
      aria-modal
      aria-labelledby="modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="document"
        className="animate-glass-in relative z-10 w-full max-w-md rounded-2xl p-8 opacity-100 shadow-[var(--shadow-ambient-lg)] glass-panel ring-1 ring-black/[0.04]"
        style={{ border: '1px solid color-mix(in srgb, white 45%, transparent)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center gap-3">
          {icon && (
            <div className="rounded-xl bg-primary/10 p-2.5">
              <MaterialIcon name={icon} className="text-primary text-2xl" filled />
            </div>
          )}
          <h2 id="modal-title" className="text-xl font-semibold tracking-tight text-on-surface">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </div>
  )
}
