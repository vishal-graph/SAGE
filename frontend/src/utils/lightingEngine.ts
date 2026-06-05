import type { SigeLight } from '../types'
import { LUX_TARGETS } from '../types'

/**
 * Tanner Helland algorithm.
 * Returns [r, g, b] each in 0–255.
 * Valid input: 1000K–40000K.
 */
export function kelvinToRGB(kelvin: number): [number, number, number] {
  const temp = Math.max(1000, Math.min(40000, kelvin)) / 100
  let r: number
  let g: number
  let b: number

  // Red
  if (temp <= 66) {
    r = 255
  } else {
    r = temp - 60
    r = 329.698727446 * Math.pow(r, -0.1332047592)
    r = Math.max(0, Math.min(255, r))
  }

  // Green
  if (temp <= 66) {
    g = temp
    g = 99.4708025861 * Math.log(g) - 161.1195681661
  } else {
    g = temp - 60
    g = 288.1221695283 * Math.pow(g, -0.0755148492)
  }
  g = Math.max(0, Math.min(255, g))

  // Blue
  if (temp >= 66) {
    b = 255
  } else if (temp <= 19) {
    b = 0
  } else {
    b = temp - 10
    b = 138.5177312231 * Math.log(b) - 305.0447927307
    b = Math.max(0, Math.min(255, b))
  }

  return [Math.round(r), Math.round(g), Math.round(b)]
}

/** Returns a Three.js-compatible hex color number from Kelvin. */
export function kelvinToThreeColor(kelvin: number): number {
  const [r, g, b] = kelvinToRGB(kelvin)
  return (r << 16) | (g << 8) | b
}

/**
 * Computes illuminance (lux) at a floor point (fpx, fpy) in WORLD FEET
 * from a single SigeLight whose plan-pixel position has been
 * pre-converted to world feet (lx, ly) by the caller.
 *
 * Returns 0 if the light is off, hidden, h<=0, or the point is outside the beam cone.
 */
export function luxAtPoint(
  fpx: number,
  fpy: number,
  lx: number,
  ly: number,
  light: SigeLight,
): number {
  if (!light.isOn || light.hidden) return 0

  const h = Number(light.mountHeightFt)
  if (!Number.isFinite(h) || h <= 0) return 0

  const dx = fpx - lx
  const dy = fpy - ly
  const d2d = Math.sqrt(dx * dx + dy * dy)
  const d3d = Math.sqrt(d2d * d2d + h * h)
  if (!Number.isFinite(d3d) || d3d <= 1e-6) return 0

  const thetaDeg = Math.acos(Math.min(1, h / d3d)) * (180 / Math.PI)
  const beam = Math.max(0.1, Math.min(179, Number(light.beamAngleDeg)))
  if (thetaDeg > beam / 2) return 0

  const dimFactor = Math.max(0, Math.min(1, Number(light.dimLevel) / 100))
  const lux =
    (Number(light.lumens) / (Math.PI * d3d * d3d)) *
    Math.cos((thetaDeg * Math.PI) / 180) *
    dimFactor

  return Math.max(0, lux)
}

export interface LuxCell {
  col: number
  row: number
  fx: number
  fy: number
  totalLux: number
  isDark: boolean
  isOverlit: boolean
}

export interface LuxGrid {
  cells: LuxCell[]
  cols: number
  rows: number
  cellSizeFt: number
  darkPatchPercent: number
  avgLux: number
  peakLux: number
}

/** Point-in-polygon test (ray casting). Works for non-convex polygons. */
function pointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false
  const n = poly.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i]![0]
    const yi = poly[i]![1]
    const xj = poly[j]![0]
    const yj = poly[j]![1]
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function computeRoomLuxGrid(
  roomPointsPx: [number, number][],
  lights: SigeLight[],
  pxPerFt: number,
  roomType: string = 'default',
  cellSizeFt = 1.0,
): LuxGrid {
  if (roomPointsPx.length < 3) {
    return { cells: [], cols: 0, rows: 0, cellSizeFt, darkPatchPercent: 0, avgLux: 0, peakLux: 0 }
  }
  if (!Number.isFinite(pxPerFt) || pxPerFt <= 0) {
    return { cells: [], cols: 0, rows: 0, cellSizeFt, darkPatchPercent: 0, avgLux: 0, peakLux: 0 }
  }

  const ptsFt: [number, number][] = roomPointsPx.map(([px, py]) => [px / pxPerFt, py / pxPerFt])

  const xs = ptsFt.map((p) => p[0])
  const ys = ptsFt.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const cols = Math.max(0, Math.ceil((maxX - minX) / cellSizeFt))
  const rows = Math.max(0, Math.ceil((maxY - minY) / cellSizeFt))

  const lightsWF = lights.map((l) => ({ light: l, lx: l.x / pxPerFt, ly: l.y / pxPerFt }))

  const target = LUX_TARGETS[roomType] ?? LUX_TARGETS.default
  const darkThreshold = target.min * 0.7
  const overlitThreshold = target.target * 2.5

  const cells: LuxCell[] = []
  let luxSum = 0
  let peakLux = 0
  let darkCount = 0
  let inRoomCount = 0

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const fx = minX + (c + 0.5) * cellSizeFt
      const fy = minY + (r + 0.5) * cellSizeFt
      if (!pointInPolygon(fx, fy, ptsFt)) continue

      let totalLux = 0
      for (const { light, lx, ly } of lightsWF) {
        totalLux += luxAtPoint(fx, fy, lx, ly, light)
      }

      const isDark = totalLux < darkThreshold
      const isOverlit = totalLux > overlitThreshold
      cells.push({ col: c, row: r, fx, fy, totalLux, isDark, isOverlit })

      luxSum += totalLux
      peakLux = Math.max(peakLux, totalLux)
      if (isDark) darkCount++
      inRoomCount++
    }
  }

  return {
    cells,
    cols,
    rows,
    cellSizeFt,
    darkPatchPercent: inRoomCount > 0 ? (darkCount / inRoomCount) * 100 : 0,
    avgLux: inRoomCount > 0 ? luxSum / inRoomCount : 0,
    peakLux,
  }
}

/**
 * Returns suggested downlight positions (PLAN PIXELS) for a room using spacing rule:
 * spacing = ceilingHeightFt × 1.5
 * wall offset = ceilingHeightFt / 2
 */
export function suggestDownlightPositions(
  roomPointsPx: [number, number][],
  ceilingHeightFt: number,
  pxPerFt: number,
): [number, number][] {
  if (roomPointsPx.length < 3) return []
  if (!Number.isFinite(pxPerFt) || pxPerFt <= 0) return []

  const spacingFt = Math.max(0.5, ceilingHeightFt * 1.5)
  const wallOffsetFt = Math.max(0, ceilingHeightFt / 2)

  const ptsFt: [number, number][] = roomPointsPx.map(([px, py]) => [px / pxPerFt, py / pxPerFt])
  const xs = ptsFt.map((p) => p[0])
  const ys = ptsFt.map((p) => p[1])
  const minX = Math.min(...xs) + wallOffsetFt
  const maxX = Math.max(...xs) - wallOffsetFt
  const minY = Math.min(...ys) + wallOffsetFt
  const maxY = Math.max(...ys) - wallOffsetFt

  const positions: [number, number][] = []
  for (let fy = minY; fy <= maxY; fy += spacingFt) {
    for (let fx = minX; fx <= maxX; fx += spacingFt) {
      if (pointInPolygon(fx, fy, ptsFt)) positions.push([fx * pxPerFt, fy * pxPerFt])
    }
  }
  return positions
}

