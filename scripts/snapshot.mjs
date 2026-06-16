#!/usr/bin/env node
// Files a freshly-exported PriceLabs CSV into sample-data/snapshots/<YYYY-MM-DD>.csv.
// Date = the earliest "Date" row (= the export/snapshot date we established).
// Usage: pnpm run snapshot <path-to-pricelabs-export.csv>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const src = process.argv[2]
if (!src) {
  console.error('Usage: pnpm run snapshot <path-to-csv>')
  process.exit(1)
}

const text = readFileSync(src, 'utf8')
const firstData = text.split(/\r?\n/)[1] ?? ''
const match = firstData.match(/\d{4}-\d{2}-\d{2}/)
if (!match) {
  console.error('Could not find a YYYY-MM-DD date in the first data row.')
  process.exit(1)
}
const date = match[0]

const dir = resolve('sample-data/snapshots')
mkdirSync(dir, { recursive: true })
const dest = resolve(dir, `${date}.csv`)
if (existsSync(dest)) {
  console.error(`Snapshot for ${date} already exists at ${dest} — not overwriting.`)
  process.exit(1)
}
writeFileSync(dest, text)
console.log(`Saved snapshot ${date} -> ${dest}`)
