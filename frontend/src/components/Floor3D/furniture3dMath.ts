import * as THREE from 'three'

const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()

/** World position of local point (lx, 0, lz) relative to center, Y rotation in radians. */
export function localToWorldXZ(
  centerX: number,
  centerZ: number,
  rotYRad: number,
  lx: number,
  lz: number,
): { x: number; z: number } {
  _v.set(lx, 0, lz)
  _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotYRad)
  _v.applyQuaternion(_q)
  return { x: centerX + _v.x, z: centerZ + _v.z }
}

/** World delta (dx, dz) projected onto local X axis (unit in world XZ). */
export function projectWorldDeltaOnLocalX(rotYRad: number, dwx: number, dwz: number): number {
  const cos = Math.cos(rotYRad)
  const sin = Math.sin(rotYRad)
  return dwx * cos + dwz * sin
}

/** World delta projected onto local Z axis. */
export function projectWorldDeltaOnLocalZ(rotYRad: number, dwx: number, dwz: number): number {
  const cos = Math.cos(rotYRad)
  const sin = Math.sin(rotYRad)
  return -dwx * sin + dwz * cos
}

/** New center when resizing local +X edge (increase width), keeping local -X face fixed. */
export function centerAfterResizeWidthFromLeftFixed(
  centerX: number,
  centerZ: number,
  rotYRad: number,
  oldW: number,
  newW: number,
): { x: number; z: number } {
  const halfDelta = (newW - oldW) / 2
  const { x, z } = localToWorldXZ(centerX, centerZ, rotYRad, halfDelta, 0)
  return { x, z }
}

/** New center when resizing local +Z edge (increase depth), keeping local -Z face fixed. */
export function centerAfterResizeDepthFromBackFixed(
  centerX: number,
  centerZ: number,
  rotYRad: number,
  oldD: number,
  newD: number,
): { x: number; z: number } {
  const halfDelta = (newD - oldD) / 2
  const { x, z } = localToWorldXZ(centerX, centerZ, rotYRad, 0, halfDelta)
  return { x, z }
}

/** New center when resizing local -X edge (increase width toward -X), keeping +X face fixed. */
export function centerAfterResizeWidthFromRightFixed(
  centerX: number,
  centerZ: number,
  rotYRad: number,
  oldW: number,
  newW: number,
): { x: number; z: number } {
  const halfDelta = -(newW - oldW) / 2
  const { x, z } = localToWorldXZ(centerX, centerZ, rotYRad, halfDelta, 0)
  return { x, z }
}

/** New center when resizing local -Z edge, keeping +Z face fixed. */
export function centerAfterResizeDepthFromFrontFixed(
  centerX: number,
  centerZ: number,
  rotYRad: number,
  oldD: number,
  newD: number,
): { x: number; z: number } {
  const halfDelta = -(newD - oldD) / 2
  const { x, z } = localToWorldXZ(centerX, centerZ, rotYRad, 0, halfDelta)
  return { x, z }
}
