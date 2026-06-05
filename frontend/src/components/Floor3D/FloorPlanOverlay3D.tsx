import { useMemo } from 'react'
import type { ConnectionPoint, Door, Room, Wall, Window } from '../../types'
import { useSigeStore } from '../../store/useSigeStore'
import { useThree } from '@react-three/fiber'
import { FloorPlanTextureMesh3D } from './primitives/FloorPlanTextureMesh3D'
import { PlanPerimeterLine3D } from './primitives/PlanPerimeterLine3D'
import { WallSegment3D } from './primitives/WallSegment3D'
import { RoomOutlineLine3D } from './primitives/RoomOutlineLine3D'
import { DoorMarker3D } from './primitives/DoorMarker3D'
import { WindowMarker3D } from './primitives/WindowMarker3D'
import { Ceiling3D } from './primitives/Ceiling3D'
import { LightsOverlay3D } from './primitives/LightsOverlay3D'
import { ViewPosts3D } from './primitives/ViewPosts3D'
import { SnapIndicator3D } from './SnapIndicator3D'

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
  windows,
  ceilings,
  lights,
  connectionPoints,
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
  windows: Window[]
  ceilings: import('../../types').Ceiling[]
  lights: import('../../types').SigeLight[]
  connectionPoints: ConnectionPoint[]
}) {
  const selectedWallIds = useSigeStore((s) => s.selectedWallIds)
  const selectedDoorId = useSigeStore((s) => s.selectedDoorId)
  const selectedWindowId = useSigeStore((s) => s.selectedWindowId)
  const showWalls = useSigeStore((s) => s.showWalls)
  const showDoors = useSigeStore((s) => s.showDoors)
  const showWindows = useSigeStore((s) => s.showWindows)
  const showCeilings = useSigeStore((s) => s.showCeilings)
  const showLights = useSigeStore((s) => s.showLights)
  const selectedCeilingId = useSigeStore((s) => s.selectedCeilingId)
  const selectedLightId = useSigeStore((s) => s.selectedLightId)
  const forceShowCeilings = useSigeStore((s) => s.forceShowCeilings)
  const viewPosts = useSigeStore((s) => (s as any).viewPosts as import('../../types').ViewPost[])
  const wallSnapIndicator = useSigeStore((s) => s.wallSnapIndicator)
  const { camera } = useThree()
  const planWidthFt = imageWidthPx / pxPerFt
  const planDepthFt = imageHeightPx / pxPerFt
  const visibleWalls = useMemo(() => walls.filter((w) => !w.hidden), [walls])

  const hasImage = Boolean(imageUrl && showFloorPlanImage && imageWidthPx > 0 && imageHeightPx > 0)
  const autoHideCeilings = !forceShowCeilings && camera.position.y < 6 && !selectedCeilingId

  return (
    <group>
      {hasImage && imageUrl && <FloorPlanTextureMesh3D url={imageUrl} planWidthFt={planWidthFt} planDepthFt={planDepthFt} />}

      <PlanPerimeterLine3D planWidthFt={planWidthFt} planDepthFt={planDepthFt} />

      {showWalls ? (
        visibleWalls.map((w) => (
        <WallSegment3D
          key={w.id}
          wall={w}
          pxPerFt={pxPerFt}
          selected={selectedWallIds.includes(w.id)}
          windows={windows}
          connectionPoints={connectionPoints}
        />
      ))
      ) : (
        // Keep invisible shadow-occluder walls so lights remain contained even when walls are hidden.
        walls.map((w) => (
          <WallSegment3D
            key={`shadow-${w.id}`}
            wall={w}
            pxPerFt={pxPerFt}
            selected={false}
            windows={windows}
            connectionPoints={connectionPoints}
            shadowOnly
          />
        ))
      )}

      {rooms.map((r) => (
        <RoomOutlineLine3D key={r.id} room={r} pxPerFt={pxPerFt} />
      ))}

      {showDoors &&
        doors.map((d) => (
        <DoorMarker3D
          key={d.id}
          door={d}
          cellSizePx={cellSizePx}
          pxPerFt={pxPerFt}
          walls={visibleWalls}
          connectionPoints={connectionPoints}
          selected={selectedDoorId === d.id}
        />
      ))}
      {showWindows &&
        windows.map((w) => (
        <WindowMarker3D
          key={w.id}
          item={w}
          pxPerFt={pxPerFt}
          connectionPoints={connectionPoints}
          selected={selectedWindowId === w.id}
        />
      ))}

      {showCeilings &&
        !autoHideCeilings &&
        ceilings
          .filter((c) => !c.hidden)
          .map((c) => (
            <Ceiling3D
              key={c.id}
              item={c}
              pxPerFt={pxPerFt}
              selected={selectedCeilingId === c.id}
            />
          ))}

      {showLights && (
        <LightsOverlay3D
          lights={lights}
          pxPerFt={pxPerFt}
          selectedLightId={selectedLightId}
          ceilings={ceilings}
          rooms={rooms}
        />
      )}

      {viewPosts.length > 0 && <ViewPosts3D posts={viewPosts} pxPerFt={pxPerFt} />}
      {wallSnapIndicator?.snapped && (
        <SnapIndicator3D planX={wallSnapIndicator.planX} planY={wallSnapIndicator.planY} pxPerFt={pxPerFt} />
      )}
    </group>
  )
}
