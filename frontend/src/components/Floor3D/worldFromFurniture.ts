import type { FurnitureItem } from '../../types'
import { effectiveFootprint } from '../../utils/gridEngine'
import { pixelToCell } from '../../utils/geometry'
import { MIN_FURNITURE_FT } from './constants'

export function offsetFt(item: FurnitureItem, pxPerFt: number): { ox: number; oz: number } {
  return { ox: item.freeOffsetPx[0] / pxPerFt, oz: item.freeOffsetPx[1] / pxPerFt }
}

/** World XZ center (feet) of furniture footprint, matching 2D anchor + effective size. */
export function furnitureCenterXZ(
  item: FurnitureItem,
  gridSizeFt: number,
  pxPerFt: number | null,
): { x: number; z: number } {
  const { w, h } = effectiveFootprint(item)
  const ox = pxPerFt ? item.freeOffsetPx[0] / pxPerFt : 0
  const oz = pxPerFt ? item.freeOffsetPx[1] / pxPerFt : 0
  return {
    x: item.gridX * gridSizeFt + ox + w / 2,
    z: item.gridY * gridSizeFt + oz + h / 2,
  }
}

export function snapScalarToGrid(v: number, gridSizeFt: number): number {
  const g = Math.max(0.25, gridSizeFt)
  return Math.round(v / g) * g
}

export function snapDimensionFt(v: number, gridSizeFt: number): number {
  const s = snapScalarToGrid(v, gridSizeFt)
  return Math.max(MIN_FURNITURE_FT, s)
}

/** Recompute grid + zero sub-cell offset from world center and item dimensions. */
export function itemStateFromCenter(
  item: FurnitureItem,
  centerX: number,
  centerZ: number,
  gridSizeFt: number,
): Pick<FurnitureItem, 'gridX' | 'gridY' | 'freeOffsetPx'> {
  const { w, h } = effectiveFootprint(item)
  const ax = centerX - w / 2
  const az = centerZ - h / 2
  const g = gridSizeFt
  return {
    gridX: Math.round(ax / g),
    gridY: Math.round(az / g),
    freeOffsetPx: [0, 0],
  }
}

/** Plan pixel cell under world point (feet), same anchor as 2D `pixelToCell`. */
export function worldFeetToAnchorCell(
  xFt: number,
  zFt: number,
  pxPerFt: number,
  cellSizePx: number,
): [number, number] {
  return pixelToCell(xFt * pxPerFt, zFt * pxPerFt, cellSizePx)
}

/**
 * Grid + sub-cell offset from world XZ center — matches 2D FurnitureShape snap / free-drag rules.
 */
export function itemStateFromWorldCenter(
  item: FurnitureItem,
  centerX: number,
  centerZ: number,
  gridSizeFt: number,
  pxPerFt: number,
  snapToGrid: boolean,
): Pick<FurnitureItem, 'gridX' | 'gridY' | 'freeOffsetPx'> {
  const { w, h } = effectiveFootprint(item)
  const ax = centerX - w / 2
  const az = centerZ - h / 2
  const cellSizePx = pxPerFt * gridSizeFt
  const topLeftPx = ax * pxPerFt
  const topLeftPy = az * pxPerFt
  if (snapToGrid) {
    return {
      gridX: Math.round(topLeftPx / cellSizePx),
      gridY: Math.round(topLeftPy / cellSizePx),
      freeOffsetPx: [0, 0],
    }
  }
  const gridX = Math.floor(topLeftPx / cellSizePx)
  const gridY = Math.floor(topLeftPy / cellSizePx)
  const offX = topLeftPx - gridX * cellSizePx
  const offY = topLeftPy - gridY * cellSizePx
  return { gridX, gridY, freeOffsetPx: [offX, offY] }
}
