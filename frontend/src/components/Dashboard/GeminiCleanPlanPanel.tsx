import { useAnalysisActions } from '../../context/AnalysisActionsContext'
import { PrimaryButton } from '../ui/PrimaryButton'
import { MaterialIcon } from '../ui/MaterialIcon'

export function GeminiCleanPlanPanel() {
  const { cleanError, cleanHint, runCleanPlan, imageUrl, aiCleanPlanLoading } = useAnalysisActions()

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">
        AI · clean floor plan
      </p>
      <p className="text-xs leading-relaxed text-on-surface-variant">
        <span className="hidden sm:inline">
          Sends your plan to the backend; Gemini redraws it to match the layout with only structural walls and door
          openings. Furniture, text, and dimensions are removed. Geometry is approximate. Use{' '}
          <span className="font-semibold text-on-surface/70">Clean plan</span> in the top bar to run it.
        </span>
        <span className="sm:hidden">
          Sends your plan to the backend; Gemini redraws walls and door openings only. Furniture and labels are removed.
        </span>
      </p>
      <PrimaryButton
        className="w-full !rounded-xl !py-3 !text-sm sm:hidden"
        disabled={!imageUrl || aiCleanPlanLoading}
        onClick={() => void runCleanPlan()}
      >
        {aiCleanPlanLoading ? (
          <span className="flex w-full items-center justify-center gap-2">
            <span className="h-4 max-w-[100px] flex-1 overflow-hidden rounded-full shimmer opacity-60" />
            Generating…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <MaterialIcon name="image" className="text-xl" />
            Generate clean plan
          </span>
        )}
      </PrimaryButton>
      {cleanError && (
        <p className="rounded-xl bg-error/10 px-3 py-2 text-xs font-medium text-error">{cleanError}</p>
      )}
      {cleanHint && !cleanError && (
        <p className="rounded-xl bg-primary/8 px-3 py-2 text-xs leading-relaxed text-on-surface-variant">{cleanHint}</p>
      )}
      <p className="text-[10px] leading-relaxed text-on-surface/40">
        Requires <code className="rounded bg-surface-container-high px-1">GEMINI_API_KEY</code> in{' '}
        <code className="rounded bg-surface-container-high px-1">backend/.env</code>. Image model:{' '}
        <code className="rounded bg-surface-container-high px-1">GEMINI_IMAGE_MODEL</code> (default{' '}
        <code className="rounded bg-surface-container-high px-1">gemini-3.1-flash-image-preview</code>). Restart uvicorn
        after changes.
      </p>
    </div>
  )
}
