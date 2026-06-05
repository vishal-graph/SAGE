import { useMemo } from 'react'
import type { ConnectionPoint, Door, Wall } from '../../../types'
import { useSigeStore } from '../../../store/useSigeStore'
import { planPxToWorldXZ } from '../planCoordinates'
import { WALL_DEFAULT_COLOR } from '../floor3DConstants'

export function DoorMarker3D({
  door,
  cellSizePx,
  pxPerFt,
  walls,
  connectionPoints,
  selected,
}: {
  door: Door
  cellSizePx: number
  pxPerFt: number
  walls: Wall[]
  connectionPoints: ConnectionPoint[]
  selected: boolean
}) {
  const selectedDoorId = useSigeStore((s) => s.selectedDoorId)
  const setSelectedDoorId = useSigeStore((s) => s.setSelectedDoorId)
  const setSelectedWallId = useSigeStore((s) => s.setSelectedWallId)
  const setSelectedFurnitureId = useSigeStore((s) => s.setSelectedFurnitureId)
  const setSelectedWindowId = useSigeStore((s) => s.setSelectedWindowId)

  const aNode = door.node_a_id ? connectionPoints.find((p) => p.id === door.node_a_id) : undefined
  const bNode = door.node_b_id ? connectionPoints.find((p) => p.id === door.node_b_id) : undefined
  const aWorld = aNode ? planPxToWorldXZ(aNode.x, aNode.y, pxPerFt) : null
  const bWorld = bNode ? planPxToWorldXZ(bNode.x, bNode.y, pxPerFt) : null
  const linkedPoint = door.node_id ? connectionPoints.find((p) => p.id === door.node_id) : undefined

  const cx = linkedPoint ? linkedPoint.x : (door.col + 0.5) * cellSizePx
  const cy = linkedPoint ? linkedPoint.y : (door.row + 0.5) * cellSizePx
  const center =
    aWorld && bWorld
      ? { x: (aWorld.x + bWorld.x) / 2, z: (aWorld.z + bWorld.z) / 2 }
      : planPxToWorldXZ(cx, cy, pxPerFt)

  const r = Math.max(0.12, (cellSizePx / pxPerFt) * 0.22)

  const bestWall = useMemo(() => {
    let best: { id: string; yaw: number; nx: number; nz: number; d: number; color: string } | null = null
    for (const wall of walls) {
      const a = planPxToWorldXZ(wall.x1, wall.y1, pxPerFt)
      const b = planPxToWorldXZ(wall.x2, wall.y2, pxPerFt)
      const vx = b.x - a.x
      const vz = b.z - a.z
      const len2 = vx * vx + vz * vz
      if (len2 < 1e-6) continue
      const t = Math.max(0, Math.min(1, ((center.x - a.x) * vx + (center.z - a.z) * vz) / len2))
      const px = a.x + vx * t
      const pz = a.z + vz * t
      const dx = center.x - px
      const dz = center.z - pz
      const d = Math.hypot(dx, dz)
      if (!best || d < best.d) {
        const yaw = Math.atan2(vz, vx)
        const nx = -Math.sin(yaw)
        const nz = Math.cos(yaw)
        best = { id: wall.id, yaw, nx, nz, d, color: wall.color ?? WALL_DEFAULT_COLOR }
      }
    }
    return best
  }, [walls, pxPerFt, center.x, center.z])

  const segYaw = aWorld && bWorld ? Math.atan2(bWorld.z - aWorld.z, bWorld.x - aWorld.x) : null
  const yaw = segYaw ?? bestWall?.yaw ?? 0
  const nx = bestWall?.nx ?? -Math.sin(yaw)
  const nz = bestWall?.nz ?? Math.cos(yaw)
  const segmentWidth = aWorld && bWorld ? Math.hypot(bWorld.x - aWorld.x, bWorld.z - aWorld.z) : 0
  const frameWidth = Math.max(0.7, segmentWidth > 0 ? segmentWidth : r * 2.6)
  const frameDepth = Math.max(0.08, r * 0.44)
  const hasTopLayer = Boolean(door.hasTopLayer)
  const frameHeight = hasTopLayer ? 8 : 7
  const jambWidth = Math.max(0.05, frameWidth * 0.08)
  const lintelHeight = hasTopLayer ? 0 : 0.12
  const clearOpeningWidth = frameWidth - jambWidth * 2
  const clearOpeningHeight = frameHeight - lintelHeight
  const leafThickness = Math.max(0.035, frameDepth * 0.45)
  // For node-based doors, fill the complete node-to-node span so no visible side gap remains.
  const leafWidth = Math.max(
    0.2,
    segmentWidth > 0 ? segmentWidth - 0.006 : clearOpeningWidth - Math.max(0.01, jambWidth * 0.08),
  )
  const topPanelHeight = hasTopLayer ? 1 : 0
  const leafHeight = hasTopLayer ? 7 : Math.max(0.5, clearOpeningHeight - 0.01)
  const topPanelCenterY = 7 + topPanelHeight / 2
  const doorOpenAngle = (door.isOpen ?? true) ? (door.swingMode === 'pull' ? Math.PI / 2.8 : -Math.PI / 2.8) : 0
  const frameStartX = center.x - Math.cos(yaw) * (frameWidth / 2)
  const frameStartZ = center.z - Math.sin(yaw) * (frameWidth / 2)
  const hingeInset = Math.max(0.006, jambWidth * 0.06)
  const hingeX = aWorld?.x ?? (frameStartX + Math.cos(yaw) * (jambWidth + hingeInset))
  const hingeZ = aWorld?.z ?? (frameStartZ + Math.sin(yaw) * (jambWidth + hingeInset))
  const pushOffset = frameDepth * 0.18
  const normalSign = door.swingMode === 'pull' ? -1 : 1
  const leafBaseX = hingeX + nx * pushOffset * normalSign
  const leafBaseZ = hingeZ + nz * pushOffset * normalSign
  const handleOffsetAlongLeaf = leafWidth * 0.38

  const handleSelectDoor = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (selectedDoorId === door.id) setSelectedDoorId(null)
    else setSelectedDoorId(door.id)
    setSelectedWallId(null)
    setSelectedFurnitureId(null)
    setSelectedWindowId(null)
  }

  const handleSelectTopWallLayer = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (bestWall?.id) setSelectedWallId(bestWall.id)
    else setSelectedWallId(null)
    setSelectedDoorId(null)
    setSelectedFurnitureId(null)
    setSelectedWindowId(null)
  }

  return (
    <group>
      <mesh
        position={[
          center.x - Math.cos(yaw) * (frameWidth / 2 - jambWidth / 2),
          frameHeight / 2,
          center.z - Math.sin(yaw) * (frameWidth / 2 - jambWidth / 2),
        ]}
        rotation={[0, -yaw, 0]}
        castShadow
        receiveShadow
        onClick={handleSelectDoor}
      >
        <boxGeometry args={[jambWidth, frameHeight, frameDepth]} />
        <meshStandardMaterial color="#7b5630" roughness={0.72} metalness={0.05} />
      </mesh>
      <mesh
        position={[
          center.x + Math.cos(yaw) * (frameWidth / 2 - jambWidth / 2),
          frameHeight / 2,
          center.z + Math.sin(yaw) * (frameWidth / 2 - jambWidth / 2),
        ]}
        rotation={[0, -yaw, 0]}
        castShadow
        receiveShadow
        onClick={handleSelectDoor}
      >
        <boxGeometry args={[jambWidth, frameHeight, frameDepth]} />
        <meshStandardMaterial color="#7b5630" roughness={0.72} metalness={0.05} />
      </mesh>
      {lintelHeight > 0 && (
        <mesh
          position={[center.x, frameHeight - lintelHeight / 2, center.z]}
          rotation={[0, -yaw, 0]}
          castShadow
          receiveShadow
          onClick={handleSelectDoor}
        >
          <boxGeometry args={[frameWidth, lintelHeight, frameDepth]} />
          <meshStandardMaterial color="#7b5630" roughness={0.72} metalness={0.05} />
        </mesh>
      )}
      {hasTopLayer && (
        <mesh
          position={[center.x, topPanelCenterY, center.z]}
          rotation={[0, -yaw, 0]}
          castShadow
          receiveShadow
          onClick={handleSelectTopWallLayer}
        >
          <boxGeometry args={[leafWidth, topPanelHeight, 0.5]} />
          <meshStandardMaterial color={bestWall?.color ?? WALL_DEFAULT_COLOR} roughness={0.66} metalness={0.04} />
        </mesh>
      )}
      <group position={[leafBaseX, leafHeight / 2, leafBaseZ]} rotation={[0, -yaw + doorOpenAngle, 0]} onClick={handleSelectDoor}>
        <mesh position={[leafWidth / 2, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[leafWidth, leafHeight, leafThickness]} />
          {door.material === 'glass' ? (
            <meshStandardMaterial color="#b7e8ff" roughness={0.08} metalness={0.02} transparent opacity={0.42} />
          ) : (
            <meshStandardMaterial color="#d5b28a" roughness={0.67} metalness={0.04} />
          )}
        </mesh>
        <mesh position={[leafWidth / 2 - handleOffsetAlongLeaf, 0.0, leafThickness * 0.58]} castShadow>
          <sphereGeometry args={[0.03, 14, 12]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
      {selected && (
        <mesh position={[center.x, frameHeight / 2, center.z]} rotation={[0, -yaw, 0]}>
          <boxGeometry args={[frameWidth + 0.04, frameHeight + 0.04, frameDepth + 0.04]} />
          <meshBasicMaterial color="#2563eb" wireframe transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

