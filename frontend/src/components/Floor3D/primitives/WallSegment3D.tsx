import { useMemo } from 'react'
import type { ConnectionPoint, Wall, Window } from '../../../types'
import { useSigeStore } from '../../../store/useSigeStore'
import { planPxToWorldXZ } from '../planCoordinates'
import { WALL_DEFAULT_COLOR, WALL_HEIGHT_FT, WALL_THICKNESS_FT } from '../floor3DConstants'
import { pickWindowOrWallOnWallClick } from '../selection3D'

export function WallSegment3D({
  wall,
  pxPerFt,
  selected,
  windows,
  connectionPoints,
  shadowOnly = false,
}: {
  wall: Wall
  pxPerFt: number
  selected: boolean
  windows: Window[]
  connectionPoints: ConnectionPoint[]
  shadowOnly?: boolean
}) {
  const setSelectedWallId = useSigeStore((s) => s.setSelectedWallId)
  const toggleSelectedWallId = useSigeStore((s) => s.toggleSelectedWallId)
  const selectedWallIds = useSigeStore((s) => s.selectedWallIds)
  const setSelectedFurnitureId = useSigeStore((s) => s.setSelectedFurnitureId)
  const setSelectedDoorId = useSigeStore((s) => s.setSelectedDoorId)
  const setSelectedWindowId = useSigeStore((s) => s.setSelectedWindowId)

  const a = useMemo(() => planPxToWorldXZ(wall.x1, wall.y1, pxPerFt), [wall.x1, wall.y1, pxPerFt])
  const b = useMemo(() => planPxToWorldXZ(wall.x2, wall.y2, pxPerFt), [wall.x2, wall.y2, pxPerFt])

  const dx = b.x - a.x
  const dz = b.z - a.z
  const lengthFt = Math.hypot(dx, dz)
  if (!Number.isFinite(lengthFt) || lengthFt <= 0.01) return null

  const centerX = (a.x + b.x) / 2
  const centerZ = (a.z + b.z) / 2
  const yaw = Math.atan2(dz, dx)

  const wallThicknessFt = Math.max(0.05, Number(wall.thicknessFt ?? WALL_THICKNESS_FT))
  const wallHeightFt = Math.max(0.5, Number(wall.heightFt ?? WALL_HEIGHT_FT))

  const onClick = (e: any) => {
    if (shadowOnly) return
    e.stopPropagation()

    const pick = pickWindowOrWallOnWallClick({
      clickWorld: e.point,
      wallId: wall.id,
      wallAWorld: a,
      wallBWorld: b,
      windows,
      connectionPoints,
      pxPerFt,
    })

    if (pick.kind === 'window') {
      setSelectedWindowId(pick.id)
      setSelectedWallId(null)
      setSelectedDoorId(null)
      setSelectedFurnitureId(null)
      return
    }

    if (e.nativeEvent.ctrlKey || e.nativeEvent.metaKey) toggleSelectedWallId(wall.id)
    else if (selectedWallIds.length === 1 && selectedWallIds[0] === wall.id) setSelectedWallId(null)
    else setSelectedWallId(wall.id)

    setSelectedFurnitureId(null)
    setSelectedDoorId(null)
    setSelectedWindowId(null)
  }

  return (
    <group onClick={onClick}>
      <mesh position={[centerX, wallHeightFt / 2, centerZ]} rotation={[0, -yaw, 0]} castShadow receiveShadow>
        <boxGeometry args={[lengthFt, wallHeightFt, wallThicknessFt]} />
        {shadowOnly ? (
          <meshStandardMaterial transparent opacity={0} colorWrite={false} />
        ) : (
          <meshStandardMaterial
            color={selected ? '#dc2626' : wall.color ?? WALL_DEFAULT_COLOR}
            roughness={0.82}
            metalness={0.04}
          />
        )}
      </mesh>
      {!shadowOnly && selected && (
        <mesh position={[centerX, wallHeightFt / 2, centerZ]} rotation={[0, -yaw, 0]}>
          <boxGeometry args={[lengthFt + 0.03, wallHeightFt + 0.03, wallThicknessFt + 0.03]} />
          <meshBasicMaterial color="#1d4ed8" wireframe transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

