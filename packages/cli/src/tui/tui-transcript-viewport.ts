/**
 * TranscriptViewport sizing (068): derive visible block count from terminal geometry,
 * not a fixed N-line tail slice.
 */

/** Reserved rows: header, footer, status, input rails (approximate). */
export function computeTranscriptBlockBudget(
  termRows: number,
  opts: { reservedRows?: number; minBlocks?: number } = {},
): number {
  const { reservedRows = 14, minBlocks = 4 } = opts
  return Math.max(minBlocks, termRows - reservedRows)
}
