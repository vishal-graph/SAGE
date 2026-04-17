import { useEffect, useMemo, useState } from 'react'
import { useSigeStore } from '../../store/useSigeStore'
import { furnitureCenterXZ, itemStateFromCenter, snapDimensionFt } from './worldFromFurniture'
import { getKenneyModelUrl } from './kenneyModelMap'
import { useKenneyGlbReachable } from './useKenneyGlbProbe'
import { furnitureItemSpanCells } from '../../utils/gridEngine'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'
import { MaterialIcon } from '../ui/MaterialIcon'

function SnapToggleRow({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
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
        <MaterialIcon name="grid_on" className="text-xl" filled={checked} />
        Snap to grid (2D & 3D drag)
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

export function Floor3DInspectorPanel() {
  const furniture = useSigeStore((s) => s.furniture)
  const selectedId = useSigeStore((s) => s.selectedFurnitureId)
  const gridSizeFt = useSigeStore((s) => s.gridSizeFt)
  const scale = useSigeStore((s) => s.scale)
  const snapToGrid = useSigeStore((s) => s.snapToGrid)
  const setSnapToGrid = useSigeStore((s) => s.setSnapToGrid)
  const updateFurniture = useSigeStore((s) => s.updateFurniture)
  const rotateFurniture = useSigeStore((s) => s.rotateFurniture)
  const removeFurniture = useSigeStore((s) => s.removeFurniture)
  const setSelected = useSigeStore((s) => s.setSelectedFurnitureId)

  const item = useMemo(
    () => (selectedId ? furniture.find((f) => f.id === selectedId) : undefined),
    [furniture, selectedId],
  )

  const pxPerFt = scale?.pxPerFt ?? null

  const [gx, setGx] = useState('0')
  const [gy, setGy] = useState('0')
  const [wStr, setWStr] = useState('0')
  const [dStr, setDStr] = useState('0')

  useEffect(() => {
    if (!item) return
    setGx(String(item.gridX))
    setGy(String(item.gridY))
    setWStr(String(item.widthFt))
    setDStr(String(item.depthFt))
  }, [item?.id, item?.gridX, item?.gridY, item?.widthFt, item?.depthFt, item?.rotation])

  const span = item ? furnitureItemSpanCells(item, gridSizeFt) : null
  const glbUrl = item ? getKenneyModelUrl(item.type) : undefined
  const kenneyReachable = useKenneyGlbReachable()

  const commitGrid = () => {
    if (!item) return
    const nx = Math.round(Number(gx))
    const ny = Math.round(Number(gy))
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return
    updateFurniture(item.id, { gridX: nx, gridY: ny, freeOffsetPx: [0, 0] })
  }

  const commitSize = () => {
    if (!item) return
    const w = snapDimensionFt(Number(wStr), gridSizeFt)
    const d = snapDimensionFt(Number(dStr), gridSizeFt)
    if (!Number.isFinite(w) || !Number.isFinite(d)) return
    const { x, z } = furnitureCenterXZ(item, gridSizeFt, pxPerFt)
    const draft = { ...item, widthFt: w, depthFt: d }
    const patch = itemStateFromCenter(draft, x, z, gridSizeFt)
    updateFurniture(item.id, { widthFt: w, depthFt: d, ...patch, freeOffsetPx: [0, 0] })
  }

  return (
    <div className="space-y-4">
      {kenneyReachable === 'no' && (
        <div className="rounded-xl border border-amber-300/80 bg-amber-50/95 px-3 py-2.5 text-xs leading-snug text-amber-950 shadow-sm">
          <p className="font-semibold text-amber-950">Kenney 3D meshes are not on disk</p>
          <p className="mt-1.5 text-amber-950/90">
            The app only finds <strong>.glb</strong> files inside{' '}
            <code className="rounded bg-white/70 px-1 py-0.5 text-[11px]">public/models/kenney/</code>. Right now
            that folder has no models (you’ll see blue footprint boxes instead). Download the free{' '}
            <a
              className="font-medium text-primary underline underline-offset-2"
              href="https://kenney.nl/assets/furniture-kit"
              target="_blank"
              rel="noreferrer"
            >
              Kenney Furniture Kit
            </a>
            , then copy the files listed in{' '}
            <code className="rounded bg-white/70 px-1 py-0.5 text-[11px]">public/models/kenney/README.md</code> from{' '}
            <code className="rounded bg-white/70 px-1 py-0.5 text-[11px]">Models/GLTF format</code> — use the{' '}
            <strong>exact filenames</strong> expected by <code className="text-[11px]">kenneyModelMap.ts</code>{' '}
            (e.g. <code className="text-[11px]">desk.glb</code>, <code className="text-[11px]">loungeSofa.glb</code>
            ). Restart dev server after copying if needed.
          </p>
        </div>
      )}

      <p className="text-xs leading-relaxed text-on-surface-variant">
        <strong className="text-on-surface">Orbit</strong> by dragging empty floor.{' '}
        <strong className="text-on-surface">Scroll</strong> to zoom.{' '}
        With <strong className="text-on-surface">Place</strong> + a library piece, <strong className="text-on-surface">click</strong>{' '}
        the floor to add. <strong className="text-on-surface">Drag</strong> a piece to move;{' '}
        <strong className="text-on-surface">edge handles</strong> resize (local axes). In 3D, pieces may{' '}
        <strong className="text-on-surface">overlap</strong> each other; moves that hit a wall or go off the plan are{' '}
        <strong className="text-on-surface">reverted</strong>. Size snaps to{' '}
        <strong className="text-on-surface">{gridSizeFt} ft</strong>; position follows the snap toggle below.
      </p>

      <SnapToggleRow checked={snapToGrid} onChange={setSnapToGrid} />

      {!item ? (
        <p className="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 px-3 py-2.5 text-xs text-on-surface-variant">
          No selection — click a furniture block in the 3D view.
        </p>
      ) : (
        <div className="space-y-3 rounded-xl border border-outline-variant/15 bg-white/40 p-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">Selected</p>
            <p className="mt-0.5 text-sm font-semibold text-on-surface">{item.label}</p>
            <p className="text-[11px] text-on-surface-variant">
              {item.type}
              {span && (
                <>
                  {' '}
                  · {span.wCells}×{span.hCells} cells ({span.wFt.toFixed(2)}×{span.hFt.toFixed(2)} ft)
                </>
              )}
            </p>
            <p className="mt-1 text-[11px] text-on-surface-variant/90">
              Mesh: {glbUrl ? <span className="text-emerald-700">Kenney GLB</span> : <span>Footprint box</span>}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                Grid X
              </label>
              <input
                type="number"
                step={1}
                value={gx}
                onChange={(e) => setGx(e.target.value)}
                onBlur={commitGrid}
                onKeyDown={(e) => e.key === 'Enter' && commitGrid()}
                className="glass-input w-full !py-2 !text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                Grid Y
              </label>
              <input
                type="number"
                step={1}
                value={gy}
                onChange={(e) => setGy(e.target.value)}
                onBlur={commitGrid}
                onKeyDown={(e) => e.key === 'Enter' && commitGrid()}
                className="glass-input w-full !py-2 !text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                Width (ft)
              </label>
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={wStr}
                onChange={(e) => setWStr(e.target.value)}
                onBlur={commitSize}
                onKeyDown={(e) => e.key === 'Enter' && commitSize()}
                className="glass-input w-full !py-2 !text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                Depth (ft)
              </label>
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={dStr}
                onChange={(e) => setDStr(e.target.value)}
                onBlur={commitSize}
                onKeyDown={(e) => e.key === 'Enter' && commitSize()}
                className="glass-input w-full !py-2 !text-sm"
              />
            </div>
          </div>

          <p className="text-[11px] text-on-surface-variant">
            Rotation: <strong className="text-on-surface">{item.rotation}°</strong> — handles stay on local width / depth
            axes.
          </p>

          <div className="flex flex-col gap-2 pt-1">
            <PrimaryButton type="button" className="!rounded-xl !py-2 !text-xs" onClick={() => rotateFurniture(item.id)}>
              Rotate 90°
            </PrimaryButton>
            <SecondaryButton
              type="button"
              className="!rounded-xl !py-2 !text-xs"
              onClick={() => {
                removeFurniture(item.id)
                setSelected(null)
              }}
            >
              Remove from plan
            </SecondaryButton>
          </div>
        </div>
      )}
    </div>
  )
}
