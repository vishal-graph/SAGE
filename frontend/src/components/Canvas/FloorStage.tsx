import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Group as KonvaGroup } from 'konva/lib/Group'
import { useSigeStore } from '../../store/useSigeStore'
import { useDerivedGrid } from '../../hooks/useDerivedGrid'
import { CellType, type FurnitureItem } from '../../types'
import {
  dimsSpanCells,
  effectiveFootprint,
  furnitureItemSpanCells,
  getGridDimensions,
  isPlacementValid,
  type GridInputs,
} from '../../utils/gridEngine'
import { pixelToCell } from '../../utils/geometry'
import {
  createFurnitureFromPreset,
  furniturePlanScaleFactorFromStoreInputs,
  scaledPresetFootprintFt,
} from '../../utils/furnitureLib'
import { computeCirculationMasks } from '../../utils/circulationMasks'

function uid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

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
  const walls = useSigeStore((s) => s.walls)
  const doors = useSigeStore((s) => s.doors)
  const furniture = useSigeStore((s) => s.furniture)
  const minPathWidthFt = useSigeStore((s) => s.minPathWidthFt)
  const tool = useSigeStore((s) => s.tool)
  const snapToGrid = useSigeStore((s) => s.snapToGrid)
  const showGrid = useSigeStore((s) => s.showGrid)
  const showHeatmap = useSigeStore((s) => s.showHeatmap)
  const showCirculation = useSigeStore((s) => s.showCirculation)
  const showFloorPlanImage = useSigeStore((s) => s.showFloorPlanImage)
  const pendingFurniturePreset = useSigeStore((s) => s.pendingFurniturePreset)
  const selectedFurnitureId = useSigeStore((s) => s.selectedFurnitureId)
  const calibrateStep = useSigeStore((s) => s.calibrateStep)
  const floorPlanRotationDeg = useSigeStore((s) => s.floorPlanRotationDeg)

  const addWall = useSigeStore((s) => s.addWall)
  const addDoor = useSigeStore((s) => s.addDoor)
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

  useEffect(() => {
    if (tool !== 'placeFurniture' || !pendingFurniturePreset) setPlacePreviewCell(null)
  }, [tool, pendingFurniturePreset])

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

  const wallDrag = useRef<{ x: number; y: number } | null>(null)

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

  const handleStagePointerMoveForPlace = useCallback(
    (evt: KonvaEventObject<MouseEvent | TouchEvent>) => {
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
    [tool, pendingFurniturePreset, derived, gridInputsBase, toFloor],
  )

  const clearPlacePreview = useCallback(() => setPlacePreviewCell(null), [])

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

    // Calibrate / room / wall / select work before scale exists (gridInputsBase is null until pxPerFt is set).
    if (tool === 'calibrate') {
      if (calibrateStep === 0) {
        setScale({
          pxPerFt: scale?.pxPerFt ?? 1,
          pointA: [pt.x, pt.y],
          pointB: [pt.x, pt.y],
        })
        setCalibrateStep(1)
      } else if (calibrateStep === 1 && scale) {
        setScale({ ...scale, pointB: [pt.x, pt.y] })
        setCalibrateStep(2)
        onRequestCalibrateDistance()
      }
      return
    }

    if (tool === 'room') {
      setRoomDraft([...roomDraft, [pt.x, pt.y]])
      return
    }

    if (tool === 'wall') {
      wallDrag.current = { x: pt.x, y: pt.y }
      return
    }

    if (tool === 'select') return

    if (!gridInputsBase) return

    if (tool === 'door' && derived) {
      const [c, r] = pixelToCell(pt.x, pt.y, derived.cellSizePx)
      addDoor({ id: uid(), col: c, row: r })
      return
    }

    if (tool === 'placeFurniture' && pendingFurniturePreset && derived && scale) {
      const [c, r] = pixelToCell(pt.x, pt.y, derived.cellSizePx)
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

  const handlePointerUp = (evt: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pt = toFloor(evt)
    if (!pt || tool !== 'wall' || !wallDrag.current) return
    const a = wallDrag.current
    wallDrag.current = null
    const dx = pt.x - a.x
    const dy = pt.y - a.y
    if (Math.hypot(dx, dy) < 4) return
    addWall({ id: uid(), x1: a.x, y1: a.y, x2: pt.x, y2: pt.y })
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

            {roomDraft.length > 0 && (
              <Line
                points={roomDraft.flat()}
                stroke="rgba(255,220,50,0.95)"
                strokeWidth={2 / displayScale}
                closed={false}
                listening={false}
              />
            )}

            {walls.map((w) => (
              <Line
                key={w.id}
                points={[w.x1, w.y1, w.x2, w.y2]}
                stroke="rgba(255,90,90,0.95)"
                strokeWidth={3 / displayScale}
                lineCap="round"
                listening={false}
              />
            ))}

            {derived &&
              doors.map((d) => {
                const cx = d.col * derived.cellSizePx + derived.cellSizePx / 2
                const cy = d.row * derived.cellSizePx + derived.cellSizePx / 2
                return (
                  <Circle
                    key={d.id}
                    x={cx}
                    y={cy}
                    radius={Math.max(4, derived.cellSizePx * 0.25)}
                    fill="rgba(80,200,255,0.85)"
                    stroke="#fff"
                    strokeWidth={1 / displayScale}
                    listening={false}
                  />
                )
              })}

            {circulationRects}
            {heatmapRects}

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
      draggable
      onMouseDown={(e) => {
        e.cancelBubble = true
        onSelect()
      }}
      onDragStart={() => {
        dragStart.current = {
          gx: item.gridX,
          gy: item.gridY,
          off: [...item.freeOffsetPx] as [number, number],
        }
      }}
      onDragEnd={(e) => {
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
