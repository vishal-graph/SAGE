import type { GlobalMetrics, RoomMetrics } from '../types'
import { postJson } from './client'

export function uint8ToBase64(u: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < u.length; i += chunk) {
    binary += String.fromCharCode(...u.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export interface MetricsApiRequest {
  cols: number
  rows: number
  cells: Uint8Array
  roomMap: Uint16Array
  doors: { col: number; row: number }[]
  rooms: { index: number; name: string }[]
  min_path_width_cells: number
}

export interface MetricsApiResponse {
  global_metrics: GlobalMetrics
  room_metrics: RoomMetrics[]
  reachable_mask_b64: string
  dead_mask_b64: string
}

export async function computeMetricsRemote(
  req: MetricsApiRequest,
): Promise<MetricsApiResponse> {
  const rm = new Uint8Array(req.roomMap.length)
  for (let i = 0; i < req.roomMap.length; i++) {
    rm[i] = Math.min(255, req.roomMap[i])
  }
  const body = {
    cols: req.cols,
    rows: req.rows,
    cells_b64: uint8ToBase64(req.cells),
    room_map_b64: uint8ToBase64(rm),
    doors: req.doors,
    rooms: req.rooms,
    min_path_width_cells: req.min_path_width_cells,
  }
  return postJson<MetricsApiResponse>('/metrics/compute', body)
}

export function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
