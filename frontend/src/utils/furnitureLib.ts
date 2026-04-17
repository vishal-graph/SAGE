import type { FurnitureItem, Room } from '../types'
import { getKenneyModelUrl } from '../components/Floor3D/kenneyModelMap'
import {
  clampFootprintProportionally,
  computePlanCharacteristicSpanFt,
  dimensionClampForFurnitureType,
  furnitureScaleFactorFromSpan,
} from './planFurnitureScale'

export interface Preset {
  type: string
  label: string
  widthFt: number
  depthFt: number
  /** UI grouping only */
  category: string
}

export const FURNITURE_PRESETS: Preset[] = [
  // Seating
  { type: 'sofa_3', label: 'Sofa (3-seat)', widthFt: 7, depthFt: 3, category: 'Seating' },
  { type: 'sofa_2', label: 'Loveseat', widthFt: 5, depthFt: 3, category: 'Seating' },
  { type: 'sofa_corner', label: 'Sofa corner', widthFt: 4, depthFt: 4, category: 'Seating' },
  { type: 'sofa_sectional', label: 'Sectional sofa', widthFt: 7, depthFt: 3.5, category: 'Seating' },
  { type: 'sofa_sectional_corner', label: 'Sectional corner', widthFt: 5, depthFt: 5, category: 'Seating' },
  { type: 'ottoman', label: 'Ottoman', widthFt: 2, depthFt: 2, category: 'Seating' },
  { type: 'armchair', label: 'Armchair', widthFt: 3, depthFt: 3, category: 'Seating' },
  { type: 'armchair_relax', label: 'Relax chair', widthFt: 3.5, depthFt: 3.5, category: 'Seating' },
  { type: 'chair_accent', label: 'Accent chair', widthFt: 2.5, depthFt: 2.5, category: 'Seating' },
  { type: 'bench', label: 'Bench', widthFt: 4, depthFt: 1.5, category: 'Seating' },
  { type: 'bench_cushion', label: 'Bench (cushion)', widthFt: 4, depthFt: 1.5, category: 'Seating' },
  { type: 'stool_bar', label: 'Bar stool', widthFt: 1.5, depthFt: 1.5, category: 'Seating' },
  { type: 'stool_bar_square', label: 'Bar stool (square)', widthFt: 1.5, depthFt: 1.5, category: 'Seating' },
  { type: 'chair_rounded', label: 'Chair (rounded)', widthFt: 2, depthFt: 2, category: 'Seating' },
  { type: 'chair_modern', label: 'Chair (modern)', widthFt: 2, depthFt: 2, category: 'Seating' },
  { type: 'chair_cushion', label: 'Chair (cushion)', widthFt: 2, depthFt: 2, category: 'Seating' },
  { type: 'dining_chair', label: 'Dining chair', widthFt: 2, depthFt: 2, category: 'Seating' },

  // Sleep
  { type: 'bed_king', label: 'Bed King', widthFt: 6.5, depthFt: 6.7, category: 'Sleep' },
  { type: 'bed_queen', label: 'Bed Queen', widthFt: 5, depthFt: 6.7, category: 'Sleep' },
  { type: 'bed_twin', label: 'Bed Twin', widthFt: 3.25, depthFt: 6.5, category: 'Sleep' },
  { type: 'bed_bunk', label: 'Bunk bed', widthFt: 3.5, depthFt: 6.5, category: 'Sleep' },
  { type: 'murphy_bed', label: 'Murphy / wall bed', widthFt: 5, depthFt: 1.5, category: 'Sleep' },

  // Work
  { type: 'desk', label: 'Desk', widthFt: 4, depthFt: 2, category: 'Work' },
  { type: 'desk_corner', label: 'Corner desk', widthFt: 5, depthFt: 5, category: 'Work' },
  { type: 'chair', label: 'Desk chair', widthFt: 2, depthFt: 2, category: 'Work' },
  { type: 'laptop', label: 'Laptop', widthFt: 1.5, depthFt: 1, category: 'Work' },

  // Dining
  { type: 'dining_table', label: 'Dining table', widthFt: 6, depthFt: 3.5, category: 'Dining' },
  { type: 'dining_table_cloth', label: 'Dining table (cloth)', widthFt: 6, depthFt: 3.5, category: 'Dining' },
  { type: 'table_round', label: 'Round table', widthFt: 4.5, depthFt: 4.5, category: 'Dining' },

  // Storage
  { type: 'wardrobe', label: 'Wardrobe', widthFt: 4, depthFt: 2, category: 'Storage' },
  { type: 'bookcase', label: 'Bookcase (closed)', widthFt: 3, depthFt: 1, category: 'Storage' },
  { type: 'bookcase_wide', label: 'Bookcase (wide)', widthFt: 4, depthFt: 1, category: 'Storage' },
  { type: 'bookcase_open', label: 'Bookcase (open)', widthFt: 3, depthFt: 1, category: 'Storage' },
  { type: 'bookcase_open_low', label: 'Bookcase (low open)', widthFt: 3, depthFt: 1, category: 'Storage' },
  { type: 'tv_stand', label: 'TV stand', widthFt: 4, depthFt: 1.5, category: 'Storage' },
  { type: 'tv_stand_doors', label: 'TV stand (doors)', widthFt: 4, depthFt: 1.5, category: 'Storage' },
  { type: 'coat_rack', label: 'Coat rack', widthFt: 2, depthFt: 2, category: 'Storage' },

  // Living
  { type: 'coffee_table', label: 'Coffee table', widthFt: 4, depthFt: 2, category: 'Living' },
  { type: 'coffee_table_glass', label: 'Coffee table (glass)', widthFt: 4, depthFt: 2.5, category: 'Living' },
  { type: 'coffee_table_square_glass', label: 'Coffee table (square glass)', widthFt: 3.5, depthFt: 3.5, category: 'Living' },
  { type: 'side_table', label: 'Side table', widthFt: 2, depthFt: 2, category: 'Living' },
  { type: 'side_table_drawers', label: 'Side table (drawers)', widthFt: 2, depthFt: 2, category: 'Living' },
  { type: 'table_console', label: 'Console table', widthFt: 5, depthFt: 2.5, category: 'Living' },
  { type: 'table_glass', label: 'Glass table', widthFt: 5, depthFt: 3, category: 'Living' },
  { type: 'tv_modern', label: 'TV (modern)', widthFt: 4, depthFt: 1.5, category: 'Living' },
  { type: 'tv_vintage', label: 'TV (vintage)', widthFt: 3.5, depthFt: 3, category: 'Living' },
  { type: 'floor_lamp', label: 'Floor lamp', widthFt: 1.5, depthFt: 1.5, category: 'Living' },
  { type: 'table_lamp', label: 'Table lamp', widthFt: 1.5, depthFt: 1.5, category: 'Living' },
  { type: 'rug_rectangle', label: 'Rug (rectangle)', widthFt: 6, depthFt: 4, category: 'Living' },
  { type: 'rug_round', label: 'Rug (round)', widthFt: 5, depthFt: 5, category: 'Living' },
  { type: 'speaker', label: 'Speaker', widthFt: 1.5, depthFt: 1.5, category: 'Living' },
  { type: 'plant', label: 'Potted plant', widthFt: 1.5, depthFt: 1.5, category: 'Living' },
  { type: 'plant_small', label: 'Plant (small)', widthFt: 1, depthFt: 1, category: 'Living' },

  // Kitchen
  { type: 'kitchen_bar', label: 'Kitchen bar', widthFt: 4, depthFt: 2, category: 'Kitchen' },
  { type: 'kitchen_fridge', label: 'Refrigerator', widthFt: 3, depthFt: 2.5, category: 'Kitchen' },
  { type: 'kitchen_fridge_large', label: 'Refrigerator (large)', widthFt: 3.5, depthFt: 2.5, category: 'Kitchen' },
  { type: 'kitchen_stove', label: 'Stove', widthFt: 3, depthFt: 2.5, category: 'Kitchen' },
  { type: 'kitchen_stove_electric', label: 'Stove (electric)', widthFt: 3, depthFt: 2.5, category: 'Kitchen' },
  { type: 'kitchen_sink_unit', label: 'Kitchen sink', widthFt: 2.5, depthFt: 2, category: 'Kitchen' },
  { type: 'kitchen_microwave', label: 'Microwave', widthFt: 1.5, depthFt: 1.5, category: 'Kitchen' },
  { type: 'kitchen_cabinet', label: 'Kitchen cabinet', widthFt: 2, depthFt: 2, category: 'Kitchen' },
  { type: 'hood_modern', label: 'Range hood', widthFt: 2.5, depthFt: 2, category: 'Kitchen' },

  // Bath
  { type: 'bathtub', label: 'Bathtub', widthFt: 5, depthFt: 2.5, category: 'Bath' },
  { type: 'toilet', label: 'Toilet', widthFt: 2.5, depthFt: 3.5, category: 'Bath' },
  { type: 'toilet_square', label: 'Toilet (square)', widthFt: 2.5, depthFt: 3.5, category: 'Bath' },
  { type: 'bath_sink', label: 'Bathroom sink', widthFt: 2.5, depthFt: 2, category: 'Bath' },
  { type: 'bath_sink_square', label: 'Bathroom sink (square)', widthFt: 2.5, depthFt: 2, category: 'Bath' },
  { type: 'bath_vanity', label: 'Bathroom vanity', widthFt: 2.5, depthFt: 1.5, category: 'Bath' },
  { type: 'bath_vanity_drawer', label: 'Vanity (drawer)', widthFt: 2.5, depthFt: 1.5, category: 'Bath' },
  { type: 'shower', label: 'Shower', widthFt: 3.5, depthFt: 3.5, category: 'Bath' },
  { type: 'shower_round', label: 'Shower (round)', widthFt: 3.5, depthFt: 3.5, category: 'Bath' },
  { type: 'bath_mirror', label: 'Bathroom mirror', widthFt: 2, depthFt: 0.5, category: 'Bath' },

  // Laundry
  { type: 'washer', label: 'Washing machine', widthFt: 2.5, depthFt: 2.5, category: 'Laundry' },
  { type: 'dryer', label: 'Dryer', widthFt: 2.5, depthFt: 2.5, category: 'Laundry' },
  { type: 'washer_dryer_stacked', label: 'Washer / dryer stack', widthFt: 2.5, depthFt: 2.5, category: 'Laundry' },
]

