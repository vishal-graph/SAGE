import { create } from 'zustand'
import type {
  Ceiling,
  ConnectionPoint,
  Door,
  FurnitureItem,
  HistoryAction,
  Room,
  ScaleState,
  SigeLight,
  ViewPost,
  Tool,
  Wall,
  Window,
} from '../types'
import type { Preset } from '../utils/furnitureLib'
import { normalizeFurnitureFromPayload } from '../utils/furnitureLib'
import { createDefaultLight } from '../types'
import { type LuxGrid, suggestDownlightPositions } from '../utils/lightingEngine'

function pointInPolygonPx(px: number, py: number, poly: [number, number][]): boolean {
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

const HISTORY_MAX = 50

export type PanelKey = 'library' | 'metrics' | 'view'

export type FloorViewMode = '2d' | '3d'

export type RenderBrightnessMode = 'normal' | 'dark'

function trimHistory<T>(arr: T[]): T[] {
  if (arr.length <= HISTORY_MAX) return arr
  return arr.slice(arr.length - HISTORY_MAX)
}

export interface SigeState {
  imageUrl: string | null
  imageFilename: string | null
  imageNaturalWidth: number
  imageNaturalHeight: number
  scale: ScaleState | null
  gridSizeFt: number
  minPathWidthFt: number
  wallDefaultThicknessFt: number
  wallDefaultHeightFt: number
  rooms: Room[]
  viewPosts: ViewPost[]
  connectionPoints: ConnectionPoint[]
  walls: Wall[]
  doors: Door[]
  windows: Window[]
  ceilings: Ceiling[]
  lights: SigeLight[]
  furniture: FurnitureItem[]

  tool: Tool
  snapToGrid: boolean
  /** Wall draw / edit: constrain segment to grid multiples of 45° */
  angleLockEnabled: boolean
  /** Transient UI: snap hover indicator position on floor plan (plan px); not persisted */
  wallSnapIndicator: null | { planX: number; planY: number; snapped: boolean }
  showGrid: boolean
  showHeatmap: boolean
  showCirculation: boolean
  showWalls: boolean
  showDoors: boolean
  showWindows: boolean
  showCeilings: boolean
  showLights: boolean
  showLuxHeatmap: boolean
  renderBrightness: RenderBrightnessMode
  /** Override: show ceiling even when camera is below it */
  forceShowCeilings: boolean
  /** When false, floor plan artwork is hidden so only grid + drawn walls/doors show clearly */
  showFloorPlanImage: boolean
  /** Gemini image model generating a clean walls+doors raster */
  aiCleanPlanLoading: boolean
  setAiCleanPlanLoading: (v: boolean) => void
  pendingFurniturePreset: Preset | null
  selectedFurnitureId: string | null
  selectedWallId: string | null
  selectedWallIds: string[]
  selectedDoorId: string | null
  selectedWindowId: string | null
  selectedCeilingId: string | null
  selectedLightId: string | null
  selectedViewPostId: string | null
  postViewActive: boolean

  luxAnalysis: Record<string, LuxGrid>
  luxAnalysisDirty: boolean
  /** 2D Konva vs 3D R3F floor view */
  floorViewMode: FloorViewMode
  setFloorViewMode: (m: FloorViewMode) => void

  /** 2D canvas only: rotate plan + overlays 90° CW steps around image center */
  floorPlanRotationDeg: 0 | 90 | 180 | 270
  rotateFloorPlan90: () => void

  past: HistoryAction[]
  future: HistoryAction[]

  calibrateStep: 0 | 1 | 2

  projectId: string | null

  /** Floating panel visibility (responsive / user preference) */
  openPanels: Record<PanelKey, boolean>
  setPanelOpen: (key: PanelKey, open: boolean) => void
  togglePanel: (key: PanelKey) => void

  setImage: (
    url: string | null,
    filename: string | null,
    w: number,
    h: number,
    preserveRotation?: boolean,
  ) => void
  setScale: (s: ScaleState) => void
  setGridSizeFt: (v: number) => void
  setMinPathWidthFt: (v: number) => void
  setWallDefaults: (p: Partial<{ thicknessFt: number; heightFt: number }>) => void
  setTool: (t: Tool) => void
  setSnapToGrid: (v: boolean) => void
  setAngleLockEnabled: (v: boolean) => void
  setWallSnapIndicator: (v: SigeState['wallSnapIndicator']) => void
  setLayerFlags: (p: Partial<{ showGrid: boolean; showHeatmap: boolean; showCirculation: boolean }>) => void
  setStructureVisibility: (
    p: Partial<{ showWalls: boolean; showDoors: boolean; showWindows: boolean; showCeilings: boolean; showLights: boolean }>,
  ) => void
  setForceShowCeilings: (v: boolean) => void
  setShowFloorPlanImage: (v: boolean) => void
  setPendingPreset: (p: Preset | null) => void
  setSelectedFurnitureId: (id: string | null) => void
  setSelectedWallId: (id: string | null) => void
  setSelectedWallIds: (ids: string[]) => void
  toggleSelectedWallId: (id: string) => void
  setSelectedDoorId: (id: string | null) => void
  setSelectedWindowId: (id: string | null) => void
  setSelectedCeilingId: (id: string | null) => void
  setSelectedLightId: (id: string | null) => void
  invalidateLuxAnalysis: () => void
  setLuxAnalysis: (p: { analysis: Record<string, LuxGrid> }) => void
  setShowLuxHeatmap: (v: boolean) => void
  setRenderBrightness: (m: RenderBrightnessMode) => void
  setCalibrateStep: (s: 0 | 1 | 2) => void
  setProjectId: (id: string | null) => void

  pushHistory: (a: HistoryAction) => void
  undo: () => void
  redo: () => void

  addRoom: (room: Room) => void
  removeRoom: (id: string) => void
  addViewPost: (post: ViewPost) => void
  updateViewPost: (id: string, patch: Partial<ViewPost>) => void
  removeViewPost: (id: string) => void
  setSelectedViewPostId: (id: string | null) => void
  setPostViewActive: (v: boolean) => void
  addConnectionPoint: (point: ConnectionPoint) => void
  removeConnectionPoint: (id: string) => void
  updateConnectionPoint: (id: string, patch: Partial<Pick<ConnectionPoint, 'x' | 'y'>>) => void
  addWall: (wall: Wall) => void
  removeWall: (id: string) => void
  updateWall: (
    id: string,
    patch: Partial<
      Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2' | 'thicknessFt' | 'heightFt' | 'color' | 'hidden'>
    >,
  ) => void
  /** Translate selected walls by Δpixels + anchored nodes ± epsilon sync */
  snapWallsRigid: (wallIds: string[], dxPx: number, dyPx: number) => void
  addDoor: (door: Door) => void
  updateDoor: (
    id: string,
    patch: Partial<Pick<Door, 'isOpen' | 'swingMode' | 'hasTopLayer' | 'material'>>,
  ) => void
  removeDoor: (id: string) => void
  addWindow: (window: Window) => void
  updateWindow: (
    id: string,
    patch: Partial<Pick<Window, 'sillHeightFt' | 'heightFt' | 'frameDepthFt' | 'frameThicknessFt' | 'material'>>,
  ) => void
  removeWindow: (id: string) => void
  addCeiling: (ceiling: Ceiling) => void
  updateCeiling: (
    id: string,
    patch: Partial<Pick<Ceiling, 'polygon' | 'roomId' | 'type' | 'heightFt' | 'thicknessFt' | 'dropFt' | 'color' | 'hidden'>>,
  ) => void
  removeCeiling: (id: string) => void
  addLight: (light: SigeLight) => void
  updateLight: (
    id: string,
    patch: Partial<SigeLight>,
  ) => void
  removeLight: (id: string) => void
  toggleLightOn: (id: string) => void
  autoPlaceDownlights: (roomId: string) => void
  addFurniture: (item: FurnitureItem, recordHistory?: boolean) => void
  removeFurniture: (id: string, recordHistory?: boolean) => void
  moveFurniture: (
    id: string,
    gridX: number,
    gridY: number,
    offset: [number, number],
    recordHistory?: boolean,
    prev?: { gx: number; gy: number; off: [number, number] },
  ) => void
  rotateFurniture: (id: string) => void
  updateFurniture: (
    id: string,
    patch: Partial<
      Pick<FurnitureItem, 'gridX' | 'gridY' | 'widthFt' | 'depthFt' | 'rotation' | 'freeOffsetPx' | 'elevationFt' | 'locked'>
    >,
    recordHistory?: boolean,
  ) => void

  loadProjectPayload: (payload: Record<string, unknown>) => void
}

function reverseAction(get: () => SigeState, set: (fn: (s: SigeState) => Partial<SigeState>) => void) {
  return (a: HistoryAction) => {
    const st = get()
    switch (a.type) {
      case 'ADD_FURNITURE':
        set(() => ({
          furniture: st.furniture.filter((x) => x.id !== a.item.id),
        }))
        break
      case 'MOVE_FURNITURE': {
        set(() => ({
          furniture: st.furniture.map((x) =>
            x.id === a.id
              ? { ...x, gridX: a.from[0], gridY: a.from[1], freeOffsetPx: [...a.fromOffset] as [number, number] }
              : x,
          ),
        }))
        break
      }
      case 'UPDATE_FURNITURE':
        set(() => ({
          furniture: st.furniture.map((x) => (x.id === a.id ? { ...a.before } : x)),
        }))
        break
      case 'REMOVE_FURNITURE':
        set(() => ({ furniture: [...st.furniture, a.item] }))
        break
      case 'ADD_ROOM':
        set(() => ({ rooms: st.rooms.filter((r) => r.id !== a.room.id) }))
        break
      case 'REMOVE_ROOM':
        set(() => ({ rooms: [...st.rooms, a.room] }))
        break
      case 'ADD_VIEW_POST':
        set(() => ({ viewPosts: st.viewPosts.filter((p) => p.id !== a.post.id) }))
        break
      case 'UPDATE_VIEW_POST':
        set(() => ({ viewPosts: st.viewPosts.map((p) => (p.id === a.id ? { ...a.before } : p)) }))
        break
      case 'REMOVE_VIEW_POST':
        set(() => ({ viewPosts: [...st.viewPosts, a.post] }))
        break
      case 'ADD_CONNECTION_POINT':
        set(() => ({ connectionPoints: st.connectionPoints.filter((p) => p.id !== a.point.id) }))
        break
      case 'REMOVE_CONNECTION_POINT':
        set(() => ({ connectionPoints: [...st.connectionPoints, a.point] }))
        break
      case 'UPDATE_CONNECTION_POINT':
        set(() => ({
          connectionPoints: st.connectionPoints.map((p) => (p.id === a.id ? { ...a.before } : p)),
        }))
        break
      case 'ADD_WALL':
        set(() => ({ walls: st.walls.filter((w) => w.id !== a.wall.id) }))
        break
      case 'REMOVE_WALL':
        set(() => ({ walls: [...st.walls, a.wall] }))
        break
      case 'UPDATE_WALL':
        set(() => ({
          walls: st.walls.map((w) => (w.id === a.id ? { ...a.before } : w)),
        }))
        break
      case 'ADD_DOOR':
        set(() => ({ doors: st.doors.filter((d) => d.id !== a.door.id) }))
        break
      case 'UPDATE_DOOR':
        set(() => ({
          doors: st.doors.map((d) => (d.id === a.id ? { ...a.before } : d)),
        }))
        break
      case 'REMOVE_DOOR':
        set(() => ({ doors: [...st.doors, a.door] }))
        break
      case 'ADD_WINDOW':
        set(() => ({ windows: st.windows.filter((w) => w.id !== a.window.id) }))
        break
      case 'UPDATE_WINDOW':
        set(() => ({
          windows: st.windows.map((w) => (w.id === a.id ? { ...a.before } : w)),
        }))
        break
      case 'REMOVE_WINDOW':
        set(() => ({ windows: [...st.windows, a.window] }))
        break
      case 'ADD_CEILING':
        set(() => ({ ceilings: st.ceilings.filter((c) => c.id !== a.ceiling.id) }))
        break
      case 'UPDATE_CEILING':
        set(() => ({ ceilings: st.ceilings.map((c) => (c.id === a.id ? { ...a.before } : c)) }))
        break
      case 'REMOVE_CEILING':
        set(() => ({ ceilings: [...st.ceilings, a.ceiling] }))
        break
      case 'ADD_LIGHT':
        set(() => ({ lights: st.lights.filter((l) => l.id !== a.light.id) }))
        break
      case 'UPDATE_LIGHT':
        set(() => ({ lights: st.lights.map((l) => (l.id === a.id ? { ...a.before } : l)) }))
        break
      case 'REMOVE_LIGHT':
        set(() => ({ lights: [...st.lights, a.light] }))
        break
      case 'BATCH_ADD_LIGHTS':
        set(() => ({ lights: st.lights.filter((l) => !a.lights.some((x) => x.id === l.id)) }))
        break
      case 'BATCH_REMOVE_LIGHTS':
        set(() => ({ lights: [...st.lights, ...a.lights] }))
        break
      case 'SET_GRID_SIZE_FT':
        set(() => ({ gridSizeFt: a.before }))
        break
      case 'SET_MIN_PATH_WIDTH_FT':
        set(() => ({ minPathWidthFt: a.before }))
        break
      case 'SET_LAYER_FLAGS':
        set(() => ({ ...a.before }))
        break
      case 'SET_SHOW_FLOOR_PLAN_IMAGE':
        set(() => ({ showFloorPlanImage: a.before }))
        break
      case 'SET_SCALE':
        set(() => ({ scale: a.before }))
        break
      case 'ROTATE_FLOOR_PLAN':
        set(() => ({ floorPlanRotationDeg: a.before }))
        break
      default:
        break
    }
  }
}

function applyAction(get: () => SigeState, set: (fn: (s: SigeState) => Partial<SigeState>) => void) {
  return (a: HistoryAction) => {
    const st = get()
    switch (a.type) {
      case 'ADD_FURNITURE':
        set(() => ({ furniture: [...st.furniture, a.item] }))
        break
      case 'MOVE_FURNITURE':
        set(() => ({
          furniture: st.furniture.map((x) =>
            x.id === a.id
              ? { ...x, gridX: a.to[0], gridY: a.to[1], freeOffsetPx: [...a.toOffset] as [number, number] }
              : x,
          ),
        }))
        break
      case 'UPDATE_FURNITURE':
        set(() => ({
          furniture: st.furniture.map((x) => (x.id === a.id ? { ...a.after } : x)),
        }))
        break
      case 'REMOVE_FURNITURE':
        set(() => ({ furniture: st.furniture.filter((x) => x.id !== a.item.id) }))
        break
      case 'ADD_ROOM':
        set(() => ({ rooms: [...st.rooms, a.room] }))
        break
      case 'REMOVE_ROOM':
        set(() => ({ rooms: st.rooms.filter((r) => r.id !== a.room.id) }))
        break
      case 'ADD_VIEW_POST':
        set(() => ({ viewPosts: [...st.viewPosts, a.post] }))
        break
      case 'UPDATE_VIEW_POST':
        set(() => ({ viewPosts: st.viewPosts.map((p) => (p.id === a.id ? { ...a.after } : p)) }))
        break
      case 'REMOVE_VIEW_POST':
        set(() => ({ viewPosts: st.viewPosts.filter((p) => p.id !== a.post.id) }))
        break
      case 'ADD_CONNECTION_POINT':
        set(() => ({ connectionPoints: [...st.connectionPoints, a.point] }))
        break
      case 'REMOVE_CONNECTION_POINT':
        set(() => ({ connectionPoints: st.connectionPoints.filter((p) => p.id !== a.point.id) }))
        break
      case 'UPDATE_CONNECTION_POINT':
        set(() => ({
          connectionPoints: st.connectionPoints.map((p) => (p.id === a.id ? { ...a.after } : p)),
        }))
        break
      case 'ADD_WALL':
        set(() => ({ walls: [...st.walls, a.wall] }))
        break
      case 'REMOVE_WALL':
        set(() => ({ walls: st.walls.filter((w) => w.id !== a.wall.id) }))
        break
      case 'UPDATE_WALL':
        set(() => ({
          walls: st.walls.map((w) => (w.id === a.id ? { ...a.after } : w)),
        }))
        break
      case 'ADD_DOOR':
        set(() => ({ doors: [...st.doors, a.door] }))
        break
      case 'UPDATE_DOOR':
        set(() => ({
          doors: st.doors.map((d) => (d.id === a.id ? { ...a.after } : d)),
        }))
        break
      case 'REMOVE_DOOR':
        set(() => ({ doors: st.doors.filter((d) => d.id !== a.door.id) }))
        break
      case 'ADD_WINDOW':
        set(() => ({ windows: [...st.windows, a.window] }))
        break
      case 'UPDATE_WINDOW':
        set(() => ({
          windows: st.windows.map((w) => (w.id === a.id ? { ...a.after } : w)),
        }))
        break
      case 'REMOVE_WINDOW':
        set(() => ({ windows: st.windows.filter((w) => w.id !== a.window.id) }))
        break
      case 'ADD_CEILING':
        set(() => ({ ceilings: [...st.ceilings, a.ceiling] }))
        break
      case 'UPDATE_CEILING':
        set(() => ({ ceilings: st.ceilings.map((c) => (c.id === a.id ? { ...a.after } : c)) }))
        break
      case 'REMOVE_CEILING':
        set(() => ({ ceilings: st.ceilings.filter((c) => c.id !== a.ceiling.id) }))
        break
      case 'ADD_LIGHT':
        set(() => ({ lights: [...st.lights, a.light] }))
        break
      case 'UPDATE_LIGHT':
        set(() => ({ lights: st.lights.map((l) => (l.id === a.id ? { ...a.after } : l)) }))
        break
      case 'REMOVE_LIGHT':
        set(() => ({ lights: st.lights.filter((l) => l.id !== a.light.id) }))
        break
      case 'BATCH_ADD_LIGHTS':
        set(() => ({ lights: [...st.lights, ...a.lights] }))
        break
      case 'BATCH_REMOVE_LIGHTS':
        set(() => ({ lights: st.lights.filter((l) => !a.lights.some((x) => x.id === l.id)) }))
        break
      case 'SET_GRID_SIZE_FT':
        set(() => ({ gridSizeFt: a.after }))
        break
      case 'SET_MIN_PATH_WIDTH_FT':
        set(() => ({ minPathWidthFt: a.after }))
        break
      case 'SET_LAYER_FLAGS':
        set(() => ({ ...a.after }))
        break
      case 'SET_SHOW_FLOOR_PLAN_IMAGE':
        set(() => ({ showFloorPlanImage: a.after }))
        break
      case 'SET_SCALE':
        set(() => ({ scale: a.after }))
        break
      case 'ROTATE_FLOOR_PLAN':
        set(() => ({ floorPlanRotationDeg: a.after }))
        break
      default:
        break
    }
  }
}

export const useSigeStore = create<SigeState>((set, get) => {
  const rev = reverseAction(get, set)
  const app = applyAction(get, set)

  return {
    imageUrl: null,
    imageFilename: null,
    imageNaturalWidth: 800,
    imageNaturalHeight: 600,
    scale: null,
    gridSizeFt: 2,
    minPathWidthFt: 2,
    wallDefaultThicknessFt: 0.5,
    wallDefaultHeightFt: 8,
    rooms: [],
    viewPosts: [],
    connectionPoints: [],
    walls: [],
    doors: [],
    windows: [],
    ceilings: [],
    lights: [],
    furniture: [],

    tool: 'select',
    snapToGrid: true,
    angleLockEnabled: true,
    wallSnapIndicator: null,
    showGrid: true,
    showHeatmap: false,
    showCirculation: false,
    showWalls: true,
    showDoors: true,
    showWindows: true,
    showCeilings: true,
    showLights: true,
    showLuxHeatmap: false,
    renderBrightness: 'normal',
    forceShowCeilings: false,
    showFloorPlanImage: true,
    aiCleanPlanLoading: false,
    setAiCleanPlanLoading: (v) => set({ aiCleanPlanLoading: v }),
    pendingFurniturePreset: null,
    selectedFurnitureId: null,
    selectedWallId: null,
    selectedWallIds: [],
    selectedDoorId: null,
    selectedWindowId: null,
    selectedCeilingId: null,
    selectedLightId: null,
    selectedViewPostId: null,
    postViewActive: false,
    luxAnalysis: {},
    luxAnalysisDirty: true,
    floorViewMode: '2d',
    setFloorViewMode: (m) => set({ floorViewMode: m }),

    floorPlanRotationDeg: 0,
    rotateFloorPlan90: () =>
      set((s) => {
        const order = [0, 90, 180, 270] as const
        const i = order.indexOf(s.floorPlanRotationDeg)
        const next = order[(i + 1) % 4]
        get().pushHistory({
          type: 'ROTATE_FLOOR_PLAN',
          before: s.floorPlanRotationDeg,
          after: next,
        })
        return { floorPlanRotationDeg: next }
      }),

    past: [],
    future: [],

    calibrateStep: 0,
    projectId: null,

    openPanels: { library: true, metrics: true, view: true },
    setPanelOpen: (key, open) =>
      set((s) => ({ openPanels: { ...s.openPanels, [key]: open } })),
    togglePanel: (key) =>
      set((s) => ({ openPanels: { ...s.openPanels, [key]: !s.openPanels[key] } })),

    setImage: (url, filename, w, h, preserveRotation = false) =>
      set({
        imageUrl: url,
        imageFilename: filename,
        imageNaturalWidth: w,
        imageNaturalHeight: h,
        ...(preserveRotation ? {} : { floorPlanRotationDeg: 0 as const }),
      }),
    setScale: (s) =>
      set((st) => {
        get().pushHistory({ type: 'SET_SCALE', before: st.scale, after: s })
        return { scale: s }
      }),
    setGridSizeFt: (v) =>
      set((st) => {
        const next = Math.max(0.25, v)
        if (st.gridSizeFt !== next) {
          get().pushHistory({ type: 'SET_GRID_SIZE_FT', before: st.gridSizeFt, after: next })
        }
        return { gridSizeFt: next }
      }),
    setMinPathWidthFt: (v) =>
      set((st) => {
        const next = Math.max(0.5, v)
        if (st.minPathWidthFt !== next) {
          get().pushHistory({ type: 'SET_MIN_PATH_WIDTH_FT', before: st.minPathWidthFt, after: next })
        }
        return { minPathWidthFt: next }
      }),
    setWallDefaults: (p) =>
      set((s) => ({
        wallDefaultThicknessFt:
          p.thicknessFt != null ? Math.max(0.05, Number(p.thicknessFt)) : s.wallDefaultThicknessFt,
        wallDefaultHeightFt: p.heightFt != null ? Math.max(0.5, Number(p.heightFt)) : s.wallDefaultHeightFt,
      })),
    setTool: (t) => set({ tool: t }),
    setSnapToGrid: (v) => set({ snapToGrid: v }),
    setAngleLockEnabled: (v) => set({ angleLockEnabled: v }),
    setWallSnapIndicator: (v) => set({ wallSnapIndicator: v }),
    setLayerFlags: (p) =>
      set((st) => {
        const before = {
          showGrid: st.showGrid,
          showHeatmap: st.showHeatmap,
          showCirculation: st.showCirculation,
        }
        const after = {
          showGrid: p.showGrid ?? st.showGrid,
          showHeatmap: p.showHeatmap ?? st.showHeatmap,
          showCirculation: p.showCirculation ?? st.showCirculation,
        }
        if (
          before.showGrid !== after.showGrid ||
          before.showHeatmap !== after.showHeatmap ||
          before.showCirculation !== after.showCirculation
        ) {
          get().pushHistory({ type: 'SET_LAYER_FLAGS', before, after })
        }
        return p
      }),
    setStructureVisibility: (p) =>
      set((s) => ({
        showWalls: p.showWalls ?? s.showWalls,
        showDoors: p.showDoors ?? s.showDoors,
        showWindows: p.showWindows ?? s.showWindows,
        showCeilings: p.showCeilings ?? s.showCeilings,
        showLights: p.showLights ?? s.showLights,
      })),
    setForceShowCeilings: (v) => set(() => ({ forceShowCeilings: v })),
    setShowFloorPlanImage: (v) =>
      set((st) => {
        if (st.showFloorPlanImage !== v) {
          get().pushHistory({ type: 'SET_SHOW_FLOOR_PLAN_IMAGE', before: st.showFloorPlanImage, after: v })
        }
        return { showFloorPlanImage: v }
      }),
    setPendingPreset: (p) => set({ pendingFurniturePreset: p }),
    setSelectedFurnitureId: (id) => set({ selectedFurnitureId: id }),
    setSelectedWallId: (id) => set({ selectedWallId: id, selectedWallIds: id ? [id] : [] }),
    setSelectedWallIds: (ids) =>
      set(() => {
        const uniq = Array.from(new Set(ids))
        return { selectedWallIds: uniq, selectedWallId: uniq[0] ?? null }
      }),
    toggleSelectedWallId: (id) =>
      set((s) => {
        const has = s.selectedWallIds.includes(id)
        const next = has ? s.selectedWallIds.filter((w) => w !== id) : [...s.selectedWallIds, id]
        return { selectedWallIds: next, selectedWallId: next[0] ?? null }
      }),
    setSelectedDoorId: (id) => set({ selectedDoorId: id }),
    setSelectedWindowId: (id) => set({ selectedWindowId: id }),
    setSelectedCeilingId: (id) => set({ selectedCeilingId: id }),
    setSelectedLightId: (id) => set({ selectedLightId: id }),
    setSelectedViewPostId: (id) => set({ selectedViewPostId: id }),
    setPostViewActive: (v) => set({ postViewActive: v }),
    invalidateLuxAnalysis: () => set({ luxAnalysisDirty: true }),
    setLuxAnalysis: ({ analysis }) => set({ luxAnalysis: analysis, luxAnalysisDirty: false }),
    setShowLuxHeatmap: (v) => set({ showLuxHeatmap: v }),
    setRenderBrightness: (m) => set({ renderBrightness: m }),
    setCalibrateStep: (s) => set({ calibrateStep: s }),
    setProjectId: (id) => set({ projectId: id }),

    pushHistory: (a) =>
      set((st) => ({
        past: trimHistory([...st.past, a]),
        future: [],
      })),

    undo: () => {
      const st = get()
      if (st.past.length === 0) return
      const last = st.past[st.past.length - 1]
      rev(last)
      set({
        past: st.past.slice(0, -1),
        future: [last, ...st.future],
      })
    },

    redo: () => {
      const st = get()
      if (st.future.length === 0) return
      const [next, ...rest] = st.future
      app(next)
      set({
        past: trimHistory([...st.past, next]),
        future: rest,
      })
    },

    addRoom: (room) => {
      get().pushHistory({ type: 'ADD_ROOM', room })
      set((s) => ({ rooms: [...s.rooms, room] }))
    },
    removeRoom: (id) => {
      const room = get().rooms.find((r) => r.id === id)
      if (!room) return
      get().pushHistory({ type: 'REMOVE_ROOM', room })
      set((s) => ({ rooms: s.rooms.filter((r) => r.id !== id) }))
    },
    addViewPost: (post) => {
      get().pushHistory({ type: 'ADD_VIEW_POST', post })
      set((s) => ({ viewPosts: [...s.viewPosts, post] }))
    },
    updateViewPost: (id, patch) => {
      const st = get()
      const cur = st.viewPosts.find((p) => p.id === id)
      if (!cur) return
      const after: ViewPost = { ...cur, ...patch }
      get().pushHistory({ type: 'UPDATE_VIEW_POST', id, before: { ...cur }, after })
      set((s) => ({ viewPosts: s.viewPosts.map((p) => (p.id === id ? after : p)) }))
    },
    removeViewPost: (id) => {
      const post = get().viewPosts.find((p) => p.id === id)
      if (!post) return
      get().pushHistory({ type: 'REMOVE_VIEW_POST', post })
      set((s) => ({
        viewPosts: s.viewPosts.filter((p) => p.id !== id),
        selectedViewPostId: s.selectedViewPostId === id ? null : s.selectedViewPostId,
        postViewActive: s.selectedViewPostId === id ? false : s.postViewActive,
      }))
    },
    addConnectionPoint: (point) => {
      get().pushHistory({ type: 'ADD_CONNECTION_POINT', point })
      set((s) => ({ connectionPoints: [...s.connectionPoints, point] }))
    },
    removeConnectionPoint: (id) => {
      const point = get().connectionPoints.find((p) => p.id === id)
      if (!point) return
      get().pushHistory({ type: 'REMOVE_CONNECTION_POINT', point })
      set((s) => ({ connectionPoints: s.connectionPoints.filter((p) => p.id !== id) }))
    },
    updateConnectionPoint: (id, patch) => {
      const st = get()
      const cur = st.connectionPoints.find((p) => p.id === id)
      if (!cur) return
      const after = { ...cur, ...patch }
      get().pushHistory({ type: 'UPDATE_CONNECTION_POINT', id, before: { ...cur }, after })
      set((s) => ({
        connectionPoints: s.connectionPoints.map((p) => (p.id === id ? after : p)),
      }))
    },
    addWall: (wall) => {
      const st = get()
      const normalized: Wall = {
        ...wall,
        thicknessFt: wall.thicknessFt ?? st.wallDefaultThicknessFt,
        heightFt: wall.heightFt ?? st.wallDefaultHeightFt,
      }
      get().pushHistory({ type: 'ADD_WALL', wall: normalized })
      set((s) => ({ walls: [...s.walls, normalized] }))
    },
    removeWall: (id) => {
      const wall = get().walls.find((w) => w.id === id)
      if (!wall) return
      get().pushHistory({ type: 'REMOVE_WALL', wall })
      set((s) => ({
        walls: s.walls.filter((w) => w.id !== id),
        selectedWallId: s.selectedWallId === id ? null : s.selectedWallId,
        selectedWallIds: s.selectedWallIds.filter((w) => w !== id),
      }))
    },
    updateWall: (id, patch) => {
      const st = get()
      const cur = st.walls.find((w) => w.id === id)
      if (!cur) return
      const after = { ...cur, ...patch }
      get().pushHistory({ type: 'UPDATE_WALL', id, before: { ...cur }, after })
      set((s) => ({
        walls: s.walls.map((w) => (w.id === id ? after : w)),
      }))
    },
    snapWallsRigid: (wallIds, dxPx, dyPx) => {
      if (!wallIds.length) return
      const st = get()
      const idSet = new Set(wallIds)
      const selectedWalls = st.walls.filter((w) => idSet.has(w.id))
      if (!selectedWalls.length) return
      const EPS = 0.6

      const endpointKeys = new Set<string>()
      for (const w of selectedWalls) {
        endpointKeys.add(`${w.x1.toFixed(3)}|${w.y1.toFixed(3)}`)
        endpointKeys.add(`${w.x2.toFixed(3)}|${w.y2.toFixed(3)}`)
      }

      for (const wall of selectedWalls) {
        get().updateWall(wall.id, {
          x1: wall.x1 + dxPx,
          y1: wall.y1 + dyPx,
          x2: wall.x2 + dxPx,
          y2: wall.y2 + dyPx,
        })
      }

      for (const cp of st.connectionPoints) {
        const key = `${cp.x.toFixed(3)}|${cp.y.toFixed(3)}`
        if (endpointKeys.has(key)) {
          get().updateConnectionPoint(cp.id, { x: cp.x + dxPx, y: cp.y + dyPx })
          continue
        }
        for (const w of selectedWalls) {
          const nearA = Math.hypot(cp.x - w.x1, cp.y - w.y1) <= EPS
          const nearB = Math.hypot(cp.x - w.x2, cp.y - w.y2) <= EPS
          if (nearA || nearB) {
            get().updateConnectionPoint(cp.id, { x: cp.x + dxPx, y: cp.y + dyPx })
            break
          }
        }
      }
    },
    addDoor: (door) => {
      get().pushHistory({ type: 'ADD_DOOR', door })
      set((s) => ({ doors: [...s.doors, door] }))
    },
    updateDoor: (id, patch) => {
      const st = get()
      const cur = st.doors.find((d) => d.id === id)
      if (!cur) return
      const after = { ...cur, ...patch }
      get().pushHistory({ type: 'UPDATE_DOOR', id, before: { ...cur }, after })
      set((s) => ({
        doors: s.doors.map((d) => (d.id === id ? after : d)),
      }))
    },
    removeDoor: (id) => {
      const door = get().doors.find((d) => d.id === id)
      if (!door) return
      get().pushHistory({ type: 'REMOVE_DOOR', door })
      set((s) => ({
        doors: s.doors.filter((d) => d.id !== id),
        selectedDoorId: s.selectedDoorId === id ? null : s.selectedDoorId,
      }))
    },
    addWindow: (window) => {
      get().pushHistory({ type: 'ADD_WINDOW', window })
      set((s) => ({ windows: [...s.windows, window] }))
    },
    updateWindow: (id, patch) => {
      const st = get()
      const cur = st.windows.find((w) => w.id === id)
      if (!cur) return
      const after = { ...cur, ...patch }
      get().pushHistory({ type: 'UPDATE_WINDOW', id, before: { ...cur }, after })
      set((s) => ({
        windows: s.windows.map((w) => (w.id === id ? after : w)),
      }))
    },
    removeWindow: (id) => {
      const window = get().windows.find((w) => w.id === id)
      if (!window) return
      get().pushHistory({ type: 'REMOVE_WINDOW', window })
      set((s) => ({
        windows: s.windows.filter((w) => w.id !== id),
        selectedWindowId: s.selectedWindowId === id ? null : s.selectedWindowId,
      }))
    },

    addCeiling: (ceiling) => {
      get().pushHistory({ type: 'ADD_CEILING', ceiling })
      set((s) => ({ ceilings: [...s.ceilings, ceiling] }))
    },
    updateCeiling: (id, patch) => {
      const st = get()
      const cur = st.ceilings.find((c) => c.id === id)
      if (!cur) return
      const after: Ceiling = { ...cur, ...patch }
      get().pushHistory({ type: 'UPDATE_CEILING', id, before: { ...cur }, after })
      set((s) => ({ ceilings: s.ceilings.map((c) => (c.id === id ? after : c)) }))
    },
    removeCeiling: (id) => {
      const ceiling = get().ceilings.find((c) => c.id === id)
      if (!ceiling) return
      get().pushHistory({ type: 'REMOVE_CEILING', ceiling })
      set((s) => ({
        ceilings: s.ceilings.filter((c) => c.id !== id),
        selectedCeilingId: s.selectedCeilingId === id ? null : s.selectedCeilingId,
      }))
    },

    addLight: (light) => {
      get().pushHistory({ type: 'ADD_LIGHT', light })
      set((s) => ({ lights: [...s.lights, light], luxAnalysisDirty: true }))
    },
    updateLight: (id, patch) => {
      const st = get()
      const cur = st.lights.find((l) => l.id === id)
      if (!cur) return
      const after: SigeLight = { ...cur, ...patch }
      get().pushHistory({ type: 'UPDATE_LIGHT', id, before: { ...cur }, after })
      set((s) => ({ lights: s.lights.map((l) => (l.id === id ? after : l)), luxAnalysisDirty: true }))
    },
    removeLight: (id) => {
      const light = get().lights.find((l) => l.id === id)
      if (!light) return
      get().pushHistory({ type: 'REMOVE_LIGHT', light })
      set((s) => ({
        lights: s.lights.filter((l) => l.id !== id),
        selectedLightId: s.selectedLightId === id ? null : s.selectedLightId,
        luxAnalysisDirty: true,
      }))
    },
    toggleLightOn: (id) => {
      const st = get()
      const cur = st.lights.find((l) => l.id === id)
      if (!cur) return
      get().updateLight(id, { isOn: !cur.isOn })
    },
    autoPlaceDownlights: (roomId) => {
      const st = get()
      const room = st.rooms.find((r) => r.id === roomId)
      if (!room) return
      const pxPerFt = st.scale?.pxPerFt
      if (!pxPerFt) return

      const suggested = suggestDownlightPositions(room.polygon, 8, pxPerFt)
      if (suggested.length === 0) return

      const now = Date.now()
      const newLights: SigeLight[] = suggested.map(([x, y], idx) =>
        createDefaultLight({
          id: `light_${roomId}_${now}_${idx}`,
          x,
          y,
          roomId,
        }),
      )

      get().pushHistory({ type: 'BATCH_ADD_LIGHTS', lights: newLights })
      set((s) => ({ lights: [...s.lights, ...newLights], luxAnalysisDirty: true }))
    },

    addFurniture: (item, recordHistory = true) => {
      if (recordHistory) get().pushHistory({ type: 'ADD_FURNITURE', item })
      set((s) => ({ furniture: [...s.furniture, item] }))
    },
    removeFurniture: (id, recordHistory = true) => {
      const item = get().furniture.find((f) => f.id === id)
      if (!item) return
      if (item.locked) return
      if (recordHistory) get().pushHistory({ type: 'REMOVE_FURNITURE', item })
      set((s) => ({
        furniture: s.furniture.filter((f) => f.id !== id),
        selectedFurnitureId: s.selectedFurnitureId === id ? null : s.selectedFurnitureId,
      }))
    },
    moveFurniture: (id, gridX, gridY, offset, recordHistory = true, prev) => {
      const st = get()
      const cur = st.furniture.find((f) => f.id === id)
      if (!cur) return
      if (cur.locked) return
      const from: [number, number] = prev ? [prev.gx, prev.gy] : [cur.gridX, cur.gridY]
      const fromOffset: [number, number] = prev
        ? prev.off
        : ([...cur.freeOffsetPx] as [number, number])
      if (recordHistory) {
        get().pushHistory({
          type: 'MOVE_FURNITURE',
          id,
          from,
          to: [gridX, gridY],
          fromOffset,
          toOffset: offset,
        })
      }
      set((s) => ({
        furniture: s.furniture.map((f) =>
          f.id === id ? { ...f, gridX, gridY, freeOffsetPx: [...offset] as [number, number] } : f,
        ),
      }))
    },
    rotateFurniture: (id) => {
      const st = get()
      const cur = st.furniture.find((f) => f.id === id)
      if (!cur) return
      if (cur.locked) return
      const order: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270]
      const i = order.indexOf(cur.rotation)
      const next = order[(i + 1) % 4]
      const after = { ...cur, rotation: next }
      get().pushHistory({ type: 'UPDATE_FURNITURE', id, before: { ...cur }, after })
      set((s) => ({
        furniture: s.furniture.map((f) => (f.id === id ? after : f)),
      }))
    },

    updateFurniture: (id, patch, recordHistory = true) => {
      const st = get()
      const cur = st.furniture.find((f) => f.id === id)
      if (!cur) return
      if (cur.locked && patch.locked == null) return
      const after = { ...cur, ...patch }
      if (recordHistory) get().pushHistory({ type: 'UPDATE_FURNITURE', id, before: { ...cur }, after })
      set((s) => ({
        furniture: s.furniture.map((f) => (f.id === id ? after : f)),
      }))
    },

    loadProjectPayload: (payload) => {
      const version = String(payload.version ?? '1.0')
      if (!version.startsWith('1.')) console.warn('Unknown project version', version)
      const config = (payload.config as Record<string, number | boolean>) ?? {}
      const geometry = (payload.geometry as Record<string, unknown>) ?? {}
      const image = (payload.image as Record<string, string | number>) ?? {}
      const sp = payload.scale as Partial<ScaleState> | undefined
      const pxFromConfig = Number(config.pxPerFt)
      const px = Number(sp?.pxPerFt) || (Number.isFinite(pxFromConfig) ? pxFromConfig : NaN)
      let scale: ScaleState | null = null
      if (Number.isFinite(px) && px > 0) {
        const pa = sp?.pointA
        const pb = sp?.pointB
        if (pa && pb && pa.length === 2 && pb.length === 2) {
          scale = { pxPerFt: px, pointA: [pa[0], pa[1]], pointB: [pb[0], pb[1]] }
        } else {
          scale = { pxPerFt: px, pointA: [0, 0], pointB: [px, 0] }
        }
      }
      const w = Number(image.width) || 0
      const h = Number(image.height) || 0
      const rawFurniture = payload.furniture
      const furnitureMigrated: FurnitureItem[] = Array.isArray(rawFurniture)
        ? rawFurniture
            .map((x) => normalizeFurnitureFromPayload(x))
            .filter((x): x is FurnitureItem => x != null)
        : []

      // --- Lights migration ---
      // Accept both:
      // - new format: SigeLight[] with roomId
      // - old format: CeilingLight[] with ceilingId (legacy)
      const rawLights = geometry.lights
      const rooms = (geometry.rooms as Room[]) ?? []
      let migratedLights: SigeLight[] = []
      if (Array.isArray(rawLights)) {
        const looksLikeNew = rawLights.some((l) => l && typeof l === 'object' && 'roomId' in (l as Record<string, unknown>))
        if (looksLikeNew) {
          migratedLights = rawLights as SigeLight[]
        } else {
          migratedLights = (rawLights as Array<Record<string, unknown>>)
            .map((l) => {
              const id = String(l.id ?? '')
              const x = Number(l.x)
              const y = Number(l.y)
              if (!id || !Number.isFinite(x) || !Number.isFinite(y)) return null
              const room = rooms.find((r) => Array.isArray(r.polygon) && r.polygon.length >= 3 && pointInPolygonPx(x, y, r.polygon))
              const roomId = room?.id ?? 'unassigned'
              return createDefaultLight({ id, x, y, roomId })
            })
            .filter((x): x is SigeLight => x != null)
        }
      }
      set({
        gridSizeFt: Number(config.gridSizeFt) || 2,
        minPathWidthFt: Number(config.minPathWidthFt) || 2,
        wallDefaultThicknessFt: 0.5,
        wallDefaultHeightFt: 8,
        showFloorPlanImage:
          typeof config.showFloorPlanImage === 'boolean' ? config.showFloorPlanImage : true,
        showWalls: typeof config.showWalls === 'boolean' ? config.showWalls : true,
        showDoors: typeof config.showDoors === 'boolean' ? config.showDoors : true,
        showWindows: typeof config.showWindows === 'boolean' ? config.showWindows : true,
        showCeilings: typeof config.showCeilings === 'boolean' ? (config.showCeilings as boolean) : true,
        showLights: typeof config.showLights === 'boolean' ? (config.showLights as boolean) : true,
        forceShowCeilings: typeof config.forceShowCeilings === 'boolean' ? (config.forceShowCeilings as boolean) : false,
        floorPlanRotationDeg: (() => {
          const r = Number(config.floorPlanRotationDeg)
          return r === 90 || r === 180 || r === 270 ? (r as 90 | 180 | 270) : 0
        })(),
        rooms: (geometry.rooms as Room[]) ?? [],
        viewPosts: (geometry.view_posts as ViewPost[]) ?? [],
        connectionPoints: (geometry.connection_points as ConnectionPoint[]) ?? [],
        walls: (geometry.walls as Wall[]) ?? [],
        doors: (geometry.doors as Door[]) ?? [],
        windows: (geometry.windows as Window[]) ?? [],
        ceilings: (geometry.ceilings as Ceiling[]) ?? [],
        lights: migratedLights,
        furniture: furnitureMigrated,
        selectedWallId: null,
        selectedWallIds: [],
        selectedDoorId: null,
        selectedWindowId: null,
        selectedCeilingId: null,
        selectedLightId: null,
        selectedViewPostId: null,
        postViewActive: false,
        wallSnapIndicator: null,
        imageUrl: (image.dataUrl as string) ?? null,
        imageFilename: (image.filename as string) ?? null,
        imageNaturalWidth: w > 0 ? w : get().imageNaturalWidth,
        imageNaturalHeight: h > 0 ? h : get().imageNaturalHeight,
        scale,
        past: [],
        future: [],
        calibrateStep: 0,
        aiCleanPlanLoading: false,
        angleLockEnabled: true,
        floorViewMode: '2d',
        showLuxHeatmap: typeof config.showLuxHeatmap === 'boolean' ? (config.showLuxHeatmap as boolean) : false,
        renderBrightness:
          ((config as Record<string, unknown>).renderBrightness === 'dark' ? 'dark' : 'normal') as RenderBrightnessMode,
        luxAnalysis: {},
        luxAnalysisDirty: true,
      })
      const dataUrl = image.dataUrl as string | undefined
      if (dataUrl) {
        const img = new Image()
        img.onload = () => {
          get().setImage(
            dataUrl,
            (image.filename as string) ?? null,
            img.naturalWidth,
            img.naturalHeight,
            true,
          )
        }
        img.src = dataUrl
      }
    },
  }
})

