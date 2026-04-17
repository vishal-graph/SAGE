import { Suspense, useLayoutEffect, useMemo } from 'react'
import { Line, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { Door, Room, Wall } from '../../types'
import { planPxToWorldXZ } from './planCoordinates'

const Y_TEXTURE = 0.016
const Y_BORDER = 0.038
const Y_DOOR = 0.052

/** Floor plan image as XZ plane, aligned with 2D pixel (0,0) → world (0,0). */
function FloorPlanTextureMesh({
  url,
  planWidthFt,
  planDepthFt,
}: {
  url: string
  planWidthFt: number
  planDepthFt: number
}) {
  const texture = useTexture(url)
  useLayoutEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true
  }, [texture])

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[planWidthFt / 2, Y_TEXTURE, planDepthFt / 2]}
      receiveShadow
    >
      <planeGeometry args={[planWidthFt, planDepthFt]} />
      <meshStandardMaterial map={texture} roughness={0.88} metalness={0.02} />
    </mesh>
  )
}

/** Outer rectangle matching the raster extent (same as 2D image bounds). */
function PlanPerimeterLine({
  planWidthFt,
  planDepthFt,
}: {
  planWidthFt: number
  planDepthFt: number
}) {
  const pts: THREE.Vector3[] = useMemo(
    () => [
      new THREE.Vector3(0, Y_BORDER, 0),
      new THREE.Vector3(planWidthFt, Y_BORDER, 0),
      new THREE.Vector3(planWidthFt, Y_BORDER, planDepthFt),
      new THREE.Vector3(0, Y_BORDER, planDepthFt),
      new THREE.Vector3(0, Y_BORDER, 0),
    ],
    [planWidthFt, planDepthFt],
  )
  return (
    <Line
      points={pts}
      color="#1e293b"
      lineWidth={2.5}
      dashed={false}
      depthTest
      depthWrite={false}
      renderOrder={2}
    />
  )
}

function WallSegmentLine({
  wall,
  pxPerFt,
}: {
  wall: Wall
  pxPerFt: number
}) {
  const a = planPxToWorldXZ(wall.x1, wall.y1, pxPerFt)
  const b = planPxToWorldXZ(wall.x2, wall.y2, pxPerFt)
  const pts = [new THREE.Vector3(a.x, Y_BORDER, a.z), new THREE.Vector3(b.x, Y_BORDER, b.z)]
  return (
    <Line
      points={pts}
      color="#e11d48"
      lineWidth={3}
      depthTest
      depthWrite={false}
      renderOrder={2}
    />
  )
}

function RoomOutlineLine({
  room,
  pxPerFt,
}: {
  room: Room
  pxPerFt: number
}) {
  const pts = useMemo(() => {
    const poly = room.polygon
    if (poly.length < 2) return []
    const v: THREE.Vector3[] = poly.map(([px, py]) => {
      const p = planPxToWorldXZ(px, py, pxPerFt)
      return new THREE.Vector3(p.x, Y_BORDER + 0.004, p.z)
    })
    if (v.length > 0) v.push(v[0]!.clone())
    return v
  }, [room.polygon, pxPerFt])

  if (pts.length < 3) return null

  return (
    <Line
      points={pts}
      color="#f59e0b"
      lineWidth={2}
      depthTest
      depthWrite={false}
      transparent
      opacity={0.95}
      renderOrder={2}
    />
  )
}

function DoorMarker3D({
  door,
  cellSizePx,
  pxPerFt,
}: {
  door: Door
  cellSizePx: number
  pxPerFt: number
}) {
  const cx = (door.col + 0.5) * cellSizePx
  const cy = (door.row + 0.5) * cellSizePx
  const { x, z } = planPxToWorldXZ(cx, cy, pxPerFt)
  const r = Math.max(0.12, (cellSizePx / pxPerFt) * 0.22)

  return (
    <mesh position={[x, Y_DOOR, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
      <ringGeometry args={[r * 0.45, r, 24]} />
      <meshStandardMaterial
        color="#38bdf8"
        emissive="#0ea5e9"
        emissiveIntensity={0.25}
        roughness={0.5}
        metalness={0.1}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export function FloorPlanOverlay3D({
  imageUrl,
  showFloorPlanImage,
  imageWidthPx,
  imageHeightPx,
  pxPerFt,
  cellSizePx,
  walls,
  rooms,
  doors,
}: {
  imageUrl: string | null
  showFloorPlanImage: boolean
  imageWidthPx: number
  imageHeightPx: number
  pxPerFt: number
  cellSizePx: number
  walls: Wall[]
  rooms: Room[]
  doors: Door[]
}) {
  const planWidthFt = imageWidthPx / pxPerFt
  const planDepthFt = imageHeightPx / pxPerFt

  const hasImage = Boolean(imageUrl && showFloorPlanImage && imageWidthPx > 0 && imageHeightPx > 0)

  return (
    <group>
      {hasImage && imageUrl && (
        <Suspense fallback={null}>
          <FloorPlanTextureMesh url={imageUrl} planWidthFt={planWidthFt} planDepthFt={planDepthFt} />
        </Suspense>
      )}

      <PlanPerimeterLine planWidthFt={planWidthFt} planDepthFt={planDepthFt} />

      {walls.map((w) => (
        <WallSegmentLine key={w.id} wall={w} pxPerFt={pxPerFt} />
      ))}

      {rooms.map((r) => (
        <RoomOutlineLine key={r.id} room={r} pxPerFt={pxPerFt} />
      ))}

      {doors.map((d) => (
        <DoorMarker3D key={d.id} door={d} cellSizePx={cellSizePx} pxPerFt={pxPerFt} />
      ))}
    </group>
  )
}