/** Presets that have a Kenney GLB mapping (same set shown in the furniture library for 3D parity). */
export const FURNITURE_PRESETS_3D: Preset[] = FURNITURE_PRESETS.filter(
  (p) => getKenneyModelUrl(p.type) != null,
)

/** Distinct GLB URLs used by the library — preload these only (not every file on disk). */
export function libraryKenneyPreloadUrls(): string[] {
  const s = new Set<string>()
  for (const p of FURNITURE_PRESETS) {
    const u = getKenneyModelUrl(p.type)
    if (u) s.add(u)
  }
  const customMesh = getKenneyModelUrl('custom')
  if (customMesh) s.add(customMesh)
  return [...s]
}

let idCounter = 0
export function newFurnitureId(): string {
  idCounter += 1
  return `f_${Date.now()}_${idCounter}`
}

/** Width/depth after plan-relative scale + realistic clamps (TV, sofa, …). */
export function scaledPresetFootprintFt(
  preset: Preset,
  planScaleFactor: number,
): { widthFt: number; depthFt: number } {
  if (!Number.isFinite(planScaleFactor) || planScaleFactor <= 0) {
    return { widthFt: preset.widthFt, depthFt: preset.depthFt }
  }
  const w = preset.widthFt * planScaleFactor
  const d = preset.depthFt * planScaleFactor
  const lim = dimensionClampForFurnitureType(preset.type)
  return clampFootprintProportionally(w, d, lim)
}

