import { CellType } from '../types'

/** Optional client-side BFS for small grids (same semantics as backend). */
export function bfsReachableMask(
  cells: Uint8Array,
  cols: number,
  rows: number,
  seeds: Set<number>,
): Uint8Array {
  const n = cols * rows
  const reachable = new Uint8Array(n)
  const q: number[] = []
  const push = (i: number) => {
    if (i < 0 || i >= n) return
    const v = cells[i]
    if (v !== CellType.EMPTY && v !== CellType.PATH) return
    if (reachable[i]) return
    reachable[i] = 1
    q.push(i)
  }
  for (const s of seeds) push(s)
  let head = 0
  while (head < q.length) {
    const i = q[head++]
    const c = i % cols
    const r = (i / cols) | 0
    if (c > 0) push(i - 1)
    if (c < cols - 1) push(i + 1)
    if (r > 0) push(i - cols)
    if (r < rows - 1) push(i + cols)
  }
  return reachable
}
