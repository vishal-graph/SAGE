# Kenney Furniture Kit (GLB)

1. Download **[Furniture Kit](https://kenney.nl/assets/furniture-kit)** (CC0).
2. Unzip and open **`kenney_furniture-kit/Models/GLTF format/`** (folder name may vary slightly by pack version).
3. Copy **`.glb`** files into **`frontend/public/models/kenney/`** — keep **Kenney’s original filenames** (camelCase).

## App catalog vs files on disk

The furniture library and 3D view use the mapping in **[`kenneyModelMap.ts`](../../../src/components/Floor3D/kenneyModelMap.ts)** plus presets in **`furnitureLib.ts`**.  
You can copy the **whole** GLTF folder: extra files (walls, floors, tiny props) simply stay unused until you add a `type` → path entry and a preset row.

## Preload behavior

Only GLBs referenced by **library presets** (plus the `custom` mesh) are **preloaded** when you open 3D — not every file in this folder — so startup stays fast.

## Troubleshooting: blue boxes or 404

1. Confirm files are under **`frontend/public/models/kenney/`** (not only inside the downloaded zip).
2. DevTools → **Network** → filter `glb` → expect **200**. **404** means the filename in the map does not match the file on disk (rename the file or edit the map).
3. Some pack versions use different names — align with `kenneyModelMap.ts` or rename the `.glb`.

Until a mapped file exists, 3D uses a **placeholder box** with the correct footprint.
