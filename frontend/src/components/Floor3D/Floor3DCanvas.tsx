import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useEffect, useMemo, useState } from 'react'
import { useDerivedGrid } from '../../hooks/useDerivedGrid'
import { useSigeStore } from '../../store/useSigeStore'
import type { GridInputs } from '../../utils/gridEngine'
import { Floor3DOrbitContext } from './Floor3DOrbitContext'
import { Floor3DInteractionPlane } from './Floor3DInteractionPlane'
import { Furniture3D } from './Furniture3D'
import { FloorPlanGrids3D } from './FloorPlanGrids3D'
import { FloorPlanOverlay3D } from './FloorPlanOverlay3D'
import { furniturePlanScaleFactorFromStoreInputs, libraryKenneyPreloadUrls } from '../../utils/furnitureLib'

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
}) {
  const [orbitEnabled, setOrbitEnabled] = useState(true)
  const furniture = useSigeStore((s) => s.furniture)
  const selectedId = useSigeStore((s) => s.selectedFurnitureId)
  const walls = useSigeStore((s) => s.walls)
  const rooms = useSigeStore((s) => s.rooms)
  const doors = useSigeStore((s) => s.doors)

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
  }, [
    pxPerFt,
    cellSizePx,
    imageNaturalWidth,
    imageNaturalHeight,
    gridSizeFt,
    rooms,
    walls,
    furniture,
  ])

  const cx = widthFt / 2
  const cz = depthFt / 2

  const orbitTarget = useMemo(() => {
    if (pxPerFt != null && imageNaturalWidth > 0 && imageNaturalHeight > 0) {
      return {
        x: imageNaturalWidth / pxPerFt / 2,
        z: imageNaturalHeight / pxPerFt / 2,
      }
    }
    return { x: cx, z: cz }
  }, [pxPerFt, imageNaturalWidth, imageNaturalHeight, cx, cz])

  const furniturePlanScaleFactor = useMemo(() => {
    if (!pxPerFt || imageNaturalWidth <= 0 || imageNaturalHeight <= 0) return undefined as number | undefined
    return furniturePlanScaleFactorFromStoreInputs(pxPerFt, imageNaturalWidth, imageNaturalHeight, rooms)
  }, [pxPerFt, imageNaturalWidth, imageNaturalHeight, rooms])

  useEffect(() => {
    for (const url of libraryKenneyPreloadUrls()) {
      useGLTF.preload(url)
    }
  }, [])

  const camDistance = useMemo(
    () => Math.max(14, Math.max(widthFt, depthFt) * 1.15),
    [widthFt, depthFt],
  )

  return (
    <Floor3DOrbitContext.Provider value={setOrbitEnabled}>
      <ambientLight intensity={0.36} color="#ffffff" />
      <hemisphereLight intensity={0.3} groundColor="#f0f0f0" color="#fafafa" />
      <directionalLight
        color="#ffffff"
        position={[widthFt * 0.6, Math.max(widthFt, depthFt) * 1.2, depthFt * 0.5]}
        intensity={0.7}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enabled={orbitEnabled}
        target={[orbitTarget.x, 0, orbitTarget.z]}
        maxPolarAngle={Math.PI / 2 - 0.06}
        minDistance={4}
        maxDistance={camDistance * 3}
      />

      <Floor3DInteractionPlane
        widthFt={widthFt}
        depthFt={depthFt}
        cx={cx}
        cz={cz}
        pxPerFt={pxPerFt}
        cellSizePx={cellSizePx}
        gridInputs={gridInputs}
        planScaleFactor={furniturePlanScaleFactor}
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
        />
      )}

      {furniture.map((f) => (
        <Furniture3D
          key={f.id}
          item={f}
          selected={f.id === selectedId}
          gridSizeFt={gridSizeFt}
          pxPerFt={pxPerFt}
        />
      ))}
    </Floor3DOrbitContext.Provider>
  )
}

export function Floor3DCanvas({ className }: { className?: string }) {
  const derived = useDerivedGrid()
  const gridSizeFt = useSigeStore((s) => s.gridSizeFt)
  const scale = useSigeStore((s) => s.scale)
  const imageUrl = useSigeStore((s) => s.imageUrl)
  const imageNaturalWidth = useSigeStore((s) => s.imageNaturalWidth)
  const imageNaturalHeight = useSigeStore((s) => s.imageNaturalHeight)
  const showFloorPlanImage = useSigeStore((s) => s.showFloorPlanImage)
  const tool = useSigeStore((s) => s.tool)
  const pendingFurniturePreset = useSigeStore((s) => s.pendingFurniturePreset)

  const size = useMemo(() => {
    if (!derived) return null
    return {
      widthFt: derived.cols * gridSizeFt,
      depthFt: derived.rows * gridSizeFt,
    }
  }, [derived, gridSizeFt])

  if (!derived || !size) {
    return (
      <div
        className={className}
        style={{ minHeight: 360 }}
      >
        <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-outline-variant/25 bg-surface-container-low/40 px-6 text-center text-sm text-on-surface-variant">
          Set scale on your floor plan to open the 3D view (grid size matches the 2D layout).
        </div>
      </div>
    )
  }

  const pxPerFt = scale?.pxPerFt ?? null
  const camDist = Math.max(14, Math.max(size.widthFt, size.depthFt) * 1.15)

  const placeCursor = tool === 'placeFurniture' && pendingFurniturePreset != null

  return (
    <div
      className={className}
      style={{
        minHeight: 360,
        height: '100%',
        cursor: placeCursor ? 'crosshair' : undefined,
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: [size.widthFt * 0.85, camDist * 0.55, size.depthFt * 0.95],
          fov: 48,
          near: 0.1,
          far: Math.max(500, camDist * 8),
        }}
        className="h-full w-full rounded-2xl"
        gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
        onCreated={({ gl, scene }) => {
          scene.background = null
          gl.setClearColor(0x000000, 0)
          gl.toneMapping = THREE.NoToneMapping
          gl.toneMappingExposure = 1
        }}
      >
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
        />
      </Canvas>
    </div>
  )
}