export function resetSigeWorkspace() {
  useSigeStore.setState({
    imageUrl: null,
    imageFilename: null,
    imageNaturalWidth: 800,
    imageNaturalHeight: 600,
    scale: null,
    gridSizeFt: 2,
    minPathWidthFt: 2,
    wallDefaultThicknessFt: 0.5,
    wallDefaultHeightFt: 8,
    rooms: [],
    viewPosts: [],
    connectionPoints: [],
    walls: [],
    doors: [],
    windows: [],
    ceilings: [],
    lights: [],
    furniture: [],
    tool: 'select',
    snapToGrid: true,
    angleLockEnabled: true,
    wallSnapIndicator: null,
    showGrid: true,
    showHeatmap: false,
    showCirculation: false,
    showWalls: true,
    showDoors: true,
    showWindows: true,
    showCeilings: true,
    showLights: true,
    showLuxHeatmap: false,
    renderBrightness: 'normal',
    forceShowCeilings: false,
    showFloorPlanImage: true,
    aiCleanPlanLoading: false,
    pendingFurniturePreset: null,
    selectedFurnitureId: null,
    selectedWallId: null,
    selectedWallIds: [],
    selectedDoorId: null,
    selectedWindowId: null,
    selectedCeilingId: null,
    selectedLightId: null,
    selectedViewPostId: null,
    postViewActive: false,
    luxAnalysis: {},
    luxAnalysisDirty: true,
    floorViewMode: '2d',
    floorPlanRotationDeg: 0,
    past: [],
    future: [],
    calibrateStep: 0,
    projectId: null,
    openPanels: { library: true, metrics: true, view: true },
  })
}
