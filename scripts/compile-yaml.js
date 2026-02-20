#!/usr/bin/env node
/**
 * scripts/compile-yaml.js
 * Reads all region YAML files and compiles them into a single benches.geojson
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REGIONS_DIR = join(__dirname, '../public/data/regions')
const OUTPUT_FILE = join(__dirname, '../public/data/benches.geojson')

const VALID_MATERIALS = ['wood', 'metal', 'stone', 'plastic', 'concrete', 'other']
const VALID_CONDITIONS = ['good', 'fair', 'poor', 'unknown']

function validateBench(bench, regionName) {
  const errors = []
  const required = ['id', 'name', 'lat', 'lng', 'material', 'backrest', 'armrests', 'condition', 'seats', 'covered', 'added_by', 'added_at']

  for (const field of required) {
    if (bench[field] === undefined || bench[field] === null) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  if (bench.lat !== undefined && (bench.lat < -90 || bench.lat > 90)) {
    errors.push(`Invalid lat: ${bench.lat} (must be -90 to 90)`)
  }
  if (bench.lng !== undefined && (bench.lng < -180 || bench.lng > 180)) {
    errors.push(`Invalid lng: ${bench.lng} (must be -180 to 180)`)
  }
  if (bench.material && !VALID_MATERIALS.includes(bench.material)) {
    errors.push(`Invalid material: "${bench.material}". Must be one of: ${VALID_MATERIALS.join(', ')}`)
  }
  if (bench.condition && !VALID_CONDITIONS.includes(bench.condition)) {
    errors.push(`Invalid condition: "${bench.condition}". Must be one of: ${VALID_CONDITIONS.join(', ')}`)
  }
  if (bench.notes && bench.notes.length > 280) {
    errors.push(`Notes too long: ${bench.notes.length} chars (max 280)`)
  }

  if (errors.length > 0) {
    console.error(`\n❌ Validation errors in [${regionName}] bench "${bench.id || 'unknown'}":`)
    errors.forEach(e => console.error(`   • ${e}`))
  }

  return errors.length === 0
}

function compile() {
  console.log('📦 Compiling YAML regions → GeoJSON...\n')

  const files = readdirSync(REGIONS_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
  
  if (files.length === 0) {
    console.warn('⚠️  No YAML files found in', REGIONS_DIR)
    process.exit(1)
  }

  const features = []
  const seenIds = new Set()
  let totalBenches = 0
  let errors = 0

  for (const file of files) {
    const filePath = join(REGIONS_DIR, file)
    const raw = readFileSync(filePath, 'utf8')
    const data = parse(raw)

    if (!data.region || !data.benches) {
      console.error(`❌ ${file}: Missing 'region' or 'benches' keys`)
      errors++
      continue
    }

    const regionName = data.region.name
    console.log(`  📍 ${regionName} (${file}) — ${data.benches.length} benches`)

    for (const bench of data.benches) {
      if (seenIds.has(bench.id)) {
        console.error(`❌ Duplicate ID: "${bench.id}" in ${file}`)
        errors++
        continue
      }

      const valid = validateBench(bench, regionName)
      if (!valid) {
        errors++
        continue
      }

      seenIds.add(bench.id)
      totalBenches++

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [bench.lng, bench.lat]
        },
        properties: {
          id: bench.id,
          name: bench.name,
          region: regionName,
          material: bench.material,
          backrest: bench.backrest,
          armrests: bench.armrests,
          accessible: bench.accessible ?? null,
          condition: bench.condition,
          seats: bench.seats,
          covered: bench.covered,
          added_by: bench.added_by,
          added_at: bench.added_at,
          notes: bench.notes || null,
          image_url: bench.image_url || null
        }
      })
    }
  }

  if (errors > 0) {
    console.error(`\n❌ Compilation failed with ${errors} error(s). Fix them and retry.`)
    process.exit(1)
  }

  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      generated_at: new Date().toISOString(),
      total_benches: totalBenches,
      regions: files.length
    },
    features
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(geojson, null, 2))
  console.log(`\n✅ Compiled ${totalBenches} benches from ${files.length} regions → public/data/benches.geojson`)
}

compile()
