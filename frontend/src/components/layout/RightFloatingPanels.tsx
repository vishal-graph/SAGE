import { GeminiCleanPlanPanel } from '../Dashboard/GeminiCleanPlanPanel'
import { MetricsPanel } from '../Dashboard/MetricsPanel'
import { FurnitureLibrary } from '../Sidebar/FurnitureLibrary'
import { LayerToggles } from '../Sidebar/LayerToggles'
import { Floor3DInspectorPanel } from '../Floor3D/Floor3DInspectorPanel'
import { useSigeStore } from '../../store/useSigeStore'
import { FloatingPanelShell } from '../ui/FloatingPanelShell'
import { GlassCard } from '../ui/GlassCard'
import { PrimaryButton } from '../ui/PrimaryButton'
import { MaterialIcon } from '../ui/MaterialIcon'

export function RightFloatingPanels() {
  const openPanels = useSigeStore((s) => s.openPanels)
  const setPanelOpen = useSigeStore((s) => s.setPanelOpen)
  const selectedFurnitureId = useSigeStore((s) => s.selectedFurnitureId)
  const rotateFurniture = useSigeStore((s) => s.rotateFurniture)
  const floorViewMode = useSigeStore((s) => s.floorViewMode)

  return (
    <aside className="pointer-events-none fixed right-4 top-1/2 z-40 hidden w-80 max-w-[calc(100vw-5rem)] -translate-y-1/2 flex-col gap-3 lg:flex">
      {openPanels.metrics && (
        <GlassCard className="!overflow-hidden !p-0" hoverLift>
          <div className="flex items-center justify-between border-b border-outline-variant/10 px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface/40">
              Analysis
            </span>
            <button
              type="button"
              className="rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-white/50"
              onClick={() => setPanelOpen('metrics', false)}
              title="Hide panel"
            >
              <MaterialIcon name="close" className="text-lg" />
            </button>
          </div>
          <div className="space-y-6 p-4">
            <GeminiCleanPlanPanel />
            <MetricsPanel />
          </div>
        </GlassCard>
      )}

      {floorViewMode === '3d' && (
        <FloatingPanelShell title="3D scene" icon="view_in_ar" defaultCollapsed={false}>
          <Floor3DInspectorPanel />
        </FloatingPanelShell>
      )}

      {openPanels.library && (
        <FloatingPanelShell title="Furniture library" icon="chair" defaultCollapsed={false}>
          <div className="flex justify-end pb-2">
            <button
              type="button"
              className="text-[10px] font-bold uppercase tracking-widest text-on-surface/40 hover:text-primary"
              onClick={() => setPanelOpen('library', false)}
            >
              Hide
            </button>
          </div>
          <FurnitureLibrary />
        </FloatingPanelShell>
      )}

      {openPanels.view && (
        <FloatingPanelShell title="Canvas layers" icon="layers" defaultCollapsed>
          <div className="flex justify-end pb-2">
            <button
              type="button"
              className="text-[10px] font-bold uppercase tracking-widest text-on-surface/40 hover:text-primary"
              onClick={() => setPanelOpen('view', false)}
            >
              Hide
            </button>
          </div>
          <LayerToggles />
        </FloatingPanelShell>
      )}

      <GlassCard className="!p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">Shortcuts</p>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          Ctrl+Z / Ctrl+Y · R rotate · Del remove
        </p>
        <PrimaryButton
          className="mt-3 w-full !rounded-xl !py-2 !text-xs"
          disabled={!selectedFurnitureId}
          onClick={() => selectedFurnitureId && rotateFurniture(selectedFurnitureId)}
        >
          Rotate 90°
        </PrimaryButton>
      </GlassCard>
    </aside>
  )
}
