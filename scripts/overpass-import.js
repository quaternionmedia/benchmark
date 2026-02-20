#!/usr/bin/env node
/**
 * scripts/overpass-import.js
 * Query the Overpass API for amenity=bench nodes within a bounding box and
 * write a ready-to-validate YAML region file.
 *
 * Requires Node 18+ (built-in fetch).
 *
 * Usage:
 *   node scripts/overpass-import.js --bbox "S,W,N,E" --region "Region Name"
 *
 * Examples:
 *   node scripts/overpass-import.js --bbox "51.48,-0.13,51.52,-0.09" --region "London South"
 *   node scripts/overpass-import.js --bbox "40.76,-73.98,40.80,-73.95" --region "Central Park"
 *
 * After running:
 *   npm run validate
 */

import { writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// ─── OSM tag mappers ──────────────────────────────────────────────────────────

function osmMaterial(tags) {
  const m = (tags.material || tags.bench_material || '').toLowerCase()
  if (m.includes('wood') || m.includes('timber'))  return 'wood'
  if (m.includes('metal') || m.includes('iron') || m.includes('steel') || m.includes('alum')) return 'metal'
  if (m.includes('stone') || m.includes('granite') || m.includes('slate')) return 'stone'
  if (m.includes('plastic') || m.includes('fibreglass')) return 'plastic'
  if (m.includes('concrete')) return 'concrete'
  return 'other'
}

function osmCondition(tags) {
  const c = (tags.condition || '').toLowerCase()
  if (c === 'good' || c === 'excellent')       return 'good'
  if (c === 'fair' || c === 'average')         return 'fair'
  if (c === 'bad'  || c === 'poor' || c === 'broken') return 'poor'
  return 'unknown'
}

function osmBackrest(tags) {
  if (tags.backrest === 'no')  return false
  if (tags.backrest === 'yes') return true
  return true   // OSM default assumption for benches
}

// ─── Overpass query builder ───────────────────────────────────────────────────

function buildQuery(bbox) {
  const parts = bbox.split(',').map(s => s.trim())
  if (parts.length !== 4) throw new Error('--bbox must be "S,W,N,E"')
  return `[out:json][timeout:30];
node[amenity=bench](${parts.join(',')});
out body;`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function getArg(args, flag) {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : null
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: node scripts/overpass-import.js --bbox "S,W,N,E" --region "Region Name"`)
    console.log(`\nExample:`)
    console.log(`  node scripts/overpass-import.js \\`)
    console.log(`    --bbox "51.48,-0.13,51.52,-0.09" \\`)
    console.log(`    --region "London South"`)
    process.exit(0)
  }

  const bbox       = getArg(args, '--bbox')
  const regionName = getArg(args, '--region') || 'Imported Region'

  if (!bbox) {
    console.error('Error: --bbox is required (format: "S,W,N,E")')
    console.error('Run with --help for usage.')
    process.exit(1)
  }

  const regionSlug = regionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const outFile    = join(__dirname, `../public/data/regions/${regionSlug}.yaml`)

  if (existsSync(outFile)) {
    console.warn(`⚠️  ${outFile} already exists. Use a different --region name or remove the file first.`)
    process.exit(1)
  }

  let query
  try { query = buildQuery(bbox) } catch (e) {
    console.error(`Error: ${e.message}`)
    process.exit(1)
  }

  console.log(`\n🌍 Querying Overpass API for benches in [${bbox}]…`)

  const res = await fetch(OVERPASS_URL, {
    method:  'POST',
    body:    `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })

  if (!res.ok) {
    console.error(`❌ Overpass API returned ${res.status}: ${res.statusText}`)
    process.exit(1)
  }

  const data  = await res.json()
  const nodes = (data.elements || []).filter(e => e.type === 'node')

  if (!nodes.length) {
    console.log('⚠️  No benches found in that bounding box. Try widening it.')
    process.exit(0)
  }

  console.log(`✅ Found ${nodes.length} bench${nodes.length !== 1 ? 'es' : ''}.`)

  const today = new Date().toISOString().slice(0, 10)
  const lines = []

  lines.push(`region:`)
  lines.push(`  name: "${regionName}"`)
  lines.push(`  description: "Imported from OpenStreetMap via Overpass API on ${today}"`)
  lines.push(``)
  lines.push(`benches:`)

  nodes.forEach((node, i) => {
    const tags   = node.tags || {}
    const num    = String(i + 1).padStart(3, '0')
    const name   = tags.name || `${regionName} bench ${num}`
    const seats  = parseInt(tags.seats) || 2
    const notes  = tags.description
                   ? tags.description.slice(0, 280)
                   : tags.inscription
                   ? tags.inscription.slice(0, 280)
                   : null

    lines.push(`  - id: ${regionSlug}-${num}`)
    lines.push(`    name: "${name.replace(/"/g, "'")}"`)
    lines.push(`    lat: ${node.lat}`)
    lines.push(`    lng: ${node.lon}`)
    lines.push(`    material: ${osmMaterial(tags)}`)
    lines.push(`    backrest: ${osmBackrest(tags)}`)
    lines.push(`    armrests: ${tags.armrest === 'yes'}`)
    lines.push(`    accessible: null`)
    lines.push(`    condition: ${osmCondition(tags)}`)
    lines.push(`    seats: ${seats}`)
    lines.push(`    covered: ${tags.covered === 'yes'}`)
    lines.push(`    added_by: overpass-import`)
    lines.push(`    added_at: "${today}"`)
    if (notes) lines.push(`    notes: "${notes.replace(/"/g, "'")}"`)
    lines.push(``)
  })

  writeFileSync(outFile, lines.join('\n'))

  console.log(`\n📁 Written to ${outFile}`)
  console.log(`\n⚠️  Please review and verify coordinates before merging.`)
  console.log(`   Many OSM bench records have 'condition: unknown' — update where possible.`)
  console.log(`\n▶  Run: npm run validate`)
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
