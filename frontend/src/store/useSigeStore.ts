import { create } from 'zustand'
import type { Door, FurnitureItem, HistoryAction, Room, ScaleState, Tool, Wall } from '../types'
import type { Preset } from '../utils/furnitureLib'
import { normalizeFurnitureFromPayload } from '../utils/furnitureLib'

const HISTORY_MAX = 50

export type PanelKey = 'library' | 'metrics' | 'view'

export type FloorViewMode = '2d' | '3d'

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
  rooms: Room[]
  walls: Wall[]
  doors: Door[]
  furniture: FurnitureItem[]

  tool: Tool
  snapToGrid: boolean
  showGrid: boolean
  showHeatmap: boolean
  showCirculation: boolean
  /** When false, floor plan artwork is hidden so only grid + drawn walls/doors show clearly */
  showFloorPlanImage: boolean
  /** Gemini image model generating a clean walls+doors raster */
  aiCleanPlanLoading: boolean
  setAiCleanPlanLoading: (v: boolean) => void
  pendingFurniturePreset: Preset | null
  selectedFurnitureId: string | null
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
  setTool: (t: Tool) => void
  setSnapToGrid: (v: boolean) => void
  setLayerFlags: (p: Partial<{ showGrid: boolean; showHeatmap: boolean; showCirculation: boolean }>) => void
  setShowFloorPlanImage: (v: boolean) => void
  setPendingPreset: (p: Preset | null) => void
  setSelectedFurnitureId: (id: string | null) => void
  setCalibrateStep: (s: 0 | 1 | 2) => void
  setProjectId: (id: string | null) => void

  pushHistory: (a: HistoryAction) => void
  undo: () => void
  redo: () => void

  addRoom: (room: Room) => void
  removeRoom: (id: string) => void
  addWall: (wall: Wall) => void
  removeWall: (id: string) => void
  addDoor: (door: Door) => void
  removeDoor: (id: string) => void
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
      Pick<FurnitureItem, 'gridX' | 'gridY' | 'widthFt' | 'depthFt' | 'rotation' | 'freeOffsetPx'>
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
      case 'ADD_WALL':
        set(() => ({ walls: st.walls.filter((w) => w.id !== a.wall.id) }))
        break
      case 'REMOVE_WALL':
        set(() => ({ walls: [...st.walls, a.wall] }))
        break
      case 'ADD_DOOR':
        set(() => ({ doors: st.doors.filter((d) => d.id !== a.door.id) }))
        break
      case 'REMOVE_DOOR':
        set(() => ({ doors: [...st.doors, a.door] }))
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
      case 'ADD_WALL':
        set(() => ({ walls: [...st.walls, a.wall] }))
        break
      case 'REMOVE_WALL':
        set(() => ({ walls: st.walls.filter((w) => w.id !== a.wall.id) }))
        break
      case 'ADD_DOOR':
        set(() => ({ doors: [...st.doors, a.door] }))
        break
      case 'REMOVE_DOOR':
        set(() => ({ doors: st.doors.filter((d) => d.id !== a.door.id) }))
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
    rooms: [],
    walls: [],
    doors: [],
    furniture: [],

    tool: 'select',
    snapToGrid: true,
    showGrid: true,
    showHeatmap: false,
    showCirculation: false,
    showFloorPlanImage: true,
    aiCleanPlanLoading: false,
    setAiCleanPlanLoading: (v) => set({ aiCleanPlanLoading: v }),
    pendingFurniturePreset: null,
    selectedFurnitureId: null,
    floorViewMode: '2d',
    setFloorViewMode: (m) => set({ floorViewMode: m }),

    floorPlanRotationDeg: 0,
    rotateFloorPlan90: () =>
      set((s) => {
        const order = [0, 90, 180, 270] as const
        const i = order.indexOf(s.floorPlanRotationDeg)
        const next = order[(i + 1) % 4]
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
    setScale: (s) => set({ scale: s }),
    setGridSizeFt: (v) => set({ gridSizeFt: Math.max(0.25, v) }),
    setMinPathWidthFt: (v) => set({ minPathWidthFt: Math.max(0.5, v) }),
    setTool: (t) => set({ tool: t }),
    setSnapToGrid: (v) => set({ snapToGrid: v }),
    setLayerFlags: (p) => set(p),
    setShowFloorPlanImage: (v) => set({ showFloorPlanImage: v }),
    setPendingPreset: (p) => set({ pendingFurniturePreset: p }),
    setSelectedFurnitureId: (id) => set({ selectedFurnitureId: id }),
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
    addWall: (wall) => {
      get().pushHistory({ type: 'ADD_WALL', wall })
      set((s) => ({ walls: [...s.walls, wall] }))
    },
    removeWall: (id) => {
      const wall = get().walls.find((w) => w.id === id)
      if (!wall) return
      get().pushHistory({ type: 'REMOVE_WALL', wall })
      set((s) => ({ walls: s.walls.filter((w) => w.id !== id) }))
    },
    addDoor: (door) => {
      get().pushHistory({ type: 'ADD_DOOR', door })
      set((s) => ({ doors: [...s.doors, door] }))
    },
    removeDoor: (id) => {
      const door = get().doors.find((d) => d.id === id)
      if (!door) return
      get().pushHistory({ type: 'REMOVE_DOOR', door })
      set((s) => ({ doors: s.doors.filter((d) => d.id !== id) }))
    },
    addFurniture: (item, recordHistory = true) => {
      if (recordHistory) get().pushHistory({ type: 'ADD_FURNITURE', item })
      set((s) => ({ furniture: [...s.furniture, item] }))
    },
    removeFurniture: (id, recordHistory = true) => {
      const item = get().furniture.find((f) => f.id === id)
      if (!item) return
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
      set({
        gridSizeFt: Number(config.gridSizeFt) || 2,
        minPathWidthFt: Number(config.minPathWidthFt) || 2,
        showFloorPlanImage:
          typeof config.showFloorPlanImage === 'boolean' ? config.showFloorPlanImage : true,
        floorPlanRotationDeg: (() => {
          const r = Number(config.floorPlanRotationDeg)
          return r === 90 || r === 180 || r === 270 ? (r as 90 | 180 | 270) : 0
        })(),
        rooms: (geometry.rooms as Room[]) ?? [],
        walls: (geometry.walls as Wall[]) ?? [],
        doors: (geometry.doors as Door[]) ?? [],
        furniture: furnitureMigrated,
        imageUrl: (image.dataUrl as string) ?? null,
        imageFilename: (image.filename as string) ?? null,
        imageNaturalWidth: w > 0 ? w : get().imageNaturalWidth,
        imageNaturalHeight: h > 0 ? h : get().imageNaturalHeight,
        scale,
        past: [],
        future: [],
        calibrateStep: 0,
        aiCleanPlanLoading: false,
        floorViewMode: '2d',
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
    rooms: [],
    walls: [],
    doors: [],
    furniture: [],
    tool: 'select',
    snapToGrid: true,
    showGrid: true,
    showHeatmap: false,
    showCirculation: false,
    showFloorPlanImage: true,
    aiCleanPlanLoading: false,
    pendingFurniturePreset: null,
    selectedFurnitureId: null,
    floorViewMode: '2d',
    floorPlanRotationDeg: 0,
    past: [],
    future: [],
    calibrateStep: 0,
    projectId: null,
    openPanels: { library: true, metrics: true, view: true },
  })
}
