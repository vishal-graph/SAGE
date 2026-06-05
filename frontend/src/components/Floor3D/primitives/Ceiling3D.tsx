import { useMemo } from 'react'
import * as THREE from 'three'
import type { Ceiling } from '../../../types'
import { useSigeStore } from '../../../store/useSigeStore'

function worldShapeFromPlanPolygon(polygon: [number, number][], pxPerFt: number) {
  const pts = polygon.map(([px, py]) => new THREE.Vector2(px / pxPerFt, py / pxPerFt))
  const shape = new THREE.Shape()
  if (pts.length > 0) shape.moveTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i]!.x, pts[i]!.y)
  shape.closePath()
  return shape
}

function centroidWorld(polygon: [number, number][], pxPerFt: number) {
  let x = 0
  let z = 0
  for (const [px, py] of polygon) {
    x += px / pxPerFt
    z += py / pxPerFt
  }
  const n = Math.max(1, polygon.length)
  return { x: x / n, z: z / n }
}

function insetPolygonByScale(polygon: [number, number][], pxPerFt: number, insetFt: number): [number, number][] {
  if (polygon.length < 3) return polygon
  const c = centroidWorld(polygon, pxPerFt)
  const dists = polygon.map(([px, py]) => Math.hypot(px / pxPerFt - c.x, py / pxPerFt - c.z))
  const avg = dists.reduce((s, v) => s + v, 0) / Math.max(1, dists.length)
  const k = avg > 1e-6 ? Math.max(0.08, 1 - insetFt / avg) : 1
  return polygon.map(([px, py]) => {
    const wx = px / pxPerFt
    const wz = py / pxPerFt
    const nx = c.x + (wx - c.x) * k
    const nz = c.z + (wz - c.z) * k
    return [nx * pxPerFt, nz * pxPerFt]
  })
}

export function Ceiling3D({ item, pxPerFt, selected }: { item: Ceiling; pxPerFt: number; selected: boolean }) {
  const setSelectedCeilingId = useSigeStore((s) => s.setSelectedCeilingId)
  const setSelectedLightId = useSigeStore((s) => s.setSelectedLightId)
  const setSelectedDoorId = useSigeStore((s) => s.setSelectedDoorId)
  const setSelectedWallId = useSigeStore((s) => s.setSelectedWallId)
  const setSelectedWindowId = useSigeStore((s) => s.setSelectedWindowId)
  const setSelectedFurnitureId = useSigeStore((s) => s.setSelectedFurnitureId)

  const heightFt = Math.max(0.5, Number(item.heightFt ?? 8))
  const thicknessFt = Math.max(0.02, Number(item.thicknessFt ?? 0.5))
  const dropFt = Math.max(0, Number(item.dropFt ?? 0))

  const baseShape = useMemo(() => worldShapeFromPlanPolygon(item.polygon, pxPerFt), [item.polygon, pxPerFt])
  const baseGeo = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(baseShape, { depth: thicknessFt, bevelEnabled: false, steps: 1 })
    // Rotate so plan space (shape XY) maps to world XZ, and extrusion (+Z) becomes world -Y (down).
    // This keeps the same Z direction convention as walls/windows (positive plan Y -> positive world Z).
    geo.rotateX(Math.PI / 2)
    return geo
  }, [baseShape, thicknessFt])

  const insetPoly = useMemo(() => insetPolygonByScale(item.polygon, pxPerFt, 0.5), [item.polygon, pxPerFt])
  const insetShape = useMemo(() => worldShapeFromPlanPolygon(insetPoly, pxPerFt), [insetPoly, pxPerFt])
  const insetGeo = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(insetShape, { depth: Math.max(0.02, thicknessFt * 0.6), bevelEnabled: false, steps: 1 })
    geo.rotateX(Math.PI / 2)
    return geo
  }, [insetShape, thicknessFt])

  const onSelect = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    setSelectedCeilingId(selected ? null : item.id)
    setSelectedLightId(null)
    setSelectedDoorId(null)
    setSelectedWallId(null)
    setSelectedWindowId(null)
    setSelectedFurnitureId(null)
  }

  if (item.type === 'open') {
    const pts = item.polygon.map(([px, py]) => new THREE.Vector3(px / pxPerFt, heightFt, py / pxPerFt))
    if (pts.length > 0) pts.push(pts[0]!.clone())
    return (
      <group onClick={onSelect}>
        {pts.length >= 3 && (
          <line>
            <bufferGeometry setFromPoints={pts} />
            <lineBasicMaterial color={selected ? '#2563eb' : '#64748b'} transparent opacity={0.85} />
          </line>
        )}
      </group>
    )
  }

  const color = item.color ?? '#e2e8f0'
  // `ExtrudeGeometry` is created in 2D and extruded, then rotated so its depth points down (-Y).
  // Place the mesh so the slab bottom sits exactly at `heightFt`.
  const yBase = heightFt + thicknessFt

  return (
    <group onClick={onSelect}>
      <mesh position={[0, yBase, 0]} geometry={baseGeo} receiveShadow castShadow>
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.02} side={THREE.DoubleSide} />
      </mesh>

      {(item.type === 'false' || item.type === 'tray') && dropFt > 0 && (
        <mesh
          position={[0, item.type === 'false' ? yBase - dropFt : yBase + dropFt, 0]}
          geometry={insetGeo}
          receiveShadow
          castShadow
        >
          <meshStandardMaterial color={color} roughness={0.92} metalness={0.02} side={THREE.DoubleSide} />
        </mesh>
      )}

      {selected && (
        <mesh position={[0, yBase + thicknessFt / 2, 0]} geometry={baseGeo}>
          <meshBasicMaterial color="#2563eb" wireframe transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

