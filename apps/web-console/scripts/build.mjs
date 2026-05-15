import { mkdirSync, writeFileSync } from 'node:fs'

mkdirSync('dist', { recursive: true })
writeFileSync('dist/index.html', '<!doctype html><title>theworld</title><p>web-console skeleton</p>\n')
console.log('web-console build passed (skeleton)')
