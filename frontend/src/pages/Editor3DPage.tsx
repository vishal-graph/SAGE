import { Suspense, useRef, useMemo, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  useGLTF,
  GizmoHelper,
  GizmoViewport,
  Grid,
} from '@react-three/drei'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'
import { useSigeStore } from '../store/useSigeStore'
import { useDerivedGrid } from '../hooks/useDerivedGrid'
import { Floor3DOrbitContext } from '../components/Floor3D/Floor3DOrbitContext'
import { FloorPlanOverlay3D } from '../components/Floor3D/FloorPlanOverlay3D'
import { Furniture3D } from '../components/Floor3D/Furniture3D'
import { Floor3DInteractionPlane } from '../components/Floor3D/Floor3DInteractionPlane'
import { FloorPlanGrids3D } from '../components/Floor3D/FloorPlanGrids3D'
import { Floor3DInspectorPanel } from '../components/Floor3D/Floor3DInspectorPanel'
import { FurnitureLibrary } from '../components/Sidebar/FurnitureLibrary'
import { furniturePlanScaleFactorFromStoreInputs, libraryKenneyPreloadUrls } from '../utils/furnitureLib'
import type { ConnectionPoint, Window } from '../types'
import type { GridInputs } from '../utils/gridEngine'

// ─── helpers ───────────────────────────────────────────────────────────────────

function clsx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

// ─── 3D Scene (inside Canvas) ─────────────────────────────────────────────────

type OrbitApi = { object: THREE.Camera; target: THREE.Vector3 }

