import * as THREE from 'three'

export interface SnapConfig {
  gridSize: number
  snapEnabled: boolean
  angleLockEnabled: boolean
  angleStep: number
}

const MIN_GRID_SIZE = 0.01

/** Snap a point on the XZ plane to the nearest grid intersection. Y is preserved. */
export function snapToGrid(point: THREE.Vector3, gridSize: number): THREE.Vector3 {
  const g = Math.max(MIN_GRID_SIZE, Math.abs(gridSize))
  if (!Number.isFinite(g) || g <= 0) return point.clone()
  const snapped = point.clone()
  snapped.x = Math.round(point.x / g) * g
  snapped.z = Math.round(point.z / g) * g
  return snapped
}

/** Snap the segment anchor->point to the nearest allowed angle, preserving length. */
export function snapAngle(anchor: THREE.Vector3, point: THREE.Vector3, angleStep: number): THREE.Vector3 {
  const dx = point.x - anchor.x
  const dz = point.z - anchor.z
  const len = Math.hypot(dx, dz)
  if (!Number.isFinite(len) || len === 0) return point.clone()

  const step = Math.abs(angleStep) || (Math.PI / 4)
  const angle = Math.atan2(dz, dx)
  const snappedAngle = Math.round(angle / step) * step

  const nx = Math.cos(snappedAngle)
  const nz = Math.sin(snappedAngle)

  return new THREE.Vector3(anchor.x + len * nx, point.y, anchor.z + len * nz)
}

function normalizeAngle(angle: number): number {
  let a = angle
  const tau = Math.PI * 2
  a = ((a % tau) + tau) % tau
  if (a > Math.PI) a -= tau
  return a
}

/** Combined grid + angle snapping for a wall endpoint. */
export function snapWallEndpoint(
  anchor: THREE.Vector3 | null,
  point: THREE.Vector3,
  config: SnapConfig,
): { position: THREE.Vector3; snapped: boolean } {
  const { gridSize, snapEnabled, angleLockEnabled, angleStep } = config
  const g = Math.max(MIN_GRID_SIZE, Math.abs(gridSize))

  // No snapping at all
  if (!snapEnabled && (!angleLockEnabled || !anchor)) {
    return { position: point.clone(), snapped: false }
  }

  // First endpoint: only grid snapping (no angle reference yet)
  if (!anchor) {
    if (!snapEnabled) return { position: point.clone(), snapped: false }
    const gridPos = snapToGrid(point, g)
    const snapped = !gridPos.equals(point)
    return { position: gridPos, snapped }
  }

  // From here on we have an anchor.
  const dx = point.x - anchor.x
  const dz = point.z - anchor.z
  const rawLen = Math.hypot(dx, dz)
  if (!Number.isFinite(rawLen) || rawLen === 0) {
    return { position: point.clone(), snapped: false }
  }

  const baseY = point.y

  let angleLockedPos = point.clone()
  let usedAngle = Math.atan2(dz, dx)
  let snapped = false

  if (angleLockEnabled) {
    const step = Math.abs(angleStep) || (Math.PI / 4)
    const angle = Math.atan2(dz, dx)
    const snappedAngle = Math.round(angle / step) * step

    // Optionally quantize length along the snapped ray to grid multiples when grid snapping is on.
    let len = rawLen
    if (snapEnabled) {
      const q = Math.round(rawLen / g) * g
      if (q > 0) len = q
    }

    const nx = Math.cos(snappedAngle)
    const nz = Math.sin(snappedAngle)
    angleLockedPos = new THREE.Vector3(anchor.x + len * nx, baseY, anchor.z + len * nz)
    usedAngle = snappedAngle
    snapped = true
  }

  if (!snapEnabled) {
    return { position: angleLockedPos, snapped }
  }

  // Grid snap the angle-locked position.
  const gridPos = snapToGrid(angleLockedPos, g)

  if (!angleLockEnabled) {
    const changed = !gridPos.equals(point)
    return { position: gridPos, snapped: snapped || changed }
  }

  // Preserve angle correctness: if grid snap would noticeably change the angle, keep the angle-locked position.
  const dxGrid = gridPos.x - anchor.x
  const dzGrid = gridPos.z - anchor.z
  const lenGrid = Math.hypot(dxGrid, dzGrid)

  if (!Number.isFinite(lenGrid) || lenGrid === 0) {
    return { position: angleLockedPos, snapped }
  }

  const angleAfterGrid = Math.atan2(dzGrid, dxGrid)
  const diff = Math.abs(normalizeAngle(angleAfterGrid - usedAngle))

  // If the grid-adjusted angle deviates by more than half a step, keep the pure angle-locked point.
  const tolerance = Math.abs(angleStep) > 0 ? Math.abs(angleStep) / 2 : Math.PI / 8
  if (diff > tolerance) {
    return { position: angleLockedPos, snapped }
  }

  const changed = !gridPos.equals(point)
  return { position: gridPos, snapped: snapped || changed }
}

