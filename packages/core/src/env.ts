const hasOwn = Object.prototype.hasOwnProperty

export function readCompatEnv(newName: string, oldName: string): string | undefined {
  if (hasOwn.call(process.env, newName)) {
    return process.env[newName]
  }
  if (hasOwn.call(process.env, oldName)) {
    return process.env[oldName]
  }
  return undefined
}

export function mirrorCompatEnv(
  target: Record<string, string>,
  newName: string,
  oldName: string,
): void {
  const value = readCompatEnv(newName, oldName)
  if (value === undefined) return
  target[newName] = value
  target[oldName] = value
}