function SceneContent({
  widthFt,
  depthFt,
  gridSizeFt,
  pxPerFt,
  cellSizePx,
  imageUrl,
  imageNaturalWidth,
  imageNaturalHeight,
  showFloorPlanImage,
  showEnvGrid,
  shadows,
  orbitRef,
}: {
  widthFt: number
  depthFt: number
  gridSizeFt: number
  pxPerFt: number | null
  cellSizePx: number
  imageUrl: string | null
  imageNaturalWidth: number
  imageNaturalHeight: number
  showFloorPlanImage: boolean
  showEnvGrid: boolean
  shadows: boolean
  orbitRef: React.RefObject<OrbitApi | null>
}) {
  const [orbitEnabled, setOrbitEnabled] = useState(true)
  const furniture = useSigeStore((s) => s.furniture)
  const selectedId = useSigeStore((s) => s.selectedFurnitureId)
  const walls = useSigeStore((s) => s.walls)
  const rooms = useSigeStore((s) => s.rooms)
  const doors = useSigeStore((s) => s.doors)
  const windows = useSigeStore((s) => s.windows)
  const ceilings = useSigeStore((s) => s.ceilings)
  const lights = useSigeStore((s) => s.lights)
  const connectionPoints = useSigeStore((s) => s.connectionPoints)

  const gridInputs = useMemo((): GridInputs | null => {
    if (!pxPerFt || cellSizePx <= 0 || imageNaturalWidth <= 0 || imageNaturalHeight <= 0) return null
    return {
      imageWidthPx: imageNaturalWidth,
      imageHeightPx: imageNaturalHeight,
      pxPerFt,
      gridSizeFt,
      rooms,
      walls,
      furniture,
    }
  }, [pxPerFt, cellSizePx, imageNaturalWidth, imageNaturalHeight, gridSizeFt, rooms, walls, furniture])

  const cx = widthFt / 2
  const cz = depthFt / 2

  const orbitTarget = useMemo(() => {
    if (pxPerFt != null && imageNaturalWidth > 0 && imageNaturalHeight > 0) {
      return { x: imageNaturalWidth / pxPerFt / 2, z: imageNaturalHeight / pxPerFt / 2 }
    }
    return { x: cx, z: cz }
  }, [pxPerFt, imageNaturalWidth, imageNaturalHeight, cx, cz])

  const furniturePlanScaleFactor = useMemo(() => {
    if (!pxPerFt || imageNaturalWidth <= 0 || imageNaturalHeight <= 0) return undefined as number | undefined
    return furniturePlanScaleFactorFromStoreInputs(pxPerFt, imageNaturalWidth, imageNaturalHeight, rooms)
  }, [pxPerFt, imageNaturalWidth, imageNaturalHeight, rooms])

  const camDistance = useMemo(() => Math.max(14, Math.max(widthFt, depthFt) * 1.15), [widthFt, depthFt])
  const gridSpan = Math.max(widthFt, depthFt) * 3

  // Preload kenney models
  useEffect(() => {
    for (const url of libraryKenneyPreloadUrls()) useGLTF.preload(url)
  }, [])

  return (
    <Floor3DOrbitContext.Provider value={setOrbitEnabled}>
      {/* ── Lights: stable, no-flicker studio rig ── */}
      <ambientLight intensity={1.4} color="#f0f4ff" />
      <hemisphereLight intensity={0.8} groundColor="#6b7280" color="#e0eaff" />
      {/* Key light — sole shadow caster; others never castShadow */}
      <directionalLight
        color="#ffffff"
        position={[widthFt * 0.6, Math.max(widthFt, depthFt) * 1.4, depthFt * 0.5]}
        intensity={2.0}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={300}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.001}
      />
      {/* Fill lights — no castShadow, no Z-fighting */}
      <directionalLight color="#cce0ff" position={[-widthFt * 0.5, camDistance * 0.6, -depthFt * 0.4]} intensity={0.9} />
      <directionalLight color="#ffffff" position={[orbitTarget.x, 6, -camDistance]} intensity={0.5} />

      <OrbitControls
        ref={orbitRef as React.RefObject<any>}
        makeDefault
        enableDamping
        dampingFactor={0.06}
        enabled={orbitEnabled}
        target={[orbitTarget.x, 0, orbitTarget.z]}
        maxPolarAngle={Math.PI / 2 - 0.04}
        minDistance={3}
        maxDistance={camDistance * 4}
      />

      {/* Infinite dark grid */}
      {showEnvGrid && (
        <Grid
          position={[orbitTarget.x, -0.01, orbitTarget.z]}
          args={[gridSpan, gridSpan]}
          cellSize={gridSizeFt}
          cellThickness={0.4}
          cellColor="#2d3a52"
          sectionSize={gridSizeFt * 5}
          sectionThickness={0.7}
          sectionColor="#3d4f70"
          fadeDistance={camDistance * 3}
          fadeStrength={1.5}
          followCamera={false}
          infiniteGrid
        />
      )}


      {/* Plan geometry */}
      <Floor3DInteractionPlane
        widthFt={widthFt}
        depthFt={depthFt}
        cx={cx}
        cz={cz}
        pxPerFt={pxPerFt}
        cellSizePx={cellSizePx}
        gridInputs={gridInputs}
        planScaleFactor={furniturePlanScaleFactor}
        readOnly={false}
      />

      <FloorPlanGrids3D
        walls={walls}
        rooms={rooms}
        gridSizeFt={gridSizeFt}
        pxPerFt={pxPerFt}
        imageNaturalWidth={imageNaturalWidth}
        imageNaturalHeight={imageNaturalHeight}
        fallbackWidthFt={widthFt}
        fallbackDepthFt={depthFt}
      />

      {pxPerFt != null && imageNaturalWidth > 0 && imageNaturalHeight > 0 && cellSizePx > 0 && (
        <FloorPlanOverlay3D
          imageUrl={imageUrl}
          showFloorPlanImage={showFloorPlanImage}
          imageWidthPx={imageNaturalWidth}
          imageHeightPx={imageNaturalHeight}
          pxPerFt={pxPerFt}
          cellSizePx={cellSizePx}
          walls={walls}
          rooms={rooms}
          doors={doors}
          windows={windows as Window[]}
          ceilings={ceilings}
          lights={lights}
          connectionPoints={connectionPoints as ConnectionPoint[]}
        />
      )}

      {furniture.map((f) => (
        <Furniture3D
          key={f.id}
          item={f}
          selected={f.id === selectedId}
          gridSizeFt={gridSizeFt}
          pxPerFt={pxPerFt}
          readOnly={false}
        />
      ))}

      {/* XYZ orbit gizmo */}
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#ff4466', '#44dd88', '#4488ff']} labelColor="white" />
      </GizmoHelper>
    </Floor3DOrbitContext.Provider>
  )
}

// ─── Camera view presets (pure DOM) ──────────────────────────────────────────

type CameraPreset = 'perspective' | 'top' | 'front' | 'right'

