/** Plan pixel space (Konva: origin top-left, +y down) → world XZ (feet), Y up in Three. */
export function planPxToWorldXZ(
  px: number,
  py: number,
  pxPerFt: number,
): { x: number; z: number } {
  return { x: px / pxPerFt, z: py / pxPerFt }
}

/** Raster size in feet (same frame as `planPxToWorldXZ`: origin at image top-left). */
export function planExtentFt(
  imageNaturalWidth: number,
  imageNaturalHeight: number,
  pxPerFt: number,
): { planW: number; planD: number } {
  return {
    planW: imageNaturalWidth / pxPerFt,
    planD: imageNaturalHeight / pxPerFt,
  }
}

/** Axis-aligned world XZ box for one room polygon (pixel vertices). */
export function roomPolygonWorldAabb(
  polygon: [number, number][],
  pxPerFt: number,
): { cx: number; cz: number; width: number; depth: number } | null {
  if (polygon.length < 2) return null
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [px, py] of polygon) {
    const { x, z } = planPxToWorldXZ(px, py, pxPerFt)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  const width = maxX - minX
  const depth = maxZ - minZ
  if (width < 0.08 || depth < 0.08) return null
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    width,
    depth,
  }
}
