/**
 * Mirrors backend/app/services/bfs.py so circulation / dead overlays work without calling the API.
 */
import { CellType } from '../types'

const { EMPTY, WALL, PATH } = CellType

function neighbors4(cols: number, rows: number, idx: number): number[] {
  const c = idx % cols
  const r = (idx / cols) | 0
  const out: number[] = []
  if (c > 0) out.push(idx - 1)
  if (c < cols - 1) out.push(idx + 1)
  if (r > 0) out.push(idx - cols)
  if (r < rows - 1) out.push(idx + cols)
  return out
}

function doorSeedIndices(
  cells: Uint8Array,
  cols: number,
  rows: number,
  doors: { col: number; row: number }[],
): Set<number> {
  const seeds = new Set<number>()
  for (const { col: dc, row: dr } of doors) {
    if (dc < 0 || dr < 0 || dc >= cols || dr >= rows) continue
    const idx = dr * cols + dc
    if (cells[idx] === EMPTY || cells[idx] === PATH) seeds.add(idx)
    for (const n of neighbors4(cols, rows, idx)) seeds.add(n)
  }
  return seeds
}

function largestEmptyRegionSeed(cells: Uint8Array, cols: number, rows: number): number | null {
  const n = cols * rows
  const visited = new Uint8Array(n)
  let bestSize = 0
  let bestRep: number | null = null

  for (let start = 0; start < n; start++) {
    if (visited[start] || cells[start] !== EMPTY) continue
    const q: number[] = [start]
    visited[start] = 1
    const comp: number[] = []
    while (q.length) {
      const i = q.pop()!
      comp.push(i)
      for (const nb of neighbors4(cols, rows, i)) {
        if (!visited[nb] && cells[nb] === EMPTY) {
          visited[nb] = 1
          q.push(nb)
        }
      }
    }
    if (comp.length > bestSize) {
      bestSize = comp.length
      let sx = 0
      let sy = 0
      for (const i of comp) {
        sx += (i % cols) + 0.5
        sy += ((i / cols) | 0) + 0.5
      }
      const cx = sx / comp.length
      const cy = sy / comp.length
      bestRep = comp.reduce((best, i) => {
        const bx = (i % cols) + 0.5 - cx
        const by = ((i / cols) | 0) + 0.5 - cy
        const d = bx * bx + by * by
        const ob = (best % cols) + 0.5 - cx
        const oby = ((best / cols) | 0) + 0.5 - cy
        const od = ob * ob + oby * oby
        return d < od ? i : best
      })
    }
  }
  return bestRep
}

function applyMinPathWidth(cells: Uint8Array, cols: number, rows: number, widthCells: number): Uint8Array {
  const n = cols * rows
  if (widthCells <= 1) return cells

  const dist = new Uint16Array(n)
  dist.fill(9999)
  const q: number[] = []
  for (let i = 0; i < n; i++) {
    if (cells[i] === WALL) {
      dist[i] = 0
      q.push(i)
    }
  }
  while (q.length) {
    const i = q.shift()!
    const d = dist[i]
    if (d >= widthCells) continue
    const nd = d + 1
    for (const nb of neighbors4(cols, rows, i)) {
      if (dist[nb] > nd) {
        dist[nb] = nd
        q.push(nb)
      }
    }
  }

  const out = new Uint8Array(cells)
  for (let i = 0; i < n; i++) {
    if (dist[i] < widthCells && cells[i] === EMPTY) out[i] = WALL
  }
  return out
}

function bfsReachable(cells: Uint8Array, cols: number, rows: number, seeds: Set<number>): Uint8Array {
  const n = cols * rows
  const reachable = new Uint8Array(n)
  if (seeds.size === 0) return reachable
  const q: number[] = []
  for (const s of seeds) {
    if (s < 0 || s >= n) continue
    if (cells[s] === EMPTY || cells[s] === PATH) {
      if (!reachable[s]) {
        reachable[s] = 1
        q.push(s)
      }
    }
  }
  while (q.length) {
    const i = q.shift()!
    for (const nb of neighbors4(cols, rows, i)) {
      if (!reachable[nb] && (cells[nb] === EMPTY || cells[nb] === PATH)) {
        reachable[nb] = 1
        q.push(nb)
      }
    }
  }
  return reachable
}

export function computeCirculationMasks(
  cells: Uint8Array,
  cols: number,
  rows: number,
  doors: { col: number; row: number }[],
  minPathWidthCells: number,
): { reachable: Uint8Array; dead: Uint8Array } {
  const n = cols * rows
  const cellsWalk = applyMinPathWidth(cells, cols, rows, minPathWidthCells)
  let seeds = doorSeedIndices(cellsWalk, cols, rows, doors)
  if (seeds.size === 0) {
    const center = largestEmptyRegionSeed(cellsWalk, cols, rows)
    if (center !== null) seeds = new Set([center])
  }
  const reachable = bfsReachable(cellsWalk, cols, rows, seeds)
  const dead = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    if (cells[i] === EMPTY && !reachable[i]) dead[i] = 1
  }
  return { reachable, dead }
}
