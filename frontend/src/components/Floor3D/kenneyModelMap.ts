/**
 * Map SIGE furniture `type` → static URL under `public/models/kenney/`.
 *
 * **Setup:** Copy Kenney Furniture Kit `Models/GLTF format/*.glb` into `frontend/public/models/kenney/`
 * using the **same filenames** as in this map (camelCase).
 *
 * If a file 404s or fails to parse, `Furniture3D` falls back to the footprint box.
 */
export const KENNEY_GLB_BY_TYPE: Partial<Record<string, string>> = {
  // —— Original core set ——
  sofa_3: '/models/kenney/loungeSofaLong.glb',
  sofa_2: '/models/kenney/loungeSofa.glb',
  bed_king: '/models/kenney/bedDouble.glb',
  bed_queen: '/models/kenney/bedDouble.glb',
  bed_twin: '/models/kenney/bedSingle.glb',
  desk: '/models/kenney/desk.glb',
  chair: '/models/kenney/chairDesk.glb',
  dining_table: '/models/kenney/tableCross.glb',
  wardrobe: '/models/kenney/bookcaseClosedDoors.glb',
  coffee_table: '/models/kenney/tableCoffee.glb',
  custom: '/models/kenney/tableCoffeeSquare.glb',

  // —— Seating ——
  armchair: '/models/kenney/loungeChair.glb',
  armchair_relax: '/models/kenney/loungeChairRelax.glb',
  chair_accent: '/models/kenney/loungeDesignChair.glb',
  sofa_corner: '/models/kenney/loungeSofaCorner.glb',
  sofa_sectional: '/models/kenney/loungeDesignSofa.glb',
  sofa_sectional_corner: '/models/kenney/loungeDesignSofaCorner.glb',
  ottoman: '/models/kenney/loungeSofaOttoman.glb',
  bench: '/models/kenney/bench.glb',
  bench_cushion: '/models/kenney/benchCushion.glb',
  stool_bar: '/models/kenney/stoolBar.glb',
  stool_bar_square: '/models/kenney/stoolBarSquare.glb',
  chair_rounded: '/models/kenney/chairRounded.glb',
  chair_modern: '/models/kenney/chairModernCushion.glb',
  chair_cushion: '/models/kenney/chairCushion.glb',
  dining_chair: '/models/kenney/chair.glb',

  // —— Sleep ——
  bed_bunk: '/models/kenney/bedBunk.glb',
  murphy_bed: '/models/kenney/cabinetBed.glb',

  // —— Work / tables ——
  desk_corner: '/models/kenney/deskCorner.glb',
  side_table: '/models/kenney/sideTable.glb',
  side_table_drawers: '/models/kenney/sideTableDrawers.glb',
  table_round: '/models/kenney/tableRound.glb',
  table_console: '/models/kenney/table.glb',
  table_glass: '/models/kenney/tableGlass.glb',
  coffee_table_glass: '/models/kenney/tableCoffeeGlass.glb',
  coffee_table_square_glass: '/models/kenney/tableCoffeeGlassSquare.glb',
  dining_table_cloth: '/models/kenney/tableCrossCloth.glb',

  // —— Storage / media ——
  bookcase: '/models/kenney/bookcaseClosed.glb',
  bookcase_wide: '/models/kenney/bookcaseClosedWide.glb',
  bookcase_open: '/models/kenney/bookcaseOpen.glb',
  bookcase_open_low: '/models/kenney/bookcaseOpenLow.glb',
  tv_stand: '/models/kenney/cabinetTelevision.glb',
  tv_stand_doors: '/models/kenney/cabinetTelevisionDoors.glb',

  // —— Kitchen ——
  kitchen_bar: '/models/kenney/kitchenBar.glb',
  kitchen_fridge: '/models/kenney/kitchenFridge.glb',
  kitchen_fridge_large: '/models/kenney/kitchenFridgeLarge.glb',
  kitchen_stove: '/models/kenney/kitchenStove.glb',
  kitchen_stove_electric: '/models/kenney/kitchenStoveElectric.glb',
  kitchen_sink_unit: '/models/kenney/kitchenSink.glb',
  kitchen_microwave: '/models/kenney/kitchenMicrowave.glb',
  kitchen_cabinet: '/models/kenney/kitchenCabinet.glb',
  hood_modern: '/models/kenney/hoodModern.glb',

  // —— Laundry ——
  washer: '/models/kenney/washer.glb',
  dryer: '/models/kenney/dryer.glb',
  washer_dryer_stacked: '/models/kenney/washerDryerStacked.glb',

  // —— Bath ——
  bathtub: '/models/kenney/bathtub.glb',
  toilet: '/models/kenney/toilet.glb',
  toilet_square: '/models/kenney/toiletSquare.glb',
  bath_sink: '/models/kenney/bathroomSink.glb',
  bath_sink_square: '/models/kenney/bathroomSinkSquare.glb',
  bath_vanity: '/models/kenney/bathroomCabinet.glb',
  bath_vanity_drawer: '/models/kenney/bathroomCabinetDrawer.glb',
  shower: '/models/kenney/shower.glb',
  shower_round: '/models/kenney/showerRound.glb',
  bath_mirror: '/models/kenney/bathroomMirror.glb',

  // —— Decor / misc ——
  tv_modern: '/models/kenney/televisionModern.glb',
  tv_vintage: '/models/kenney/televisionVintage.glb',
  laptop: '/models/kenney/laptop.glb',
  floor_lamp: '/models/kenney/lampRoundFloor.glb',
  table_lamp: '/models/kenney/lampRoundTable.glb',
  plant: '/models/kenney/pottedPlant.glb',
  plant_small: '/models/kenney/plantSmall1.glb',
  coat_rack: '/models/kenney/coatRackStanding.glb',
  rug_rectangle: '/models/kenney/rugRectangle.glb',
  rug_round: '/models/kenney/rugRound.glb',
  speaker: '/models/kenney/speaker.glb',
}

export function getKenneyModelUrl(type: string): string | undefined {
  const u = KENNEY_GLB_BY_TYPE[type]
  return u && u.length > 0 ? u : undefined
}

/** All distinct mapped URLs (used for reachability probe). */
export function allKenneyUrls(): string[] {
  return [...new Set(Object.values(KENNEY_GLB_BY_TYPE).filter(Boolean) as string[])]
}
