import { useMemo, useState } from 'react'
import { useSigeStore } from '../../store/useSigeStore'

const WALL_COLORS = [
  '#f87171',
  '#ef4444',
  '#fb7185',
  '#f59e0b',
  '#facc15',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
  '#6b7280',
  '#374151',
]

export function WallColorPanel({
  className,
  clearSelectionOnApply = false,
}: {
  className?: string
  clearSelectionOnApply?: boolean
}) {

  const walls = useSigeStore((s) => s.walls)
  const selectedWallIds = useSigeStore((s) => s.selectedWallIds)
  const updateWall = useSigeStore((s) => s.updateWall)
  const setSelectedWallIds = useSigeStore((s) => s.setSelectedWallIds)

  const selectedWalls = useMemo(
    () => walls.filter((w) => selectedWallIds.includes(w.id)),
    [walls, selectedWallIds],
  )
  const [customColor, setCustomColor] = useState('#f87171')
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)

  if (!selectedWalls.length) return null

  const firstColor = selectedWalls[0]?.color ?? '#f87171'
  const mixed = selectedWalls.some((w) => (w.color ?? '#f87171') !== firstColor)

  const applyColor = (color: string) => {
    for (const wall of selectedWalls) {
      updateWall(wall.id, { color })
    }
    if (clearSelectionOnApply) setSelectedWallIds([])
  }

  const isValidCssColor = (value: string): boolean => {
    const probe = new Option().style
    probe.color = ''
    probe.color = value.trim()
    return probe.color !== ''
  }

  const applyCodeInput = () => {
    const normalized = codeInput.trim()
    if (!normalized) {
      setCodeError('Enter a color code or color name')
      return
    }
    if (!isValidCssColor(normalized)) {
      setCodeError('Invalid color. Use #hex or CSS color name.')
      return
    }
    setCodeError(null)
    applyColor(normalized)
  }

  return (
    <div className={className}>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">Wall color</p>
      <div className="grid grid-cols-6 gap-1.5">
        {WALL_COLORS.map((color) => {
          const active = !mixed && color.toLowerCase() === firstColor.toLowerCase()
          return (
            <button
              key={color}
              type="button"
              onClick={() => applyColor(color)}
              title={color}
              className={`h-5 w-5 rounded-full border transition-transform hover:scale-105 ${
                active ? 'border-on-surface ring-2 ring-primary/50' : 'border-black/15'
              }`}
              style={{ backgroundColor: color }}
            />
          )
        })}
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="h-8 w-9 cursor-pointer rounded border border-outline-variant/30 bg-transparent p-0.5"
            title="Pick any color"
          />
          <button
            type="button"
            onClick={() => applyColor(customColor)}
            className="rounded-lg border border-outline-variant/30 px-2.5 py-1 text-[11px] font-medium text-on-surface hover:bg-surface-container-low/60"
          >
            Apply picker
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => {
              setCodeInput(e.target.value)
              if (codeError) setCodeError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && applyCodeInput()}
            placeholder="#22c55e or teal"
            className="glass-input w-full !py-1.5 !text-xs"
          />
          <button
            type="button"
            onClick={applyCodeInput}
            className="rounded-lg border border-outline-variant/30 px-2.5 py-1 text-[11px] font-medium text-on-surface hover:bg-surface-container-low/60"
          >
            Apply
          </button>
        </div>
        {codeError && <p className="text-[10px] text-rose-600">{codeError}</p>}
      </div>
    </div>
  )
}
