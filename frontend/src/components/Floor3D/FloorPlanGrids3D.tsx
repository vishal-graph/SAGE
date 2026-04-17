import { useMemo } from 'react'
import * as THREE from 'three'
import { GridNoRaycast } from './GridNoRaycast'
import type { Room, Wall } from '../../types'
import { planExtentFt, planPxToWorldXZ } from './planCoordinates'

const GRID_Y = 0.028
const PAD_FT = 0.25 // small padding so grid lines sit slightly beyond the outermost wall

const baseGridProps = {
  cellThickness: 0.65,
  cellColor: '#737373',
  sectionThickness: 1.15,
  sectionColor: '#404040',
  fadeStrength: 0.88,
  infiniteGrid: false,
  side: THREE.DoubleSide,
  renderOrder: 1,
} as const

interface Box { cx: number; cz: number; w: number; d: number }

function validPlane(w: number, d: number, cell: number): boolean {
  return (
    Number.isFinite(w) &&
    Number.isFinite(d) &&
    Number.isFinite(cell) &&
    w > 0.01 &&
    d > 0.01 &&
    cell > 1e-6
  )
}

/** Compute world-XZ AABB from all wall endpoints + room polygon vertices (pixel coords). */
function contentAabb(
  walls: Wall[] | undefined,
  rooms: Room[] | undefined,
  pxPerFt: number,
): Box | null {
  const wl = Array.isArray(walls) ? walls : []
  const rm = Array.isArray(rooms) ? rooms : []

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  let count = 0

  const visit = (px: number, py: number) => {
    const { x, z } = planPxToWorldXZ(px, py, pxPerFt)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
    count++
  }

  for (const w of wl) {
    visit(w.x1, w.y1)
    visit(w.x2, w.y2)
  }
  for (const r of rm) {
    const poly = r.polygon
    if (!Array.isArray(poly)) continue
    for (const pt of poly) {
      if (!pt || pt.length < 2) continue
      visit(pt[0], pt[1])
    }
  }

  if (count < 2) return null
  const w = maxX - minX + PAD_FT * 2
  const d = maxZ - minZ + PAD_FT * 2
  if (w < 0.2 || d < 0.2) return null
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, w, d }
}

export function FloorPlanGrids3D({
  walls,
  rooms,
  gridSizeFt,
  pxPerFt,
  imageNaturalWidth,
  imageNaturalHeight,
  fallbackWidthFt,
  fallbackDepthFt,
}: {
  walls?: Wall[] | null
  rooms?: Room[] | null
  gridSizeFt: number
  pxPerFt: number | null
  imageNaturalWidth: number
  imageNaturalHeight: number
  fallbackWidthFt: number
  fallbackDepthFt: number
}) {
  const box: Box | null = useMemo(() => {
    if (pxPerFt == null || pxPerFt <= 0) return null

    // Priority 1: content AABB from walls + rooms
    const aabb = contentAabb(walls ?? undefined, rooms ?? undefined, pxPerFt)
    if (aabb) return aabb

    // Priority 2: plan image bounds
    if (imageNaturalWidth > 0 && imageNaturalHeight > 0) {
      const { planW, planD } = planExtentFt(imageNaturalWidth, imageNaturalHeight, pxPerFt)
      return { cx: planW / 2, cz: planD / 2, w: planW, d: planD }
    }

    return null
  }, [walls, rooms, pxPerFt, imageNaturalWidth, imageNaturalHeight])

  // Must run hooks unconditionally, so guard after
  if (box == null) {
    // Fallback: use derived full grid size
    if (!validPlane(fallbackWidthFt, fallbackDepthFt, gridSizeFt)) return null
    return (
      <GridNoRaycast
        args={[fallbackWidthFt, fallbackDepthFt]}
        position={[fallbackWidthFt / 2, GRID_Y, fallbackDepthFt / 2]}
        cellSize={gridSizeFt}
        sectionSize={gridSizeFt * 5}
        fadeDistance={Math.max(1200, Math.max(fallbackWidthFt, fallbackDepthFt) * 8)}
        {...baseGridProps}
      />
    )
  }

  if (!validPlane(box.w, box.d, gridSizeFt)) return null
  return (
    <GridNoRaycast
      args={[box.w, box.d]}
      position={[box.cx, GRID_Y, box.cz]}
      cellSize={gridSizeFt}
      sectionSize={gridSizeFt * 5}
      fadeDistance={Math.max(600, Math.max(box.w, box.d) * 5)}
      {...baseGridProps}
    />
  )
}
