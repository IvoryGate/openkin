const hasOwn = Object.prototype.hasOwnProperty

export function readEnv(name: string): string | undefined {
  if (hasOwn.call(process.env, name)) {
    return process.env[name]
  }
  return undefined
}

export function copyEnv(target: Record<string, string>, name: string): void {
  const value = readEnv(name)
  if (value === undefined) return
  target[name] = value
}
