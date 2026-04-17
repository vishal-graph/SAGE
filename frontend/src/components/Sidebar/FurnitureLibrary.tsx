import { useMemo, useState } from 'react'
import { useSigeStore } from '../../store/useSigeStore'
import { FURNITURE_PRESETS_3D, createCustomFurniture } from '../../utils/furnitureLib'
import { useDerivedGrid } from '../../hooks/useDerivedGrid'
import { dimsSpanCells, isPlacementValid } from '../../utils/gridEngine'
import { SecondaryButton } from '../ui/SecondaryButton'
import { MaterialIcon } from '../ui/MaterialIcon'

const CATEGORIES = [
  'All',
  'Seating',
  'Sleep',
  'Work',
  'Dining',
  'Storage',
  'Living',
  'Kitchen',
  'Bath',
  'Laundry',
] as const

export function FurnitureLibrary() {
  const setPendingPreset = useSigeStore((s) => s.setPendingPreset)
  const setTool = useSigeStore((s) => s.setTool)
  const addFurniture = useSigeStore((s) => s.addFurniture)
  const gridSizeFt = useSigeStore((s) => s.gridSizeFt)
  const scale = useSigeStore((s) => s.scale)
  const rooms = useSigeStore((s) => s.rooms)
  const walls = useSigeStore((s) => s.walls)
  const furniture = useSigeStore((s) => s.furniture)
  const imageNaturalWidth = useSigeStore((s) => s.imageNaturalWidth)
  const imageNaturalHeight = useSigeStore((s) => s.imageNaturalHeight)

  const derived = useDerivedGrid()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All')
  const [label, setLabel] = useState('Custom')
  const [wFt, setWFt] = useState(3)
  const [dFt, setDFt] = useState(2)

  const gridInputs =
    scale?.pxPerFt && derived
      ? {
          imageWidthPx: imageNaturalWidth,
          imageHeightPx: imageNaturalHeight,
          pxPerFt: scale.pxPerFt,
          gridSizeFt,
          rooms,
          walls,
          furniture,
        }
      : null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return FURNITURE_PRESETS_3D.filter((p) => {
      if (category !== 'All' && p.category !== category) return false
      if (!q) return true
      return p.label.toLowerCase().includes(q) || p.type.toLowerCase().includes(q)
    })
  }, [search, category])

  const customCells = useMemo(() => {
    if (!scale) return null
    return dimsSpanCells(wFt, dFt, gridSizeFt)
  }, [scale, wFt, dFt, gridSizeFt])

  const placeCenter = () => {
    if (!derived || !gridInputs) return
    const c = Math.max(0, Math.floor(derived.cols / 2) - 1)
    const r = Math.max(0, Math.floor(derived.rows / 2) - 1)
    const item = createCustomFurniture(label, wFt, dFt, c, r)
    if (isPlacementValid(item, null, gridInputs)) addFurniture(item)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-on-surface-variant">
        Listed pieces have a <strong className="text-on-surface">3D model</strong> (Kenney kit). Each has a{' '}
        <strong className="text-on-surface">size in feet</strong> mapped to{' '}
        <strong className="text-on-surface">grid cells</strong> via <strong className="text-on-surface">Grid (ft)</strong>{' '}
        (e.g. 7×3 ft on a 2 ft grid → 4×2 cells). Calibrate scale first, then choose a piece and{' '}
        <strong className="text-on-surface">click the plan</strong> to place, or use Custom (generic 3D mesh) at center.
      </p>

      <div className="relative">
        <MaterialIcon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant"
        />
        <input
          type="search"
          placeholder="Search furniture…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="glass-input !py-2.5 !pl-10 !text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 ${
              category === c
                ? 'bg-primary/15 text-primary ring-1 ring-primary/25'
                : 'bg-white/40 text-on-surface-variant hover:bg-white/70'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <ul className="max-h-[min(24rem,50vh)] space-y-1 overflow-y-auto pr-1">
        {filtered.map((p) => {
          const span = dimsSpanCells(p.widthFt, p.depthFt, gridSizeFt)
          return (
            <li key={p.type}>
              <button
                type="button"
                onClick={() => {
                  setPendingPreset(p)
                  setTool('placeFurniture')
                }}
                className="group flex w-full flex-col items-stretch gap-0.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-all duration-200 hover:bg-white/60 hover:shadow-sm active:scale-[0.98]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span>{p.label}</span>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-on-surface/35 group-hover:text-primary">
                    {p.category}
                  </span>
                </span>
                {scale ? (
                  <span className="text-[10px] font-medium tabular-nums text-on-surface-variant">
                    {p.widthFt}×{p.depthFt} ft → {span.wCells}×{span.hCells} cells
                  </span>
                ) : (
                  <span className="text-[10px] text-on-surface-variant/80">{p.widthFt}×{p.depthFt} ft</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="space-y-3 rounded-xl bg-surface-container-low/40 p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">Custom size</p>
        <label className="block text-xs font-medium text-on-surface-variant">
          Name
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="glass-input mt-1 !py-2 !text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-on-surface-variant">
            W (ft)
            <input
              type="number"
              min={0.5}
              step={0.25}
              value={wFt}
              onChange={(e) => setWFt(Number(e.target.value))}
              className="glass-input mt-1 !py-2 !text-sm"
            />
          </label>
          <label className="text-xs font-medium text-on-surface-variant">
            H (ft)
            <input
              type="number"
              min={0.5}
              step={0.25}
              value={dFt}
              onChange={(e) => setDFt(Number(e.target.value))}
              className="glass-input mt-1 !py-2 !text-sm"
            />
          </label>
        </div>
        {customCells && (
          <p className="text-[10px] tabular-nums text-on-surface-variant">
            {wFt}×{dFt} ft → {customCells.wCells}×{customCells.hCells} cells (grid {gridSizeFt} ft)
          </p>
        )}
        <SecondaryButton type="button" className="w-full !justify-center" disabled={!gridInputs} onClick={placeCenter}>
          Add at center
        </SecondaryButton>
      </div>
    </div>
  )
}
