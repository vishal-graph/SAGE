import { useEffect, useMemo, useState } from 'react'
import { useSigeStore } from '../../store/useSigeStore'
import { furnitureCenterXZ, itemStateFromCenter, snapDimensionFt } from './worldFromFurniture'
import { getKenneyModelUrl } from './kenneyModelMap'
import { useKenneyGlbReachable } from './useKenneyGlbProbe'
import { furnitureItemSpanCells } from '../../utils/gridEngine'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'
import { MaterialIcon } from '../ui/MaterialIcon'
import { WallColorPanel } from '../Sidebar/WallColorPanel'
import type { Ceiling, ConnectionPoint, Wall } from '../../types'
import { createDefaultLight } from '../../types'

type LayerItem = {
  id: string
  type: 'wall' | 'door' | 'window' | 'door-top-wall' | 'ceiling' | 'ceiling-drop'
  label: string
  heightFt: number
  thicknessFt: number
}

function segmentDirection(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  return { ux: dx / len, uy: dy / len, len }
}

function isCollinearAndOverlappingWall(
  wall: Wall,
  segA: [number, number],
  segB: [number, number],
  eps = 0.8,
) {
  const { ux, uy, len } = segmentDirection(wall.x1, wall.y1, wall.x2, wall.y2)
  if (len <= 1e-6) return false
  const sdx = segB[0] - segA[0]
  const sdy = segB[1] - segA[1]
  const slen = Math.hypot(sdx, sdy)
  if (slen <= 1e-6) return false
  const sux = sdx / slen
  const suy = sdy / slen
  const crossDir = Math.abs(ux * suy - uy * sux)
  if (crossDir > 0.03) return false
  const distA = Math.abs((segA[0] - wall.x1) * uy - (segA[1] - wall.y1) * ux)
  const distB = Math.abs((segB[0] - wall.x1) * uy - (segB[1] - wall.y1) * ux)
  if (distA > eps || distB > eps) return false
  const proj = (x: number, y: number) => (x - wall.x1) * ux + (y - wall.y1) * uy
  const aProj = proj(segA[0], segA[1])
  const bProj = proj(segB[0], segB[1])
  const minSeg = Math.min(aProj, bProj)
  const maxSeg = Math.max(aProj, bProj)
  return maxSeg >= -eps && minSeg <= len + eps
}

