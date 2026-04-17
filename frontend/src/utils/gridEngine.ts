import type { Door, FurnitureItem, Room, Wall } from '../types'
import { CellType } from '../types'
import { pointInPolygon, rasterizeWallToCells } from './geometry'

export interface GridInputs {
  imageWidthPx: number
  imageHeightPx: number
  pxPerFt: number
  gridSizeFt: number
  rooms: Room[]
  walls: Wall[]
  furniture: FurnitureItem[]
}

export function getCellSizePx(pxPerFt: number, gridSizeFt: number): number {
  return pxPerFt * gridSizeFt
}

export function getGridDimensions(
  imageWidthPx: number,
  imageHeightPx: number,
  pxPerFt: number,
  gridSizeFt: number,
): { cols: number; rows: number; cellSizePx: number } {
  const cellSizePx = getCellSizePx(pxPerFt, gridSizeFt)
  const cols = Math.max(1, Math.ceil(imageWidthPx / cellSizePx))
  const rows = Math.max(1, Math.ceil(imageHeightPx / cellSizePx))
  return { cols, rows, cellSizePx }
}

function idx(cols: number, c: number, r: number): number {
  return r * cols + c
}

export function effectiveFootprint(item: FurnitureItem): { w: number; h: number } {
  const rot = item.rotation
  if (rot === 90 || rot === 270) {
    return { w: item.depthFt, h: item.widthFt }
  }
  return { w: item.widthFt, h: item.depthFt }
}

export function getOccupiedCells(
  item: FurnitureItem,
  gridSizeFt: number,
): [number, number][] {
  const { w, h } = effectiveFootprint(item)
  const wCells = Math.max(1, Math.ceil(w / gridSizeFt))
  const hCells = Math.max(1, Math.ceil(h / gridSizeFt))
  const cells: [number, number][] = []
  for (let dx = 0; dx < wCells; dx++) {
    for (let dy = 0; dy < hCells; dy++) {
      cells.push([item.gridX + dx, item.gridY + dy])
    }
  }
  return cells
}

const _minGridFt = 0.25

/** Footprint in feet (after rotation) and how many cells it occupies at this grid size. */
export function furnitureItemSpanCells(
  item: FurnitureItem,
  gridSizeFt: number,
): { wFt: number; hFt: number; wCells: number; hCells: number } {
  const { w, h } = effectiveFootprint(item)
  const g = Math.max(_minGridFt, gridSizeFt)
  return {
    wFt: w,
    hFt: h,
    wCells: Math.max(1, Math.ceil(w / g)),
    hCells: Math.max(1, Math.ceil(h / g)),
  }
}

/** Same as above for preset/custom dimensions (rotation 0). */
export function dimsSpanCells(
  widthFt: number,
  depthFt: number,
  gridSizeFt: number,
): { wCells: number; hCells: number } {
  const g = Math.max(_minGridFt, gridSizeFt)
  return {
    wCells: Math.max(1, Math.ceil(widthFt / g)),
    hCells: Math.max(1, Math.ceil(depthFt / g)),
  }
}

export function computeGrid(input: GridInputs): {
  cols: number
  rows: number
  cellSizePx: number
  cells: Uint8Array
  roomMap: Uint16Array
} {
  const { cols, rows, cellSizePx } = getGridDimensions(
    input.imageWidthPx,
    input.imageHeightPx,
    input.pxPerFt,
    input.gridSizeFt,
  )
  const n = cols * rows
  const cells = new Uint8Array(n)
  const roomMap = new Uint16Array(n)

  for (const wall of input.walls) {
    const hit = rasterizeWallToCells(
      wall.x1,
      wall.y1,
      wall.x2,
      wall.y2,
      cellSizePx,
      cols,
      rows,
    )
    for (const [c, r] of hit) {
      cells[idx(cols, c, r)] = CellType.WALL
    }
  }

  input.rooms.forEach((room, roomIndex) => {
    const ri = roomIndex + 1
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * cellSizePx
        const cy = (r + 0.5) * cellSizePx
        if (pointInPolygon(cx, cy, room.polygon)) {
          const i = idx(cols, c, r)
          roomMap[i] = ri
        }
      }
    }
  })

  for (const item of input.furniture) {
    const occupied = getOccupiedCells(item, input.gridSizeFt)
    for (const [c, r] of occupied) {
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue
      const i = idx(cols, c, r)
      if (cells[i] === CellType.WALL) continue
      cells[i] = CellType.FURNITURE
    }
  }

  return { cols, rows, cellSizePx, cells, roomMap }
}

export function doorsToGridCells(
  doors: Door[],
  cols: number,
  rows: number,
): { col: number; row: number }[] {
  return doors.filter((d) => d.col >= 0 && d.row >= 0 && d.col < cols && d.row < rows)
}

export type IsPlacementValidOptions = {
  /** When true, other furniture does not block (walls and bounds still apply). */
  allowFurnitureOverlap?: boolean
}

export function isPlacementValid(
  item: FurnitureItem,
  excludeId: string | null,
  input: GridInputs,
  options?: IsPlacementValidOptions,
): boolean {
  const others = input.furniture.filter((f) => f.id !== excludeId)
  const { cols, rows, cells } = computeGrid({ ...input, furniture: others })
  const occupied = getOccupiedCells(item, input.gridSizeFt)
  const allowOverlap = options?.allowFurnitureOverlap === true
  for (const [c, r] of occupied) {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return false
    const i = r * cols + c
    const v = cells[i]
    if (v === CellType.WALL) return false
    if (!allowOverlap && v === CellType.FURNITURE) return false
  }
  return occupied.length > 0
}
