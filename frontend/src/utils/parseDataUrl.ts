/** Extract base64 payload and mime from a browser data URL. */
export function parseDataUrl(dataUrl: string): { mime: string; b64: string } | null {
  const m = dataUrl.match(/^data:([^;,]+);base64,(.+)$/s)
  if (!m) return null
  return { mime: m[1].trim(), b64: m[2].replace(/\s/g, '') }
}
