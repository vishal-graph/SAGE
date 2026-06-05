import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Group as KonvaGroup } from 'konva/lib/Group'
import { useSigeStore } from '../../store/useSigeStore'
import { useDerivedGrid } from '../../hooks/useDerivedGrid'
import { CellType, type Ceiling, type ConnectionPoint, type FurnitureItem } from '../../types'
import { createDefaultLight } from '../../types'
import {
  dimsSpanCells,
  effectiveFootprint,
  furnitureItemSpanCells,
  getGridDimensions,
  isPlacementValid,
  type GridInputs,
} from '../../utils/gridEngine'
import { pixelToCell } from '../../utils/geometry'
import { kelvinToRGB } from '../../utils/lightingEngine'
import {
  createFurnitureFromPreset,
  furniturePlanScaleFactorFromStoreInputs,
  scaledPresetFootprintFt,
} from '../../utils/furnitureLib'
import { computeCirculationMasks } from '../../utils/circulationMasks'
import * as THREE from 'three'
import { snapWallEndpoint } from '../../utils/snap'

function uid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

const DOOR_LINE_BROWN = '#8b5a2b'
const WINDOW_LINE_CYAN = '#38bdf8'
const WALL_DEFAULT_COLOR = '#f87171'
const CEILING_DEFAULT_COLOR = 'rgba(60,130,255,0.15)'
const CEILING_OUTLINE = 'rgba(60,130,255,0.95)'
const LIGHT_DOT = 'rgba(255,214,102,0.95)'
const LUX_CELL_ALPHA = 0.42
const VIEW_POST_DOT = 'rgba(168,85,247,0.95)'

interface FloorStageProps {
  roomDraft: [number, number][]
  setRoomDraft: (p: [number, number][]) => void
  onRequestCalibrateDistance: () => void
  /** Canvas presentation: reset zoom/pan */
  onRegisterViewControls?: (api: { reset: () => void }) => void
}

