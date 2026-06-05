import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Ceiling, Room, SigeLight } from '../../../types'
import { useSigeStore } from '../../../store/useSigeStore'
import { kelvinToRGB } from '../../../utils/lightingEngine'

function kelvinToThreeColorObj(tempK: number) {
  const [r, g, b] = kelvinToRGB(tempK)
  return new THREE.Color(r / 255, g / 255, b / 255)
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

/**
 * With physicallyCorrectLights=true, SpotLight/PointLight intensity is in candela (cd).
 * Convert luminous flux (lumens) into luminous intensity (cd).
 */
function lumensToCandelaSpot(lumens: number, dim01: number, halfAngleRad: number) {
  const flux = Math.max(0, Number(lumens)) * clamp01(dim01)
  const a = Math.max(0.001, Math.min(Math.PI / 2 - 0.001, halfAngleRad))
  const omega = 2 * Math.PI * (1 - Math.cos(a)) // solid angle
  return omega > 0 ? flux / omega : 0
}

function lumensToCandelaPoint(lumens: number, dim01: number) {
  const flux = Math.max(0, Number(lumens)) * clamp01(dim01)
  return flux / (4 * Math.PI)
}

function lumensToRectAreaIntensity(lumens: number, dim01: number, areaM2: number) {
  const flux = Math.max(0, Number(lumens)) * clamp01(dim01)
  const a = Math.max(0.0001, areaM2)
  // Three's rectAreaLight uses "intensity" as luminance-like term; this gives a stable mapping.
  return flux / a / 200
}

export function LightsOverlay3D({
  lights,
  pxPerFt,
  selectedLightId,
  ceilings,
  rooms,
}: {
  lights: SigeLight[]
  pxPerFt: number
  selectedLightId: string | null
  ceilings: Ceiling[]
  rooms: Room[]
}) {
  const setSelectedLightId = useSigeStore((s) => s.setSelectedLightId)
  const setSelectedCeilingId = useSigeStore((s) => s.setSelectedCeilingId)
  const setSelectedDoorId = useSigeStore((s) => s.setSelectedDoorId)
  const setSelectedWallId = useSigeStore((s) => s.setSelectedWallId)
  const setSelectedWindowId = useSigeStore((s) => s.setSelectedWindowId)
  const setSelectedFurnitureId = useSigeStore((s) => s.setSelectedFurnitureId)

  const lightColors = useMemo(() => {
    const m = new Map<string, THREE.Color>()
    for (const l of lights) m.set(l.id, kelvinToThreeColorObj(l.colorTempK))
    return m
  }, [lights])

  const ceilingHeightByRoomId = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of ceilings) {
      if (!c.roomId) continue
      const h = Math.max(0.5, Number(c.heightFt ?? 8))
      if (!Number.isFinite(h)) continue
      m.set(c.roomId, h)
    }
    return m
  }, [ceilings])

  const roomBoundsById = useMemo(() => {
    const m = new Map<string, { minX: number; maxX: number; minY: number; maxY: number }>()
    for (const r of rooms) {
      if (!r.polygon || r.polygon.length < 3) continue
      let minX = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY
      let minY = Number.POSITIVE_INFINITY
      let maxY = Number.NEGATIVE_INFINITY
      for (const [x, y] of r.polygon) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
      m.set(r.id, { minX, maxX, minY, maxY })
    }
    return m
  }, [rooms])

  return (
    <group>
      {/* Light containment: invisible occluder walls around each room polygon.
          This keeps light from spilling through openings / hidden walls. */}
      {rooms
        .filter((r) => Array.isArray(r.polygon) && r.polygon.length >= 3)
        .map((r) => {
          const ceilingH = ceilingHeightByRoomId.get(r.id) ?? 8
          const height = Math.max(0.5, Number(ceilingH))
          const thick = 0.12
          const pts = r.polygon
          return (
            <group key={`room-occl-${r.id}`}>
              {pts.map((p, i) => {
                const q = pts[(i + 1) % pts.length]!
                const ax = p[0] / pxPerFt
                const az = p[1] / pxPerFt
                const bx = q[0] / pxPerFt
                const bz = q[1] / pxPerFt
                const dx = bx - ax
                const dz = bz - az
                const len = Math.hypot(dx, dz)
                if (!Number.isFinite(len) || len <= 0.01) return null
                const cx = (ax + bx) / 2
                const cz = (az + bz) / 2
                const yaw = Math.atan2(dz, dx)
                return (
                  <mesh
                    key={`seg-${i}`}
                    position={[cx, height / 2, cz]}
                    rotation={[0, -yaw, 0]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[len, height, thick]} />
                    <meshStandardMaterial transparent opacity={0} colorWrite={false} />
                  </mesh>
                )
              })}
            </group>
          )
        })}

      {lights
        .filter((l) => !l.hidden)
        .map((l) => {
          const selected = l.id === selectedLightId
          const cx = l.x / pxPerFt
          const cz = l.y / pxPerFt
          const ceilingH = ceilingHeightByRoomId.get(l.roomId)
          const y = Math.max(
            0.5,
            Math.min(Math.max(0.5, Number(l.mountHeightFt)), ceilingH != null ? ceilingH - 0.06 : Number.POSITIVE_INFINITY),
          )
          const c = lightColors.get(l.id) ?? new THREE.Color(1, 1, 1)
          const dim01 = clamp01(Number(l.dimLevel) / 100)
          const beam = Math.max(1, Math.min(179, Number(l.beamAngleDeg)))
          const spotAngle = (beam * Math.PI) / 180 / 2
          const spotCd = lumensToCandelaSpot(l.lumens, dim01, spotAngle)
          const pointCd = lumensToCandelaPoint(l.lumens, dim01)

          // Limit influence to the owning room (prevents "cross-room" lighting).
          const rb = roomBoundsById.get(l.roomId)
          const roomDiagFt =
            rb != null
              ? Math.hypot((rb.maxX - rb.minX) / pxPerFt, (rb.maxY - rb.minY) / pxPerFt)
              : 30
          const distance = Math.max(6, Math.min(80, roomDiagFt * 1.15))

          const targetRef = useRef<THREE.Object3D>(null)

          const onSelect = (e: { stopPropagation: () => void }) => {
            e.stopPropagation()
            setSelectedLightId(selected ? null : l.id)
            setSelectedCeilingId(null)
            setSelectedDoorId(null)
            setSelectedWallId(null)
            setSelectedWindowId(null)
            setSelectedFurnitureId(null)
          }

          return (
            <group key={l.id} position={[cx, y, cz]} onClick={onSelect}>
              <object3D ref={targetRef} position={[0, -1, 0]} />
              {/* Fixture body */}
              <mesh castShadow>
                {l.fixtureType === 'panel' ? (
                  <boxGeometry args={[0.55, 0.03, 0.55]} />
                ) : l.fixtureType === 'pendant' || l.fixtureType === 'chandelier' ? (
                  <cylinderGeometry args={[0.07, 0.1, 0.12, 16]} />
                ) : l.fixtureType === 'track' ? (
                  <boxGeometry args={[0.18, 0.05, 0.09]} />
                ) : l.fixtureType === 'sconce' ? (
                  <boxGeometry args={[0.12, 0.08, 0.06]} />
                ) : (
                  <cylinderGeometry args={[0.09, 0.09, 0.04, 18]} />
                )}
                <meshStandardMaterial color="#f8fafc" roughness={0.6} metalness={0.05} />
              </mesh>

              {/* Glow */}
              {l.fixtureType === 'panel' ? (
                <mesh position={[0, -0.02, 0]}>
                  <planeGeometry args={[0.5, 0.5]} />
                  <meshStandardMaterial
                    color={c}
                    emissive={c}
                    emissiveIntensity={l.isOn ? 1.2 : 0.08}
                    transparent
                    opacity={0.92}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              ) : (
                <mesh position={[0, -0.03, 0]}>
                  <sphereGeometry args={[0.04, 12, 10]} />
                  <meshStandardMaterial
                    color={c}
                    emissive={c}
                    emissiveIntensity={l.isOn ? 0.9 : 0.06}
                    transparent
                    opacity={0.86}
                  />
                </mesh>
              )}

              {/* Actual light */}
              {l.isOn && (
                <>
                  {(l.fixtureType === 'downlight' || l.fixtureType === 'pendant' || l.fixtureType === 'chandelier') && (
                    <spotLight
                      color={c}
                      intensity={spotCd}
                      distance={distance}
                      angle={spotAngle}
                      penumbra={0.35}
                      decay={2}
                      position={[0, -0.02, 0]}
                      target={targetRef.current ?? undefined}
                      castShadow
                      shadow-mapSize-width={1024}
                      shadow-mapSize-height={1024}
                      shadow-bias={-0.0002}
                    />
                  )}
                  {l.fixtureType === 'panel' && (
                    <rectAreaLight
                      color={c}
                      intensity={lumensToRectAreaIntensity(l.lumens, dim01, 0.25)}
                      width={2.2}
                      height={2.2}
                      position={[0, -0.03, 0]}
                      rotation={[-Math.PI / 2, 0, 0]}
                    />
                  )}
                  {l.fixtureType === 'cove' && (
                    <pointLight
                      color={c}
                      intensity={0.35 * pointCd}
                      distance={distance}
                      decay={2}
                      position={[0, -0.02, 0]}
                      castShadow
                    />
                  )}
                </>
              )}

              {selected && (
                <mesh>
                  <sphereGeometry args={[0.18, 12, 10]} />
                  <meshBasicMaterial color="#2563eb" wireframe transparent opacity={0.45} depthWrite={false} />
                </mesh>
              )}
            </group>
          )
        })}
    </group>
  )
}

