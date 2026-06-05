import type { ConnectionPoint, Window } from '../../types'
import { planPxToWorldXZ } from './planCoordinates'

export type PickResult =
  | { kind: 'window'; id: string }
  | { kind: 'wall'; id: string }
  | { kind: 'none' }

function pointById(points: ConnectionPoint[]) {
  const map = new Map<string, ConnectionPoint>()
  for (const p of points) map.set(p.id, p)
  return map
}

/**
 * Minimal selection helper extracted from `WallSegmentCuboid`:
 * when clicking a wall mesh, prefer a window if the click ray point falls inside a window's
 * along-segment span and its sill/height vertical span.
 *
 * This intentionally mirrors current behavior (no feature changes).
 */
export function pickWindowOrWallOnWallClick({
  clickWorld,
  wallId,
  wallAWorld,
  wallBWorld,
  windows,
  connectionPoints,
  pxPerFt,
}: {
  clickWorld: { x: number; y: number; z: number }
  wallId: string
  wallAWorld: { x: number; z: number }
  wallBWorld: { x: number; z: number }
  windows: Window[]
  connectionPoints: ConnectionPoint[]
  pxPerFt: number
}): PickResult {
  const a = wallAWorld
  const b = wallBWorld
  const dx = b.x - a.x
  const dz = b.z - a.z
  const wallLen = Math.max(1e-6, Math.hypot(dx, dz))
  const ux = dx / wallLen
  const uz = dz / wallLen

  const clickAlong = (clickWorld.x - a.x) * ux + (clickWorld.z - a.z) * uz
  const points = pointById(connectionPoints)

  const hitWindow = windows.find((w) => {
    const pa = w.node_a_id ? points.get(w.node_a_id) : undefined
    const pb = w.node_b_id ? points.get(w.node_b_id) : undefined
    if (!pa || !pb) return false

    const wa = planPxToWorldXZ(pa.x, pa.y, pxPerFt)
    const wb = planPxToWorldXZ(pb.x, pb.y, pxPerFt)
    const wndx = wb.x - wa.x
    const wndz = wb.z - wa.z
    const wlen = Math.hypot(wndx, wndz)
    if (wlen <= 1e-6) return false

    const wux = wndx / wlen
    const wuz = wndz / wlen

    // Window is considered on this wall if it's collinear and parallel.
    const parallel = Math.abs(ux * wuz - uz * wux) < 0.03
    const distA = Math.abs((wa.x - a.x) * uz - (wa.z - a.z) * ux)
    const distB = Math.abs((wb.x - a.x) * uz - (wb.z - a.z) * ux)
    if (!parallel || distA > 0.08 || distB > 0.08) return false

    const cAlong = ((wa.x + wb.x) / 2 - a.x) * ux + ((wa.z + wb.z) / 2 - a.z) * uz
    const halfW = wlen / 2
    const sill = Math.max(0.2, Number(w.sillHeightFt ?? 3))
    const wh = Math.max(0.5, Number(w.heightFt ?? 4))
    const withinAlong = clickAlong >= cAlong - halfW - 0.06 && clickAlong <= cAlong + halfW + 0.06
    const withinY = clickWorld.y >= sill - 0.06 && clickWorld.y <= sill + wh + 0.06
    return withinAlong && withinY
  })

  if (hitWindow) return { kind: 'window', id: hitWindow.id }
  return { kind: 'wall', id: wallId }
}