export function FloorStage({
  roomDraft,
  setRoomDraft,
  onRequestCalibrateDistance,
  onRegisterViewControls,
}: FloorStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  /** Inner group: image + grid in plan pixel space (inverse transform for pointer mapping). */
  const floorContentRef = useRef<KonvaGroup | null>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [viewScale, setViewScale] = useState(1)
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 })
  const [placePreviewCell, setPlacePreviewCell] = useState<[number, number] | null>(null)
  const [lightDrag, setLightDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const [viewPostDrag, setViewPostDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  /** Middle-mouse view pan (window listeners attached from mousedown). */
  const panLast = useRef({ sx: 0, sy: 0, px: 0, py: 0 })
  /** Select tool: left-drag pans; click without drag clears furniture selection. */
  const selectPanRef = useRef<{
    sx: number
    sy: number
    panX: number
    panY: number
    didPan: boolean
  } | null>(null)

  const imageUrl = useSigeStore((s) => s.imageUrl)
  const imageNaturalWidth = useSigeStore((s) => s.imageNaturalWidth)
  const imageNaturalHeight = useSigeStore((s) => s.imageNaturalHeight)
  const scale = useSigeStore((s) => s.scale)
  const gridSizeFt = useSigeStore((s) => s.gridSizeFt)
  const rooms = useSigeStore((s) => s.rooms)
  const connectionPoints = useSigeStore((s) => s.connectionPoints)
  const walls = useSigeStore((s) => s.walls)
  const doors = useSigeStore((s) => s.doors)
  const windows = useSigeStore((s) => s.windows)
  const furniture = useSigeStore((s) => s.furniture)
  const minPathWidthFt = useSigeStore((s) => s.minPathWidthFt)
  const tool = useSigeStore((s) => s.tool)
  const snapToGrid = useSigeStore((s) => s.snapToGrid)
  const angleLockEnabled = useSigeStore((s) => s.angleLockEnabled)
  const selectedWallIds = useSigeStore((s) => s.selectedWallIds)
  const showGrid = useSigeStore((s) => s.showGrid)
  const showHeatmap = useSigeStore((s) => s.showHeatmap)
  const showCirculation = useSigeStore((s) => s.showCirculation)
  const showWalls = useSigeStore((s) => s.showWalls)
  const showDoors = useSigeStore((s) => s.showDoors)
  const showWindows = useSigeStore((s) => s.showWindows)
  const showCeilings = useSigeStore((s) => s.showCeilings)
  const showLights = useSigeStore((s) => s.showLights)
  const showLuxHeatmap = useSigeStore((s) => s.showLuxHeatmap)
  const showFloorPlanImage = useSigeStore((s) => s.showFloorPlanImage)
  const pendingFurniturePreset = useSigeStore((s) => s.pendingFurniturePreset)
  const selectedFurnitureId = useSigeStore((s) => s.selectedFurnitureId)
  const calibrateStep = useSigeStore((s) => s.calibrateStep)
  const floorPlanRotationDeg = useSigeStore((s) => s.floorPlanRotationDeg)
  const wallDefaultHeightFt = useSigeStore((s) => s.wallDefaultHeightFt)

  const addRoom = useSigeStore((s) => s.addRoom)
  const addWall = useSigeStore((s) => s.addWall)
  const addConnectionPoint = useSigeStore((s) => s.addConnectionPoint)
  const addDoor = useSigeStore((s) => s.addDoor)
  const addWindow = useSigeStore((s) => s.addWindow)
  const ceilings = useSigeStore((s) => s.ceilings)
  const lights = useSigeStore((s) => s.lights)
  const viewPosts = useSigeStore((s) => (s as any).viewPosts as import('../../types').ViewPost[])
  const selectedViewPostId = useSigeStore((s) => (s as any).selectedViewPostId as string | null)
  const luxAnalysis = useSigeStore((s) => s.luxAnalysis)
  const invalidateLuxAnalysis = useSigeStore((s) => s.invalidateLuxAnalysis)
  const selectedLightId = useSigeStore((s) => s.selectedLightId)
  const addViewPost = useSigeStore((s) => (s as any).addViewPost as (p: import('../../types').ViewPost) => void)
  const updateViewPost = useSigeStore((s) => (s as any).updateViewPost as (id: string, patch: Partial<import('../../types').ViewPost>) => void)
  const removeViewPost = useSigeStore((s) => (s as any).removeViewPost as (id: string) => void)
  const setSelectedViewPostId = useSigeStore((s) => (s as any).setSelectedViewPostId as (id: string | null) => void)
  const addCeiling = useSigeStore((s) => s.addCeiling)
  const addLight = useSigeStore((s) => s.addLight)
  const updateLight = useSigeStore((s) => s.updateLight)
  const removeLight = useSigeStore((s) => s.removeLight)
  const setSelectedCeilingId = useSigeStore((s) => s.setSelectedCeilingId)
  const setSelectedLightId = useSigeStore((s) => s.setSelectedLightId)
  const setSelectedDoorId = useSigeStore((s) => s.setSelectedDoorId)
  const setSelectedWallId = useSigeStore((s) => s.setSelectedWallId)
  const setSelectedWindowId = useSigeStore((s) => s.setSelectedWindowId)
  const updateDoor = useSigeStore((s) => s.updateDoor)
  const removeWall = useSigeStore((s) => s.removeWall)
  const updateWall = useSigeStore((s) => s.updateWall)
  const updateConnectionPoint = useSigeStore((s) => s.updateConnectionPoint)
  const snapWallsRigid = useSigeStore((s) => s.snapWallsRigid)
  const setWallSnapIndicator = useSigeStore((s) => s.setWallSnapIndicator)
  const setScale = useSigeStore((s) => s.setScale)
  const setCalibrateStep = useSigeStore((s) => s.setCalibrateStep)
  const setTool = useSigeStore((s) => s.setTool)
  const setPendingPreset = useSigeStore((s) => s.setPendingPreset)
  const setSelectedFurnitureId = useSigeStore((s) => s.setSelectedFurnitureId)
  const addFurniture = useSigeStore((s) => s.addFurniture)
  const moveFurniture = useSigeStore((s) => s.moveFurniture)
  const derived = useDerivedGrid()

  const { reachable: reachableMask, dead: deadMask } = useMemo(() => {
    if (!derived) return { reachable: null, dead: null }
    const minCells = Math.max(1, Math.ceil(minPathWidthFt / gridSizeFt))
    return computeCirculationMasks(
      derived.cells,
      derived.cols,
      derived.rows,
      doors.map((d) => ({ col: d.col, row: d.row })),
      minCells,
    )
  }, [derived, doors, minPathWidthFt, gridSizeFt])

  const resetView = useCallback(() => {
    setViewScale(1)
    setViewPan({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    onRegisterViewControls?.({ reset: resetView })
  }, [onRegisterViewControls, resetView])

  /** New / replaced plan: frame it centered at 1× zoom (avoids leftover pan from a previous image). */
  useEffect(() => {
    if (!imageUrl || imageNaturalWidth <= 0 || imageNaturalHeight <= 0) return
    setViewPan({ x: 0, y: 0 })
    setViewScale(1)
  }, [imageUrl, imageNaturalWidth, imageNaturalHeight])

  /** Keep plan framed when 2D rotation changes (bbox aspect swaps at 90°/270°). */
  useEffect(() => {
    if (!imageUrl) return
    setViewPan({ x: 0, y: 0 })
    setViewScale(1)
  }, [floorPlanRotationDeg, imageUrl])

  const [wallStartPointId, setWallStartPointId] = useState<string | null>(null)
  const [wallHoverPointId, setWallHoverPointId] = useState<string | null>(null)
  const [wallHoverPlan, setWallHoverPlan] = useState<{ x: number; y: number; snapped: boolean } | null>(null)
  const [doorStartPointId, setDoorStartPointId] = useState<string | null>(null)
  const [doorHoverPointId, setDoorHoverPointId] = useState<string | null>(null)
  const [windowStartPointId, setWindowStartPointId] = useState<string | null>(null)
  const [windowHoverPointId, setWindowHoverPointId] = useState<string | null>(null)
  const [roomDraftNodeIds, setRoomDraftNodeIds] = useState<string[]>([])
  const [ceilingDraftNodeIds, setCeilingDraftNodeIds] = useState<string[]>([])
  const [ceilingHoverNodeId, setCeilingHoverNodeId] = useState<string | null>(null)
  const [ceilingEdgeAId, setCeilingEdgeAId] = useState<string | null>(null)
  const [ceilingEdgeBId, setCeilingEdgeBId] = useState<string | null>(null)

  type DraftSnapshot =
    | { tool: 'room'; roomDraftNodeIds: string[] }
    | { tool: 'wall'; wallStartPointId: string | null }
    | { tool: 'door'; doorStartPointId: string | null }
    | { tool: 'window'; windowStartPointId: string | null }
    | { tool: 'ceiling'; ceilingDraftNodeIds: string[]; ceilingEdgeAId: string | null; ceilingEdgeBId: string | null }

  const draftPastRef = useRef<DraftSnapshot[]>([])
  const draftFutureRef = useRef<DraftSnapshot[]>([])

  const getDraftSnapshot = useCallback((): DraftSnapshot | null => {
    if (tool === 'room') return { tool: 'room', roomDraftNodeIds: [...roomDraftNodeIds] }
    if (tool === 'wall') return { tool: 'wall', wallStartPointId }
    if (tool === 'door') return { tool: 'door', doorStartPointId }
    if (tool === 'window') return { tool: 'window', windowStartPointId }
    if (tool === 'ceiling')
      return {
        tool: 'ceiling',
        ceilingDraftNodeIds: [...ceilingDraftNodeIds],
        ceilingEdgeAId,
        ceilingEdgeBId,
      }
    return null
  }, [
    tool,
    roomDraftNodeIds,
    wallStartPointId,
    doorStartPointId,
    windowStartPointId,
    ceilingDraftNodeIds,
    ceilingEdgeAId,
    ceilingEdgeBId,
  ])

  const applyDraftSnapshot = useCallback((snap: DraftSnapshot) => {
    if (snap.tool === 'room') {
      setRoomDraftNodeIds([...snap.roomDraftNodeIds])
      return
    }
    if (snap.tool === 'wall') {
      setWallStartPointId(snap.wallStartPointId)
      return
    }
    if (snap.tool === 'door') {
      setDoorStartPointId(snap.doorStartPointId)
      return
    }
    if (snap.tool === 'window') {
      setWindowStartPointId(snap.windowStartPointId)
      return
    }
    if (snap.tool === 'ceiling') {
      setCeilingDraftNodeIds([...snap.ceilingDraftNodeIds])
      setCeilingEdgeAId(snap.ceilingEdgeAId)
      setCeilingEdgeBId(snap.ceilingEdgeBId)
    }
  }, [])

  const pushDraft = useCallback(() => {
    const snap = getDraftSnapshot()
    if (!snap) return
    draftPastRef.current.push(snap)
    draftFutureRef.current = []
  }, [getDraftSnapshot])

  const hasActiveDraft = useCallback(() => {
    if (tool === 'room') return roomDraftNodeIds.length > 0
    if (tool === 'wall') return Boolean(wallStartPointId)
    if (tool === 'door') return Boolean(doorStartPointId)
    if (tool === 'window') return Boolean(windowStartPointId)
    if (tool === 'ceiling') return ceilingDraftNodeIds.length > 0
    return false
  }, [
    tool,
    roomDraftNodeIds.length,
    wallStartPointId,
    doorStartPointId,
    windowStartPointId,
    ceilingDraftNodeIds.length,
  ])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')
      const isRedo =
        (e.ctrlKey || e.metaKey) && ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || e.key === 'y' || e.key === 'Y')
      if (!isUndo && !isRedo) return
      if (!hasActiveDraft() && draftPastRef.current.length === 0 && draftFutureRef.current.length === 0) return

      // Only intercept when we're in a draft-based tool.
      if (tool !== 'room' && tool !== 'wall' && tool !== 'door' && tool !== 'window' && tool !== 'ceiling') return

      if (isUndo) {
        if (draftPastRef.current.length === 0) return
        const cur = getDraftSnapshot()
        const prev = draftPastRef.current.pop()
        if (!prev) return
        if (cur) draftFutureRef.current.unshift(cur)
        e.preventDefault()
        e.stopPropagation()
        applyDraftSnapshot(prev)
        return
      }

      if (isRedo) {
        if (draftFutureRef.current.length === 0) return
        const cur = getDraftSnapshot()
        const next = draftFutureRef.current.shift()
        if (!next) return
        if (cur) draftPastRef.current.push(cur)
        e.preventDefault()
        e.stopPropagation()
        applyDraftSnapshot(next)
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true } as any)
  }, [tool, applyDraftSnapshot, getDraftSnapshot, hasActiveDraft])

  // Keep the outer roomDraft (points) in sync with node-based draft.
  useEffect(() => {
    if (tool !== 'room') return
    if (roomDraftNodeIds.length === 0) {
      if (roomDraft.length !== 0) setRoomDraft([])
      return
    }
    const pts = roomDraftNodeIds
      .map((id) => connectionPoints.find((p) => p.id === id))
      .filter((p): p is ConnectionPoint => Boolean(p))
      .map((p) => [p.x, p.y] as [number, number])
    setRoomDraft(pts)
  }, [tool, roomDraftNodeIds, connectionPoints, roomDraft.length, setRoomDraft])

  useEffect(() => {
    if (tool !== 'placeFurniture' || !pendingFurniturePreset) setPlacePreviewCell(null)
  }, [tool, pendingFurniturePreset])

  useEffect(() => {
    if (tool !== 'wall') {
      setWallStartPointId(null)
      setWallHoverPointId(null)
      setWallHoverPlan(null)
      setWallSnapIndicator(null)
    }
  }, [tool, setWallSnapIndicator])

  useEffect(() => {
    if (tool !== 'door') {
      setDoorStartPointId(null)
      setDoorHoverPointId(null)
    }
  }, [tool])

  useEffect(() => {
    if (tool !== 'window') {
      setWindowStartPointId(null)
      setWindowHoverPointId(null)
    }
  }, [tool])

  useEffect(() => {
    if (tool !== 'room') {
      setRoomDraftNodeIds([])
    }
  }, [tool])

  useEffect(() => {
    if (tool !== 'ceiling') {
      setCeilingDraftNodeIds([])
      setCeilingHoverNodeId(null)
      setCeilingEdgeAId(null)
      setCeilingEdgeBId(null)
    }
  }, [tool])

  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!imageUrl) {
      return () => {}
    }
    const im = new Image()
    im.crossOrigin = 'anonymous'
    let cancelled = false
    im.onload = () => {
      if (!cancelled) setImgEl(im)
    }
    im.src = imageUrl
    return () => {
      cancelled = true
      setImgEl(null)
    }
  }, [imageUrl])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const imgW = imageNaturalWidth
  const imgH = imageNaturalHeight
  const displayScale = useMemo(() => {
    if (imgW <= 0 || imgH <= 0) return 1
    const swap = floorPlanRotationDeg === 90 || floorPlanRotationDeg === 270
    const effW = swap ? imgH : imgW
    const effH = swap ? imgW : imgH
    return Math.min(size.w / effW, size.h / effH) * 0.95
  }, [size, imgW, imgH, floorPlanRotationDeg])

  useEffect(() => {
    if (tool !== 'ceiling') {
      setCeilingDraftNodeIds([])
      setCeilingHoverNodeId(null)
      setCeilingEdgeAId(null)
      setCeilingEdgeBId(null)
    }
  }, [tool])

  useEffect(() => {
    // Draft-only edge delete helper (keeps ceiling tool simple).
    if (tool !== 'ceiling') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (!ceilingEdgeAId || !ceilingEdgeBId) return
      const a = ceilingEdgeAId
      const b = ceilingEdgeBId
      setCeilingDraftNodeIds((prev) => {
        const ia = prev.indexOf(a)
        const ib = prev.indexOf(b)
        if (ia < 0 || ib < 0) return prev
        const adjacent = Math.abs(ia - ib) === 1
        if (!adjacent) return prev
        // Remove the second endpoint to delete the segment between them.
        const removeIdx = Math.max(ia, ib)
        const next = prev.slice(0, removeIdx).concat(prev.slice(removeIdx + 1))
        return next
      })
      setCeilingEdgeAId(null)
      setCeilingEdgeBId(null)
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tool, ceilingEdgeAId, ceilingEdgeBId])

  const gridInputsBase = useMemo((): GridInputs | null => {
    if (!scale?.pxPerFt) return null
    return {
      imageWidthPx: imgW,
      imageHeightPx: imgH,
      pxPerFt: scale.pxPerFt,
      gridSizeFt,
      rooms,
      walls,
      furniture,
    }
  }, [scale, imgW, imgH, gridSizeFt, rooms, walls, furniture])

  const cellSizePx = derived?.cellSizePx ?? 0

  const furniturePlanScaleFactor = useMemo(() => {
    if (!scale?.pxPerFt || imgW <= 0 || imgH <= 0) return undefined as number | undefined
    return furniturePlanScaleFactorFromStoreInputs(scale.pxPerFt, imgW, imgH, rooms)
  }, [scale?.pxPerFt, imgW, imgH, rooms])

  const placePreviewBox = useMemo(() => {
    if (
      tool !== 'placeFurniture' ||
      !pendingFurniturePreset ||
      placePreviewCell == null ||
      !derived ||
      !gridInputsBase
    )
      return null
    const [c, r] = placePreviewCell
    const cs = derived.cellSizePx
    const pw = pendingFurniturePreset
    const f = furniturePlanScaleFactor
    const dims =
      f != null ? scaledPresetFootprintFt(pw, f) : { widthFt: pw.widthFt, depthFt: pw.depthFt }
    const { wCells, hCells } = dimsSpanCells(dims.widthFt, dims.depthFt, gridSizeFt)
    const item = createFurnitureFromPreset(pw, c, r, f != null ? { planScaleFactor: f } : undefined)
    const ok = isPlacementValid(item, null, gridInputsBase)
    return {
      x: c * cs,
      y: r * cs,
      w: wCells * cs,
      h: hCells * cs,
      ok,
      wCells,
      hCells,
      footprintFt: dims,
    }
  }, [
    tool,
    pendingFurniturePreset,
    placePreviewCell,
    derived,
    gridInputsBase,
    gridSizeFt,
    furniturePlanScaleFactor,
  ])

  const toFloor = useCallback((evt: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = evt.target.getStage()
    const p = stage?.getPointerPosition()
    const node = floorContentRef.current
    if (!p || !node) return null
    const inv = node.getAbsoluteTransform().copy().invert()
    const pt = inv.point(p)
    return { x: pt.x, y: pt.y }
  }, [])

  const snapPt = useCallback(
    (x: number, y: number) => {
      if (!snapToGrid) return { x, y }
      const cs = derived?.cellSizePx
      if (!cs || cs <= 0) return { x, y }
      return { x: Math.round(x / cs) * cs, y: Math.round(y / cs) * cs }
    },
    [snapToGrid, derived?.cellSizePx],
  )

  const computeWallSnap = useCallback(
    (pt: { x: number; y: number }, anchor: ConnectionPoint | null, shiftBypass: boolean) => {
      const cell = Math.max(0.01, derived?.cellSizePx ?? 0.01)
      const out = snapWallEndpoint(
        anchor ? new THREE.Vector3(anchor.x, 0, anchor.y) : null,
        new THREE.Vector3(pt.x, 0, pt.y),
        {
          gridSize: cell,
          snapEnabled: snapToGrid && !shiftBypass,
          angleLockEnabled: angleLockEnabled && !shiftBypass,
          angleStep: Math.PI / 4,
        },
      )
      return { x: out.position.x, y: out.position.z, snapped: out.snapped }
    },
    [derived?.cellSizePx, snapToGrid, angleLockEnabled],
  )

  const pointInPolygon = useCallback((pt: { x: number; y: number }, poly: [number, number][]) => {
    if (poly.length < 3) return false
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i]![0]
      const yi = poly[i]![1]
      const xj = poly[j]![0]
      const yj = poly[j]![1]
      const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-9) + xi
      if (intersect) inside = !inside
    }
    return inside
  }, [])

  const findNearbyConnectionPoint = useCallback(
    (x: number, y: number): ConnectionPoint | null => {
      if (connectionPoints.length === 0) return null
      let best: ConnectionPoint | null = null
      let bestDist = Number.POSITIVE_INFINITY
      for (const point of connectionPoints) {
        const d = Math.hypot(point.x - x, point.y - y)
        if (d < bestDist) {
          bestDist = d
          best = point
        }
      }
      return bestDist <= 14 / displayScale ? best : null
    },
    [connectionPoints, displayScale],
  )

  const getOrthogonalElbow = useCallback((a: ConnectionPoint, b: ConnectionPoint) => {
    const elbowA = { x: a.x, y: b.y }
    const elbowB = { x: b.x, y: a.y }
    const dA = Math.hypot(elbowA.x - a.x, elbowA.y - a.y) + Math.hypot(b.x - elbowA.x, b.y - elbowA.y)
    const dB = Math.hypot(elbowB.x - a.x, elbowB.y - a.y) + Math.hypot(b.x - elbowB.x, b.y - elbowB.y)
    return dA <= dB ? elbowA : elbowB
  }, [])

  const getOrCreateConnectionPoint = useCallback(
    (x: number, y: number): ConnectionPoint => {
      const existing = findNearbyConnectionPoint(x, y)
      if (existing) return existing
      const created: ConnectionPoint = { id: uid(), x, y }
      addConnectionPoint(created)
      return created
    },
    [findNearbyConnectionPoint, addConnectionPoint],
  )

  const findNodeNear = useCallback(
    (x: number, y: number, eps = 1.2) => {
      let best: ConnectionPoint | null = null
      let bestDist = Number.POSITIVE_INFINITY
      for (const p of connectionPoints) {
        const d = Math.hypot(p.x - x, p.y - y)
        if (d < bestDist) {
          bestDist = d
          best = p
        }
      }
      return best && bestDist <= eps ? best : null
    },
    [connectionPoints],
  )

  const findDoorBetweenNodes = useCallback(
    (nodeAId: string, nodeBId: string) =>
      doors.find(
        (d) =>
          (d.node_a_id === nodeAId && d.node_b_id === nodeBId) ||
          (d.node_a_id === nodeBId && d.node_b_id === nodeAId),
      ),
    [doors],
  )

  const isWallMatchingSegment = useCallback((wall: (typeof walls)[number], a: ConnectionPoint, b: ConnectionPoint) => {
    const same =
      Math.abs(wall.x1 - a.x) <= 0.5 &&
      Math.abs(wall.y1 - a.y) <= 0.5 &&
      Math.abs(wall.x2 - b.x) <= 0.5 &&
      Math.abs(wall.y2 - b.y) <= 0.5
    const reversed =
      Math.abs(wall.x1 - b.x) <= 0.5 &&
      Math.abs(wall.y1 - b.y) <= 0.5 &&
      Math.abs(wall.x2 - a.x) <= 0.5 &&
      Math.abs(wall.y2 - a.y) <= 0.5
    return same || reversed
  }, [])

  const findWallSnapPoint = useCallback(
    (x: number, y: number): { x: number; y: number } | null => {
      const threshold = 12 / displayScale
      let best: { x: number; y: number } | null = null
      let bestDist = Number.POSITIVE_INFINITY
      for (const w of walls) {
        const vx = w.x2 - w.x1
        const vy = w.y2 - w.y1
        const len2 = vx * vx + vy * vy
        if (len2 <= 1e-6) continue
        const t = Math.max(0, Math.min(1, ((x - w.x1) * vx + (y - w.y1) * vy) / len2))
        const px = w.x1 + t * vx
        const py = w.y1 + t * vy
        const d = Math.hypot(px - x, py - y)
        if (d < bestDist) {
          bestDist = d
          best = { x: px, y: py }
        }
      }
      return best && bestDist <= threshold ? best : null
    },
    [walls, displayScale],
  )

  const wallGraph = useMemo(() => {
    const byId = new Map<string, ConnectionPoint>()
    for (const p of connectionPoints) byId.set(p.id, p)

    const nearestNodeId = (x: number, y: number) => {
      let bestId: string | null = null
      let bestDist = Number.POSITIVE_INFINITY
      for (const p of connectionPoints) {
        const d = Math.hypot(p.x - x, p.y - y)
        if (d < bestDist) {
          bestDist = d
          bestId = p.id
        }
      }
      return bestDist <= 1.2 ? bestId : null
    }

    const adj = new Map<string, Set<string>>()
    const addEdge = (a: string, b: string) => {
      if (!adj.has(a)) adj.set(a, new Set())
      if (!adj.has(b)) adj.set(b, new Set())
      adj.get(a)!.add(b)
      adj.get(b)!.add(a)
    }

    for (const w of walls) {
      // Walls store coordinates; map endpoints to nearest nodes.
      const aId = nearestNodeId(w.x1, w.y1)
      const bId = nearestNodeId(w.x2, w.y2)
      if (aId && bId && aId !== bId && byId.has(aId) && byId.has(bId)) addEdge(aId, bId)
    }

    const findPath = (startId: string, goalId: string): string[] | null => {
      if (startId === goalId) return [startId]
      const q: string[] = [startId]
      const prev = new Map<string, string | null>()
      prev.set(startId, null)
      while (q.length) {
        const cur = q.shift()!
        const nexts = adj.get(cur)
        if (!nexts) continue
        for (const nx of nexts) {
          if (prev.has(nx)) continue
          prev.set(nx, cur)
          if (nx === goalId) {
            const path: string[] = [goalId]
            let p: string | null = cur
            while (p) {
              path.push(p)
              p = prev.get(p) ?? null
            }
            path.reverse()
            return path
          }
          q.push(nx)
        }
      }
      return null
    }

    return { adj, findPath }
  }, [walls, connectionPoints])

  const handleStagePointerMoveForPlace = useCallback(
    (evt: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (tool === 'ceiling') {
        const pt = toFloor(evt)
        if (!pt) {
          setCeilingHoverNodeId(null)
          return
        }
        // Important: do NOT snap before searching for nodes, otherwise nodes that are off-grid
        // become hard/impossible to pick when snap-to-grid is enabled.
        const nearby = findNearbyConnectionPoint(pt.x, pt.y)
        setCeilingHoverNodeId(nearby?.id ?? null)
        return
      }
      if (tool === 'wall') {
        const pt = toFloor(evt)
        if (!pt) {
          setWallHoverPointId(null)
          setWallHoverPlan(null)
          setWallSnapIndicator(null)
          return
        }
        const nearby = findNearbyConnectionPoint(pt.x, pt.y)
        const anchor = wallStartPointId ? connectionPoints.find((p) => p.id === wallStartPointId) ?? null : null
        const snapped = computeWallSnap(pt, anchor, Boolean((evt.evt as MouseEvent).shiftKey))
        setWallHoverPlan(snapped)
        setWallSnapIndicator({ planX: snapped.x, planY: snapped.y, snapped: snapped.snapped })
        setWallHoverPointId(nearby?.id ?? null)
        return
      }
      if (tool === 'door') {
        const pt = toFloor(evt)
        if (!pt) {
          setDoorHoverPointId(null)
          return
        }
        const nearby = findNearbyConnectionPoint(pt.x, pt.y)
        setDoorHoverPointId(nearby?.id ?? null)
        return
      }
      if (tool === 'window') {
        const pt = toFloor(evt)
        if (!pt) {
          setWindowHoverPointId(null)
          return
        }
        const nearby = findNearbyConnectionPoint(pt.x, pt.y)
        setWindowHoverPointId(nearby?.id ?? null)
        return
      }
      if (tool !== 'placeFurniture' || !pendingFurniturePreset) return
      if (!derived || !gridInputsBase) {
        setPlacePreviewCell(null)
        return
      }
      const pt = toFloor(evt)
      if (!pt) {
        setPlacePreviewCell(null)
        return
      }
      const [c, r] = pixelToCell(pt.x, pt.y, derived.cellSizePx)
      setPlacePreviewCell((prev) => (prev?.[0] === c && prev?.[1] === r ? prev : [c, r]))
    },
    [tool, pendingFurniturePreset, derived, gridInputsBase, toFloor, findNearbyConnectionPoint, wallStartPointId, connectionPoints, computeWallSnap, setWallSnapIndicator],
  )

  const clearPlacePreview = useCallback(() => {
    setPlacePreviewCell(null)
    setWallHoverPointId(null)
    setWallHoverPlan(null)
    setDoorHoverPointId(null)
    setWindowHoverPointId(null)
    setCeilingHoverNodeId(null)
    setWallSnapIndicator(null)
  }, [setWallSnapIndicator])

  const handleStageWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    const pointer = stage?.getPointerPosition()
    if (!pointer) return
    const oldScale = viewScale
    const direction = e.evt.deltaY > 0 ? -1 : 1
    const factor = direction > 0 ? 1.08 : 1 / 1.08
    const next = Math.min(4, Math.max(0.2, oldScale * factor))
    const mousePointTo = {
      x: (pointer.x - viewPan.x) / oldScale,
      y: (pointer.y - viewPan.y) / oldScale,
    }
    setViewPan({
      x: pointer.x - mousePointTo.x * next,
      y: pointer.y - mousePointTo.y * next,
    })
    setViewScale(next)
  }

  const SELECT_PAN_THRESHOLD_PX = 4

  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const btn = e.evt.button
    if (btn === 1) {
      e.evt.preventDefault()
      const st = e.target.getStage()
      if (!st?.getPointerPosition()) return
      panLast.current = { sx: e.evt.clientX, sy: e.evt.clientY, px: viewPan.x, py: viewPan.y }
      const move = (ev: MouseEvent) => {
        const dx = ev.clientX - panLast.current.sx
        const dy = ev.clientY - panLast.current.sy
        setViewPan({ x: panLast.current.px + dx, y: panLast.current.py + dy })
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
      return
    }
    if (btn !== 0 || tool !== 'select') return
    e.evt.preventDefault()
    selectPanRef.current = {
      sx: e.evt.clientX,
      sy: e.evt.clientY,
      panX: viewPan.x,
      panY: viewPan.y,
      didPan: false,
    }
    const move = (ev: MouseEvent) => {
      const r = selectPanRef.current
      if (!r) return
      const dx = ev.clientX - r.sx
      const dy = ev.clientY - r.sy
      if (Math.hypot(dx, dy) > SELECT_PAN_THRESHOLD_PX) r.didPan = true
      if (r.didPan) setViewPan({ x: r.panX + dx, y: r.panY + dy })
    }
    const up = () => {
      const r = selectPanRef.current
      if (r && !r.didPan) setSelectedFurnitureId(null)
      selectPanRef.current = null
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const handleStageTouchStart = (e: KonvaEventObject<TouchEvent>) => {
    if (tool !== 'select') return
    if (e.evt.touches.length !== 1) return
    const t = e.evt.touches[0]
    selectPanRef.current = {
      sx: t.clientX,
      sy: t.clientY,
      panX: viewPan.x,
      panY: viewPan.y,
      didPan: false,
    }
    const move = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return
      const r = selectPanRef.current
      if (!r) return
      const tt = ev.touches[0]
      const dx = tt.clientX - r.sx
      const dy = tt.clientY - r.sy
      if (Math.hypot(dx, dy) > SELECT_PAN_THRESHOLD_PX) r.didPan = true
      if (r.didPan) setViewPan({ x: r.panX + dx, y: r.panY + dy })
    }
    const end = () => {
      const r = selectPanRef.current
      if (r && !r.didPan) setSelectedFurnitureId(null)
      selectPanRef.current = null
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
      window.removeEventListener('touchcancel', end)
    }
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', end)
    window.addEventListener('touchcancel', end)
  }

  const handlePointerDown = (evt: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pt = toFloor(evt)
    if (!pt) return
    // Snap-to-grid should not affect node-based tools. It is only used for furniture placement/moves.
    const snapped =
      tool === 'placeFurniture' ? snapPt(pt.x, pt.y) : { x: pt.x, y: pt.y }

    // Calibrate / room / wall / select work before scale exists (gridInputsBase is null until pxPerFt is set).
    if (tool === 'calibrate') {
      if (calibrateStep === 0) {
        setScale({
          pxPerFt: scale?.pxPerFt ?? 1,
          pointA: [snapped.x, snapped.y],
          pointB: [snapped.x, snapped.y],
        })
        setCalibrateStep(1)
      } else if (calibrateStep === 1 && scale) {
        setScale({ ...scale, pointB: [snapped.x, snapped.y] })
        setCalibrateStep(2)
        onRequestCalibrateDistance()
      }
      return
    }

    if (tool === 'room') {
      // Room polygons should use existing connection nodes (like ceilings).
      const nearby = findNearbyConnectionPoint(pt.x, pt.y)
      if (!nearby) return
      const node = nearby

      const firstId = roomDraftNodeIds[0]
      const isClosing = Boolean(firstId && node.id === firstId && roomDraftNodeIds.length >= 3)
      if (isClosing) {
        pushDraft()
        const poly = roomDraftNodeIds
          .map((id) => connectionPoints.find((p) => p.id === id))
          .filter((p): p is ConnectionPoint => Boolean(p))
          .map((p) => [p.x, p.y] as [number, number])
        if (poly.length >= 3) {
          addRoom({
            id: uid(),
            name: `Room ${rooms.length + 1}`,
            polygon: poly,
          })
        }
        setRoomDraftNodeIds([])
        setRoomDraft([])
        return
      }

      const lastId = roomDraftNodeIds[roomDraftNodeIds.length - 1]
      if (lastId && node.id === lastId) {
        pushDraft()
        setRoomDraftNodeIds((prev) => prev.slice(0, -1))
        return
      }

      const prevId = roomDraftNodeIds[roomDraftNodeIds.length - 1]
      const prevNode = prevId ? connectionPoints.find((p) => p.id === prevId) : undefined
      if (prevNode) {
        const path = wallGraph.findPath(prevId, node.id)
        if (path && path.length >= 2) {
          pushDraft()
          setRoomDraftNodeIds((prev) => {
            const toAdd = path.slice(1)
            const out = [...prev]
            for (const id of toAdd) {
              if (out[out.length - 1] !== id) out.push(id)
            }
            return out
          })
          return
        }

        const aligned = Math.abs(prevNode.x - node.x) <= 0.5 || Math.abs(prevNode.y - node.y) <= 0.5
        if (aligned) {
          pushDraft()
          setRoomDraftNodeIds((prev) => [...prev, node.id])
          return
        }

        const elbowA = findNodeNear(prevNode.x, node.y)
        const elbowB = findNodeNear(node.x, prevNode.y)
        const elbow = elbowA ?? elbowB
        if (elbow) {
          pushDraft()
          setRoomDraftNodeIds((prev) => [...prev, elbow.id, node.id])
          return
        }

        pushDraft()
        setRoomDraftNodeIds((prev) => [...prev, node.id])
        return
      }

      pushDraft()
      setRoomDraftNodeIds((prev) => [...prev, node.id])
      return
    }

    if (tool === 'connection') {
      addConnectionPoint({ id: uid(), x: snapped.x, y: snapped.y })
      return
    }

    if (tool === 'viewPost') {
      const id = uid()
      addViewPost({ id, x: pt.x, y: pt.y, heightFt: 4, yawDeg: 0, pitchDeg: 0 })
      setSelectedViewPostId(id)
      setSelectedCeilingId(null)
      setSelectedLightId(null)
      setSelectedDoorId(null)
      setSelectedWallId(null)
      setSelectedWindowId(null)
      setSelectedFurnitureId(null)
      return
    }

    if (tool === 'ceiling') {
      // Simple ceiling: ONLY use existing nodes. Click nodes that are connected by walls.
      // The draft edges follow the existing wall path between nodes; no freehand points.
      const nearby = findNearbyConnectionPoint(pt.x, pt.y)
      if (!nearby) return
      const node = nearby

      // Shift+click selects two nodes so Delete removes the draft segment between them.
      if ((evt.evt as MouseEvent).shiftKey) {
        if (!ceilingEdgeAId || (ceilingEdgeAId && ceilingEdgeBId)) {
          setCeilingEdgeAId(node.id)
          setCeilingEdgeBId(null)
        } else if (ceilingEdgeAId && !ceilingEdgeBId) {
          setCeilingEdgeBId(node.id)
        }
        return
      }

      const firstId = ceilingDraftNodeIds[0]
      const isClosing = Boolean(firstId && node.id === firstId && ceilingDraftNodeIds.length >= 3)
      if (isClosing) {
        pushDraft()
        const poly = ceilingDraftNodeIds
          .map((id) => connectionPoints.find((p) => p.id === id))
          .filter((p): p is ConnectionPoint => Boolean(p))
          .map((p) => [p.x, p.y] as [number, number])
        if (poly.length >= 3) {
          const c: Ceiling = {
            id: uid(),
            polygon: poly,
            type: 'flat',
            heightFt: Math.max(0.5, Number(wallDefaultHeightFt ?? 8)),
            thicknessFt: 1,
            dropFt: 0,
            color: '#93c5fd',
            hidden: false,
          }
          addCeiling(c)
          setSelectedCeilingId(c.id)
        }
        setCeilingDraftNodeIds([])
        setCeilingHoverNodeId(null)
        return
      }

      // Toggle off if user clicks the last selected node again.
      const lastId = ceilingDraftNodeIds[ceilingDraftNodeIds.length - 1]
      if (lastId && node.id === lastId) {
        pushDraft()
        setCeilingDraftNodeIds((prev) => prev.slice(0, -1))
        return
      }

      // Append node. Prefer following an existing wall path between nodes so ceilings
      // match the wall outline precisely. Fallback: insert orthogonal elbow.
      const prevId = ceilingDraftNodeIds[ceilingDraftNodeIds.length - 1]
      const prevNode = prevId ? connectionPoints.find((p) => p.id === prevId) : undefined
      if (prevNode) {
        const path = wallGraph.findPath(prevId, node.id)
        if (path && path.length >= 2) {
          // Append intermediate nodes (skip the first since it's already in draft).
          pushDraft()
          setCeilingDraftNodeIds((prev) => {
            const toAdd = path.slice(1)
            // Avoid duplicate if user clicks quickly on already-included node.
            const out = [...prev]
            for (const id of toAdd) {
              if (out[out.length - 1] !== id) out.push(id)
            }
            return out
          })
          return
        }

        // If there is no wall path between nodes, still allow drawing (not mandatory).
        // Prefer wall-like orthogonal behavior using existing nodes only.
        const aligned = Math.abs(prevNode.x - node.x) <= 0.5 || Math.abs(prevNode.y - node.y) <= 0.5
        if (aligned) {
          pushDraft()
          setCeilingDraftNodeIds((prev) => [...prev, node.id])
          return
        }

        // Try to reuse an existing elbow node at (ax, by) or (bx, ay).
        const elbowA = findNodeNear(prevNode.x, node.y)
        const elbowB = findNodeNear(node.x, prevNode.y)
        const elbow = elbowA ?? elbowB
        if (elbow) {
          pushDraft()
          setCeilingDraftNodeIds((prev) => [...prev, elbow.id, node.id])
          return
        }

        // Final fallback: allow direct connection even if diagonal,
        // rather than blocking the user (still only uses existing nodes).
        pushDraft()
        setCeilingDraftNodeIds((prev) => [...prev, node.id])
        return
      }
      pushDraft()
      setCeilingDraftNodeIds((prev) => [...prev, node.id])
      return
    }

    if (tool === 'ceilingLight') {
      const room = rooms.find((r) => pointInPolygon({ x: pt.x, y: pt.y }, r.polygon))
      if (!room) return
      const light = createDefaultLight({ id: uid(), x: pt.x, y: pt.y, roomId: room.id })
      addLight(light)
      invalidateLuxAnalysis()
      setSelectedLightId(light.id)
      setSelectedCeilingId(null)
      setSelectedDoorId(null)
      setSelectedWallId(null)
      setSelectedWindowId(null)
      setSelectedFurnitureId(null)
      return
    }

    if (tool === 'wall') {
      const shiftBypass = Boolean((evt.evt as MouseEvent).shiftKey)
      const startNode = wallStartPointId ? connectionPoints.find((point) => point.id === wallStartPointId) ?? null : null
      const snappedPt = computeWallSnap(pt, startNode, shiftBypass)
      const nearby = findNearbyConnectionPoint(snappedPt.x, snappedPt.y)
      const snapNode = nearby
        ? nearby
        : (() => {
            if (wallHoverPlan) return getOrCreateConnectionPoint(wallHoverPlan.x, wallHoverPlan.y)
            const wallSnap = findWallSnapPoint(snappedPt.x, snappedPt.y)
            if (wallSnap) return getOrCreateConnectionPoint(wallSnap.x, wallSnap.y)
            return getOrCreateConnectionPoint(snappedPt.x, snappedPt.y)
          })()
      if (!snapNode) return
      if (!wallStartPointId) {
        pushDraft()
        setWallStartPointId(snapNode.id)
        return
      }
      if (snapNode.id === wallStartPointId) {
        pushDraft()
        setWallStartPointId(null)
        return
      }
      const start = connectionPoints.find((point) => point.id === wallStartPointId)
      if (!start) {
        pushDraft()
        setWallStartPointId(null)
        return
      }
      const linkedDoor = findDoorBetweenNodes(start.id, snapNode.id)
      if (linkedDoor) {
        updateDoor(linkedDoor.id, { hasTopLayer: true })
        for (const wall of walls) {
          if (isWallMatchingSegment(wall, start, snapNode)) removeWall(wall.id)
        }
        pushDraft()
        setWallStartPointId(null)
        return
      }
      const angleEnabledNow = angleLockEnabled && !shiftBypass
      if (angleEnabledNow || Math.abs(start.x - snapNode.x) <= 0.5 || Math.abs(start.y - snapNode.y) <= 0.5) {
        addWall({ id: uid(), x1: start.x, y1: start.y, x2: snapNode.x, y2: snapNode.y })
      } else {
        const elbow = getOrthogonalElbow(start, snapNode)
        const elbowNode = getOrCreateConnectionPoint(elbow.x, elbow.y)
        addWall({ id: uid(), x1: start.x, y1: start.y, x2: elbowNode.x, y2: elbowNode.y })
        addWall({ id: uid(), x1: elbowNode.x, y1: elbowNode.y, x2: snapNode.x, y2: snapNode.y })
      }
      setWallHoverPlan(null)
      setWallSnapIndicator(null)
      setWallStartPointId(null)
      return
    }

    if (tool === 'select') return

    if (!gridInputsBase) return

    if (tool === 'door' && derived) {
      const nearby = findNearbyConnectionPoint(pt.x, pt.y)
      if (!nearby) return
      if (!doorStartPointId) {
        pushDraft()
        setDoorStartPointId(nearby.id)
        return
      }
      if (nearby.id === doorStartPointId) {
        pushDraft()
        setDoorStartPointId(null)
        return
      }
      const start = connectionPoints.find((p) => p.id === doorStartPointId)
      if (!start) {
        pushDraft()
        setDoorStartPointId(null)
        return
      }
      const midX = (start.x + nearby.x) / 2
      const midY = (start.y + nearby.y) / 2
      const [c, r] = pixelToCell(midX, midY, derived.cellSizePx)
      addDoor({
        id: uid(),
        col: c,
        row: r,
        node_a_id: start.id,
        node_b_id: nearby.id,
        isOpen: true,
        swingMode: 'push',
        hasTopLayer: false,
        material: 'wood',
      })
      setDoorStartPointId(null)
      return
    }

    if (tool === 'window') {
      const cellSizeForWindow = derived?.cellSizePx ?? (scale?.pxPerFt ? scale.pxPerFt * gridSizeFt : 0)
      if (!Number.isFinite(cellSizeForWindow) || cellSizeForWindow <= 0) return
      const nearby = findNearbyConnectionPoint(pt.x, pt.y)
      if (!nearby) return
      if (!windowStartPointId) {
        pushDraft()
        setWindowStartPointId(nearby.id)
        return
      }
      if (nearby.id === windowStartPointId) {
        pushDraft()
        setWindowStartPointId(null)
        return
      }
      const start = connectionPoints.find((p) => p.id === windowStartPointId)
      if (!start) {
        pushDraft()
        setWindowStartPointId(null)
        return
      }
      const midX = (start.x + nearby.x) / 2
      const midY = (start.y + nearby.y) / 2
      const [c, r] = pixelToCell(midX, midY, cellSizeForWindow)
      addWindow({
        id: uid(),
        col: c,
        row: r,
        node_a_id: start.id,
        node_b_id: nearby.id,
        sillHeightFt: 3,
        heightFt: 4,
        frameDepthFt: 0.5,
        frameThicknessFt: 0.12,
        material: 'clear',
      })
      setWindowStartPointId(null)
      return
    }

    if (tool === 'placeFurniture' && pendingFurniturePreset && derived && scale) {
      const [c, r] = pixelToCell(snapped.x, snapped.y, derived.cellSizePx)
      const item = createFurnitureFromPreset(
        pendingFurniturePreset,
        c,
        r,
        furniturePlanScaleFactor != null ? { planScaleFactor: furniturePlanScaleFactor } : undefined,
      )
      if (isPlacementValid(item, null, gridInputsBase)) {
        addFurniture(item)
        setPendingPreset(null)
        setTool('select')
      }
    }
  }

  const handlePointerUp = () => {
    setWallSnapIndicator(null)
  }

  /** Per-segment geometry only — a single Konva `Line` with all points draws one polyline and connects the bottom of each vertical to the top of the next (diagonals). */
  const gridSpec = useMemo(() => {
    if (!showGrid || !scale?.pxPerFt) return null
    return getGridDimensions(imgW, imgH, scale.pxPerFt, gridSizeFt)
  }, [showGrid, scale, imgW, imgH, gridSizeFt])

  const heatmapRects = useMemo(() => {
    if (!showHeatmap || !derived || !deadMask || deadMask.length !== derived.cells.length) return null
    const { cols, cellSizePx: cs } = derived
    const rects: ReactElement[] = []
    for (let i = 0; i < deadMask.length; i++) {
      if (!deadMask[i] || derived.cells[i] !== CellType.EMPTY) continue
      const c = i % cols
      const r = (i / cols) | 0
      rects.push(
        <Rect
          key={`d-${i}`}
          x={c * cs}
          y={r * cs}
          width={cs}
          height={cs}
          fill="rgba(220,60,60,0.35)"
          listening={false}
        />,
      )
    }
    return rects
  }, [showHeatmap, derived, deadMask])

  const circulationRects = useMemo(() => {
    if (!showCirculation || !derived || !reachableMask || reachableMask.length !== derived.cells.length)
      return null
    const { cols, cellSizePx: cs } = derived
    const rects: ReactElement[] = []
    for (let i = 0; i < reachableMask.length; i++) {
      if (!reachableMask[i]) continue
      if (derived.cells[i] !== CellType.EMPTY && derived.cells[i] !== CellType.PATH) continue
      const c = i % cols
      const r = (i / cols) | 0
      rects.push(
        <Rect
          key={`c-${i}`}
          x={c * cs}
          y={r * cs}
          width={cs}
          height={cs}
          fill="rgba(60,180,120,0.22)"
          listening={false}
        />,
      )
    }
    return rects
  }, [showCirculation, derived, reachableMask])

  const luxHeatmapRects = useMemo(() => {
    if (!showLuxHeatmap || !scale?.pxPerFt) return null
    const rects: ReactElement[] = []
    for (const r of rooms) {
      const grid = luxAnalysis[r.id]
      if (!grid || grid.cells.length === 0) continue
      const pxPerFt = scale.pxPerFt
      const csPx = grid.cellSizeFt * pxPerFt
      // Color ramp: dark (blue) -> target (green) -> overlit (red)
      for (const cell of grid.cells) {
        const x = cell.fx * pxPerFt - csPx / 2
        const y = cell.fy * pxPerFt - csPx / 2
        let fill = `rgba(34,197,94,${LUX_CELL_ALPHA})`
        if (cell.isDark) fill = `rgba(59,130,246,${LUX_CELL_ALPHA})`
        else if (cell.isOverlit) fill = `rgba(239,68,68,${LUX_CELL_ALPHA})`
        rects.push(<Rect key={`lux-${r.id}-${cell.col}-${cell.row}`} x={x} y={y} width={csPx} height={csPx} fill={fill} listening={false} />)
      }
    }
    return rects
  }, [showLuxHeatmap, rooms, luxAnalysis, scale?.pxPerFt])

  return (
    <div
      ref={containerRef}
      className={`floor-stage-wrap h-full min-h-[320px] w-full overflow-hidden rounded-3xl bg-white/30 shadow-[var(--shadow-ambient)] ring-1 ring-white/40 backdrop-blur-[2px] ${
        tool === 'placeFurniture' && pendingFurniturePreset ? 'cursor-crosshair' : ''
      }`}
    >
      <Stage
        width={size.w}
        height={size.h}
        onWheel={handleStageWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStagePointerMoveForPlace}
        onMouseLeave={clearPlacePreview}
        onTouchStart={handleStageTouchStart}
        onTouchMove={handleStagePointerMoveForPlace}
        onTouchEnd={clearPlacePreview}
      >
        <Layer>
          <Group x={viewPan.x} y={viewPan.y} scaleX={viewScale} scaleY={viewScale}>
            <Group
              ref={floorContentRef}
              x={size.w / 2}
              y={size.h / 2}
              offsetX={imgW / 2}
              offsetY={imgH / 2}
              rotation={floorPlanRotationDeg}
              scaleX={displayScale}
              scaleY={displayScale}
            >
            {imgEl && (
              <KonvaImage
                image={imgEl}
                width={imgW}
                height={imgH}
                opacity={showFloorPlanImage ? 1 : 0.04}
                listening
                onMouseDown={handlePointerDown}
                onMouseUp={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchEnd={handlePointerUp}
              />
            )}
            {!imgEl && (
              <Rect
                width={imgW}
                height={imgH}
                fill="#e8e8ea"
                onMouseDown={handlePointerDown}
                onMouseUp={handlePointerUp}
              />
            )}

            {gridSpec && (
              <Shape
                sceneFunc={(ctx, shape) => {
                  const { cols, rows, cellSizePx: cs } = gridSpec
                  ctx.beginPath()
                  for (let c = 0; c <= cols; c++) {
                    const x = c * cs
                    ctx.moveTo(x, 0)
                    ctx.lineTo(x, imgH)
                  }
                  for (let r = 0; r <= rows; r++) {
                    const y = r * cs
                    ctx.moveTo(0, y)
                    ctx.lineTo(imgW, y)
                  }
                  ctx.strokeShape(shape)
                }}
                stroke="rgba(193,198,215,0.22)"
                strokeWidth={1 / displayScale}
                listening={false}
              />
            )}

            {rooms.map((room) => (
              <Line
                key={room.id}
                points={room.polygon.flat()}
                closed
                stroke="rgba(255,200,100,0.9)"
                strokeWidth={2 / displayScale}
                fill="rgba(255,200,100,0.08)"
                listening={false}
              />
            ))}

            {showCeilings &&
              ceilings
                .filter((c) => !c.hidden)
                .map((c) => (
                  <Line
                    key={c.id}
                    points={c.polygon.flat()}
                    closed
                    stroke={CEILING_OUTLINE}
                    strokeWidth={2 / displayScale}
                    dash={[10 / displayScale, 8 / displayScale]}
                    fill={c.color ? 'rgba(147,197,253,0.22)' : CEILING_DEFAULT_COLOR}
                    listening={false}
                  />
                ))}

            {tool === 'ceiling' && ceilingDraftNodeIds.length > 0 && (
              <Line
                points={ceilingDraftNodeIds
                  .map((id) => connectionPoints.find((p) => p.id === id))
                  .filter((p): p is ConnectionPoint => Boolean(p))
                  .flatMap((p) => [p.x, p.y])}
                closed={false}
                stroke={CEILING_OUTLINE}
                strokeWidth={2 / displayScale}
                dash={[10 / displayScale, 8 / displayScale]}
                listening={false}
              />
            )}

            {roomDraft.length > 0 && (
              <Line
                points={roomDraft.flat()}
                stroke="rgba(255,220,50,0.95)"
                strokeWidth={2 / displayScale}
                closed={false}
                listening={false}
              />
            )}

            {connectionPoints.map((point) => {
              const active =
                point.id === wallStartPointId || point.id === wallHoverPointId || tool === 'connection'
              const ceilingActive =
                tool === 'ceiling' &&
                (point.id === ceilingHoverNodeId || ceilingDraftNodeIds.includes(point.id))
              const ceilingSelected = tool === 'ceiling' && (point.id === ceilingEdgeAId || point.id === ceilingEdgeBId)
              return (
                <Circle
                  key={point.id}
                  x={point.x}
                  y={point.y}
                  radius={(active || ceilingActive ? 4.75 : 3.5) / displayScale}
                  fill={
                    point.id === wallStartPointId
                      ? 'rgba(255,198,45,0.98)'
                      : ceilingSelected
                        ? 'rgba(168,85,247,0.95)'
                        : 'rgba(76,182,255,0.95)'
                  }
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={1.25 / displayScale}
                  listening={false}
                />
              )
            })}
            {(() => {
              if (!wallStartPointId) return null
              const start = connectionPoints.find((point) => point.id === wallStartPointId)
              const endPoint = wallHoverPointId
                ? connectionPoints.find((point) => point.id === wallHoverPointId)
                : wallHoverPlan
              if (!start || !endPoint) return null
              const end = { x: endPoint.x, y: endPoint.y }
              const aligned = Math.abs(start.x - end.x) <= 0.5 || Math.abs(start.y - end.y) <= 0.5 || angleLockEnabled
              const elbow = aligned ? null : getOrthogonalElbow(start, { id: 'tmp', x: end.x, y: end.y })
              return (
                <>
                  <Line
                    points={
                      elbow
                        ? [start.x, start.y, elbow.x, elbow.y, end.x, end.y]
                        : [start.x, start.y, end.x, end.y]
                    }
                    stroke="rgba(255,198,45,0.92)"
                    strokeWidth={2 / displayScale}
                    dash={[8 / displayScale, 6 / displayScale]}
                    listening={false}
                  />
                  {wallHoverPlan?.snapped && (
                    <Circle
                      x={wallHoverPlan.x}
                      y={wallHoverPlan.y}
                      radius={5.8 / displayScale}
                      stroke="rgba(0,255,136,0.95)"
                      strokeWidth={1.6 / displayScale}
                      fill="rgba(0,255,136,0.15)"
                      listening={false}
                    />
                  )}
                </>
              )
            })()}
            {(() => {
              if (!doorStartPointId || !doorHoverPointId || doorStartPointId === doorHoverPointId) return null
              const start = connectionPoints.find((point) => point.id === doorStartPointId)
              const end = connectionPoints.find((point) => point.id === doorHoverPointId)
              if (!start || !end) return null
              return (
                <Line
                  points={[start.x, start.y, end.x, end.y]}
                  stroke={DOOR_LINE_BROWN}
                  strokeWidth={Math.max(2 / displayScale, 2.5)}
                  dash={[6 / displayScale, 5 / displayScale]}
                  listening={false}
                />
              )
            })()}
            {(() => {
              if (!windowStartPointId || !windowHoverPointId || windowStartPointId === windowHoverPointId) return null
              const start = connectionPoints.find((point) => point.id === windowStartPointId)
              const end = connectionPoints.find((point) => point.id === windowHoverPointId)
              if (!start || !end) return null
              return (
                <Line
                  points={[start.x, start.y, end.x, end.y]}
                  stroke={WINDOW_LINE_CYAN}
                  strokeWidth={Math.max(2 / displayScale, 2.5)}
                  dash={[6 / displayScale, 5 / displayScale]}
                  listening={false}
                />
              )
            })()}

            {showWalls &&
              walls.filter((w) => !w.hidden).map((w) => (
              <Line
                key={w.id}
                points={[w.x1, w.y1, w.x2, w.y2]}
                stroke={w.color ?? WALL_DEFAULT_COLOR}
                strokeWidth={3 / displayScale}
                lineCap="round"
                listening={tool === 'select'}
                hitStrokeWidth={14 / displayScale}
                onMouseDown={(evt) => {
                  if (tool !== 'select') return
                  evt.cancelBubble = true
                  if (evt.evt.ctrlKey || evt.evt.metaKey) {
                    const has = selectedWallIds.includes(w.id)
                    const next = has ? selectedWallIds.filter((id) => id !== w.id) : [...selectedWallIds, w.id]
                    useSigeStore.getState().setSelectedWallIds(next)
                  } else {
                    useSigeStore.getState().setSelectedWallIds([w.id])
                  }
                }}
              />
            ))}
            {tool === 'select' &&
              selectedWallIds.length === 1 &&
              (() => {
                const wall = walls.find((w) => w.id === selectedWallIds[0])
                if (!wall) return null
                const mid = { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 }
                const startNode = connectionPoints.find((p) => Math.hypot(p.x - wall.x1, p.y - wall.y1) <= 0.6)
                const endNode = connectionPoints.find((p) => Math.hypot(p.x - wall.x2, p.y - wall.y2) <= 0.6)
                return (
                  <>
                    <Circle
                      x={wall.x1}
                      y={wall.y1}
                      radius={5 / displayScale}
                      fill="rgba(0,255,136,0.9)"
                      draggable
                      onDragMove={(evt) => {
                        const n = evt.target
                        const raw = { x: n.x(), y: n.y() }
                        const snapped = computeWallSnap(raw, { id: 'tmp', x: wall.x2, y: wall.y2 }, Boolean(evt.evt.shiftKey))
                        n.position({ x: snapped.x, y: snapped.y })
                        setWallSnapIndicator({ planX: snapped.x, planY: snapped.y, snapped: snapped.snapped })
                      }}
                      onDragEnd={(evt) => {
                        const n = evt.target
                        updateWall(wall.id, { x1: n.x(), y1: n.y() })
                        if (startNode) updateConnectionPoint(startNode.id, { x: n.x(), y: n.y() })
                        setWallSnapIndicator(null)
                      }}
                    />
                    <Circle
                      x={wall.x2}
                      y={wall.y2}
                      radius={5 / displayScale}
                      fill="rgba(0,255,136,0.9)"
                      draggable
                      onDragMove={(evt) => {
                        const n = evt.target
                        const raw = { x: n.x(), y: n.y() }
                        const snapped = computeWallSnap(raw, { id: 'tmp', x: wall.x1, y: wall.y1 }, Boolean(evt.evt.shiftKey))
                        n.position({ x: snapped.x, y: snapped.y })
                        setWallSnapIndicator({ planX: snapped.x, planY: snapped.y, snapped: snapped.snapped })
                      }}
                      onDragEnd={(evt) => {
                        const n = evt.target
                        updateWall(wall.id, { x2: n.x(), y2: n.y() })
                        if (endNode) updateConnectionPoint(endNode.id, { x: n.x(), y: n.y() })
                        setWallSnapIndicator(null)
                      }}
                    />
                    <Circle
                      x={mid.x}
                      y={mid.y}
                      radius={5.2 / displayScale}
                      fill="rgba(59,130,246,0.95)"
                      draggable
                      onDragMove={(evt) => {
                        const n = evt.target
                        const dx = n.x() - mid.x
                        const dy = n.y() - mid.y
                        const cell = Math.max(0.01, derived?.cellSizePx ?? 0.01)
                        const tdx = snapToGrid && !evt.evt.shiftKey ? Math.round(dx / cell) * cell : dx
                        const tdy = snapToGrid && !evt.evt.shiftKey ? Math.round(dy / cell) * cell : dy
                        n.position({ x: mid.x + tdx, y: mid.y + tdy })
                      }}
                      onDragEnd={(evt) => {
                        const n = evt.target
                        const dx = n.x() - mid.x
                        const dy = n.y() - mid.y
                        snapWallsRigid([wall.id], dx, dy)
                      }}
                    />
                  </>
                )
              })()}

            {showDoors &&
              derived &&
              doors.map((d) => {
                const a = d.node_a_id ? connectionPoints.find((p) => p.id === d.node_a_id) : undefined
                const b = d.node_b_id ? connectionPoints.find((p) => p.id === d.node_b_id) : undefined
                if (a && b) {
                  return (
                    <Line
                      key={d.id}
                      points={[a.x, a.y, b.x, b.y]}
                      stroke={DOOR_LINE_BROWN}
                      strokeWidth={Math.max(2 / displayScale, derived.cellSizePx * 0.11)}
                      lineCap="round"
                      listening={false}
                    />
                  )
                }
                const linked = d.node_id
                  ? connectionPoints.find((p) => p.id === d.node_id)
                  : undefined
                const cx = linked ? linked.x : d.col * derived.cellSizePx + derived.cellSizePx / 2
                const cy = linked ? linked.y : d.row * derived.cellSizePx + derived.cellSizePx / 2
                const nearestWall = walls.filter((w) => !w.hidden).reduce(
                  (best, w) => {
                    const vx = w.x2 - w.x1
                    const vy = w.y2 - w.y1
                    const len2 = vx * vx + vy * vy
                    if (len2 <= 1e-6) return best
                    const t = Math.max(0, Math.min(1, ((cx - w.x1) * vx + (cy - w.y1) * vy) / len2))
                    const px = w.x1 + t * vx
                    const py = w.y1 + t * vy
                    const dist = Math.hypot(cx - px, cy - py)
                    if (!best || dist < best.dist) return { w, dist }
                    return best
                  },
                  null as { w: (typeof walls)[number]; dist: number } | null,
                )
                const wx = nearestWall ? nearestWall.w.x2 - nearestWall.w.x1 : 1
                const wy = nearestWall ? nearestWall.w.y2 - nearestWall.w.y1 : 0
                const wl = Math.hypot(wx, wy) || 1
                const ux = wx / wl
                const uy = wy / wl
                const nx = -uy
                const ny = ux
                const leafLen = Math.max(8, derived.cellSizePx * 0.72)
                const half = leafLen / 2
                const hingeX = cx - ux * half
                const hingeY = cy - uy * half
                const leafEndX = hingeX + nx * leafLen * 0.78
                const leafEndY = hingeY + ny * leafLen * 0.78
                return (
                  <Group key={d.id} listening={false}>
                    <Line
                      points={[cx - ux * half, cy - uy * half, cx + ux * half, cy + uy * half]}
                      stroke="rgba(111,72,39,0.98)"
                      strokeWidth={Math.max(2 / displayScale, derived.cellSizePx * 0.11)}
                      lineCap="round"
                    />
                    <Line
                      points={[hingeX, hingeY, leafEndX, leafEndY]}
                      stroke="rgba(146,93,53,0.98)"
                      strokeWidth={Math.max(2 / displayScale, derived.cellSizePx * 0.08)}
                      lineCap="round"
                    />
                    <Circle
                      x={hingeX}
                      y={hingeY}
                      radius={Math.max(2.2 / displayScale, derived.cellSizePx * 0.09)}
                      fill="#f5e6d3"
                      stroke="rgba(111,72,39,0.95)"
                      strokeWidth={1 / displayScale}
                    />
                  </Group>
                )
              })}
            {showWindows &&
              windows.map((w) => {
              const a = w.node_a_id ? connectionPoints.find((p) => p.id === w.node_a_id) : undefined
              const b = w.node_b_id ? connectionPoints.find((p) => p.id === w.node_b_id) : undefined
              if (!a || !b) return null
              return (
                <Line
                  key={w.id}
                  points={[a.x, a.y, b.x, b.y]}
                  stroke={WINDOW_LINE_CYAN}
                  strokeWidth={Math.max(2 / displayScale, 2.2)}
                  lineCap="round"
                  listening={false}
                />
              )
            })}

            {showLights &&
              lights.map((l) => {
                const selected = l.id === selectedLightId
                const isDragging = lightDrag?.id === l.id
                const px = isDragging ? lightDrag.x : l.x
                const py = isDragging ? lightDrag.y : l.y
                const [r, g, b] = kelvinToRGB(l.colorTempK)
                const dot = `rgba(${r},${g},${b},0.95)`
                const pxPerFt = scale?.pxPerFt ?? null
                const ringRadius =
                  pxPerFt != null
                    ? (l.mountHeightFt * Math.tan(((Math.max(1, Math.min(179, l.beamAngleDeg)) / 2) * Math.PI) / 180)) * pxPerFt
                    : null
                return (
                  <Group
                    key={l.id}
                    x={px}
                    y={py}
                    draggable={tool === 'select' && selected}
                    onDragStart={(evt) => {
                      evt.cancelBubble = true
                      setSelectedLightId(l.id)
                      setSelectedCeilingId(null)
                      setSelectedDoorId(null)
                      setSelectedWallId(null)
                      setSelectedWindowId(null)
                      setSelectedFurnitureId(null)
                      setLightDrag({ id: l.id, x: l.x, y: l.y })
                    }}
                    onDragMove={(evt) => {
                      evt.cancelBubble = true
                      const nx = evt.target.x()
                      const ny = evt.target.y()
                      setLightDrag({ id: l.id, x: nx, y: ny })
                    }}
                    onDragEnd={(evt) => {
                      evt.cancelBubble = true
                      const nx = evt.target.x()
                      const ny = evt.target.y()
                      setLightDrag(null)
                      updateLight(l.id, { x: nx, y: ny })
                      invalidateLuxAnalysis()
                    }}
                  >
                    {ringRadius != null && ringRadius > 1 && (
                      <Circle
                        x={0}
                        y={0}
                        radius={ringRadius}
                        stroke={selected ? 'rgba(14,165,233,0.95)' : 'rgba(255,255,255,0.35)'}
                        strokeWidth={(selected ? 2.4 : 1.2) / displayScale}
                        dash={selected ? [10 / displayScale, 6 / displayScale] : undefined}
                        listening={false}
                      />
                    )}
                    <Circle
                      x={0}
                      y={0}
                      radius={(selected ? 6.0 : 4.3) / displayScale}
                      fill={l.hidden ? 'rgba(120,120,120,0.8)' : dot ?? LIGHT_DOT}
                      opacity={l.isOn ? 1 : 0.45}
                      stroke={selected ? 'rgba(14,165,233,0.95)' : 'rgba(60,40,10,0.6)'}
                      strokeWidth={(selected ? 2.2 : 1) / displayScale}
                      onClick={(evt) => {
                        evt.cancelBubble = true
                        setSelectedLightId(selected ? null : l.id)
                        setSelectedCeilingId(null)
                        setSelectedDoorId(null)
                        setSelectedWallId(null)
                        setSelectedWindowId(null)
                        setSelectedFurnitureId(null)
                      }}
                      onDblClick={(evt) => {
                        evt.cancelBubble = true
                        updateLight(l.id, { isOn: !l.isOn })
                        invalidateLuxAnalysis()
                      }}
                    />
                    {selected && (
                      <Group
                        x={10 / displayScale}
                        y={-10 / displayScale}
                        onClick={(evt) => {
                          evt.cancelBubble = true
                          removeLight(l.id)
                          setSelectedLightId(null)
                          invalidateLuxAnalysis()
                        }}
                      >
                        <Rect
                          x={-10 / displayScale}
                          y={-8 / displayScale}
                          width={20 / displayScale}
                          height={16 / displayScale}
                          cornerRadius={4 / displayScale}
                          fill="rgba(239,68,68,0.92)"
                          stroke="rgba(127,29,29,0.9)"
                          strokeWidth={1 / displayScale}
                        />
                        <Text
                          text="×"
                          x={-4.2 / displayScale}
                          y={-9.2 / displayScale}
                          fontSize={16 / displayScale}
                          fill="rgba(255,255,255,0.95)"
                          listening={false}
                        />
                      </Group>
                    )}
                  </Group>
                )
              })}

            {/* View posts (2D markers) */}
            {viewPosts.map((p) => {
              const selected = p.id === selectedViewPostId
              const dragging = viewPostDrag?.id === p.id
              const px = dragging ? viewPostDrag.x : p.x
              const py = dragging ? viewPostDrag.y : p.y
              return (
                <Group
                  key={p.id}
                  x={px}
                  y={py}
                  draggable={tool === 'select' && selected}
                  onDragStart={(evt) => {
                    evt.cancelBubble = true
                    setSelectedViewPostId(p.id)
                    setSelectedCeilingId(null)
                    setSelectedLightId(null)
                    setSelectedDoorId(null)
                    setSelectedWallId(null)
                    setSelectedWindowId(null)
                    setSelectedFurnitureId(null)
                    setViewPostDrag({ id: p.id, x: p.x, y: p.y })
                  }}
                  onDragMove={(evt) => {
                    evt.cancelBubble = true
                    setViewPostDrag({ id: p.id, x: evt.target.x(), y: evt.target.y() })
                  }}
                  onDragEnd={(evt) => {
                    evt.cancelBubble = true
                    const nx = evt.target.x()
                    const ny = evt.target.y()
                    setViewPostDrag(null)
                    updateViewPost(p.id, { x: nx, y: ny })
                  }}
                >
                  <Circle
                    x={0}
                    y={0}
                    radius={(selected ? 7 : 5) / displayScale}
                    fill={VIEW_POST_DOT}
                    stroke={selected ? 'rgba(14,165,233,0.95)' : 'rgba(20,20,35,0.55)'}
                    strokeWidth={(selected ? 2 : 1) / displayScale}
                    onClick={(evt) => {
                      evt.cancelBubble = true
                      setSelectedViewPostId(selected ? null : p.id)
                      setSelectedCeilingId(null)
                      setSelectedLightId(null)
                      setSelectedDoorId(null)
                      setSelectedWallId(null)
                      setSelectedWindowId(null)
                      setSelectedFurnitureId(null)
                    }}
                  />
                  <Text
                    text="VP"
                    x={-6 / displayScale}
                    y={-18 / displayScale}
                    fontSize={10 / displayScale}
                    fill="rgba(255,255,255,0.9)"
                    listening={false}
                  />
                  {selected && (
                    <Group
                      x={12 / displayScale}
                      y={-12 / displayScale}
                      onClick={(evt) => {
                        evt.cancelBubble = true
                        removeViewPost(p.id)
                        setSelectedViewPostId(null)
                      }}
                    >
                      <Rect
                        x={-10 / displayScale}
                        y={-8 / displayScale}
                        width={20 / displayScale}
                        height={16 / displayScale}
                        cornerRadius={4 / displayScale}
                        fill="rgba(239,68,68,0.92)"
                        stroke="rgba(127,29,29,0.9)"
                        strokeWidth={1 / displayScale}
                      />
                      <Text
                        text="×"
                        x={-4.2 / displayScale}
                        y={-9.2 / displayScale}
                        fontSize={16 / displayScale}
                        fill="rgba(255,255,255,0.95)"
                        listening={false}
                      />
                    </Group>
                  )}
                </Group>
              )
            })}

            {circulationRects}
            {heatmapRects}
            {luxHeatmapRects}

            {placePreviewBox && scale && pendingFurniturePreset && (
              <Group listening={false}>
                <Rect
                  x={placePreviewBox.x}
                  y={placePreviewBox.y}
                  width={placePreviewBox.w}
                  height={placePreviewBox.h}
                  fill={placePreviewBox.ok ? 'rgba(0,140,255,0.38)' : 'rgba(255,65,65,0.42)'}
                  stroke={placePreviewBox.ok ? 'rgba(0,85,190,0.98)' : 'rgba(170,25,25,0.98)'}
                  strokeWidth={2.5 / displayScale}
                  cornerRadius={5 / displayScale}
                  listening={false}
                />
                <Text
                  x={placePreviewBox.x + 6 / displayScale}
                  y={placePreviewBox.y + 5 / displayScale}
                  width={Math.max(8, placePreviewBox.w - 12 / displayScale)}
                  text={`${pendingFurniturePreset.label}\n${placePreviewBox.footprintFt.widthFt.toFixed(2)}×${placePreviewBox.footprintFt.depthFt.toFixed(2)} ft · ${placePreviewBox.wCells}×${placePreviewBox.hCells} cells`}
                  fill="rgba(12,18,28,0.92)"
                  fontSize={Math.min(11, Math.max(8, placePreviewBox.h / 6)) / displayScale}
                  lineHeight={1.12}
                  listening={false}
                />
              </Group>
            )}

            {scale &&
              furniture.map((f) => (
                <FurnitureShape
                  key={f.id}
                  item={f}
                  pxPerFt={scale.pxPerFt}
                  cellSizePx={cellSizePx || 1}
                  displayScale={displayScale}
                  selected={f.id === selectedFurnitureId}
                  snapToGrid={snapToGrid}
                  gridInputsBase={gridInputsBase}
                  onSelect={() => {
                    setSelectedFurnitureId(f.id)
                    setTool('select')
                  }}
                  onMoveEnd={(nx, ny, off, prev, ok) => {
                    if (ok) moveFurniture(f.id, nx, ny, off, true, prev)
                    else moveFurniture(f.id, prev.gx, prev.gy, prev.off, false)
                  }}
                />
              ))}

            {scale && calibrateStep >= 1 && scale.pointA && (
              <>
                <Circle
                  x={scale.pointA[0]}
                  y={scale.pointA[1]}
                  radius={6 / displayScale}
                  fill="lime"
                  listening={false}
                />
                {calibrateStep >= 2 && (
                  <Circle
                    x={scale.pointB[0]}
                    y={scale.pointB[1]}
                    radius={6 / displayScale}
                    fill="cyan"
                    listening={false}
                  />
                )}
              </>
            )}

            {!scale?.pxPerFt && imageUrl && (
              <Text
                x={16}
                y={16}
                text="Set scale: choose Calibrate tool and pick two points"
                fill="#1a1c1d"
                fontSize={18 / displayScale}
                listening={false}
              />
            )}
            </Group>
          </Group>
        </Layer>
      </Stage>
    </div>
  )
}

function FurnitureShape({
  item,
  pxPerFt,
  cellSizePx,
  displayScale,
  selected,
  snapToGrid,
  gridInputsBase,
  onSelect,
  onMoveEnd,
}: {
  item: FurnitureItem
  pxPerFt: number
  cellSizePx: number
  displayScale: number
  selected: boolean
  snapToGrid: boolean
  gridInputsBase: GridInputs | null
  onSelect: () => void
  onMoveEnd: (
    gridX: number,
    gridY: number,
    off: [number, number],
    prev: { gx: number; gy: number; off: [number, number] },
    ok: boolean,
  ) => void
}) {
  const { w, h } = effectiveFootprint(item)
  const gs = gridInputsBase?.gridSizeFt
  const span = gs != null ? furnitureItemSpanCells(item, gs) : null
  const fw = span != null ? span.wCells * cellSizePx : w * pxPerFt
  const fh = span != null ? span.hCells * cellSizePx : h * pxPerFt
  const cx = item.gridX * cellSizePx + item.freeOffsetPx[0] + fw / 2
  const cy = item.gridY * cellSizePx + item.freeOffsetPx[1] + fh / 2

  const dragStart = useRef({
    gx: item.gridX,
    gy: item.gridY,
    off: [...item.freeOffsetPx] as [number, number],
  })

  const invalid = useMemo(() => {
    if (!gridInputsBase) return false
    return !isPlacementValid(item, item.id, gridInputsBase)
  }, [gridInputsBase, item])

  const labelText = useMemo(() => {
    if (gs == null) return `${item.label}\n${w}×${h} ft`
    const s = furnitureItemSpanCells(item, gs)
    return `${item.label}\n${s.wFt}×${s.hFt} ft · ${s.wCells}×${s.hCells} cells`
  }, [gs, item, w, h])

  const fillBase = invalid
    ? 'rgba(255,80,80,0.55)'
    : selected
      ? 'rgba(90,170,255,0.52)'
      : 'rgba(70,150,240,0.4)'

  return (
    <Group
      key={`${item.id}-${item.gridX}-${item.gridY}-${item.rotation}-${item.freeOffsetPx[0]}-${item.freeOffsetPx[1]}`}
      x={cx}
      y={cy}
      offsetX={fw / 2}
      offsetY={fh / 2}
      rotation={item.rotation}
      draggable={!item.locked}
      onMouseDown={(e) => {
        e.cancelBubble = true
        onSelect()
      }}
      onDragStart={() => {
        if (item.locked) return
        dragStart.current = {
          gx: item.gridX,
          gy: item.gridY,
          off: [...item.freeOffsetPx] as [number, number],
        }
      }}
      onDragEnd={(e) => {
        if (item.locked) return
        const node = e.target
        const ncx = node.x()
        const ncy = node.y()
        const topLeftX = ncx - fw / 2
        const topLeftY = ncy - fh / 2
        let gridX = Math.floor(topLeftX / cellSizePx)
        let gridY = Math.floor(topLeftY / cellSizePx)
        let offX = topLeftX - gridX * cellSizePx
        let offY = topLeftY - gridY * cellSizePx
        if (snapToGrid) {
          offX = 0
          offY = 0
          gridX = Math.round(topLeftX / cellSizePx)
          gridY = Math.round(topLeftY / cellSizePx)
        }
        const prev = {
          gx: dragStart.current.gx,
          gy: dragStart.current.gy,
          off: dragStart.current.off,
        }
        const draft: FurnitureItem = {
          ...item,
          gridX,
          gridY,
          freeOffsetPx: [offX, offY],
        }
        const ok = Boolean(gridInputsBase && isPlacementValid(draft, item.id, gridInputsBase))
        if (!ok) {
          const prevCx = prev.gx * cellSizePx + prev.off[0] + fw / 2
          const prevCy = prev.gy * cellSizePx + prev.off[1] + fh / 2
          node.position({ x: prevCx, y: prevCy })
        }
        onMoveEnd(gridX, gridY, [offX, offY], prev, ok)
      }}
      onDragMove={(e) => {
        if (item.locked) return
        if (snapToGrid) return
        const node = e.target
        const ncx = node.x()
        const ncy = node.y()
        const topLeftX = ncx - fw / 2
        const topLeftY = ncy - fh / 2
        const gridX = Math.floor(topLeftX / cellSizePx)
        const gridY = Math.floor(topLeftY / cellSizePx)
        const draft: FurnitureItem = {
          ...item,
          gridX,
          gridY,
          freeOffsetPx: [topLeftX - gridX * cellSizePx, topLeftY - gridY * cellSizePx],
        }
        const ok = Boolean(gridInputsBase && isPlacementValid(draft, item.id, gridInputsBase))
        const rect = (e.target as KonvaGroup).findOne('.furn-body') as
          | { fill: (c: string) => void }
          | undefined
        rect?.fill(ok ? fillBase : 'rgba(255,80,80,0.55)')
      }}
    >
      <Rect
        name="furn-body"
        width={fw}
        height={fh}
        cornerRadius={6 / displayScale}
        fill={fillBase}
        stroke={selected ? '#0058bc' : 'rgba(255,255,255,0.85)'}
        strokeWidth={selected ? 2.5 / displayScale : 1 / displayScale}
        shadowBlur={selected ? 18 / displayScale : 0}
        shadowColor={selected ? 'rgba(0,88,188,0.45)' : undefined}
        shadowOpacity={selected ? 1 : 0}
      />
      <Text
        x={4}
        y={4}
        width={fw - 8}
        text={labelText}
        fill="rgba(12,18,28,0.92)"
        fontSize={Math.min(12, Math.max(8, fh / 5)) / displayScale}
        lineHeight={1.15}
        listening={false}
      />
    </Group>
  )
}
