from __future__ import annotations

import array
import base64
from typing import List

from app.models.schemas import GlobalMetrics, MetricsRequest, MetricsResponse, RoomMetrics
from app.services.bfs import EMPTY, FURNITURE, PATH, WALL, compute_masks, decode_u8_b64, encode_u8_b64


def compute_metrics(req: MetricsRequest) -> MetricsResponse:
    cells = decode_u8_b64(req.cells_b64)
    room_map = decode_u8_b64(req.room_map_b64)
    n = req.cols * req.rows
    if len(cells) != n or len(room_map) != n:
        raise ValueError("cells/room_map size mismatch")

    reachable, dead, _ = compute_masks(
        cells,
        req.cols,
        req.rows,
        [(d.col, d.row) for d in req.doors],
        req.min_path_width_cells,
    )

    total = n
    wall_cells = sum(1 for v in cells if v == WALL)
    usable = total - wall_cells
    furniture_cells = sum(1 for v in cells if v == FURNITURE)

    reachable_count = sum(
        1 for i in range(n) if reachable[i] and cells[i] in (EMPTY, PATH)
    )
    dead_count = sum(1 for i in range(n) if dead[i])

    if usable <= 0:
        g = GlobalMetrics(
            total_cells=total,
            wall_cells=wall_cells,
            usable_cells=0,
            furniture_cells=furniture_cells,
            furniture_pct=0.0,
            circulation_pct=0.0,
            dead_pct=0.0,
            efficiency_score=0.0,
        )
    else:
        furniture_pct = furniture_cells / usable
        circulation_pct = reachable_count / usable
        dead_pct = dead_count / usable
        eff = min(
            1.0,
            max(
                0.0,
                furniture_pct * 0.40 + circulation_pct * 0.35 + (1.0 - dead_pct) * 0.25,
            ),
        )
        g = GlobalMetrics(
            total_cells=total,
            wall_cells=wall_cells,
            usable_cells=usable,
            furniture_cells=furniture_cells,
            furniture_pct=round(furniture_pct, 4),
            circulation_pct=round(circulation_pct, 4),
            dead_pct=round(dead_pct, 4),
            efficiency_score=round(eff, 4),
        )

    room_by_index = {r.index: r.name for r in req.rooms}
    room_metrics: List[RoomMetrics] = []
    seen_indices = set(int(x) for x in room_map)
    for ri in sorted(x for x in seen_indices if x > 0):
        usable_r = 0
        furn_r = 0
        reach_r = 0
        dead_r = 0
        for i in range(n):
            if room_map[i] != ri:
                continue
            if cells[i] == WALL:
                continue
            usable_r += 1
            if cells[i] == FURNITURE:
                furn_r += 1
            elif cells[i] in (EMPTY, PATH):
                if reachable[i]:
                    reach_r += 1
                elif dead[i]:
                    dead_r += 1
        if usable_r == 0:
            continue
        room_metrics.append(
            RoomMetrics(
                room_index=ri,
                name=room_by_index.get(ri, f"Room {ri}"),
                usable_cells=usable_r,
                furniture_pct=round(furn_r / usable_r, 4),
                circulation_pct=round(reach_r / usable_r, 4),
                dead_pct=round(dead_r / usable_r, 4),
            )
        )

    reachable_mask = array.array("B", reachable)
    dead_mask = array.array("B", dead)

    return MetricsResponse(
        global_metrics=g,
        room_metrics=room_metrics,
        reachable_mask_b64=encode_u8_b64(reachable_mask),
        dead_mask_b64=encode_u8_b64(dead_mask),
    )
