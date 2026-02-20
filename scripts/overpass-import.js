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
 *   node scripts/overpass-import.js --preset <preset-name> [--force]
 *   node scripts/overpass-import.js --list
 *
 * Examples:
 *   node scripts/overpass-import.js --list
 *   node scripts/overpass-import.js --preset london-south
 *   node scripts/overpass-import.js --preset london-south --force
 *   node scripts/overpass-import.js --bbox "51.48,-0.13,51.52,-0.09" --region "London South"
 *
 * After running:
 *   npm run validate
 */

import { writeFileSync, existsSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// ─── Presets for seed regions ─────────────────────────────────────────────────
// bbox format: "S,W,N,E"  (add generous padding around known bench coords)

const PRESETS = {
  'london-south': {
    region: 'London South',
    bbox:   '51.490,-0.115,51.520,-0.070'
  },
  'central-park': {
    region: 'Central Park',
    bbox:   '40.765,-73.985,40.800,-73.945'
  },
  'kyoto-central': {
    region: 'Kyoto Central',
    bbox:   '34.995,135.760,35.025,135.790'
  }
}

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

// ─── Arg helpers ──────────────────────────────────────────────────────────────

function getArg(args, flag) {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : null
}

function hasFlag(args, ...flags) {
  return flags.some(f => args.includes(f))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)

  // ── --help ──────────────────────────────────────────────────────────────────
  if (hasFlag(args, '--help', '-h')) {
    console.log(`Usage:`)
    console.log(`  node scripts/overpass-import.js --list`)
    console.log(`  node scripts/overpass-import.js --preset <name> [--force]`)
    console.log(`  node scripts/overpass-import.js --bbox "S,W,N,E" --region "Name" [--force]`)
    console.log(`\nFlags:`)
    console.log(`  --list            List available presets`)
    console.log(`  --preset <name>   Use a pre-configured region bbox`)
    console.log(`  --bbox "S,W,N,E"  Custom bounding box`)
    console.log(`  --region "Name"   Region name (required with --bbox)`)
    console.log(`  --force           Overwrite an existing YAML file`)
    console.log(`\nPresets: ${Object.keys(PRESETS).join(', ')}`)
    process.exit(0)
  }

  // ── --list ──────────────────────────────────────────────────────────────────
  if (hasFlag(args, '--list', '--list-presets')) {
    console.log('\nAvailable presets:\n')
    for (const [key, { region, bbox }] of Object.entries(PRESETS)) {
      console.log(`  ${key.padEnd(18)} ${region} (${bbox})`)
    }
    console.log(`\nRun with: npm run overpass-import -- --preset <name>`)
    process.exit(0)
  }

  // ── no args → show presets ──────────────────────────────────────────────────
  if (args.length === 0) {
    console.log('benchmark — Overpass importer\n')
    console.log('Available presets (run with --preset <name>):\n')
    for (const [key, { region, bbox }] of Object.entries(PRESETS)) {
      console.log(`  ${key.padEnd(18)} ${region}  bbox: ${bbox}`)
    }
    console.log(`\nOr supply a custom area:`)
    console.log(`  npm run overpass-import -- --bbox "S,W,N,E" --region "My Region"`)
    console.log(`\nRun with --help for full usage.`)
    process.exit(0)
  }

  // ── resolve bbox + region from --preset or --bbox / --region ────────────────
  const force      = hasFlag(args, '--force', '-f')
  const presetKey  = getArg(args, '--preset')

  let bbox, regionName

  if (presetKey) {
    const preset = PRESETS[presetKey]
    if (!preset) {
      console.error(`❌ Unknown preset "${presetKey}". Run with --list to see available presets.`)
      process.exit(1)
    }
    bbox       = preset.bbox
    regionName = preset.region
  } else {
    bbox       = getArg(args, '--bbox')
    regionName = getArg(args, '--region') || 'Imported Region'
  }

  if (!bbox) {
    console.error('Error: --bbox or --preset is required.')
    console.error('Run with --list to see presets, or --help for full usage.')
    process.exit(1)
  }

  const regionSlug = regionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const outFile    = join(__dirname, `../public/data/regions/${regionSlug}.yaml`)

  if (existsSync(outFile) && !force) {
    console.warn(`⚠️  ${outFile} already exists.`)
    console.warn(`   Use --force to overwrite (existing file will be backed up to .bak).`)
    console.warn(`   Or use a different --region name.`)
    process.exit(1)
  }

  let bakFile = null
  if (existsSync(outFile) && force) {
    bakFile = `${outFile}.bak`
    renameSync(outFile, bakFile)
    console.log(`📦 Backed up existing file to ${bakFile}`)
  }

  let query
  try { query = buildQuery(bbox) } catch (e) {
    console.error(`Error: ${e.message}`)
    process.exit(1)
  }

  // ── fetch with retry ────────────────────────────────────────────────────────
  // Overpass can return 429 (rate limit) or 504/503 (overload) transiently.
  // Retry up to MAX_RETRIES times with exponential back-off before giving up.

  const MAX_RETRIES   = 3
  const RETRY_DELAY   = 4000   // ms base; doubles each attempt
  const RETRYABLE     = new Set([429, 500, 503, 504])

  async function fetchWithRetry(url, options) {
    let delay = RETRY_DELAY
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(url, options)
      if (res.ok) return res
      if (!RETRYABLE.has(res.status) || attempt === MAX_RETRIES) {
        throw Object.assign(
          new Error(`Overpass API returned ${res.status}: ${res.statusText}`),
          { status: res.status }
        )
      }
      console.warn(`⚠️  Attempt ${attempt}/${MAX_RETRIES} failed (${res.status}). Retrying in ${delay / 1000}s…`)
      await new Promise(r => setTimeout(r, delay))
      delay *= 2
    }
  }

  console.log(`\n🌍 Querying Overpass API for benches in [${bbox}]…`)

  let res
  try {
    res = await fetchWithRetry(OVERPASS_URL, {
      method:  'POST',
      body:    `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
  } catch (err) {
    // Restore backup so the region file is not left missing
    if (bakFile && existsSync(bakFile)) {
      renameSync(bakFile, outFile)
      console.warn(`♻️  Restored backup to ${outFile}`)
    }
    console.error(`❌ ${err.message}`)
    process.exit(1)
  }

  const data  = await res.json()
  const nodes = (data.elements || []).filter(e => e.type === 'node')

  if (!nodes.length) {
    // Nothing found — restore backup so we don't lose curated data
    if (bakFile && existsSync(bakFile)) {
      renameSync(bakFile, outFile)
      console.warn(`♻️  No results found; restored backup to ${outFile}`)
    } else {
      console.log('⚠️  No benches found in that bounding box. Try widening it.')
    }
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

  // Success — discard backup
  if (bakFile && existsSync(bakFile)) {
    const { unlinkSync } = await import('fs')
    unlinkSync(bakFile)
  }

  console.log(`\n📁 Written to ${outFile}`)
  console.log(`\n⚠️  Please review and verify coordinates before merging.`)
  console.log(`   Many OSM bench records have 'condition: unknown' — update where possible.`)
  console.log(`\n▶  Run: npm run validate`)
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
