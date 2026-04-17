import { useSigeStore } from '../../store/useSigeStore'
import { MaterialIcon } from './MaterialIcon'

/** Full-canvas overlay while the clean floor plan image is generating. */
export function AiCleanPlanLoadingOverlay() {
  const loading = useSigeStore((s) => s.aiCleanPlanLoading)
  const imageUrl = useSigeStore((s) => s.imageUrl)

  if (!loading || !imageUrl) return null

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-white/55 backdrop-blur-md ring-1 ring-white/50"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-outline-variant/15 bg-white/85 px-8 py-7 text-center shadow-[var(--shadow-ambient-lg)]">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MaterialIcon name="auto_awesome" className="animate-pulse text-4xl" />
        </span>
        <div>
          <p className="text-base font-semibold tracking-tight text-on-surface">Generating clean plan</p>
          <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
            AI is redrawing walls and doors only. Large sheets can take a minute.
          </p>
        </div>
        <span className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-surface-container-high">
          <span className="block h-full w-1/3 rounded-full shimmer opacity-80" />
        </span>
      </div>
    </div>
  )
}
