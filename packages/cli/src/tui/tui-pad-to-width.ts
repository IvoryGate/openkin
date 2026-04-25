/**
 * 将单行至 pad 到列宽（用于 `Text` 上整行 `backgroundColor` 可见；ASCII 等宽为主）。
 * 多字节字符不展开 EastAsianWidth，与 OpenCode/终端常见假设一致，足够用于状态条。
 */
export function padStringToWidth(line: string, targetCols: number): string {
  if (targetCols <= 0) return ''
  if (line.length >= targetCols) {
    return line.slice(0, targetCols)
  }
  return `${line}${' '.repeat(targetCols - line.length)}`
}