const PRESET_META: { id: CameraPreset; label: string; icon: string }[] = [
  { id: 'perspective', label: 'Persp', icon: 'view_in_ar' },
  { id: 'top', label: 'Top', icon: 'vertical_align_top' },
  { id: 'front', label: 'Front', icon: 'crop_5_4' },
  { id: 'right', label: 'Side', icon: 'switch_right' },
]

function CameraViewPanel({
  orbitRef,
  cx,
  cz,
  camDist,
}: {
  orbitRef: React.RefObject<OrbitApi | null>
  cx: number
  cz: number
  camDist: number
}) {
  const go = (preset: CameraPreset) => {
    const ctrl = orbitRef.current as any
    if (!ctrl) return
    const cam = ctrl.object as THREE.Camera | undefined
    if (!cam) return
    const target: THREE.Vector3 = ctrl.target ?? new THREE.Vector3(cx, 0, cz)

    const positions: Record<CameraPreset, [number, number, number]> = {
      perspective: [target.x + camDist * 0.7, camDist * 0.55, target.z + camDist * 0.8],
      top: [target.x, camDist * 2.2, target.z + 0.001],
      front: [target.x, camDist * 0.35, target.z + camDist * 1.4],
      right: [target.x + camDist * 1.4, camDist * 0.35, target.z],
    }
    const [px, py, pz] = positions[preset]
    cam.position.set(px, py, pz)
    if ('lookAt' in cam) (cam as THREE.PerspectiveCamera).lookAt(target)
    ctrl.update?.()
  }

  return (
    <div className="ed-glass flex flex-col gap-0.5 rounded-xl p-1.5">
      {PRESET_META.map((p) => (
        <button
          key={p.id}
          type="button"
          title={p.label}
          onClick={() => go(p.id)}
          className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-95"
        >
          <span className="material-symbols-outlined text-base leading-none">{p.icon}</span>
          {p.label}
        </button>
      ))}
    </div>
  )
}

// ─── Scene Outliner ───────────────────────────────────────────────────────────

