import { memo, Suspense, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import * as THREE from 'three'
import type { FurnitureItem } from '../../types'
import { useSigeStore } from '../../store/useSigeStore'
import { isPlacementValid, type GridInputs } from '../../utils/gridEngine'
import {
  furnitureCenterXZ,
  itemStateFromCenter,
  itemStateFromWorldCenter,
  snapDimensionFt,
} from './worldFromFurniture'
import * as M from './furniture3dMath'
import { getKenneyModelUrl } from './kenneyModelMap'
import { KenneyGlbMesh } from './KenneyGlbMesh'
import { FootprintFallback } from './FootprintFallback'
import { GlbErrorBoundary } from './GlbErrorBoundary'
import { intersectFloorXZ } from './floorPointer'
import { useSetFloor3DOrbit } from './Floor3DOrbitContext'

type Preview = { cx: number; cz: number; w: number; d: number }

type ResizeKind = 'resize-right' | 'resize-left' | 'resize-front' | 'resize-back'

function Furniture3DInner({
  item,
  selected,
  gridSizeFt,
  pxPerFt,
}: {
  item: FurnitureItem
  selected: boolean
  gridSizeFt: number
  pxPerFt: number | null
}) {
  const updateFurniture = useSigeStore((s) => s.updateFurniture)
  const setSelected = useSigeStore((s) => s.setSelectedFurnitureId)
  const snapToGrid = useSigeStore((s) => s.snapToGrid)
  const walls = useSigeStore((s) => s.walls)
  const rooms = useSigeStore((s) => s.rooms)
  const furnitureList = useSigeStore((s) => s.furniture)
  const imageNaturalWidth = useSigeStore((s) => s.imageNaturalWidth)
  const imageNaturalHeight = useSigeStore((s) => s.imageNaturalHeight)
  const setOrbit = useSetFloor3DOrbit()
  const { camera, gl } = useThree()

  const gridInputs = useMemo((): GridInputs | null => {
    if (!pxPerFt || imageNaturalWidth <= 0 || imageNaturalHeight <= 0) return null
    return {
      imageWidthPx: imageNaturalWidth,
      imageHeightPx: imageNaturalHeight,
      pxPerFt,
      gridSizeFt,
      rooms,
      walls,
      furniture: furnitureList,
    }
  }, [pxPerFt, imageNaturalWidth, imageNaturalHeight, gridSizeFt, rooms, walls, furnitureList])

  const rotYRad = THREE.MathUtils.degToRad(item.rotation)
  const baseCenter = furnitureCenterXZ(item, gridSizeFt, pxPerFt)

  const [preview, setPreview] = useState<Preview | null>(null)
  const [dragging, setDragging] = useState(false)
  const liveRef = useRef<Preview>({
    cx: baseCenter.x,
    cz: baseCenter.z,
    w: item.widthFt,
    d: item.depthFt,
  })

  const cx = preview?.cx ?? baseCenter.x
  const cz = preview?.cz ?? baseCenter.z
  const wFt = preview?.w ?? item.widthFt
  const dFt = preview?.d ?? item.depthFt
  const yLift = dragging ? 0.08 : 0

  const glbUrl = getKenneyModelUrl(item.type)

  const onPointerDownBody = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setSelected(item.id)
    setOrbit(false)
    setDragging(true)
    const pid = e.nativeEvent.pointerId
    gl.domElement.setPointerCapture(pid)

    const hit0 = new THREE.Vector3()
    if (!intersectFloorXZ(e.nativeEvent.clientX, e.nativeEvent.clientY, camera, gl.domElement, hit0)) {
      try {
        gl.domElement.releasePointerCapture(pid)
      } catch {
        /* */
      }
      setDragging(false)
      setOrbit(true)
      return
    }

    const startC = furnitureCenterXZ(item, gridSizeFt, pxPerFt)
    liveRef.current = { cx: startC.x, cz: startC.z, w: item.widthFt, d: item.depthFt }
    setPreview({ ...liveRef.current })

    const move = (ev: PointerEvent) => {
      const h = new THREE.Vector3()
      if (!intersectFloorXZ(ev.clientX, ev.clientY, camera, gl.domElement, h)) return
      liveRef.current = {
        cx: startC.x + (h.x - hit0.x),
        cz: startC.z + (h.z - hit0.z),
        w: item.widthFt,
        d: item.depthFt,
      }
      setPreview({ ...liveRef.current })
    }

    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      try {
        gl.domElement.releasePointerCapture(pid)
      } catch {
        /* */
      }
      setOrbit(true)
      setDragging(false)

      const h = new THREE.Vector3()
      let fcx = liveRef.current.cx
      let fcz = liveRef.current.cz
      if (intersectFloorXZ(ev.clientX, ev.clientY, camera, gl.domElement, h)) {
        fcx = startC.x + (h.x - hit0.x)
        fcz = startC.z + (h.z - hit0.z)
      }
      const patch =
        pxPerFt != null
          ? itemStateFromWorldCenter(item, fcx, fcz, gridSizeFt, pxPerFt, snapToGrid)
          : itemStateFromCenter(item, fcx, fcz, gridSizeFt)
      const draft: FurnitureItem = { ...item, ...patch }
      if (gridInputs && !isPlacementValid(draft, item.id, gridInputs, { allowFurnitureOverlap: true })) {
        setPreview(null)
        return
      }
      updateFurniture(item.id, patch)
      setPreview(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const onPointerDownResize = (e: ThreeEvent<PointerEvent>, kind: ResizeKind) => {
    e.stopPropagation()
    setSelected(item.id)
    setOrbit(false)
    setDragging(true)
    const pid = e.nativeEvent.pointerId
    gl.domElement.setPointerCapture(pid)

    const hit0 = new THREE.Vector3()
    if (!intersectFloorXZ(e.nativeEvent.clientX, e.nativeEvent.clientY, camera, gl.domElement, hit0)) {
      setDragging(false)
      setOrbit(true)
      return
    }

    const startC = furnitureCenterXZ(item, gridSizeFt, pxPerFt)
    const startW = item.widthFt
    const startD = item.depthFt

    const applyResize = (h: THREE.Vector3) => {
      const dwx = h.x - hit0.x
      const dwz = h.z - hit0.z
      let newW = startW
      let newD = startD
      let ncx = startC.x
      let ncz = startC.z

      if (kind === 'resize-right') {
        const dlx = M.projectWorldDeltaOnLocalX(rotYRad, dwx, dwz)
        newW = snapDimensionFt(startW + dlx, gridSizeFt)
        const c = M.centerAfterResizeWidthFromLeftFixed(startC.x, startC.z, rotYRad, startW, newW)
        ncx = c.x
        ncz = c.z
      } else if (kind === 'resize-left') {
        const dlx = M.projectWorldDeltaOnLocalX(rotYRad, dwx, dwz)
        newW = snapDimensionFt(startW - dlx, gridSizeFt)
        const c = M.centerAfterResizeWidthFromRightFixed(startC.x, startC.z, rotYRad, startW, newW)
        ncx = c.x
        ncz = c.z
      } else if (kind === 'resize-front') {
        const dlz = M.projectWorldDeltaOnLocalZ(rotYRad, dwx, dwz)
        newD = snapDimensionFt(startD + dlz, gridSizeFt)
        const c = M.centerAfterResizeDepthFromBackFixed(startC.x, startC.z, rotYRad, startD, newD)
        ncx = c.x
        ncz = c.z
      } else {
        const dlz = M.projectWorldDeltaOnLocalZ(rotYRad, dwx, dwz)
        newD = snapDimensionFt(startD - dlz, gridSizeFt)
        const c = M.centerAfterResizeDepthFromFrontFixed(startC.x, startC.z, rotYRad, startD, newD)
        ncx = c.x
        ncz = c.z
      }

      liveRef.current = { cx: ncx, cz: ncz, w: newW, d: newD }
      setPreview({ ...liveRef.current })
    }

    const move = (ev: PointerEvent) => {
      const h = new THREE.Vector3()
      if (!intersectFloorXZ(ev.clientX, ev.clientY, camera, gl.domElement, h)) return
      applyResize(h)
    }

    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      try {
        gl.domElement.releasePointerCapture(pid)
      } catch {
        /* */
      }
      setOrbit(true)
      setDragging(false)

      const h = new THREE.Vector3()
      if (intersectFloorXZ(ev.clientX, ev.clientY, camera, gl.domElement, h)) applyResize(h)

      const { cx: fcx, cz: fcz, w: fw, d: fd } = liveRef.current
      const sized: FurnitureItem = { ...item, widthFt: fw, depthFt: fd }
      const patch =
        pxPerFt != null
          ? itemStateFromWorldCenter(sized, fcx, fcz, gridSizeFt, pxPerFt, snapToGrid)
          : itemStateFromCenter(sized, fcx, fcz, gridSizeFt)
      const next: FurnitureItem = {
        ...item,
        widthFt: fw,
        depthFt: fd,
        gridX: patch.gridX,
        gridY: patch.gridY,
        freeOffsetPx: patch.freeOffsetPx,
      }
      if (gridInputs && !isPlacementValid(next, item.id, gridInputs, { allowFurnitureOverlap: true })) {
        setPreview(null)
        return
      }
      updateFurniture(item.id, {
        widthFt: fw,
        depthFt: fd,
        gridX: patch.gridX,
        gridY: patch.gridY,
        freeOffsetPx: patch.freeOffsetPx,
      })
      setPreview(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const handleThickness = 0.22
  const handleLong = Math.max(0.35, Math.min(wFt, dFt) * 0.35)
  const handleY = 0.12 + yLift

  const fallback = <FootprintFallback widthFt={wFt} depthFt={dFt} showEdges={false} />

  return (
    <group
      position={[cx, yLift, cz]}
      rotation={[0, rotYRad, 0]}
      onClick={(e) => e.stopPropagation()}
    >
      <group onPointerDown={onPointerDownBody}>
        {glbUrl ? (
          <GlbErrorBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
              <KenneyGlbMesh url={glbUrl} widthFt={wFt} depthFt={dFt} />
            </Suspense>
          </GlbErrorBoundary>
        ) : (
          fallback
        )}
      </group>

      {selected && (
        <group position={[0, 0.02, 0]}>
          <mesh>
            <boxGeometry args={[wFt + 0.06, 0.04, dFt + 0.06]} />
            <meshBasicMaterial transparent opacity={0.08} depthWrite={false} />
            <Edges color={0x1d4ed8} threshold={12} />
          </mesh>
        </group>
      )}

      {selected && (
        <>
          <mesh
            position={[wFt / 2 + handleThickness / 2, handleY, 0]}
            onPointerDown={(e) => onPointerDownResize(e, 'resize-right')}
            onClick={(e) => e.stopPropagation()}
          >
            <boxGeometry args={[handleThickness, handleLong, handleLong]} />
            <meshBasicMaterial transparent opacity={0.02} depthWrite={false} />
          </mesh>
          <mesh
            position={[-wFt / 2 - handleThickness / 2, handleY, 0]}
            onPointerDown={(e) => onPointerDownResize(e, 'resize-left')}
            onClick={(e) => e.stopPropagation()}
          >
            <boxGeometry args={[handleThickness, handleLong, handleLong]} />
            <meshBasicMaterial transparent opacity={0.02} depthWrite={false} />
          </mesh>
          <mesh
            position={[0, handleY, dFt / 2 + handleThickness / 2]}
            onPointerDown={(e) => onPointerDownResize(e, 'resize-front')}
            onClick={(e) => e.stopPropagation()}
          >
            <boxGeometry args={[handleLong, handleLong, handleThickness]} />
            <meshBasicMaterial transparent opacity={0.02} depthWrite={false} />
          </mesh>
          <mesh
            position={[0, handleY, -dFt / 2 - handleThickness / 2]}
            onPointerDown={(e) => onPointerDownResize(e, 'resize-back')}
            onClick={(e) => e.stopPropagation()}
          >
            <boxGeometry args={[handleLong, handleLong, handleThickness]} />
            <meshBasicMaterial transparent opacity={0.02} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  )
}

export const Furniture3D = memo(Furniture3DInner, (a, b) => {
  if (a.selected !== b.selected || a.gridSizeFt !== b.gridSizeFt || a.pxPerFt !== b.pxPerFt) return false
  const p = a.item
  const q = b.item
  return (
    p.id === q.id &&
    p.gridX === q.gridX &&
    p.gridY === q.gridY &&
    p.widthFt === q.widthFt &&
    p.depthFt === q.depthFt &&
    p.rotation === q.rotation &&
    p.freeOffsetPx[0] === q.freeOffsetPx[0] &&
    p.freeOffsetPx[1] === q.freeOffsetPx[1] &&
    p.type === q.type
  )
})
