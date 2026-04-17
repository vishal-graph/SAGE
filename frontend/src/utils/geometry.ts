/** Point-in-polygon (ray casting). Coordinates in same space as polygon. */
export function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Line segment vs axis-aligned rectangle intersection (2D). */
function lineIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)
  if (maxX < rx || minX > rx + rw || maxY < ry || minY > ry + rh) return false
  // Liang-Barsky or simple: if either endpoint inside
  const ins = (px: number, py: number) =>
    px >= rx && px <= rx + rw && py >= ry && py <= ry + rh
  if (ins(x1, y1) || ins(x2, y2)) return true
  // Check intersection with four edges
  const edges: [number, number, number, number][] = [
    [rx, ry, rx + rw, ry],
    [rx + rw, ry, rx + rw, ry + rh],
    [rx, ry + rh, rx + rw, ry + rh],
    [rx, ry, rx, ry + rh],
  ]
  for (const [ex1, ey1, ex2, ey2] of edges) {
    if (segmentsIntersect(x1, y1, x2, y2, ex1, ey1, ex2, ey2)) return true
  }
  return false
}

function segmentsIntersect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): boolean {
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(d) < 1e-9) return false
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

/** All grid cells (col, row) whose pixel-area the wall segment intersects. */
export function rasterizeWallToCells(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cellSizePx: number,
  cols: number,
  rows: number,
): [number, number][] {
  const out: [number, number][] = []
  const seen = new Set<string>()
  const minC = Math.max(0, Math.floor(Math.min(x1, x2) / cellSizePx))
  const maxC = Math.min(cols - 1, Math.floor(Math.max(x1, x2) / cellSizePx))
  const minR = Math.max(0, Math.floor(Math.min(y1, y2) / cellSizePx))
  const maxR = Math.min(rows - 1, Math.floor(Math.max(y1, y2) / cellSizePx))
  for (let c = minC; c <= maxC; c++) {
    for (let r = minR; r <= maxR; r++) {
      const rx = c * cellSizePx
      const ry = r * cellSizePx
      if (lineIntersectsRect(x1, y1, x2, y2, rx, ry, cellSizePx, cellSizePx)) {
        const key = `${c},${r}`
        if (!seen.has(key)) {
          seen.add(key)
          out.push([c, r])
        }
      }
    }
  }
  return out
}

export function pixelToCell(
  px: number,
  py: number,
  cellSizePx: number,
): [number, number] {
  return [Math.floor(px / cellSizePx), Math.floor(py / cellSizePx)]
}
