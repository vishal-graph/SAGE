import { HttpApiError } from '../api/client'
import { cleanFloorplanImageRemote } from '../api/cleanFloorplan'
import { useSigeStore } from '../store/useSigeStore'
import { parseDataUrl } from './parseDataUrl'

export type CleanImageRunResult =
  | { ok: true; width: number; height: number }
  | { ok: false; message: string }

/**
 * Calls backend Gemini image model and replaces the floor plan bitmap with a clean walls+doors PNG.
 */
export async function runCleanFloorplanImageFromStore(): Promise<CleanImageRunResult> {
  const st = useSigeStore.getState()
  const { imageUrl, imageNaturalWidth: w, imageNaturalHeight: h, imageFilename } = st

  if (!imageUrl) {
    return { ok: false, message: 'No floor plan loaded.' }
  }
  const parsed = parseDataUrl(imageUrl)
  if (!parsed) {
    return { ok: false, message: 'Could not read image data. Try PNG or JPG.' }
  }

  st.setAiCleanPlanLoading(true)
  try {
    let res
    try {
      res = await cleanFloorplanImageRemote({
        image_b64: parsed.b64,
        mime_type: parsed.mime,
        width: w,
        height: h,
      })
    } catch (e) {
      if (e instanceof HttpApiError) {
        return { ok: false, message: e.message }
      }
      const msg = e instanceof Error ? e.message : 'Clean plan request failed'
      return { ok: false, message: msg }
    }

    const dataUrl = `data:${res.mime_type};base64,${res.image_b64}`
    const base = (imageFilename || 'plan').replace(/\.[^.]+$/i, '')
    useSigeStore.getState().setImage(dataUrl, `${base || 'plan'}-clean.png`, res.width, res.height)
    useSigeStore.getState().setShowFloorPlanImage(true)

    return { ok: true, width: res.width, height: res.height }
  } finally {
    useSigeStore.getState().setAiCleanPlanLoading(false)
  }
}
