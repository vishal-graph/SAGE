import { useSigeStore } from '../../store/useSigeStore'
import { MaterialIcon } from '../ui/MaterialIcon'

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 active:scale-[0.98] ${
        checked ? 'bg-primary/10 text-primary' : 'hover:bg-white/50 text-on-surface'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <MaterialIcon name={icon} className="text-xl" filled={checked} />
        {label}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-gradient-to-r from-primary to-primary-container' : 'bg-surface-container-high'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}

export function LayerToggles() {
  const showGrid = useSigeStore((s) => s.showGrid)
  const showHeatmap = useSigeStore((s) => s.showHeatmap)
  const showCirculation = useSigeStore((s) => s.showCirculation)
  const showFloorPlanImage = useSigeStore((s) => s.showFloorPlanImage)
  const snapToGrid = useSigeStore((s) => s.snapToGrid)
  const setLayerFlags = useSigeStore((s) => s.setLayerFlags)
  const setSnapToGrid = useSigeStore((s) => s.setSnapToGrid)
  const setShowFloorPlanImage = useSigeStore((s) => s.setShowFloorPlanImage)

  return (
    <div className="space-y-1">
      <ToggleRow
        icon="image"
        label="Floor plan image"
        checked={showFloorPlanImage}
        onChange={setShowFloorPlanImage}
      />
      <ToggleRow
        icon="grid_view"
        label="Grid overlay"
        checked={showGrid}
        onChange={(v) => setLayerFlags({ showGrid: v })}
      />
      <ToggleRow
        icon="thermostat"
        label="Dead space heatmap"
        checked={showHeatmap}
        onChange={(v) => setLayerFlags({ showHeatmap: v })}
      />
      <ToggleRow
        icon="directions_walk"
        label="Circulation"
        checked={showCirculation}
        onChange={(v) => setLayerFlags({ showCirculation: v })}
      />
      <ToggleRow
        icon="ads_click"
        label="Snap to grid"
        checked={snapToGrid}
        onChange={setSnapToGrid}
      />
    </div>
  )
}