function SceneOutliner({ onClose }: { onClose: () => void }) {
  const furniture = useSigeStore((s) => s.furniture)
  const walls = useSigeStore((s) => s.walls)
  const rooms = useSigeStore((s) => s.rooms)
  const doors = useSigeStore((s) => s.doors)
  const windows = useSigeStore((s) => s.windows)
  const selectedId = useSigeStore((s) => s.selectedFurnitureId)
  const setSelected = useSigeStore((s) => s.setSelectedFurnitureId)
  const removeFurniture = useSigeStore((s) => s.removeFurniture)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    furniture: true,
    structure: false,
    rooms: false,
  })
  const toggle = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }))

  const GroupRow = ({ id, label, icon, count }: { id: string; label: string; icon: string; count: number }) => (
    <button
      type="button"
      onClick={() => toggle(id)}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-200"
    >
      <span className="material-symbols-outlined text-sm leading-none text-slate-600">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="rounded-full bg-slate-700/70 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">{count}</span>
      <span className="material-symbols-outlined text-sm leading-none text-slate-600">
        {expanded[id] ? 'expand_less' : 'expand_more'}
      </span>
    </button>
  )

  return (
    <aside className="ed-glass flex h-full w-60 flex-shrink-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Scene</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-600 transition-colors hover:bg-white/10 hover:text-slate-300"
        >
          <span className="material-symbols-outlined text-sm leading-none">close</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1 text-sm">
        {/* Furniture */}
        <GroupRow id="furniture" label="Furniture" icon="chair" count={furniture.length} />
        {expanded.furniture && (
          <div className="mb-1">
            {furniture.length === 0 ? (
              <p className="px-8 py-1.5 text-[11px] italic text-slate-600">No furniture placed</p>
            ) : (
              furniture.map((f) => (
                <div
                  key={f.id}
                  className={clsx(
                    'group flex cursor-pointer items-center gap-2 px-8 py-1.5 transition-colors',
                    f.id === selectedId
                      ? 'bg-blue-500/18 text-blue-300'
                      : 'text-slate-500 hover:bg-white/5 hover:text-slate-200',
                  )}
                  onClick={() => setSelected(f.id === selectedId ? null : f.id)}
                >
                  <span className="material-symbols-outlined text-xs leading-none opacity-50">weekend</span>
                  <span className="flex-1 truncate text-[11px] font-medium">{f.label}</span>
                  <button
                    type="button"
                    className="hidden rounded p-0.5 text-slate-600 transition-colors hover:bg-red-500/20 hover:text-red-400 group-hover:block"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFurniture(f.id)
                    }}
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-xs leading-none">delete</span>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Structure */}
        <GroupRow id="structure" label="Structure" icon="home" count={walls.length + doors.length + windows.length} />
        {expanded.structure && (
          <div className="mb-1">
            {walls.map((w) => (
              <div key={w.id} className="flex items-center gap-2 px-8 py-1 text-slate-600">
                <span className="material-symbols-outlined text-xs leading-none">crop_16_9</span>
                <span className="truncate text-[11px]">Wall {w.id.slice(-4)}</span>
              </div>
            ))}
            {doors.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-8 py-1 text-slate-600">
                <span className="material-symbols-outlined text-xs leading-none">door_open</span>
                <span className="truncate text-[11px]">Door {d.id.slice(-4)}</span>
              </div>
            ))}
            {windows.map((w) => (
              <div key={w.id} className="flex items-center gap-2 px-8 py-1 text-slate-600">
                <span className="material-symbols-outlined text-xs leading-none">window</span>
                <span className="truncate text-[11px]">Win {w.id.slice(-4)}</span>
              </div>
            ))}
            {walls.length + doors.length + windows.length === 0 && (
              <p className="px-8 py-1.5 text-[11px] italic text-slate-600">None drawn</p>
            )}
          </div>
        )}

        {/* Rooms */}
        <GroupRow id="rooms" label="Rooms" icon="meeting_room" count={rooms.length} />
        {expanded.rooms && (
          <div className="mb-1">
            {rooms.length === 0 ? (
              <p className="px-8 py-1.5 text-[11px] italic text-slate-600">No rooms drawn</p>
            ) : (
              rooms.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-8 py-1 text-slate-600">
                  <span className="material-symbols-outlined text-xs leading-none">grid_4x4</span>
                  <span className="truncate text-[11px]">{r.name ?? r.id}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

// ─── Env / Visibility Toggles bar ─────────────────────────────────────────────

function EnvPill({
  on,
  toggle,
  label,
  icon,
}: {
  on: boolean
  toggle: () => void
  label: string
  icon: string
}) {
  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.15s',
        border: on ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(255,255,255,0.15)',
        background: on ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.07)',
        color: on ? '#93c5fd' : '#94a3b8',
        boxShadow: on ? '0 0 0 1px rgba(59,130,246,0.2)' : 'none',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14, lineHeight: 1 }}>
        {icon}
      </span>
      {label}
    </button>
  )
}

function EnvBar({
  showEnvGrid,
  setShowEnvGrid,
  shadows,
  setShadows,
}: {
  showEnvGrid: boolean
  setShowEnvGrid: (v: boolean) => void
  shadows: boolean
  setShadows: (v: boolean) => void
}) {
  const showFloorPlanImage = useSigeStore((s) => s.showFloorPlanImage)
  const setShowFloorPlanImage = useSigeStore((s) => s.setShowFloorPlanImage)
  const showWalls = useSigeStore((s) => s.showWalls)
  const showDoors = useSigeStore((s) => s.showDoors)
  const showWindows = useSigeStore((s) => s.showWindows)
  const setStructureVisibility = useSigeStore((s) => s.setStructureVisibility)

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '6px 8px',
      borderRadius: 12,
      background: 'rgba(10, 14, 24, 0.92)',
      border: '1px solid rgba(255,255,255,0.14)',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <EnvPill on={showEnvGrid} toggle={() => setShowEnvGrid(!showEnvGrid)} label="Grid" icon="grid_on" />
      <EnvPill on={shadows} toggle={() => setShadows(!shadows)} label="Shadows" icon="wb_shade" />
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }} />
      <EnvPill on={showFloorPlanImage} toggle={() => setShowFloorPlanImage(!showFloorPlanImage)} label="Plan" icon="map" />
      <EnvPill on={showWalls} toggle={() => setStructureVisibility({ showWalls: !showWalls })} label="Walls" icon="crop_16_9" />
      <EnvPill on={showDoors} toggle={() => setStructureVisibility({ showDoors: !showDoors })} label="Doors" icon="door_open" />
      <EnvPill on={showWindows} toggle={() => setStructureVisibility({ showWindows: !showWindows })} label="Windows" icon="window" />
    </div>
  )
}

