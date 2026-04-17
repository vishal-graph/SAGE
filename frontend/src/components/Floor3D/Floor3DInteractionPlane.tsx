import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSigeStore } from '../../store/useSigeStore'
import type { GridInputs } from '../../utils/gridEngine'
import { isPlacementValid } from '../../utils/gridEngine'
import { createFurnitureFromPreset } from '../../utils/furnitureLib'
import { intersectFloorXZ } from './floorPointer'
import { worldFeetToAnchorCell } from './worldFromFurniture'

const HIT_Y = 0.06

/**
 * Invisible plane above the grid/plan graphics so clicks reach “empty floor”.
 * - Select tool: click clears furniture selection.
 * - Place furniture + pending preset: click places (same rules as 2D).
 */
export function Floor3DInteractionPlane({
  widthFt,
  depthFt,
  cx,
  cz,
  pxPerFt,
  cellSizePx,
  gridInputs,
  planScaleFactor,
  readOnly = false,
}: {
  widthFt: number
  depthFt: number
  cx: number
  cz: number
  pxPerFt: number | null
  cellSizePx: number
  gridInputs: GridInputs | null
  planScaleFactor?: number
  readOnly?: boolean
}) {
  const { camera, gl } = useThree()
  const tool = useSigeStore((s) => s.tool)
  const pendingFurniturePreset = useSigeStore((s) => s.pendingFurniturePreset)
  const addFurniture = useSigeStore((s) => s.addFurniture)
  const setPendingPreset = useSigeStore((s) => s.setPendingPreset)
  const setTool = useSigeStore((s) => s.setTool)
  const setSelected = useSigeStore((s) => s.setSelectedFurnitureId)

  const canPlace =
    tool === 'placeFurniture' &&
    pendingFurniturePreset != null &&
    gridInputs != null &&
    pxPerFt != null &&
    pxPerFt > 0 &&
    cellSizePx > 0

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[cx, HIT_Y, cz]}
      renderOrder={8}
      onClick={(e) => {
        e.stopPropagation()
        if (readOnly) return
        const hit = new THREE.Vector3()
        if (!intersectFloorXZ(e.nativeEvent.clientX, e.nativeEvent.clientY, camera, gl.domElement, hit)) {
          return
        }

        if (canPlace && pxPerFt != null) {
          const [c, r] = worldFeetToAnchorCell(hit.x, hit.z, pxPerFt, cellSizePx)
          const item = createFurnitureFromPreset(
            pendingFurniturePreset,
            c,
            r,
            planScaleFactor != null ? { planScaleFactor } : undefined,
          )
          if (isPlacementValid(item, null, gridInputs, { allowFurnitureOverlap: true })) {
            addFurniture(item)
            setPendingPreset(null)
            setTool('select')
          }
          return
        }

        if (tool === 'select') {
          setSelected(null)
        }
      }}
    >
      <planeGeometry args={[widthFt * 1.6, depthFt * 1.6]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
