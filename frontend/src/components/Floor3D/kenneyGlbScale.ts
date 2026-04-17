import * as THREE from 'three'
import { KENNEY_METERS_TO_FT } from './constants'

/**
 * Many Kenney GLBs are Y-up with a thin axis (depth or bad export). Use the two largest
 * AABB extents as the horizontal footprint so we don't treat a 2m×2m×0.02m slab as 2m×0.02m.
 */
export function horizontalFootprintMeters(box: THREE.Box3): { wM: number; dM: number } {
  const s = new THREE.Vector3()
  box.getSize(s)
  const ax = Math.abs(s.x)
  const ay = Math.abs(s.y)
  const az = Math.abs(s.z)
  const dims = [ax, ay, az].sort((a, b) => b - a)
  return {
    wM: Math.max(dims[0]!, 1e-5),
    dM: Math.max(dims[1]!, 1e-5),
  }
}

function modelFt(wM: number, dM: number, divisor: number): { wFt: number; dFt: number } {
  const f = KENNEY_METERS_TO_FT / divisor
  return { wFt: wM * f, dFt: dM * f }
}

/**
 * Map GLB meters (or cm/mm if mis-tagged) to scale factors so the mesh matches target feet.
 * Iterates unit divisors when the naive scale is extreme (tiny specks or giants).
 */
export function scaleKenneyToTargetFt(
  wM: number,
  dM: number,
  widthFt: number,
  depthFt: number,
): { sx: number; sy: number; sz: number } {
  let divisor = 1
  let sx = 1
  let sz = 1

  for (let i = 0; i < 6; i++) {
    const { wFt, dFt } = modelFt(wM, dM, divisor)
    sx = widthFt / Math.max(wFt, 1e-6)
    sz = depthFt / Math.max(dFt, 1e-6)
    const lo = Math.min(sx, sz)
    const hi = Math.max(sx, sz)
    if (lo >= 0.05 && hi <= 55) break
    if (lo < 0.05) divisor *= 100
    else if (hi > 55) divisor = Math.max(1e-4, divisor / 100)
    else break
  }

  const sxC = Math.min(50, Math.max(0.04, sx))
  const szC = Math.min(50, Math.max(0.04, sz))
  const sy = Math.min(sxC, szC)
  return { sx: sxC, sy, sz: szC }
}
