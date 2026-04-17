import { useAnalysisActions } from '../../context/AnalysisActionsContext'
import { PrimaryButton } from '../ui/PrimaryButton'
import { MaterialIcon } from '../ui/MaterialIcon'

/** Toolbar primaries: no shadow (avoids blue glow painting over the center title) */
const btn =
  '!h-9 !min-h-9 !max-h-9 !shrink-0 !rounded-lg !px-2 !py-0 !text-[11px] !font-semibold !leading-none !gap-1 !shadow-none !ring-0 hover:!translate-y-0 hover:!shadow-none active:!scale-[0.98] active:!shadow-none focus-visible:!shadow-none'

export function AnalysisTopBarButtons() {
  const {
    runCleanPlan,
    runMetrics,
    imageUrl,
    aiCleanPlanLoading,
    metricsLoading,
    hasDerivedGrid,
  } = useAnalysisActions()

  return (
    <div className="hidden h-9 shrink-0 items-center gap-1 sm:flex">
      <PrimaryButton
        type="button"
        className={`${btn} inline-flex`}
        disabled={!imageUrl || aiCleanPlanLoading}
        onClick={() => void runCleanPlan()}
        title="Generate clean floor plan (Gemini)"
      >
        {aiCleanPlanLoading ? (
          <span className="flex max-w-[5.5rem] items-center gap-1">
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full shimmer opacity-60" />
            <span className="text-[10px] opacity-90">…</span>
          </span>
        ) : (
          <>
            <MaterialIcon name="image" className="!text-lg leading-none" />
            <span className="hidden min-[1100px]:inline">Clean plan</span>
            <span className="min-[1100px]:hidden">Clean</span>
          </>
        )}
      </PrimaryButton>
      <PrimaryButton
        type="button"
        className={`${btn} inline-flex`}
        disabled={!hasDerivedGrid || metricsLoading}
        onClick={() => void runMetrics()}
        title="Compute layout metrics"
      >
        {metricsLoading ? (
          <span className="flex max-w-[5.5rem] items-center gap-1">
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full shimmer opacity-60" />
            <span className="text-[10px] opacity-90">…</span>
          </span>
        ) : (
          'Metrics'
        )}
      </PrimaryButton>
    </div>
  )
}
