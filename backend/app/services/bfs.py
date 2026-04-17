"""BFS for circulation / dead space with door seeds and largest-region fallback."""
from __future__ import annotations

import base64
import array
from collections import deque
from typing import List, Optional, Set, Tuple

# CellType enum values (must match frontend)
EMPTY = 0
WALL = 1
FURNITURE = 2
PATH = 3


def decode_u8_b64(b64: str) -> array.array:
    raw = base64.b64decode(b64)
    return array.array("B", raw)


def encode_u8_b64(buf: array.array) -> str:
    return base64.b64encode(buf.tobytes()).decode("ascii")


def neighbors4(cols: int, rows: int, idx: int) -> List[int]:
    c = idx % cols
    r = idx // cols
    out: List[int] = []
    if c > 0:
        out.append(idx - 1)
    if c < cols - 1:
        out.append(idx + 1)
    if r > 0:
        out.append(idx - cols)
    if r < rows - 1:
        out.append(idx + cols)
    return out


def door_seed_indices(
    cells: array.array,
    cols: int,
    rows: int,
    doors: List[Tuple[int, int]],
) -> Set[int]:
    seeds: Set[int] = set()
    for dc, dr in doors:
        if not (0 <= dc < cols and 0 <= dr < rows):
            continue
        idx = dr * cols + dc
        if cells[idx] in (EMPTY, PATH):
            seeds.add(idx)
        for n in neighbors4(cols, rows, idx):
            seeds.add(n)
    return seeds


def largest_empty_region_seed(cells: array.array, cols: int, rows: int) -> Optional[int]:
    """Find center cell of largest 4-connected EMPTY region."""
    n = cols * rows
    visited = bytearray(n)
    best_size = 0
    best_rep: Optional[int] = None

    for start in range(n):
        if visited[start] or cells[start] != EMPTY:
            continue
        q = deque([start])
        visited[start] = 1
        comp: List[int] = []
        while q:
            i = q.popleft()
            comp.append(i)
            for nb in neighbors4(cols, rows, i):
                if not visited[nb] and cells[nb] == EMPTY:
                    visited[nb] = 1
                    q.append(nb)
        if len(comp) > best_size:
            best_size = len(comp)
            # representative: geometric median approx = cell closest to centroid
            sx = sum((i % cols) + 0.5 for i in comp)
            sy = sum((i // cols) + 0.5 for i in comp)
            cx, cy = sx / len(comp), sy / len(comp)
            best_rep = min(comp, key=lambda i: ((i % cols) + 0.5 - cx) ** 2 + ((i // cols) + 0.5 - cy) ** 2)
    return best_rep


def apply_min_path_width(cells: array.array, cols: int, rows: int, width_cells: int) -> array.array:
    """
    If width_cells > 1, treat cells as blocked if within (width_cells-1) of any WALL
    in Manhattan sense — simplified: dilate walls by (width_cells-1) using Chebyshev.
    Returns a copy of walkability mask (1 = walkable for BFS seed expansion).
    """
    n = cols * rows
    if width_cells <= 1:
        return cells

    dist = array.array("H", [9999]) * n
    q = deque()
    for i in range(n):
        if cells[i] == WALL:
            dist[i] = 0
            q.append(i)
    while q:
        i = q.popleft()
        d = dist[i]
        if d >= width_cells:
            continue
        nd = d + 1
        for nb in neighbors4(cols, rows, i):
            if dist[nb] > nd:
                dist[nb] = nd
                q.append(nb)

    out = array.array("B", cells)
    for i in range(n):
        if dist[i] < width_cells and cells[i] == EMPTY:
            out[i] = WALL  # treat as blocked for narrow passages
    return out


def bfs_reachable(
    cells: array.array,
    cols: int,
    rows: int,
    seeds: Set[int],
) -> bytearray:
    n = cols * rows
    reachable = bytearray(n)
    if not seeds:
        return reachable
    q = deque()
    for s in seeds:
        if 0 <= s < n and (cells[s] == EMPTY or cells[s] == PATH):
            if not reachable[s]:
                reachable[s] = 1
                q.append(s)
    while q:
        i = q.popleft()
        for nb in neighbors4(cols, rows, i):
            if not reachable[nb] and (cells[nb] == EMPTY or cells[nb] == PATH):
                reachable[nb] = 1
                q.append(nb)
    return reachable


def compute_masks(
    cells: array.array,
    cols: int,
    rows: int,
    doors: List[Tuple[int, int]],
    min_path_width_cells: int,
) -> Tuple[bytearray, bytearray, array.array]:
    """Returns reachable_mask, dead_mask (as 0/1 per cell), cells_for_bfs."""
    cells_walk = apply_min_path_width(cells, cols, rows, min_path_width_cells)
    seeds = door_seed_indices(cells_walk, cols, rows, doors)
    if not seeds:
        center = largest_empty_region_seed(cells_walk, cols, rows)
        if center is not None:
            seeds = {center}
    reachable = bfs_reachable(cells_walk, cols, rows, seeds)
    n = cols * rows
    dead = bytearray(n)
    for i in range(n):
        if cells[i] == EMPTY and not reachable[i]:
            dead[i] = 1
    return reachable, dead, cells_walk
