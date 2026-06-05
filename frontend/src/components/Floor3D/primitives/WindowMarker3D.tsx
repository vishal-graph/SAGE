import * as THREE from 'three'
import type { ConnectionPoint, Window } from '../../../types'
import { useSigeStore } from '../../../store/useSigeStore'
import { planPxToWorldXZ } from '../planCoordinates'

export function WindowMarker3D({
  item,
  pxPerFt,
  connectionPoints,
  selected,
}: {
  item: Window
  pxPerFt: number
  connectionPoints: ConnectionPoint[]
  selected: boolean
}) {
  const selectedWindowId = useSigeStore((s) => s.selectedWindowId)
  const setSelectedWindowId = useSigeStore((s) => s.setSelectedWindowId)
  const setSelectedDoorId = useSigeStore((s) => s.setSelectedDoorId)
  const setSelectedWallId = useSigeStore((s) => s.setSelectedWallId)
  const setSelectedFurnitureId = useSigeStore((s) => s.setSelectedFurnitureId)

  const aNode = item.node_a_id ? connectionPoints.find((p) => p.id === item.node_a_id) : undefined
  const bNode = item.node_b_id ? connectionPoints.find((p) => p.id === item.node_b_id) : undefined
  if (!aNode || !bNode) return null

  const a = planPxToWorldXZ(aNode.x, aNode.y, pxPerFt)
  const b = planPxToWorldXZ(bNode.x, bNode.y, pxPerFt)
  const centerX = (a.x + b.x) / 2
  const centerZ = (a.z + b.z) / 2
  const yaw = Math.atan2(b.z - a.z, b.x - a.x)
  const nx = -Math.sin(yaw)
  const nz = Math.cos(yaw)
  const width = Math.max(0.4, Math.hypot(b.x - a.x, b.z - a.z) - 0.01)
  const sill = Math.max(0.2, Number(item.sillHeightFt ?? 3))
  const h = Math.max(0.5, Number(item.heightFt ?? 4))
  const frameDepth = Math.max(0.12, Number(item.frameDepthFt ?? 0.5))
  const frameThickness = Math.max(0.04, Number(item.frameThicknessFt ?? 0.12))
  const glassWidth = Math.max(0.2, width - frameThickness * 2)
  const glassHeight = Math.max(0.2, h - frameThickness * 2)
  const glassPaneDepth = 0.02
  const glassFaceOffset = frameDepth / 2 + 0.012
  const sideX = width / 2 - frameThickness / 2
  const topY = h / 2 - frameThickness / 2

  // Keep the window centered in wall thickness so it's visible from both sides.
  const fx = centerX
  const fz = centerZ

  const glassColor = item.material === 'frosted' ? '#dbeafe' : item.material === 'tinted' ? '#7dd3fc' : '#bfdbfe'
  const glassOpacity = item.material === 'frosted' ? 0.7 : item.material === 'tinted' ? 0.45 : 0.35

  const onSelect = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (selectedWindowId === item.id) setSelectedWindowId(null)
    else setSelectedWindowId(item.id)
    setSelectedDoorId(null)
    setSelectedWallId(null)
    setSelectedFurnitureId(null)
  }

  return (
    <group onClick={onSelect}>
      <mesh
        position={[fx - Math.cos(yaw) * sideX, sill + h / 2, fz - Math.sin(yaw) * sideX]}
        rotation={[0, -yaw, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[frameThickness, h, frameDepth]} />
        <meshStandardMaterial color="#7b5630" roughness={0.72} metalness={0.05} />
      </mesh>
      <mesh
        position={[fx + Math.cos(yaw) * sideX, sill + h / 2, fz + Math.sin(yaw) * sideX]}
        rotation={[0, -yaw, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[frameThickness, h, frameDepth]} />
        <meshStandardMaterial color="#7b5630" roughness={0.72} metalness={0.05} />
      </mesh>
      <mesh position={[fx, sill + h / 2 + topY, fz]} rotation={[0, -yaw, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, frameThickness, frameDepth]} />
        <meshStandardMaterial color="#7b5630" roughness={0.72} metalness={0.05} />
      </mesh>
      <mesh position={[fx, sill + h / 2 - topY, fz]} rotation={[0, -yaw, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, frameThickness, frameDepth]} />
        <meshStandardMaterial color="#7b5630" roughness={0.72} metalness={0.05} />
      </mesh>
      <mesh position={[fx + nx * glassFaceOffset, sill + h / 2, fz + nz * glassFaceOffset]} rotation={[0, -yaw, 0]}>
        <boxGeometry args={[glassWidth, glassHeight, glassPaneDepth]} />
        <meshStandardMaterial
          color={glassColor}
          roughness={item.material === 'frosted' ? 0.28 : 0.08}
          metalness={0.02}
          transparent
          opacity={item.material === 'frosted' ? 0.88 : glassOpacity}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[fx - nx * glassFaceOffset, sill + h / 2, fz - nz * glassFaceOffset]} rotation={[0, -yaw, 0]}>
        <boxGeometry args={[glassWidth, glassHeight, glassPaneDepth]} />
        <meshStandardMaterial
          color={glassColor}
          roughness={item.material === 'frosted' ? 0.28 : 0.08}
          metalness={0.02}
          transparent
          opacity={item.material === 'frosted' ? 0.88 : glassOpacity}
          side={THREE.DoubleSide}
        />
      </mesh>
      {selected && (
        <mesh position={[fx, sill + h / 2, fz]} rotation={[0, -yaw, 0]}>
          <boxGeometry args={[width + 0.03, h + 0.03, frameDepth + 0.03]} />
          <meshBasicMaterial color="#2563eb" wireframe transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

