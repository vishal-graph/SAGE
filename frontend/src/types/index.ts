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

export interface ViewPost {
  id: string
  /** Plan-pixel anchor */
  x: number
  y: number
  /** Camera height (ft). Default 4. */
  heightFt?: number
  /** View yaw (deg) for post mode. */
  yawDeg?: number
  /** View pitch (deg) for post mode. */
  pitchDeg?: number
}

export interface ConnectionPoint {
  id: string
  x: number
  y: number
}

export interface Wall {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  thicknessFt?: number
  heightFt?: number
  color?: string
  /** Visual hide flag (still kept in project data). */
  hidden?: boolean
}

export interface Door {
  id: string
  col: number
  row: number
  node_a_id?: string
  node_b_id?: string
  node_id?: string
  roomId?: string
  isOpen?: boolean
  swingMode?: 'push' | 'pull'
  hasTopLayer?: boolean
  material?: 'wood' | 'glass'
}

export interface Window {
  id: string
  col: number
  row: number
  node_a_id?: string
  node_b_id?: string
  sillHeightFt?: number
  heightFt?: number
  frameDepthFt?: number
  frameThicknessFt?: number
  material?: 'clear' | 'frosted' | 'tinted'
}

export type CeilingType = 'flat' | 'false' | 'tray' | 'coffered' | 'open'

export interface Ceiling {
  id: string
  /** Polygon in plan-pixel space (same frame as Room.polygon). */
  polygon: [number, number][]
  /** Optional source room — when set, polygon auto-syncs from the room. */
  roomId?: string
  type: CeilingType
  /** Bottom of ceiling slab (ft from floor). Default 8. */
  heightFt: number
  /** Slab thickness (ft). Default 0.5. */
  thicknessFt: number
  /** For 'false'/'tray': drop from ceilingHeight (ft). 0 means flush. */
  dropFt?: number
  color?: string
  hidden?: boolean
}

export type LightType = 'recessed' | 'pendant' | 'spot' | 'strip' | 'cove'

export interface CeilingLight {
  id: string
  ceilingId: string
  /** Plan-pixel anchor (so it stays glued to the ceiling polygon). */
  x: number
  y: number
  type: LightType
  /** ft below ceiling bottom for pendants. */
  dropFt?: number
  intensity?: number
  colorTempK?: number
  on: boolean
}

export type LightFixtureType =
  | 'downlight'
  | 'panel'
  | 'pendant'
  | 'track'
  | 'cove'
  | 'sconce'
  | 'floor-lamp'
  | 'chandelier'

export type LightLayer = 'ambient' | 'task' | 'accent'

export interface SigeLight {
  id: string
  roomId: string
  fixtureType: LightFixtureType
  layer: LightLayer

  /** 2D position (plan pixels) */
  x: number
  y: number

  /** mounting */
  mountHeightFt: number
  wallOffsetFt?: number

  /** output */
  lumens: number
  beamAngleDeg: number
  dimLevel: number

  /** color quality */
  colorTempK: number
  cri: number

  /** control grouping */
  circuitId: string

  /** track-only */
  trackAzimuthDeg?: number
  trackElevationDeg?: number

  /** state */
  isOn: boolean
  hidden: boolean
}

export function createDefaultLight(
  overrides: Partial<SigeLight> & { id: string; x: number; y: number; roomId: string },
): SigeLight {
  return {
    fixtureType: 'downlight',
    layer: 'ambient',
    mountHeightFt: 8,
    lumens: 800,
    beamAngleDeg: 38,
    dimLevel: 100,
    colorTempK: 3000,
    cri: 90,
    circuitId: 'circuit-A',
    isOn: true,
    hidden: false,
    ...overrides,
  }
}

export const LUX_TARGETS: Record<string, { min: number; target: number; label: string }> = {
  bedroom: { min: 100, target: 200, label: 'Bedroom' },
  bedroom_task: { min: 300, target: 400, label: 'Bedroom reading' },
  living: { min: 150, target: 300, label: 'Living room' },
  kitchen: { min: 200, target: 300, label: 'Kitchen ambient' },
  kitchen_task: { min: 400, target: 600, label: 'Kitchen counters' },
  bathroom: { min: 200, target: 400, label: 'Bathroom' },
  bathroom_mirror: { min: 500, target: 700, label: 'Bathroom mirror' },
  office: { min: 300, target: 500, label: 'Home office' },
  dining: { min: 150, target: 250, label: 'Dining room' },
  hallway: { min: 80, target: 150, label: 'Hallway' },
  default: { min: 100, target: 200, label: 'General' },
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
  /** Vertical lift in 3D (feet). 0 = on floor. */
  elevationFt?: number
  /** Locked components cannot be moved/resized/rotated/deleted accidentally. */
  locked?: boolean
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
  | { type: 'ADD_VIEW_POST'; post: ViewPost }
  | { type: 'UPDATE_VIEW_POST'; id: string; before: ViewPost; after: ViewPost }
  | { type: 'REMOVE_VIEW_POST'; post: ViewPost }
  | { type: 'ADD_WALL'; wall: Wall }
  | { type: 'UPDATE_WALL'; id: string; before: Wall; after: Wall }
  | { type: 'REMOVE_WALL'; wall: Wall }
  | { type: 'ADD_DOOR'; door: Door }
  | { type: 'UPDATE_DOOR'; id: string; before: Door; after: Door }
  | { type: 'REMOVE_DOOR'; door: Door }
  | { type: 'ADD_WINDOW'; window: Window }
  | { type: 'UPDATE_WINDOW'; id: string; before: Window; after: Window }
  | { type: 'REMOVE_WINDOW'; window: Window }
  | { type: 'ADD_CEILING'; ceiling: Ceiling }
  | { type: 'UPDATE_CEILING'; id: string; before: Ceiling; after: Ceiling }
  | { type: 'REMOVE_CEILING'; ceiling: Ceiling }
  | { type: 'ADD_LIGHT'; light: SigeLight }
  | { type: 'UPDATE_LIGHT'; id: string; before: SigeLight; after: SigeLight }
  | { type: 'REMOVE_LIGHT'; light: SigeLight }
  | { type: 'BATCH_ADD_LIGHTS'; lights: SigeLight[] }
  | { type: 'BATCH_REMOVE_LIGHTS'; lights: SigeLight[] }
  | { type: 'ADD_CONNECTION_POINT'; point: ConnectionPoint }
  | { type: 'REMOVE_CONNECTION_POINT'; point: ConnectionPoint }
  | { type: 'UPDATE_CONNECTION_POINT'; id: string; before: ConnectionPoint; after: ConnectionPoint }
  | { type: 'SET_GRID_SIZE_FT'; before: number; after: number }
  | { type: 'SET_MIN_PATH_WIDTH_FT'; before: number; after: number }
  | {
      type: 'SET_LAYER_FLAGS'
      before: { showGrid: boolean; showHeatmap: boolean; showCirculation: boolean }
      after: { showGrid: boolean; showHeatmap: boolean; showCirculation: boolean }
    }
  | { type: 'SET_SHOW_FLOOR_PLAN_IMAGE'; before: boolean; after: boolean }
  | { type: 'SET_SCALE'; before: ScaleState | null; after: ScaleState | null }
  | { type: 'ROTATE_FLOOR_PLAN'; before: 0 | 90 | 180 | 270; after: 0 | 90 | 180 | 270 }

export type Tool =
  | 'select'
  | 'calibrate'
  | 'connection'
  | 'room'
  | 'wall'
  | 'door'
  | 'window'
  | 'ceiling'
  | 'ceilingLight'
  | 'viewPost'
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
