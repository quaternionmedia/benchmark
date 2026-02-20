#!/usr/bin/env node
/**
 * scripts/issue-to-yaml.js
 * Converts a GitHub "suggest-a-bench" issue body into a ready-to-paste YAML entry.
 *
 * Usage:
 *   node scripts/issue-to-yaml.js <issue-body.txt>
 *   gh issue view <number> --json body --jq '.body' | node scripts/issue-to-yaml.js
 */

import { readFileSync } from 'fs'
import { createInterface } from 'readline'

async function readStdin() {
  const lines = []
  const rl = createInterface({ input: process.stdin })
  for await (const line of rl) lines.push(line)
  return lines.join('\n')
}

function parseField(body, label) {
  const re = new RegExp(`### ${label}\\s*\\n+([^#\\n][^#]*)`, 'i')
  const m = body.match(re)
  if (!m) return null
  const val = m[1].trim()
  return val === '_No response_' || val === '' ? null : val
}

function parseFeatures(body) {
  const m = body.match(/### Features([\s\S]*?)(?=###|$)/)
  if (!m) return { backrest: false, armrests: false, accessible: null, covered: false }
  const section = m[1]
  return {
    backrest:   /\[x\] Has backrest/i.test(section),
    armrests:   /\[x\] Has armrests/i.test(section),
    accessible: /\[x\] Wheelchair accessible/i.test(section)
                  ? true
                  : /\[ \] Wheelchair accessible/i.test(section) ? false : null,
    covered:    /\[x\] Covered/i.test(section)
  }
}

function toSlug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function pad(n) {
  return String(n).padStart(3, '0')
}

async function main() {
  let body

  if (process.argv[2]) {
    body = readFileSync(process.argv[2], 'utf8')
  } else if (process.stdin.isTTY) {
    console.error('Usage:')
    console.error('  node scripts/issue-to-yaml.js <issue-body.txt>')
    console.error('  gh issue view <NUMBER> --json body --jq \'.body\' | node scripts/issue-to-yaml.js')
    process.exit(1)
  } else {
    body = await readStdin()
  }

  const name      = parseField(body, 'Bench name')
  const region    = parseField(body, 'Region')
  const lat       = parseField(body, 'Latitude')
  const lng       = parseField(body, 'Longitude')
  const material  = parseField(body, 'Material')
  const condition = parseField(body, 'Condition')
  const seats     = parseField(body, 'Number of seats')
  const notes     = parseField(body, 'Notes \\(optional\\)') ?? parseField(body, 'Notes')
  const image_url = parseField(body, 'Photo URL \\(optional\\)') ?? parseField(body, 'Photo URL')

  const { backrest, armrests, accessible, covered } = parseFeatures(body)

  const regionSlug = region ? toSlug(region) : 'region'
  const today      = new Date().toISOString().slice(0, 10)

  console.log(`\n# ── Paste the following into public/data/regions/${regionSlug}.yaml ──\n`)
  console.log(`  - id: ${regionSlug}-XXX          # replace XXX with the next available number`)
  console.log(`    name: "${name ?? 'FILL IN'}"`)
  console.log(`    lat: ${lat ?? 'FILL IN'}`)
  console.log(`    lng: ${lng ?? 'FILL IN'}`)
  console.log(`    material: ${material ?? 'other'}`)
  console.log(`    backrest: ${backrest}`)
  console.log(`    armrests: ${armrests}`)
  console.log(`    accessible: ${accessible === null ? 'null' : accessible}`)
  console.log(`    condition: ${condition ?? 'unknown'}`)
  console.log(`    seats: ${seats ?? 2}`)
  console.log(`    covered: ${covered}`)
  console.log(`    added_by: community`)
  console.log(`    added_at: "${today}"`)
  if (notes) console.log(`    notes: "${notes}"`)
  if (image_url) console.log(`    image_url: "${image_url}"`)

  console.log(`\n# ── Checklist ────────────────────────────────────────────────────────`)
  console.log(`#  1. Replace XXX with the next ID number for the ${regionSlug} region`)
  console.log(`#  2. Verify coordinates on a map before merging`)
  console.log(`#  3. Run: npm run validate`)
}

main().catch(console.error)
