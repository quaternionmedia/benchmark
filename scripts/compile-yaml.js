#!/usr/bin/env node
/**
 * scripts/compile-yaml.js
 * Reads all region YAML files and compiles them into a single benches.geojson
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parse, stringify as yamlStringify } from 'yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REGIONS_DIR = join(__dirname, '../public/data/regions')
const OUTPUT_FILE = join(__dirname, '../public/data/benches.geojson')

const VALID_MATERIALS = ['wood', 'metal', 'stone', 'plastic', 'concrete', 'other']
const VALID_CONDITIONS = ['good', 'fair', 'poor', 'unknown']

/**
 * Validate a bench object.
 * When fix=true, auto-repair common problems in-place and return the fixed bench
 * (or null if the problem is unfixable, e.g. missing coordinates).
 * When fix=false, return null on any error (original behaviour).
 */
function validateBench(bench, regionName, fix = false) {
  const fixes   = []
  const errors  = []

  const required = ['id', 'name', 'lat', 'lng', 'material', 'backrest', 'armrests', 'condition', 'seats', 'covered', 'added_by', 'added_at']

  for (const field of required) {
    if (bench[field] === undefined || bench[field] === null) {
      if (!fix) {
        errors.push(`Missing required field: ${field}`)
        continue
      }
      // Autofix: apply safe defaults
      if      (field === 'material')   { bench.material  = 'other';    fixes.push(`material → 'other'`) }
      else if (field === 'condition')  { bench.condition = 'unknown';  fixes.push(`condition → 'unknown'`) }
      else if (field === 'backrest')   { bench.backrest  = false;      fixes.push(`backrest → false`) }
      else if (field === 'armrests')   { bench.armrests  = false;      fixes.push(`armrests → false`) }
      else if (field === 'covered')    { bench.covered   = false;      fixes.push(`covered → false`) }
      else if (field === 'seats')      { bench.seats     = 2;          fixes.push(`seats → 2`) }
      else if (field === 'added_by')   { bench.added_by  = 'unknown';  fixes.push(`added_by → 'unknown'`) }
      else if (field === 'added_at')   { bench.added_at  = new Date().toISOString().slice(0, 10); fixes.push(`added_at → today`) }
      else {
        // lat/lng/id/name cannot be safely guessed — still an error
        errors.push(`Missing required field: ${field} (cannot be auto-fixed)`)
      }
    }
  }

  if (bench.lat !== undefined && (bench.lat < -90 || bench.lat > 90)) {
    errors.push(`Invalid lat: ${bench.lat} (must be -90 to 90)`)
  }
  if (bench.lng !== undefined && (bench.lng < -180 || bench.lng > 180)) {
    errors.push(`Invalid lng: ${bench.lng} (must be -180 to 180)`)
  }

  if (bench.material && !VALID_MATERIALS.includes(bench.material)) {
    if (fix) {
      fixes.push(`material "${bench.material}" → 'other'`)
      bench.material = 'other'
    } else {
      errors.push(`Invalid material: "${bench.material}". Must be one of: ${VALID_MATERIALS.join(', ')}`)
    }
  }

  if (bench.condition && !VALID_CONDITIONS.includes(bench.condition)) {
    if (fix) {
      fixes.push(`condition "${bench.condition}" → 'unknown'`)
      bench.condition = 'unknown'
    } else {
      errors.push(`Invalid condition: "${bench.condition}". Must be one of: ${VALID_CONDITIONS.join(', ')}`)
    }
  }

  if (bench.notes && bench.notes.length > 280) {
    if (fix) {
      fixes.push(`notes truncated (${bench.notes.length} → 280 chars)`)
      bench.notes = bench.notes.slice(0, 280)
    } else {
      errors.push(`Notes too long: ${bench.notes.length} chars (max 280)`)
    }
  }

  // Ensure optional fields exist as null rather than undefined (clean YAML output)
  if (fix) {
    if (bench.accessible === undefined) bench.accessible = null
    if (bench.notes      === undefined) bench.notes      = null
    if (bench.image_url  === undefined) bench.image_url  = null
  }

  if (fixes.length > 0) {
    console.warn(`  🔧 Auto-fixed [${regionName}] "${bench.id || 'unknown'}": ${fixes.join(', ')}`)
  }

  if (errors.length > 0) {
    console.error(`\n❌ Validation errors in [${regionName}] bench "${bench.id || 'unknown'}":`)
    errors.forEach(e => console.error(`   • ${e}`))
    return null
  }

  return bench
}