function SnapToggleRow({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 active:scale-[0.98] ${
        checked ? 'bg-primary/10 text-primary' : 'hover:bg-white/50 text-on-surface'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <MaterialIcon name="grid_on" className="text-xl" filled={checked} />
        Snap to grid (2D & 3D drag)
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-gradient-to-r from-primary to-primary-container' : 'bg-surface-container-high'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}

function AngleLockToggleRow({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 active:scale-[0.98] ${
        checked ? 'bg-primary/10 text-primary' : 'hover:bg-white/50 text-on-surface'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <MaterialIcon name="straighten" className="text-xl" filled={checked} />
        Angle lock (45°)
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-gradient-to-r from-primary to-primary-container' : 'bg-surface-container-high'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}

export function Floor3DInspectorPanel() {
  const furniture = useSigeStore((s) => s.furniture)
  const walls = useSigeStore((s) => s.walls)
  const selectedId = useSigeStore((s) => s.selectedFurnitureId)
  const selectedWallIds = useSigeStore((s) => s.selectedWallIds)
  const selectedDoorId = useSigeStore((s) => s.selectedDoorId)
  const selectedWindowId = useSigeStore((s) => s.selectedWindowId)
  const connectionPoints = useSigeStore((s) => s.connectionPoints)
  const gridSizeFt = useSigeStore((s) => s.gridSizeFt)
  const scale = useSigeStore((s) => s.scale)
  const snapToGrid = useSigeStore((s) => s.snapToGrid)
  const setSnapToGrid = useSigeStore((s) => s.setSnapToGrid)
  const angleLockEnabled = useSigeStore((s) => s.angleLockEnabled)
  const setAngleLockEnabled = useSigeStore((s) => s.setAngleLockEnabled)
  const showWalls = useSigeStore((s) => s.showWalls)
  const showDoors = useSigeStore((s) => s.showDoors)
  const showWindows = useSigeStore((s) => s.showWindows)
  const showCeilings = useSigeStore((s) => s.showCeilings)
  const showLights = useSigeStore((s) => s.showLights)
  const renderBrightness = useSigeStore((s) => s.renderBrightness)
  const forceShowCeilings = useSigeStore((s) => s.forceShowCeilings)
  const setStructureVisibility = useSigeStore((s) => s.setStructureVisibility)
  const setForceShowCeilings = useSigeStore((s) => s.setForceShowCeilings)
  const setRenderBrightness = useSigeStore((s) => s.setRenderBrightness)
  const viewPosts = useSigeStore((s) => (s as any).viewPosts as import('../../types').ViewPost[])
  const selectedViewPostId = useSigeStore((s) => (s as any).selectedViewPostId as string | null)
  const setSelectedViewPostId = useSigeStore((s) => (s as any).setSelectedViewPostId as (id: string | null) => void)
  const removeViewPost = useSigeStore((s) => (s as any).removeViewPost as (id: string) => void)
  const postViewActive = useSigeStore((s) => (s as any).postViewActive as boolean)
  const setPostViewActive = useSigeStore((s) => (s as any).setPostViewActive as (v: boolean) => void)
  const wallDefaultThicknessFt = useSigeStore((s) => s.wallDefaultThicknessFt)
  const wallDefaultHeightFt = useSigeStore((s) => s.wallDefaultHeightFt)
  const setWallDefaults = useSigeStore((s) => s.setWallDefaults)
  const updateFurniture = useSigeStore((s) => s.updateFurniture)
  const rotateFurniture = useSigeStore((s) => s.rotateFurniture)
  const removeFurniture = useSigeStore((s) => s.removeFurniture)
  const setSelected = useSigeStore((s) => s.setSelectedFurnitureId)
  const setSelectedWallIds = useSigeStore((s) => s.setSelectedWallIds)
  const setSelectedDoorId = useSigeStore((s) => s.setSelectedDoorId)
  const setSelectedWindowId = useSigeStore((s) => s.setSelectedWindowId)
  const selectedCeilingId = useSigeStore((s) => s.selectedCeilingId)
  const selectedLightId = useSigeStore((s) => s.selectedLightId)
  const setSelectedCeilingId = useSigeStore((s) => s.setSelectedCeilingId)
  const setSelectedLightId = useSigeStore((s) => s.setSelectedLightId)
  const updateWall = useSigeStore((s) => s.updateWall)
  const removeWall = useSigeStore((s) => s.removeWall)
  const doors = useSigeStore((s) => s.doors)
  const updateDoor = useSigeStore((s) => s.updateDoor)
  const removeDoor = useSigeStore((s) => s.removeDoor)
  const windows = useSigeStore((s) => s.windows)
  const updateWindow = useSigeStore((s) => s.updateWindow)
  const removeWindow = useSigeStore((s) => s.removeWindow)
  const ceilings = useSigeStore((s) => s.ceilings)
  const updateCeiling = useSigeStore((s) => s.updateCeiling)
  const removeCeiling = useSigeStore((s) => s.removeCeiling)
  const lights = useSigeStore((s) => s.lights)
  const updateLight = useSigeStore((s) => s.updateLight)
  const removeLight = useSigeStore((s) => s.removeLight)
  const invalidateLuxAnalysis = useSigeStore((s) => s.invalidateLuxAnalysis)
  const luxAnalysis = useSigeStore((s) => s.luxAnalysis)
  const autoPlaceDownlights = useSigeStore((s) => s.autoPlaceDownlights)
  const showLuxHeatmap = useSigeStore((s) => s.showLuxHeatmap)
  const setShowLuxHeatmap = useSigeStore((s) => s.setShowLuxHeatmap)

  const item = useMemo(
    () => (selectedId ? furniture.find((f) => f.id === selectedId) : undefined),
    [furniture, selectedId],
  )

  const pxPerFt = scale?.pxPerFt ?? null

  const [gx, setGx] = useState('0')
  const [gy, setGy] = useState('0')
  const [wStr, setWStr] = useState('0')
  const [dStr, setDStr] = useState('0')
  const [wallThicknessStr, setWallThicknessStr] = useState('0.5')
  const [wallHeightStr, setWallHeightStr] = useState('8')
  const [newWallThicknessStr, setNewWallThicknessStr] = useState('0.5')
  const [newWallHeightStr, setNewWallHeightStr] = useState('8')
  const selectedWalls = useMemo(
    () => walls.filter((w) => selectedWallIds.includes(w.id)),
    [walls, selectedWallIds],
  )
  const hiddenWallsCount = useMemo(() => walls.filter((w) => w.hidden).length, [walls])
  const selectedDoor = useMemo(
    () => (selectedDoorId ? doors.find((d) => d.id === selectedDoorId) : undefined),
    [doors, selectedDoorId],
  )
  const selectedWindow = useMemo(
    () => (selectedWindowId ? windows.find((w) => w.id === selectedWindowId) : undefined),
    [windows, selectedWindowId],
  )
  const selectedCeiling = useMemo(
    () => (selectedCeilingId ? ceilings.find((c) => c.id === selectedCeilingId) : undefined),
    [ceilings, selectedCeilingId],
  )
  const selectedLight = useMemo(
    () => (selectedLightId ? lights.find((l) => l.id === selectedLightId) : undefined),
    [lights, selectedLightId],
  )
  const selectedViewPost = useMemo(
    () => (selectedViewPostId ? viewPosts.find((p) => p.id === selectedViewPostId) : undefined),
    [viewPosts, selectedViewPostId],
  )
  const pointById = useMemo(() => {
    const map = new Map<string, ConnectionPoint>()
    for (const p of connectionPoints) map.set(p.id, p)
    return map
  }, [connectionPoints])

  const wallFromSegment = useMemo(
    () =>
      (aId?: string, bId?: string): Wall | undefined => {
        if (!aId || !bId) return undefined
        const a = pointById.get(aId)
        const b = pointById.get(bId)
        if (!a || !b) return undefined
        return walls.find((w) => isCollinearAndOverlappingWall(w, [a.x, a.y], [b.x, b.y]))
      },
    [pointById, walls],
  )

  const layerStack = useMemo(() => {
    const out: LayerItem[] = []
    if (selectedCeiling) {
      const h = Math.max(0.5, Number(selectedCeiling.heightFt ?? 8))
      const t = Math.max(0.02, Number(selectedCeiling.thicknessFt ?? 0.5))
      out.push({
        id: `ceiling-${selectedCeiling.id}`,
        type: 'ceiling',
        label: `Ceiling (${selectedCeiling.type ?? 'flat'}) @ ${h.toFixed(2)} ft`,
        heightFt: t,
        thicknessFt: t,
      })
      const drop = Math.max(0, Number(selectedCeiling.dropFt ?? 0))
      if ((selectedCeiling.type === 'false' || selectedCeiling.type === 'tray') && drop > 0) {
        out.push({
          id: `ceiling-drop-${selectedCeiling.id}`,
          type: 'ceiling-drop',
          label: `Ceiling step (${selectedCeiling.type})`,
          heightFt: drop,
          thicknessFt: Math.max(0.02, t * 0.6),
        })
      }
      return out
    }
    if (selectedWindow) {
      const w = wallFromSegment(selectedWindow.node_a_id, selectedWindow.node_b_id)
      const wallHeight = Number(w?.heightFt ?? 8)
      const wallThickness = Number(w?.thicknessFt ?? 0.5)
      const sill = Math.max(0, Number(selectedWindow.sillHeightFt ?? 3))
      const winH = Math.max(0.2, Number(selectedWindow.heightFt ?? 4))
      const top = Math.max(0, wallHeight - sill - winH)
      if (sill > 0) {
        out.push({
          id: `window-base-${selectedWindow.id}`,
          type: 'wall',
          label: `Wall below window`,
          heightFt: sill,
          thicknessFt: wallThickness,
        })
      }
      out.push({
        id: `window-${selectedWindow.id}`,
        type: 'window',
        label: `Window`,
        heightFt: winH,
        thicknessFt: Number(selectedWindow.frameDepthFt ?? 0.5),
      })
      if (top > 0) {
        out.push({
          id: `window-top-${selectedWindow.id}`,
          type: 'wall',
          label: `Wall above window`,
          heightFt: top,
          thicknessFt: wallThickness,
        })
      }
      return out
    }
    if (selectedDoor) {
      const w = wallFromSegment(selectedDoor.node_a_id, selectedDoor.node_b_id)
      const wallHeight = Number(w?.heightFt ?? 8)
      const wallThickness = Number(w?.thicknessFt ?? 0.5)
      const doorH = selectedDoor.hasTopLayer ? 7 : Math.min(7, wallHeight)
      out.push({
        id: `door-${selectedDoor.id}`,
        type: 'door',
        label: `Door`,
        heightFt: doorH,
        thicknessFt: 0.5,
      })
      const top = selectedDoor.hasTopLayer ? 1 : Math.max(0, wallHeight - doorH)
      if (top > 0) {
        out.push({
          id: `door-top-${selectedDoor.id}`,
          type: 'door-top-wall',
          label: `Wall above door`,
          heightFt: top,
          thicknessFt: wallThickness,
        })
      }
      return out
    }
    if (selectedWallIds.length > 0) {
      for (const w of walls.filter((x) => selectedWallIds.includes(x.id))) {
        out.push({
          id: `wall-${w.id}`,
          type: 'wall',
          label: `Wall (${w.id})`,
          heightFt: Number(w.heightFt ?? 8),
          thicknessFt: Number(w.thicknessFt ?? 0.5),
        })
      }
    }
    return out
  }, [selectedCeiling, selectedWindow, selectedDoor, selectedWallIds, walls, wallFromSegment])
  const layerTotalHeightFt = useMemo(
    () => layerStack.reduce((sum, item) => sum + Math.max(0, item.heightFt), 0),
    [layerStack],
  )

  const ceilingCentroid = useMemo(() => {
    if (!selectedCeiling || selectedCeiling.polygon.length === 0) return null
    let x = 0
    let y = 0
    for (const [px, py] of selectedCeiling.polygon) {
      x += px
      y += py
    }
    const n = selectedCeiling.polygon.length
    return { x: x / n, y: y / n }
  }, [selectedCeiling])

  useEffect(() => {
    if (!item) return
    setGx(String(item.gridX))
    setGy(String(item.gridY))
    setWStr(String(item.widthFt))
    setDStr(String(item.depthFt))
  }, [item?.id, item?.gridX, item?.gridY, item?.widthFt, item?.depthFt, item?.rotation])

  useEffect(() => {
    if (!selectedWalls.length) return
    const first = selectedWalls[0]
    setWallThicknessStr(String(first.thicknessFt ?? 0.5))
    setWallHeightStr(String(first.heightFt ?? 8))
  }, [selectedWalls])

  useEffect(() => {
    setNewWallThicknessStr(String(wallDefaultThicknessFt))
    setNewWallHeightStr(String(wallDefaultHeightFt))
  }, [wallDefaultThicknessFt, wallDefaultHeightFt])

  const span = item ? furnitureItemSpanCells(item, gridSizeFt) : null
  const glbUrl = item ? getKenneyModelUrl(item.type) : undefined
  const kenneyReachable = useKenneyGlbReachable()

  const commitGrid = () => {
    if (!item) return
    const nx = Math.round(Number(gx))
    const ny = Math.round(Number(gy))
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return
    updateFurniture(item.id, { gridX: nx, gridY: ny, freeOffsetPx: [0, 0] })
  }

  const commitSize = () => {
    if (!item) return
    const w = snapDimensionFt(Number(wStr), gridSizeFt)
    const d = snapDimensionFt(Number(dStr), gridSizeFt)
    if (!Number.isFinite(w) || !Number.isFinite(d)) return
    const { x, z } = furnitureCenterXZ(item, gridSizeFt, pxPerFt)
    const draft = { ...item, widthFt: w, depthFt: d }
    const patch = itemStateFromCenter(draft, x, z, gridSizeFt)
    updateFurniture(item.id, { widthFt: w, depthFt: d, ...patch, freeOffsetPx: [0, 0] })
  }

  const commitWallDims = () => {
    if (!selectedWalls.length) return
    const thicknessFt = Math.max(0.05, Number(wallThicknessStr))
    const heightFt = Math.max(0.5, Number(wallHeightStr))
    if (!Number.isFinite(thicknessFt) || !Number.isFinite(heightFt)) return
    for (const w of selectedWalls) {
      updateWall(w.id, { thicknessFt, heightFt })
    }
  }

  const commitNewWallDefaults = () => {
    const thicknessFt = Math.max(0.05, Number(newWallThicknessStr))
    const heightFt = Math.max(0.5, Number(newWallHeightStr))
    if (!Number.isFinite(thicknessFt) || !Number.isFinite(heightFt)) return
    setWallDefaults({ thicknessFt, heightFt })
  }

  return (
    <div className="space-y-4">
      {kenneyReachable === 'no' && (
        <div className="rounded-xl border border-amber-300/80 bg-amber-50/95 px-3 py-2.5 text-xs leading-snug text-amber-950 shadow-sm">
          <p className="font-semibold text-amber-950">Kenney 3D meshes are not on disk</p>
          <p className="mt-1.5 text-amber-950/90">
            The app only finds <strong>.glb</strong> files inside{' '}
            <code className="rounded bg-white/70 px-1 py-0.5 text-[11px]">public/models/kenney/</code>. Right now
            that folder has no models (you’ll see blue footprint boxes instead). Download the free{' '}
            <a
              className="font-medium text-primary underline underline-offset-2"
              href="https://kenney.nl/assets/furniture-kit"
              target="_blank"
              rel="noreferrer"
            >
              Kenney Furniture Kit
            </a>
            , then copy the files listed in{' '}
            <code className="rounded bg-white/70 px-1 py-0.5 text-[11px]">public/models/kenney/README.md</code> from{' '}
            <code className="rounded bg-white/70 px-1 py-0.5 text-[11px]">Models/GLTF format</code> — use the{' '}
            <strong>exact filenames</strong> expected by <code className="text-[11px]">kenneyModelMap.ts</code>{' '}
            (e.g. <code className="text-[11px]">desk.glb</code>, <code className="text-[11px]">loungeSofa.glb</code>
            ). Restart dev server after copying if needed.
          </p>
        </div>
      )}

      <p className="text-xs leading-relaxed text-on-surface-variant">
        <strong className="text-on-surface">Orbit</strong> by dragging empty floor.{' '}
        <strong className="text-on-surface">Scroll</strong> to zoom.{' '}
        With <strong className="text-on-surface">Place</strong> + a library piece, <strong className="text-on-surface">click</strong>{' '}
        the floor to add. <strong className="text-on-surface">Drag</strong> a piece to move;{' '}
        <strong className="text-on-surface">edge handles</strong> resize (local axes). In 3D, pieces may{' '}
        <strong className="text-on-surface">overlap</strong> each other; moves that hit a wall or go off the plan are{' '}
        <strong className="text-on-surface">reverted</strong>. Size snaps to{' '}
        <strong className="text-on-surface">{gridSizeFt} ft</strong>; position follows the snap toggle below.
      </p>

      <SnapToggleRow checked={snapToGrid} onChange={setSnapToGrid} />
      <AngleLockToggleRow checked={angleLockEnabled} onChange={setAngleLockEnabled} />

      <div className="space-y-2 rounded-xl border border-outline-variant/15 bg-white/40 p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">Visibility</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setStructureVisibility({ showWalls: !showWalls })}
            className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
              showWalls ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {showWalls ? 'Hide walls' : 'Show walls'}
          </button>
          <button
            type="button"
            onClick={() => setStructureVisibility({ showDoors: !showDoors })}
            className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
              showDoors ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {showDoors ? 'Hide doors' : 'Show doors'}
          </button>
          <button
            type="button"
            onClick={() => setStructureVisibility({ showWindows: !showWindows })}
            className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
              showWindows ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {showWindows ? 'Hide windows' : 'Show windows'}
          </button>
          <button
            type="button"
            onClick={() => setStructureVisibility({ showCeilings: !showCeilings })}
            className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
              showCeilings ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {showCeilings ? 'Hide ceilings' : 'Show ceilings'}
          </button>
          <button
            type="button"
            onClick={() => setStructureVisibility({ showLights: !showLights })}
            className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
              showLights ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {showLights ? 'Hide lights' : 'Show lights'}
          </button>
          <button
            type="button"
            onClick={() => setForceShowCeilings(!forceShowCeilings)}
            className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
              forceShowCeilings ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {forceShowCeilings ? 'Ceiling forced' : 'Auto-hide ceiling'}
          </button>
          <button
            type="button"
            onClick={() => setRenderBrightness(renderBrightness === 'dark' ? 'normal' : 'dark')}
            className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
              renderBrightness === 'dark' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {renderBrightness === 'dark' ? '3D: Dark' : '3D: Normal'}
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-outline-variant/15 bg-white/40 p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">New wall defaults</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
              Thickness (ft)
            </label>
            <input
              type="number"
              min={0.05}
              step={0.01}
              value={newWallThicknessStr}
              onChange={(e) => setNewWallThicknessStr(e.target.value)}
              onBlur={commitNewWallDefaults}
              onKeyDown={(e) => e.key === 'Enter' && commitNewWallDefaults()}
              className="glass-input w-full !py-2 !text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
              Height (ft)
            </label>
            <input
              type="number"
              min={0.5}
              step={0.1}
              value={newWallHeightStr}
              onChange={(e) => setNewWallHeightStr(e.target.value)}
              onBlur={commitNewWallDefaults}
              onKeyDown={(e) => e.key === 'Enter' && commitNewWallDefaults()}
              className="glass-input w-full !py-2 !text-sm"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-outline-variant/15 bg-white/40 p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">Layer stack</p>
        {layerStack.length === 0 ? (
          <p className="text-xs text-on-surface-variant">
            Select a wall/door/window to inspect stacked layers in that area.
          </p>
        ) : (
          <div className="space-y-1.5">
            {layerStack.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-outline-variant/20 bg-surface-container-low/40 px-2.5 py-2 text-xs"
              >
                <span className="font-medium text-on-surface">
                  {item.label}
                  <span className="ml-1 text-on-surface-variant">
                    (H {item.heightFt.toFixed(2)} ft, T {item.thicknessFt.toFixed(2)} ft)
                  </span>
                </span>
                <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-on-surface-variant">
                  L{index + 1}
                </span>
              </div>
            ))}
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs font-semibold text-primary">
              Total stacked height: {layerTotalHeightFt.toFixed(2)} ft
            </div>
          </div>
        )}
      </div>

      {!item ? (
        selectedViewPost ? (
          <div className="space-y-3 rounded-xl border border-outline-variant/15 bg-white/40 p-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">Selected view post</p>
              <p className="mt-0.5 text-sm font-semibold text-on-surface">{selectedViewPost.id}</p>
              <p className="text-[11px] text-on-surface-variant">
                Height: {Number(selectedViewPost.heightFt ?? 4).toFixed(1)} ft
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {postViewActive ? (
                <PrimaryButton type="button" className="!rounded-xl !py-2 !text-xs" onClick={() => setPostViewActive(false)}>
                  Exit post view
                </PrimaryButton>
              ) : (
                <SecondaryButton type="button" className="!rounded-xl !py-2 !text-xs" onClick={() => setPostViewActive(true)}>
                  Enter post view
                </SecondaryButton>
              )}
              <SecondaryButton
                type="button"
                className="!rounded-xl !py-2 !text-xs"
                onClick={() => {
                  removeViewPost(selectedViewPost.id)
                  setSelectedViewPostId(null)
                  setPostViewActive(false)
                }}
              >
                Delete post
              </SecondaryButton>
            </div>

            <SecondaryButton type="button" className="!rounded-xl !py-2 !text-xs" onClick={() => setSelectedViewPostId(null)}>
              Clear post selection
            </SecondaryButton>
          </div>
        ) : selectedLight ? (
          <div className="space-y-3 rounded-xl border border-outline-variant/15 bg-white/40 p-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">Selected light</p>
              <p className="mt-0.5 text-sm font-semibold text-on-surface">{selectedLight.id}</p>
              <p className="text-[11px] text-on-surface-variant">Room: {selectedLight.roomId}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {selectedLight.isOn ? (
                <PrimaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => {
                    updateLight(selectedLight.id, { isOn: true })
                    invalidateLuxAnalysis()
                  }}
                >
                  On
                </PrimaryButton>
              ) : (
                <SecondaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => {
                    updateLight(selectedLight.id, { isOn: true })
                    invalidateLuxAnalysis()
                  }}
                >
                  On
                </SecondaryButton>
              )}
              {selectedLight.isOn ? (
                <SecondaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => {
                    updateLight(selectedLight.id, { isOn: false })
                    invalidateLuxAnalysis()
                  }}
                >
                  Off
                </SecondaryButton>
              ) : (
                <PrimaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => {
                    updateLight(selectedLight.id, { isOn: false })
                    invalidateLuxAnalysis()
                  }}
                >
                  Off
                </PrimaryButton>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Fixture
                </label>
                <select
                  value={selectedLight.fixtureType}
                  onChange={(e) => {
                    updateLight(selectedLight.id, { fixtureType: e.target.value as any })
                    invalidateLuxAnalysis()
                  }}
                  className="glass-input w-full !py-2 !text-sm"
                >
                  <option value="downlight">Downlight</option>
                  <option value="panel">Panel (square)</option>
                  <option value="pendant">Pendant</option>
                  <option value="track">Track</option>
                  <option value="cove">Cove</option>
                  <option value="sconce">Sconce</option>
                  <option value="floor-lamp">Floor lamp</option>
                  <option value="chandelier">Chandelier</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Layer
                </label>
                <select
                  value={selectedLight.layer}
                  onChange={(e) => {
                    updateLight(selectedLight.id, { layer: e.target.value as any })
                    invalidateLuxAnalysis()
                  }}
                  className="glass-input w-full !py-2 !text-sm"
                >
                  <option value="ambient">Ambient</option>
                  <option value="task">Task</option>
                  <option value="accent">Accent</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                Color temp (K)
              </label>
              <input
                type="range"
                min={2700}
                max={6500}
                step={50}
                value={Number(selectedLight.colorTempK)}
                onChange={(e) => {
                  updateLight(selectedLight.id, { colorTempK: Number(e.target.value) })
                  invalidateLuxAnalysis()
                }}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Lumens
                </label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={Number(selectedLight.lumens)}
                  onChange={(e) => {
                    updateLight(selectedLight.id, { lumens: Number(e.target.value) })
                    invalidateLuxAnalysis()
                  }}
                  className="glass-input w-full !py-2 !text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Dim (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Number(selectedLight.dimLevel)}
                  onChange={(e) => {
                    updateLight(selectedLight.id, { dimLevel: Number(e.target.value) })
                    invalidateLuxAnalysis()
                  }}
                  className="glass-input w-full !py-2 !text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Beam (deg)
                </label>
                <input
                  type="number"
                  min={1}
                  max={179}
                  step={1}
                  value={Number(selectedLight.beamAngleDeg)}
                  onChange={(e) => {
                    updateLight(selectedLight.id, { beamAngleDeg: Number(e.target.value) })
                    invalidateLuxAnalysis()
                  }}
                  className="glass-input w-full !py-2 !text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Mount height (ft)
                </label>
                <input
                  type="number"
                  min={0.5}
                  step={0.1}
                  value={Number(selectedLight.mountHeightFt)}
                  onChange={(e) => {
                    updateLight(selectedLight.id, { mountHeightFt: Number(e.target.value) })
                    invalidateLuxAnalysis()
                  }}
                  className="glass-input w-full !py-2 !text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  CRI
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Number(selectedLight.cri)}
                  onChange={(e) => updateLight(selectedLight.id, { cri: Number(e.target.value) })}
                  className="glass-input w-full !py-2 !text-sm"
                />
                {Number(selectedLight.cri) < 80 && (
                  <p className="mt-1 text-[11px] text-amber-700">Low CRI may look unnatural.</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Circuit
                </label>
                <input
                  type="text"
                  value={selectedLight.circuitId}
                  onChange={(e) => updateLight(selectedLight.id, { circuitId: e.target.value })}
                  className="glass-input w-full !py-2 !text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {selectedLight.hidden ? (
                <SecondaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateLight(selectedLight.id, { hidden: false })}
                >
                  Show
                </SecondaryButton>
              ) : (
                <PrimaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateLight(selectedLight.id, { hidden: true })}
                >
                  Hide
                </PrimaryButton>
              )}
              <SecondaryButton
                type="button"
                className="!rounded-xl !py-2 !text-xs"
                onClick={() => autoPlaceDownlights(selectedLight.roomId)}
              >
                Auto-place downlights
              </SecondaryButton>
            </div>

            {showLuxHeatmap ? (
              <PrimaryButton
                type="button"
                className="!rounded-xl !py-2 !text-xs"
                onClick={() => setShowLuxHeatmap(false)}
              >
                Lux heatmap: On
              </PrimaryButton>
            ) : (
              <SecondaryButton
                type="button"
                className="!rounded-xl !py-2 !text-xs"
                onClick={() => setShowLuxHeatmap(true)}
              >
                Lux heatmap: Off
              </SecondaryButton>
            )}

            <div className="grid grid-cols-2 gap-2">
              <SecondaryButton
                type="button"
                className="!rounded-xl !py-2 !text-xs"
                onClick={() => {
                  const grid = luxAnalysis[selectedLight.roomId]
                  if (!grid || grid.cells.length === 0 || !pxPerFt) return
                  const avgFx = grid.cells.reduce((s, c) => s + c.fx, 0) / grid.cells.length
                  const avgFy = grid.cells.reduce((s, c) => s + c.fy, 0) / grid.cells.length
                  updateLight(selectedLight.id, { x: avgFx * pxPerFt, y: avgFy * pxPerFt })
                  invalidateLuxAnalysis()
                }}
              >
                Move to center
              </SecondaryButton>
              <SecondaryButton
                type="button"
                className="!rounded-xl !py-2 !text-xs"
                onClick={() => {
                  removeLight(selectedLight.id)
                  setSelectedLightId(null)
                  invalidateLuxAnalysis()
                }}
              >
                Delete light
              </SecondaryButton>
            </div>

            <SecondaryButton type="button" className="!rounded-xl !py-2 !text-xs" onClick={() => setSelectedLightId(null)}>
              Clear light selection
            </SecondaryButton>
          </div>
        ) : selectedCeiling ? (
          <div className="space-y-3 rounded-xl border border-outline-variant/15 bg-white/40 p-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">Selected ceiling</p>
              <p className="mt-0.5 text-sm font-semibold text-on-surface">{selectedCeiling.id}</p>
              {selectedCeiling.roomId && (
                <p className="text-[11px] text-on-surface-variant">Room-linked: {selectedCeiling.roomId}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(['flat', 'false', 'tray', 'coffered', 'open'] as Ceiling['type'][]).map((t) => {
                const active = (selectedCeiling.type ?? 'flat') === t
                const Btn = active ? PrimaryButton : SecondaryButton
                return (
                  <Btn
                    key={t}
                    type="button"
                    className="!rounded-xl !py-2 !text-xs"
                    onClick={() => updateCeiling(selectedCeiling.id, { type: t })}
                  >
                    {t}
                  </Btn>
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Height (ft)
                </label>
                <input
                  type="number"
                  min={0.5}
                  step={0.1}
                  value={Number(selectedCeiling.heightFt ?? 8)}
                  onChange={(e) => updateCeiling(selectedCeiling.id, { heightFt: Number(e.target.value) })}
                  className="glass-input w-full !py-2 !text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Thickness (ft)
                </label>
                <input
                  type="number"
                  min={0.02}
                  step={0.02}
                  value={Number(selectedCeiling.thicknessFt ?? 0.5)}
                  onChange={(e) => updateCeiling(selectedCeiling.id, { thicknessFt: Number(e.target.value) })}
                  className="glass-input w-full !py-2 !text-sm"
                />
              </div>
            </div>

            {(selectedCeiling.type === 'false' || selectedCeiling.type === 'tray') && (
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Drop (ft)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={Number(selectedCeiling.dropFt ?? 0)}
                  onChange={(e) => updateCeiling(selectedCeiling.id, { dropFt: Number(e.target.value) })}
                  className="glass-input w-full !py-2 !text-sm"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Color
                </label>
                <input
                  type="color"
                  value={String(selectedCeiling.color ?? '#93c5fd')}
                  onChange={(e) => updateCeiling(selectedCeiling.id, { color: e.target.value })}
                  className="h-10 w-full rounded-xl border border-outline-variant/30 bg-white/60 p-1"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Hidden
                </label>
                <button
                  type="button"
                  onClick={() => updateCeiling(selectedCeiling.id, { hidden: !selectedCeiling.hidden })}
                  className={`h-10 w-full rounded-xl px-3 text-xs font-semibold transition ${
                    selectedCeiling.hidden ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary text-on-primary'
                  }`}
                >
                  {selectedCeiling.hidden ? 'Hidden' : 'Visible'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <SecondaryButton
                type="button"
                className="!rounded-xl !py-2 !text-xs"
                onClick={() => {
                  if (!ceilingCentroid) return
                  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
                  const roomId = selectedCeiling.roomId ?? 'unassigned'
                  const light = createDefaultLight({ id, x: ceilingCentroid.x, y: ceilingCentroid.y, roomId })
                  useSigeStore.getState().addLight(light)
                  invalidateLuxAnalysis()
                  setSelectedLightId(light.id)
                  setSelectedCeilingId(null)
                }}
              >
                Add light
              </SecondaryButton>
              <SecondaryButton
                type="button"
                className="!rounded-xl !py-2 !text-xs"
                onClick={() => {
                  removeCeiling(selectedCeiling.id)
                  setSelectedCeilingId(null)
                }}
              >
                Delete ceiling
              </SecondaryButton>
              <SecondaryButton type="button" className="!rounded-xl !py-2 !text-xs" onClick={() => setSelectedCeilingId(null)}>
                Clear
              </SecondaryButton>
            </div>
          </div>
        ) : selectedWindow ? (
          <div className="space-y-3 rounded-xl border border-outline-variant/15 bg-white/40 p-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">Selected window</p>
              <p className="mt-0.5 text-sm font-semibold text-on-surface">{selectedWindow.id}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Sill (ft)
                </label>
                <input
                  type="number"
                  min={0.2}
                  step={0.1}
                  value={selectedWindow.sillHeightFt ?? 3}
                  onChange={(e) => updateWindow(selectedWindow.id, { sillHeightFt: Number(e.target.value) })}
                  className="glass-input w-full !py-2 !text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Height (ft)
                </label>
                <input
                  type="number"
                  min={0.5}
                  step={0.1}
                  value={selectedWindow.heightFt ?? 4}
                  onChange={(e) => updateWindow(selectedWindow.id, { heightFt: Number(e.target.value) })}
                  className="glass-input w-full !py-2 !text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(selectedWindow.material ?? 'clear') === 'clear' ? (
                <PrimaryButton type="button" className="!rounded-xl !py-2 !text-xs" onClick={() => updateWindow(selectedWindow.id, { material: 'clear' })}>
                  Clear
                </PrimaryButton>
              ) : (
                <SecondaryButton type="button" className="!rounded-xl !py-2 !text-xs" onClick={() => updateWindow(selectedWindow.id, { material: 'clear' })}>
                  Clear
                </SecondaryButton>
              )}
              {(selectedWindow.material ?? 'clear') === 'frosted' ? (
                <PrimaryButton type="button" className="!rounded-xl !py-2 !text-xs" onClick={() => updateWindow(selectedWindow.id, { material: 'frosted' })}>
                  Frosted
                </PrimaryButton>
              ) : (
                <SecondaryButton type="button" className="!rounded-xl !py-2 !text-xs" onClick={() => updateWindow(selectedWindow.id, { material: 'frosted' })}>
                  Frosted
                </SecondaryButton>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SecondaryButton type="button" className="!rounded-xl !py-2 !text-xs" onClick={() => updateWindow(selectedWindow.id, { material: 'tinted' })}>
                Tinted
              </SecondaryButton>
              <SecondaryButton
                type="button"
                className="!rounded-xl !py-2 !text-xs"
                onClick={() => {
                  removeWindow(selectedWindow.id)
                  setSelectedWindowId(null)
                }}
              >
                Delete window
              </SecondaryButton>
            </div>
            <SecondaryButton type="button" className="!rounded-xl !py-2 !text-xs" onClick={() => setSelectedWindowId(null)}>
              Clear window selection
            </SecondaryButton>
          </div>
        ) : selectedDoor ? (
          <div className="space-y-3 rounded-xl border border-outline-variant/15 bg-white/40 p-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">Selected door</p>
              <p className="mt-0.5 text-sm font-semibold text-on-surface">{selectedDoor.id}</p>
              <p className="text-[11px] text-on-surface-variant">
                Swing: {selectedDoor.swingMode ?? 'push'} · State: {(selectedDoor.isOpen ?? true) ? 'open' : 'shut'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(selectedDoor.isOpen ?? true) ? (
                <SecondaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateDoor(selectedDoor.id, { isOpen: false })}
                >
                  Shut
                </SecondaryButton>
              ) : (
                <PrimaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateDoor(selectedDoor.id, { isOpen: false })}
                >
                  Shut
                </PrimaryButton>
              )}
              {(selectedDoor.isOpen ?? true) ? (
                <PrimaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateDoor(selectedDoor.id, { isOpen: true })}
                >
                  Open
                </PrimaryButton>
              ) : (
                <SecondaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateDoor(selectedDoor.id, { isOpen: true })}
                >
                  Open
                </SecondaryButton>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(selectedDoor.material ?? 'wood') === 'wood' ? (
                <PrimaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateDoor(selectedDoor.id, { material: 'wood' })}
                >
                  Wood
                </PrimaryButton>
              ) : (
                <SecondaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateDoor(selectedDoor.id, { material: 'wood' })}
                >
                  Wood
                </SecondaryButton>
              )}
              {(selectedDoor.material ?? 'wood') === 'glass' ? (
                <PrimaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateDoor(selectedDoor.id, { material: 'glass' })}
                >
                  Glass
                </PrimaryButton>
              ) : (
                <SecondaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateDoor(selectedDoor.id, { material: 'glass' })}
                >
                  Glass
                </SecondaryButton>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(selectedDoor.swingMode ?? 'push') === 'push' ? (
                <PrimaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateDoor(selectedDoor.id, { swingMode: 'push' })}
                >
                  Push first
                </PrimaryButton>
              ) : (
                <SecondaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateDoor(selectedDoor.id, { swingMode: 'push' })}
                >
                  Push first
                </SecondaryButton>
              )}
              {(selectedDoor.swingMode ?? 'push') === 'pull' ? (
                <PrimaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateDoor(selectedDoor.id, { swingMode: 'pull' })}
                >
                  Pull first
                </PrimaryButton>
              ) : (
                <SecondaryButton
                  type="button"
                  className="!rounded-xl !py-2 !text-xs"
                  onClick={() => updateDoor(selectedDoor.id, { swingMode: 'pull' })}
                >
                  Pull first
                </SecondaryButton>
              )}
            </div>
            <SecondaryButton
              type="button"
              className="!rounded-xl !py-2 !text-xs"
              onClick={() => {
                removeDoor(selectedDoor.id)
                setSelectedDoorId(null)
              }}
            >
              Delete door
            </SecondaryButton>
            <SecondaryButton
              type="button"
              className="!rounded-xl !py-2 !text-xs"
              onClick={() => setSelectedDoorId(null)}
            >
              Clear door selection
            </SecondaryButton>
          </div>
        ) : !selectedWalls.length ? (
          <p className="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 px-3 py-2.5 text-xs text-on-surface-variant">
            No selection — click a furniture block, wall, door, or window in the 3D view. Use Ctrl+click to select multiple walls.
          </p>
        ) : (
          <div className="space-y-3 rounded-xl border border-outline-variant/15 bg-white/40 p-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">Selected wall(s)</p>
              <p className="mt-0.5 text-sm font-semibold text-on-surface">
                {selectedWalls.length} wall{selectedWalls.length === 1 ? '' : 's'} selected
              </p>
              {selectedWalls.length === 1 && (
                <p className="text-[11px] text-on-surface-variant">{selectedWalls[0]?.id}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Thickness (ft)
                </label>
                <input
                  type="number"
                  min={0.05}
                  step={0.01}
                  value={wallThicknessStr}
                  onChange={(e) => setWallThicknessStr(e.target.value)}
                  onBlur={commitWallDims}
                  onKeyDown={(e) => e.key === 'Enter' && commitWallDims()}
                  className="glass-input w-full !py-2 !text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                  Height (ft)
                </label>
                <input
                  type="number"
                  min={0.5}
                  step={0.1}
                  value={wallHeightStr}
                  onChange={(e) => setWallHeightStr(e.target.value)}
                  onBlur={commitWallDims}
                  onKeyDown={(e) => e.key === 'Enter' && commitWallDims()}
                  className="glass-input w-full !py-2 !text-sm"
                />
              </div>
            </div>
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 px-2 py-2">
              <WallColorPanel clearSelectionOnApply className="" />
            </div>
            <SecondaryButton
              type="button"
              className="!rounded-xl !py-2 !text-xs"
              onClick={() => {
                for (const wallId of selectedWallIds) updateWall(wallId, { hidden: true })
                setSelectedWallIds([])
              }}
            >
              Hide selected wall(s)
            </SecondaryButton>
            <SecondaryButton
              type="button"
              className="!rounded-xl !py-2 !text-xs"
              onClick={() => {
                for (const wallId of selectedWallIds) removeWall(wallId)
                setSelectedWallIds([])
              }}
            >
              Delete selected wall(s)
            </SecondaryButton>
            {hiddenWallsCount > 0 && (
              <SecondaryButton
                type="button"
                className="!rounded-xl !py-2 !text-xs"
                onClick={() => {
                  for (const w of walls) {
                    if (w.hidden) updateWall(w.id, { hidden: false })
                  }
                }}
              >
                Unhide all walls ({hiddenWallsCount})
              </SecondaryButton>
            )}
            <SecondaryButton
              type="button"
              className="!rounded-xl !py-2 !text-xs"
              onClick={() => setSelectedWallIds([])}
            >
              Clear wall selection
            </SecondaryButton>
          </div>
        )
      ) : (
        <div className="space-y-3 rounded-xl border border-outline-variant/15 bg-white/40 p-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface/40">Selected</p>
            <p className="mt-0.5 text-sm font-semibold text-on-surface">{item.label}</p>
            <p className="text-[11px] text-on-surface-variant">
              {item.type}
              {span && (
                <>
                  {' '}
                  · {span.wCells}×{span.hCells} cells ({span.wFt.toFixed(2)}×{span.hFt.toFixed(2)} ft)
                </>
              )}
            </p>
            <p className="mt-1 text-[11px] text-on-surface-variant/90">
              Mesh: {glbUrl ? <span className="text-emerald-700">Kenney GLB</span> : <span>Footprint box</span>}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                Grid X
              </label>
              <input
                type="number"
                step={1}
                value={gx}
                onChange={(e) => setGx(e.target.value)}
                onBlur={commitGrid}
                onKeyDown={(e) => e.key === 'Enter' && commitGrid()}
                className="glass-input w-full !py-2 !text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                Grid Y
              </label>
              <input
                type="number"
                step={1}
                value={gy}
                onChange={(e) => setGy(e.target.value)}
                onBlur={commitGrid}
                onKeyDown={(e) => e.key === 'Enter' && commitGrid()}
                className="glass-input w-full !py-2 !text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                Width (ft)
              </label>
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={wStr}
                onChange={(e) => setWStr(e.target.value)}
                onBlur={commitSize}
                onKeyDown={(e) => e.key === 'Enter' && commitSize()}
                className="glass-input w-full !py-2 !text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
                Depth (ft)
              </label>
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={dStr}
                onChange={(e) => setDStr(e.target.value)}
                onBlur={commitSize}
                onKeyDown={(e) => e.key === 'Enter' && commitSize()}
                className="glass-input w-full !py-2 !text-sm"
              />
            </div>
          </div>

          <p className="text-[11px] text-on-surface-variant">
            Rotation: <strong className="text-on-surface">{item.rotation}°</strong> — handles stay on local width / depth
            axes.
          </p>
          <p className="text-[11px] text-on-surface-variant">
            Status:{' '}
            <strong className={item.locked ? 'text-amber-700' : 'text-emerald-700'}>
              {item.locked ? 'Locked' : 'Unlocked'}
            </strong>
          </p>

          <div className="flex flex-col gap-2 pt-1">
            <SecondaryButton
              type="button"
              className="!rounded-xl !py-2 !text-xs"
              onClick={() => updateFurniture(item.id, { locked: !item.locked })}
            >
              {item.locked ? 'Unlock component' : 'Lock component'}
            </SecondaryButton>
            <PrimaryButton
              type="button"
              className="!rounded-xl !py-2 !text-xs"
              onClick={() => rotateFurniture(item.id)}
              disabled={Boolean(item.locked)}
            >
              Rotate 90°
            </PrimaryButton>
            <SecondaryButton
              type="button"
              className="!rounded-xl !py-2 !text-xs"
              disabled={Boolean(item.locked)}
              onClick={() => {
                removeFurniture(item.id)
                setSelected(null)
              }}
            >
              Remove from plan
            </SecondaryButton>
          </div>
        </div>
      )}
    </div>
  )
}