export function createFurnitureFromPreset(
  preset: Preset,
  gridX: number,
  gridY: number,
  options?: { planScaleFactor?: number },
): FurnitureItem {
  const dims =
    options?.planScaleFactor != null && Number.isFinite(options.planScaleFactor)
      ? scaledPresetFootprintFt(preset, options.planScaleFactor)
      : { widthFt: preset.widthFt, depthFt: preset.depthFt }
  return {
    id: newFurnitureId(),
    type: preset.type,
    label: preset.label,
    widthFt: dims.widthFt,
    depthFt: dims.depthFt,
    gridX,
    gridY,
    rotation: 0,
    freeOffsetPx: [0, 0],
  }
}

/** Use with store + image bounds to scale new library placements vs the current plan. */
export function furniturePlanScaleFactorFromStoreInputs(
  pxPerFt: number,
  imageWidthPx: number,
  imageHeightPx: number,
  rooms: Room[],
): number {
  const span = computePlanCharacteristicSpanFt(pxPerFt, imageWidthPx, imageHeightPx, rooms)
  return furnitureScaleFactorFromSpan(span)
}

export function createCustomFurniture(
  label: string,
  widthFt: number,
  depthFt: number,
  gridX: number,
  gridY: number,
): FurnitureItem {
  return {
    id: newFurnitureId(),
    type: 'custom',
    label,
    widthFt,
    depthFt,
    gridX,
    gridY,
    rotation: 0,
    freeOffsetPx: [0, 0],
  }
}

/** Migrate legacy JSON (`heightFt`) to `depthFt`. */
export function normalizeFurnitureFromPayload(raw: unknown): FurnitureItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.type !== 'string' || typeof o.label !== 'string') return null
  const widthFt = Number(o.widthFt)
  let depthFt = Number(o.depthFt)
  if (!Number.isFinite(depthFt) && Number.isFinite(Number(o.heightFt))) depthFt = Number(o.heightFt)
  if (!Number.isFinite(widthFt) || !Number.isFinite(depthFt)) return null
  const gridX = Number(o.gridX)
  const gridY = Number(o.gridY)
  const rot = Number(o.rotation)
  const rots = [0, 90, 180, 270] as const
  const rotation = (rots.includes(rot as 0 | 90 | 180 | 270) ? rot : 0) as 0 | 90 | 180 | 270
  const fo = o.freeOffsetPx
  const freeOffsetPx: [number, number] =
    Array.isArray(fo) && fo.length >= 2
      ? [Number(fo[0]) || 0, Number(fo[1]) || 0]
      : [0, 0]
  return {
    id: o.id,
    type: o.type,
    label: o.label,
    widthFt,
    depthFt,
    gridX: Number.isFinite(gridX) ? gridX : 0,
    gridY: Number.isFinite(gridY) ? gridY : 0,
    rotation,
    freeOffsetPx,
  }
}
