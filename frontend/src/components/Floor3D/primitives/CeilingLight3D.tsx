import { useMemo } from 'react'
import * as THREE from 'three'
import type { Ceiling, CeilingLight } from '../../../types'
import { useSigeStore } from '../../../store/useSigeStore'

function kelvinToRgb(tempK: number) {
  // Fast approximation good enough for UI lighting.
  const t = Math.max(1000, Math.min(12000, tempK)) / 100
  let r = 255
  let g = 255
  let b = 255

  if (t <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(t) - 161.1195681661
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492)
    b = 255
  }

  const clamp = (v: number) => Math.max(0, Math.min(255, v)) / 255
  return new THREE.Color(clamp(r), clamp(g), clamp(b))
}

export function CeilingLight3D({
  item,
  ceiling,
  pxPerFt,
  selected,
}: {
  item: CeilingLight
  ceiling: Ceiling | undefined
  pxPerFt: number
  selected: boolean
}) {
  const setSelectedLightId = useSigeStore((s) => s.setSelectedLightId)
  const setSelectedCeilingId = useSigeStore((s) => s.setSelectedCeilingId)
  const setSelectedDoorId = useSigeStore((s) => s.setSelectedDoorId)
  const setSelectedWallId = useSigeStore((s) => s.setSelectedWallId)
  const setSelectedWindowId = useSigeStore((s) => s.setSelectedWindowId)
  const setSelectedFurnitureId = useSigeStore((s) => s.setSelectedFurnitureId)

  const cx = item.x / pxPerFt
  const cz = item.y / pxPerFt
  const ceilingY = Math.max(0.5, Number(ceiling?.heightFt ?? 8))
  const drop = Math.max(0, Number(item.dropFt ?? (item.type === 'pendant' ? 1.5 : 0.15)))
  const y = item.type === 'pendant' ? ceilingY - drop : ceilingY - 0.05

  const intensity = Math.max(0, Math.min(1, Number(item.intensity ?? 0.65)))
  const colorTempK = Math.max(1500, Math.min(8000, Number(item.colorTempK ?? 4000)))
  const lightColor = useMemo(() => kelvinToRgb(colorTempK), [colorTempK])

  const onSelect = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    setSelectedLightId(selected ? null : item.id)
    setSelectedCeilingId(item.ceilingId)
    setSelectedDoorId(null)
    setSelectedWallId(null)
    setSelectedWindowId(null)
    setSelectedFurnitureId(null)
  }

  return (
    <group position={[cx, y, cz]} onClick={onSelect}>
      {item.type === 'pendant' && (
        <mesh position={[0, (ceilingY - y) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.01, 0.01, Math.max(0.05, ceilingY - y), 10]} />
          <meshStandardMaterial color="#111827" roughness={0.9} metalness={0.1} />
        </mesh>
      )}
      <mesh castShadow>
        {item.type === 'spot' ? (
          <coneGeometry args={[0.08, 0.12, 14]} />
        ) : item.type === 'pendant' ? (
          <cylinderGeometry args={[0.07, 0.1, 0.12, 16]} />
        ) : (
          <cylinderGeometry args={[0.09, 0.09, 0.04, 18]} />
        )}
        <meshStandardMaterial color="#f8fafc" roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.03, 0]}>
        <sphereGeometry args={[0.04, 12, 10]} />
        <meshStandardMaterial
          color={lightColor}
          emissive={lightColor}
          emissiveIntensity={item.on ? 0.8 : 0.05}
          transparent
          opacity={0.85}
        />
      </mesh>

      {item.on && (
        <pointLight
          color={lightColor}
          intensity={0.9 * intensity}
          distance={6}
          decay={2}
          position={[0, -0.05, 0]}
        />
      )}

      {selected && (
        <mesh>
          <sphereGeometry args={[0.18, 12, 10]} />
          <meshBasicMaterial color="#2563eb" wireframe transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

