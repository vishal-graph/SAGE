/** Render first PDF page to PNG data URL (browser). */
export async function pdfFirstPageToDataUrl(
  file: File,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const pdfjs = await import('pdfjs-dist')
  const version = (pdfjs as { version?: string }).version ?? '5.5.207'
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`

  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const page = await pdf.getPage(1)
  const baseVp = page.getViewport({ scale: 1 })
  const scale = Math.min(2400 / baseVp.width, 2400 / baseVp.height, 2)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const task = page.render({ canvas, viewport })
  await task.promise
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  }
}