// ─── Main 3D Editor Page ──────────────────────────────────────────────────────

export function Editor3DPage() {
  const navigate = useNavigate()
  const derived = useDerivedGrid()
  const gridSizeFt = useSigeStore((s) => s.gridSizeFt)
  const scale = useSigeStore((s) => s.scale)
  const imageUrl = useSigeStore((s) => s.imageUrl)
  const imageNaturalWidth = useSigeStore((s) => s.imageNaturalWidth)
  const imageNaturalHeight = useSigeStore((s) => s.imageNaturalHeight)
  const showFloorPlanImage = useSigeStore((s) => s.showFloorPlanImage)
  const tool = useSigeStore((s) => s.tool)
  const pendingFurniturePreset = useSigeStore((s) => s.pendingFurniturePreset)
  const undo = useSigeStore((s) => s.undo)
  const redo = useSigeStore((s) => s.redo)
  const past = useSigeStore((s) => s.past)
  const future = useSigeStore((s) => s.future)
  const selectedFurnitureId = useSigeStore((s) => s.selectedFurnitureId)
  const rotateFurniture = useSigeStore((s) => s.rotateFurniture)
  const removeFurniture = useSigeStore((s) => s.removeFurniture)

  const [showOutliner, setShowOutliner] = useState(true)
  const [showInspector, setShowInspector] = useState(true)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showEnvGrid, setShowEnvGrid] = useState(true)
  const [shadows, setShadows] = useState(true)

  // OrbitControls ref — typed as the drei OrbitControls instance
  const orbitRef = useRef<OrbitApi | null>(null)

  const size = useMemo(() => {
    if (!derived) return null
    return {
      widthFt: derived.cols * gridSizeFt,
      depthFt: derived.rows * gridSizeFt,
    }
  }, [derived, gridSizeFt])

  const pxPerFt = scale?.pxPerFt ?? null
  const camDist = size ? Math.max(14, Math.max(size.widthFt, size.depthFt) * 1.15) : 20
  const placeCursor = tool === 'placeFurniture' && pendingFurniturePreset != null

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo()
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) redo()
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFurnitureId) {
        removeFurniture(selectedFurnitureId)
      }
      if (e.key.toLowerCase() === 'r' && selectedFurnitureId) rotateFurniture(selectedFurnitureId)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, selectedFurnitureId, removeFurniture, rotateFurniture])

  return (
    <>
      {/* ── scoped styles ── */}
      <style>{`
        .ed-root {
          display: flex;
          flex-direction: column;
          height: 100dvh;
          width: 100vw;
          background: #0d1117;
          color: #e2e8f0;
          font-family: 'Inter', sans-serif;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
        }
        .ed-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
          height: 46px;
          min-height: 46px;
          flex-shrink: 0;
          background: rgba(10, 12, 18, 0.96);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(12px);
          z-index: 60;
          gap: 8px;
        }
        .ed-workspace {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        .ed-canvas {
          flex: 1;
          position: relative;
          overflow: hidden;
          background: #0f1117;
        }
        .ed-glass {
          background: rgba(12, 17, 27, 0.90);
          border-right: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(18px);
        }
        .ed-panel-right {
          background: rgba(12, 17, 27, 0.90);
          border-left: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(18px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex-shrink: 0;
          width: 276px;
        }
        .ed-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px; height: 30px;
          border-radius: 7px;
          color: #64748b;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.14s;
          flex-shrink: 0;
        }
        .ed-icon-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #e2e8f0; }
        .ed-icon-btn:active:not(:disabled) { transform: scale(0.91); }
        .ed-icon-btn--on { background: rgba(59,130,246,0.2) !important; color: #60a5fa !important; }
        .ed-icon-btn:disabled { opacity: 0.3; cursor: default; }
        .ed-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 9px; border-radius: 7px;
          font-size: 11px; font-weight: 600;
          color: #64748b;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          cursor: pointer; transition: all 0.14s;
          white-space: nowrap;
        }
        .ed-pill:hover { background: rgba(255,255,255,0.11); color: #e2e8f0; }
        .ed-pill:active { transform: scale(0.95); }
        .ed-divider { width: 1px; height: 20px; background: rgba(255,255,255,0.09); flex-shrink: 0; }
        .ed-section-title {
          font-size: 9px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.18em;
          color: #475569;
          padding: 8px 12px 4px;
        }
      `}</style>

      <div className="ed-root">
        {/* ── Top Bar ── */}
        <header className="ed-topbar">
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <button type="button" className="ed-icon-btn" title="Back to 2D editor" onClick={() => navigate('/editor')}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, lineHeight: 1 }}>arrow_back</span>
            </button>
            <div className="ed-divider" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>SIGE</span>
            <span style={{
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em',
              color: '#60a5fa', background: 'rgba(59,130,246,0.15)', borderRadius: 5,
              padding: '2px 7px', border: '1px solid rgba(59,130,246,0.25)',
            }}>3D Editor</span>
          </div>

          {/* Center: Action strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' }}>
            <button type="button" className="ed-icon-btn" title="Undo (Ctrl+Z)" disabled={past.length === 0} onClick={undo}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>undo</span>
            </button>
            <button type="button" className="ed-icon-btn" title="Redo (Ctrl+Y)" disabled={future.length === 0} onClick={redo}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>redo</span>
            </button>
            {selectedFurnitureId && (
              <>
                <div className="ed-divider" />
                <button type="button" className="ed-pill" onClick={() => rotateFurniture(selectedFurnitureId)} title="Rotate 90°">
                  <span className="material-symbols-outlined" style={{ fontSize: 13, lineHeight: 1 }}>rotate_right</span>
                  Rotate
                </button>
                <button
                  type="button"
                  className="ed-pill"
                  style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.07)' }}
                  onClick={() => removeFurniture(selectedFurnitureId)}
                  title="Delete (Del)"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13, lineHeight: 1 }}>delete</span>
                  Delete
                </button>
              </>
            )}
          </div>

          {/* Right: Panel toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              className={clsx('ed-icon-btn', showLibrary && 'ed-icon-btn--on')}
              title="Furniture library"
              onClick={() => setShowLibrary((v) => !v)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 17, lineHeight: 1 }}>chair</span>
            </button>
            <button
              type="button"
              className={clsx('ed-icon-btn', showOutliner && 'ed-icon-btn--on')}
              title="Scene outliner"
              onClick={() => setShowOutliner((v) => !v)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 17, lineHeight: 1 }}>account_tree</span>
            </button>
            <button
              type="button"
              className={clsx('ed-icon-btn', showInspector && 'ed-icon-btn--on')}
              title="Inspector"
              onClick={() => setShowInspector((v) => !v)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 17, lineHeight: 1 }}>tune</span>
            </button>
            <div className="ed-divider" />
            <button
              type="button"
              className="ed-pill"
              style={{ color: '#93c5fd', borderColor: 'rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.1)' }}
              onClick={() => navigate('/editor')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13, lineHeight: 1 }}>edit</span>
              2D Edit
            </button>
          </div>
        </header>

        {/* ── Workspace ── */}
        <div className="ed-workspace">
          {/* Left: Outliner */}
          {showOutliner && <SceneOutliner onClose={() => setShowOutliner(false)} />}

          {/* Center: 3D Canvas */}
          <div className="ed-canvas" style={{ cursor: placeCursor ? 'crosshair' : 'default' }}>
            {!derived || !size ? (
              /* Empty state */
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                  background: 'rgba(17,24,39,0.9)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 20, padding: 40, textAlign: 'center', backdropFilter: 'blur(20px)',
                  maxWidth: 340,
                }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%', background: 'rgba(59,130,246,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#60a5fa', lineHeight: 1 }}>
                      view_in_ar
                    </span>
                  </div>
                  <div>
                    <h2 style={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>No 3D scene</h2>
                    <p style={{ fontSize: 13, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>
                      Upload a floor plan and calibrate scale in the 2D editor to unlock the 3D view.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/editor')}
                    style={{
                      background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff',
                      border: 'none', borderRadius: 10, padding: '10px 22px',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      boxShadow: '0 4px 20px rgba(37,99,235,0.35)',
                    }}
                  >
                    Go to 2D Editor
                  </button>
                </div>
              </div>
            ) : (
              <Canvas
                shadows={shadows}
                dpr={[1, 2]}
                camera={{
                  position: [size.widthFt * 0.85, camDist * 0.55, size.depthFt * 0.95],
                  fov: 52,
                  near: 0.1,
                  far: Math.max(500, camDist * 10),
                }}
                style={{ width: '100%', height: '100%' }}
                gl={{ antialias: true, alpha: false }}
                onCreated={({ gl, scene }) => {
                  scene.background = new THREE.Color('#1a2035')
                  gl.toneMapping = THREE.NoToneMapping
                  gl.toneMappingExposure = 1.0
                }}
              >
                <Suspense fallback={null}>
                  <SceneContent
                    widthFt={size.widthFt}
                    depthFt={size.depthFt}
                    gridSizeFt={gridSizeFt}
                    pxPerFt={pxPerFt}
                    cellSizePx={derived.cellSizePx}
                    imageUrl={imageUrl}
                    imageNaturalWidth={imageNaturalWidth}
                    imageNaturalHeight={imageNaturalHeight}
                    showFloorPlanImage={showFloorPlanImage}
                    showEnvGrid={showEnvGrid}
                    shadows={shadows}
                    orbitRef={orbitRef}
                  />
                </Suspense>
              </Canvas>
            )}

            {/* Floating camera view presets — left side */}
            {derived && size && (
              <div style={{
                position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 20, pointerEvents: 'auto',
              }}>
                <CameraViewPanel orbitRef={orbitRef} cx={size.widthFt / 2} cz={size.depthFt / 2} camDist={camDist} />
              </div>
            )}

            {/* Floating env bar — bottom center */}
            <div style={{
              position: 'absolute', bottom: 12, left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20, pointerEvents: 'auto',
            }}>
              <EnvBar
                showEnvGrid={showEnvGrid}
                setShowEnvGrid={setShowEnvGrid}
                shadows={shadows}
                setShadows={setShadows}
              />
            </div>

            {/* Keyboard shortcut hint */}
            <div style={{
              position: 'absolute', right: 10, top: 10, zIndex: 20,
              background: 'rgba(12,17,27,0.75)', borderRadius: 8,
              padding: '5px 10px', backdropFilter: 'blur(8px)',
              fontSize: 10, color: '#475569', letterSpacing: '0.05em',
              border: '1px solid rgba(255,255,255,0.06)',
              lineHeight: 1.8,
            }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Orbit</span> drag ·{' '}
              <span style={{ color: '#64748b', fontWeight: 600 }}>Zoom</span> scroll ·{' '}
              <span style={{ color: '#64748b', fontWeight: 600 }}>R</span> rotate ·{' '}
              <span style={{ color: '#64748b', fontWeight: 600 }}>Del</span> remove
            </div>
          </div>

          {/* Right: Inspector + Library */}
          {(showInspector || showLibrary) && (
            <div className="ed-panel-right">
              {showInspector && (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)',
                    flexShrink: 0,
                  }}>
                    <span className="ed-section-title" style={{ padding: 0 }}>Inspector</span>
                    <button type="button" className="ed-icon-btn" onClick={() => setShowInspector(false)}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, lineHeight: 1 }}>close</span>
                    </button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 8, minHeight: 0 }}>
                    {derived && size ? (
                      <Floor3DInspectorPanel />
                    ) : (
                      <p style={{ fontSize: 12, color: '#475569', padding: '8px 4px' }}>
                        Calibrate scale in 2D editor to inspect.
                      </p>
                    )}
                  </div>
                </>
              )}

              {showLibrary && (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderTop: showInspector ? '1px solid rgba(255,255,255,0.07)' : undefined,
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    flexShrink: 0,
                  }}>
                    <span className="ed-section-title" style={{ padding: 0 }}>Furniture Library</span>
                    <button type="button" className="ed-icon-btn" onClick={() => setShowLibrary(false)}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, lineHeight: 1 }}>close</span>
                    </button>
                  </div>
                  <div style={{ flex: showInspector ? '0 0 200px' : 1, overflowY: 'auto', padding: 8 }}>
                    <FurnitureLibrary />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
