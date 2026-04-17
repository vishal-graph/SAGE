import { postJson } from './client'

export interface CleanFloorplanImageResponse {
  image_b64: string
  mime_type: string
  width: number
  height: number
  source_width: number
  source_height: number
  model: string
}

export async function cleanFloorplanImageRemote(body: {
  image_b64: string
  mime_type: string
  width: number
  height: number
}): Promise<CleanFloorplanImageResponse> {
  return postJson<CleanFloorplanImageResponse>('/ai/clean-floorplan-image', body)
}