/**
 * Escape bare newlines inside YAML double-quoted scalars.
 * The old hand-rolled importer could write:  notes: "line one\nline two"
 * where \n is a LITERAL newline — strict YAML parsers reject this.
 * Walk char-by-char: inside a double-quoted scalar, replace \n → \\n.
 */
function fixYamlText(raw) {
  const out = []
  let inDQ = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '\\' && inDQ) {
      out.push(ch, raw[++i])        // consume escape pair as-is
    } else if (ch === '"') {
      inDQ = !inDQ
      out.push(ch)
    } else if (ch === '\n' && inDQ) {
      out.push('\\n')               // escape the bare newline
    } else {
      out.push(ch)
    }
  }
  return out.join('')
}

function compile() {
  const fix = process.argv.includes('--fix')

  console.log(`📦 Compiling YAML regions → GeoJSON${fix ? ' (--fix mode)' : ''}...\n`)

  const files = readdirSync(REGIONS_DIR).filter(f => (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.endsWith('.bak'))

  if (files.length === 0) {
    console.warn('⚠️  No YAML files found in', REGIONS_DIR)
    process.exit(1)
  }

  const features      = []
  const seenIds       = new Set()
  let totalBenches    = 0
  let errors          = 0
  let totalFixedFiles = 0

  for (const file of files) {
    const filePath = join(REGIONS_DIR, file)
    let raw, data

    try {
      raw  = readFileSync(filePath, 'utf8')
      try {
        data = parse(raw)
      } catch (parseErr) {
        if (!fix) throw parseErr
        // --fix: escape bare newlines inside double-quoted scalars, then retry
        console.warn(`  🔧 YAML parse error in ${file} — attempting text repair…`)
        const fixed = fixYamlText(raw)
        data = parse(fixed)   // throws again if still broken (unfixable)
        writeFileSync(filePath, fixed)
        console.warn(`  ✏️  Rewrote ${file} with escaped newlines`)
      }
    } catch (e) {
      console.error(`❌ ${file}: YAML parse error — ${e.message}`)
      errors++
      continue
    }

    if (!data.region || !data.benches) {
      console.error(`❌ ${file}: Missing 'region' or 'benches' keys`)
      errors++
      continue
    }

    const regionName  = data.region.name
    let   fixedInFile = 0
    console.log(`  📍 ${regionName} (${file}) — ${data.benches.length} benches`)

    for (const bench of data.benches) {
      if (seenIds.has(bench.id)) {
        console.error(`❌ Duplicate ID: "${bench.id}" in ${file}`)
        errors++
        continue
      }

      const result = validateBench(bench, regionName, fix)
      if (result === null) {
        errors++
        continue
      }

      // validateBench mutates bench in-place when fix=true; count changes
      if (fix) fixedInFile++

      seenIds.add(bench.id)
      totalBenches++

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [bench.lng, bench.lat]
        },
        properties: {
          id:        bench.id,
          name:      bench.name,
          region:    regionName,
          material:  bench.material,
          backrest:  bench.backrest,
          armrests:  bench.armrests,
          accessible: bench.accessible ?? null,
          condition: bench.condition,
          seats:     bench.seats,
          covered:   bench.covered,
          added_by:  bench.added_by,
          added_at:  bench.added_at,
          notes:     bench.notes || null,
          image_url: bench.image_url || null
        }
      })
    }

    // Rewrite YAML if any bench in this file was touched by --fix
    if (fix && fixedInFile > 0) {
      writeFileSync(filePath, yamlStringify(data, { lineWidth: 0 }))
      console.log(`  ✏️  Rewrote ${file} with fixes applied`)
      totalFixedFiles++
    }
  }

  if (errors > 0) {
    console.error(`\n❌ Compilation failed with ${errors} error(s).`)
    if (!fix) console.error(`   Run with --fix to auto-repair common issues: npm run validate:fix`)
    process.exit(1)
  }

  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      generated_at:  new Date().toISOString(),
      total_benches: totalBenches,
      regions:       files.length
    },
    features
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(geojson, null, 2))

  if (fix && totalFixedFiles > 0) {
    console.log(`\n🔧 Fixed and rewrote ${totalFixedFiles} YAML file(s).`)
  }
  console.log(`\n✅ Compiled ${totalBenches} benches from ${files.length} regions → public/data/benches.geojson`)
}

compile()
