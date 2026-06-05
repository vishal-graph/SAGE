import { useMemo } from 'react'
import type { ConnectionPoint, Door, Room, Wall, Window } from '../../types'

function nodePairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function useFloorWorld({
  connectionPoints,
  walls,
  doors,
  windows,
  rooms,
}: {
  connectionPoints: ConnectionPoint[]
  walls: Wall[]
  doors: Door[]
  windows: Window[]
  rooms: Room[]
}) {
  const nodesById = useMemo(() => {
    const map = new Map<string, ConnectionPoint>()
    for (const p of connectionPoints) map.set(p.id, p)
    return map
  }, [connectionPoints])

  const wallsById = useMemo(() => {
    const map = new Map<string, Wall>()
    for (const w of walls) map.set(w.id, w)
    return map
  }, [walls])

  const roomsById = useMemo(() => {
    const map = new Map<string, Room>()
    for (const r of rooms) map.set(r.id, r)
    return map
  }, [rooms])

  // Best-effort: walls don't store node ids, so this is not populated today.
  const wallsByNodePair = useMemo(() => new Map<string, Wall>(), [])

  const doorsByNodePair = useMemo(() => {
    const map = new Map<string, Door[]>()
    for (const d of doors) {
      if (!d.node_a_id || !d.node_b_id) continue
      const k = nodePairKey(d.node_a_id, d.node_b_id)
      const arr = map.get(k) ?? []
      arr.push(d)
      map.set(k, arr)
    }
    return map
  }, [doors])

  const windowsByNodePair = useMemo(() => {
    const map = new Map<string, Window[]>()
    for (const w of windows) {
      if (!w.node_a_id || !w.node_b_id) continue
      const k = nodePairKey(w.node_a_id, w.node_b_id)
      const arr = map.get(k) ?? []
      arr.push(w)
      map.set(k, arr)
    }
    return map
  }, [windows])

  return {
    nodesById,
    wallsById,
    roomsById,
    wallsByNodePair,
    doorsByNodePair,
    windowsByNodePair,
  }
}

