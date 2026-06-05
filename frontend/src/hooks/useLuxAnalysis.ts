import { useEffect, useMemo } from 'react'
import { useSigeStore } from '../store/useSigeStore'
import { computeRoomLuxGrid } from '../utils/lightingEngine'

export function useLuxAnalysis() {
  const rooms = useSigeStore((s) => s.rooms)
  const lights = useSigeStore((s) => s.lights)
  const pxPerFt = useSigeStore((s) => s.scale?.pxPerFt ?? null)
  const dirty = useSigeStore((s) => s.luxAnalysisDirty)
  const setLuxAnalysis = useSigeStore((s) => s.setLuxAnalysis)

  const lightsByRoomId = useMemo(() => {
    const m = new Map<string, typeof lights>()
    for (const l of lights) {
      const arr = m.get(l.roomId) ?? []
      arr.push(l)
      m.set(l.roomId, arr)
    }
    return m
  }, [lights])

  useEffect(() => {
    if (!dirty) return
    if (!pxPerFt) return

    const t = window.setTimeout(() => {
      const analysis: Record<string, ReturnType<typeof computeRoomLuxGrid>> = {}
      for (const r of rooms) {
        const roomLights = lightsByRoomId.get(r.id) ?? []
        analysis[r.id] = computeRoomLuxGrid(r.polygon, roomLights, pxPerFt, 'default', 1.0)
      }
      setLuxAnalysis({ analysis })
    }, 400)

    return () => window.clearTimeout(t)
  }, [dirty, pxPerFt, rooms, lightsByRoomId, setLuxAnalysis])
}

