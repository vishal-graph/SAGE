import type { ReactNode } from 'react'
import { useSigeStore } from '../../store/useSigeStore'
import type { PanelKey } from '../../store/useSigeStore'
import { MaterialIcon } from '../ui/MaterialIcon'
import { SecondaryButton } from '../ui/SecondaryButton'

interface BottomHUDProps {
  gridSizeFt: number
  minPathWidthFt: number
  onGridSizeChange: (v: number) => void
  onMinPathChange: (v: number) => void
  roomToolExtras?: ReactNode
  onResetView?: () => void
  onOpenMobilePanels?: () => void
}

export function BottomHUD({
  gridSizeFt,
  minPathWidthFt,
  onGridSizeChange,
  onMinPathChange,
  roomToolExtras,
  onResetView,
  onOpenMobilePanels,
}: BottomHUDProps) {
  const openPanels = useSigeStore((s) => s.openPanels)
  const setPanelOpen = useSigeStore((s) => s.setPanelOpen)

  const pin = (key: PanelKey, icon: string, label: string) => (
    <button
      type="button"
      title={label}
      onClick={() => setPanelOpen(key, true)}
      className={`inline-flex items-center justify-center rounded-xl p-2 transition-all duration-200 active:scale-95 ${
        openPanels[key] ? 'hidden' : 'bg-white/50 text-primary hover:bg-white/80'
      }`}
    >
      <MaterialIcon name={icon} className="text-xl" />
    </button>
  )

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-4">
      <div
        className="pointer-events-auto flex max-w-4xl flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/25 bg-white/55 px-4 py-3 shadow-[var(--shadow-ambient-lg)] backdrop-blur-[30px]"
        style={{
          borderTopColor: 'color-mix(in srgb, var(--color-outline-variant) 15%, transparent)',
        }}
      >
        <div className="hidden items-center gap-1 lg:flex">
          {pin('metrics', 'analytics', 'Show analysis')}
          {pin('library', 'chair', 'Show library')}
          {pin('view', 'layers', 'Show layers')}
        </div>
        <div className="hidden h-8 w-px bg-outline-variant/20 lg:block" aria-hidden />

        <div className="flex items-center gap-2">
          <MaterialIcon name="grid_4x4" className="text-on-surface-variant text-lg" />
          <label className="flex items-center gap-2 text-xs font-medium text-on-surface/70">
            <span className="hidden sm:inline">Grid (ft)</span>
            <input
              type="number"
              min={0.25}
              step={0.25}
              value={gridSizeFt}
              onChange={(e) => onGridSizeChange(Number(e.target.value))}
              className="glass-input w-20 py-2 text-sm"
            />
          </label>
        </div>
        <div className="h-8 w-px bg-outline-variant/20" aria-hidden />
        <div className="flex items-center gap-2">
          <MaterialIcon name="straighten" className="text-on-surface-variant text-lg" />
          <label className="flex items-center gap-2 text-xs font-medium text-on-surface/70">
            <span className="hidden sm:inline">Min path</span>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={minPathWidthFt}
              onChange={(e) => onMinPathChange(Number(e.target.value))}
              className="glass-input w-20 py-2 text-sm"
            />
          </label>
        </div>
        {roomToolExtras && (
          <>
            <div className="h-8 w-px bg-outline-variant/20" aria-hidden />
            {roomToolExtras}
          </>
        )}
        <div className="h-8 w-px bg-outline-variant/20" aria-hidden />
        {onResetView && (
          <SecondaryButton type="button" className="!gap-1 !text-xs" onClick={onResetView}>
            <MaterialIcon name="restart_alt" className="!text-lg" />
            Reset view
          </SecondaryButton>
        )}
        {onOpenMobilePanels && (
          <SecondaryButton type="button" className="!text-xs lg:hidden" onClick={onOpenMobilePanels}>
            Panels
          </SecondaryButton>
        )}
      </div>
    </div>
  )
}
