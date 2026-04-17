/** Logical grid cell values (matches backend). */
export const CellType = {
  EMPTY: 0,
  WALL: 1,
  FURNITURE: 2,
  PATH: 3,
} as const

export interface Room {
  id: string
  name: string
  polygon: [number, number][]
}

export interface Wall {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Door {
  id: string
  col: number
  row: number
  roomId?: string
}

export interface FurnitureItem {
  id: string
  type: string
  label: string
  widthFt: number
  /** Plan depth / second horizontal span (maps to 3D Z). */
  depthFt: number
  gridX: number
  gridY: number
  rotation: 0 | 90 | 180 | 270
  freeOffsetPx: [number, number]
}

export interface ScaleState {
  pxPerFt: number
  pointA: [number, number]
  pointB: [number, number]
}

export interface DerivedGrid {
  cols: number
  rows: number
  cellSizePx: number
  cells: Uint8Array
  roomMap: Uint16Array
}

export type HistoryAction =
  | { type: 'ADD_FURNITURE'; item: FurnitureItem }
  | { type: 'MOVE_FURNITURE'; id: string; from: [number, number]; to: [number, number]; fromOffset: [number, number]; toOffset: [number, number] }
  | { type: 'UPDATE_FURNITURE'; id: string; before: FurnitureItem; after: FurnitureItem }
  | { type: 'REMOVE_FURNITURE'; item: FurnitureItem }
  | { type: 'ADD_ROOM'; room: Room }
  | { type: 'REMOVE_ROOM'; room: Room }
  | { type: 'ADD_WALL'; wall: Wall }
  | { type: 'REMOVE_WALL'; wall: Wall }
  | { type: 'ADD_DOOR'; door: Door }
  | { type: 'REMOVE_DOOR'; door: Door }

export type Tool =
  | 'select'
  | 'calibrate'
  | 'room'
  | 'wall'
  | 'door'
  | 'placeFurniture'

export interface GlobalMetrics {
  total_cells: number
  wall_cells: number
  usable_cells: number
  furniture_cells: number
  furniture_pct: number
  circulation_pct: number
  dead_pct: number
  efficiency_score: number
}

export interface RoomMetrics {
  room_index: number
  name: string
  usable_cells: number
  furniture_pct: number
  circulation_pct: number
  dead_pct: number
}
