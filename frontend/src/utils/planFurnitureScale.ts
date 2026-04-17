import type { Room } from '../types'

/** Typical shorter plan dimension for a modest house / large apartment (feet). */
const REFERENCE_CHARACTERISTIC_SPAN_FT = 38

/** Room polygon AABB in feet (plan pixel space → feet). */
function roomAabbFt(polygon: [number, number][], pxPerFt: number): { wf: number; df: number } {
  if (!polygon?.length) return { wf: 0, df: 0 }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const pt of polygon) {
    if (!pt || pt.length < 2) continue
    minX = Math.min(minX, pt[0])
    maxX = Math.max(maxX, pt[0])
    minY = Math.min(minY, pt[1])
    maxY = Math.max(maxY, pt[1])
  }
  if (!Number.isFinite(minX)) return { wf: 0, df: 0 }
  return {
    wf: (maxX - minX) / pxPerFt,
    df: (maxY - minY) / pxPerFt,
  }
}

/**
 * One number that represents “how big the floor plate reads” in feet — used to scale presets.
 * Prefers median of larger room dimensions when rooms exist; otherwise a fraction of full raster.
 */
export function computePlanCharacteristicSpanFt(
  pxPerFt: number,
  imageWidthPx: number,
  imageHeightPx: number,
  rooms: Room[],
): number {
  const fullMin = Math.min(imageWidthPx / pxPerFt, imageHeightPx / pxPerFt)
  if (fullMin <= 0 || !Number.isFinite(fullMin)) return 36

  if (!rooms.length) return Math.max(12, fullMin * 0.5)

  const spans: number[] = []
  for (const r of rooms) {
    const { wf, df } = roomAabbFt(r.polygon, pxPerFt)
    const major = Math.max(wf, df)
    if (major > 1) spans.push(major)
  }
  if (!spans.length) return Math.max(12, fullMin * 0.5)

  spans.sort((a, b) => a - b)
  const med = spans[Math.floor(spans.length / 2)]!
  return Math.min(fullMin, Math.max(med, 10))
}

/**
 * Multiplier for preset width/depth so pieces feel right vs this plan.
 * Large plan (often miscalibrated raster) → shrink toward reference; compact plan → grow slightly.
 */
export function furnitureScaleFactorFromSpan(characteristicSpanFt: number): number {
  if (!Number.isFinite(characteristicSpanFt) || characteristicSpanFt < 8) return 1
  const raw = REFERENCE_CHARACTERISTIC_SPAN_FT / characteristicSpanFt
  return Math.min(1.5, Math.max(0.52, raw))
}

export type FurnitureDimClamp = { minW: number; minD: number; maxW: number; maxD: number }

export function dimensionClampForFurnitureType(type: string): FurnitureDimClamp {
  if (type.startsWith('tv_')) return { minW: 2.2, minD: 0.85, maxW: 7.5, maxD: 2.4 }
  if (type.startsWith('bed_') || type === 'murphy_bed') return { minW: 3, minD: 5.5, maxW: 8, maxD: 8.5 }
  if (type.startsWith('sofa')) return { minW: 3.5, minD: 2.2, maxW: 10, maxD: 5 }
  if (type.includes('chair') || type.includes('stool')) return { minW: 1.4, minD: 1.4, maxW: 4, maxD: 4 }
  if (type.startsWith('dining_table') || type.startsWith('table_') || type === 'table_glass')
    return { minW: 3, minD: 2.5, maxW: 9, maxD: 5 }
  if (type.startsWith('kitchen_') || type.startsWith('bath') || type.startsWith('shower'))
    return { minW: 1.5, minD: 1.2, maxW: 6, maxD: 5 }
  if (type.startsWith('rug_')) return { minW: 3, minD: 3, maxW: 14, maxD: 12 }
  return { minW: 1, minD: 1, maxW: 16, maxD: 16 }
}

/** Uniform scale to fit inside [min,max] on both axes while keeping aspect ratio. */
export function clampFootprintProportionally(
  widthFt: number,
  depthFt: number,
  lim: FurnitureDimClamp,
): { widthFt: number; depthFt: number } {
  let w = widthFt
  let d = depthFt
  if (w <= 0 || d <= 0) return { widthFt: lim.minW, depthFt: lim.minD }

  const scaleUp = Math.max(lim.minW / w, lim.minD / d)
  if (scaleUp > 1) {
    w *= scaleUp
    d *= scaleUp
  }
  const scaleDown = Math.min(lim.maxW / w, lim.maxD / d, 1)
  w *= scaleDown
  d *= scaleDown
  return {
    widthFt: Math.max(lim.minW, Math.min(lim.maxW, w)),
    depthFt: Math.max(lim.minD, Math.min(lim.maxD, d)),
  }
}
