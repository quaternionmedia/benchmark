#!/usr/bin/env node
/**
 * scripts/generate-catalogue.js
 * Generates docs/CATALOGUE.md from compiled benches.geojson
 * Run via: npm run catalogue
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GEOJSON_FILE = join(__dirname, '../public/data/benches.geojson')
const OUTPUT_FILE = join(__dirname, '../docs/CATALOGUE.md')

const CONDITION_EMOJI = { good: '🟢', fair: '🟡', poor: '🔴', unknown: '⚪' }
const MATERIAL_EMOJI = { wood: '🪵', metal: '⚙️', stone: '🪨', plastic: '🔵', concrete: '🏗️', other: '❓' }

function generateCatalogue() {
  const raw = readFileSync(GEOJSON_FILE, 'utf8')
  const data = JSON.parse(raw)
  const { features, metadata } = data

  // Group by region
  const byRegion = {}
  for (const f of features) {
    const r = f.properties.region
    if (!byRegion[r]) byRegion[r] = []
    byRegion[r].push(f.properties)
  }

  const conditionCounts = { good: 0, fair: 0, poor: 0, unknown: 0 }
  features.forEach(f => conditionCounts[f.properties.condition]++)

  const lines = []

  lines.push(`# benchmark — Bench Catalogue`)
  lines.push(``)
  lines.push(`> Auto-generated from YAML source data. Do not edit directly.  `)
  lines.push(`> Last generated: \`${metadata.generated_at}\``)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)
  lines.push(`## Summary`)
  lines.push(``)
  lines.push(`| Stat | Value |`)
  lines.push(`|---|---|`)
  lines.push(`| Total benches | **${metadata.total_benches}** |`)
  lines.push(`| Regions | **${metadata.regions}** |`)
  lines.push(`| Condition: Good | ${CONDITION_EMOJI.good} ${conditionCounts.good} |`)
  lines.push(`| Condition: Fair | ${CONDITION_EMOJI.fair} ${conditionCounts.fair} |`)
  lines.push(`| Condition: Poor | ${CONDITION_EMOJI.poor} ${conditionCounts.poor} |`)
  lines.push(`| Condition: Unknown | ${CONDITION_EMOJI.unknown} ${conditionCounts.unknown} |`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)
  lines.push(`## Table of Contents`)
  lines.push(``)
  for (const region of Object.keys(byRegion).sort()) {
    const slug = region.toLowerCase().replace(/\s+/g, '-')
    lines.push(`- [${region}](#${slug}) — ${byRegion[region].length} benches`)
  }
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  for (const region of Object.keys(byRegion).sort()) {
    const benches = byRegion[region]
    lines.push(`## ${region}`)
    lines.push(``)
    lines.push(`${benches.length} bench${benches.length !== 1 ? 'es' : ''} in this region.`)
    lines.push(``)

    for (const b of benches) {
      lines.push(`### ${b.name}`)
      lines.push(``)
      lines.push(`**ID:** \`${b.id}\`  `)
      lines.push(`**Coordinates:** \`${features.find(f => f.properties.id === b.id).geometry.coordinates[1]}, ${features.find(f => f.properties.id === b.id).geometry.coordinates[0]}\`  `)
      lines.push(`**Condition:** ${CONDITION_EMOJI[b.condition]} ${b.condition}  `)
      lines.push(`**Material:** ${MATERIAL_EMOJI[b.material] || '❓'} ${b.material}  `)
      lines.push(`**Seats:** ${b.seats}  `)
      lines.push(``)
      
      const features_list = []
      if (b.backrest) features_list.push('backrest')
      if (b.armrests) features_list.push('armrests')
      if (b.accessible) features_list.push('accessible')
      if (b.covered) features_list.push('covered')
      
      if (features_list.length > 0) {
        lines.push(`**Features:** ${features_list.join(', ')}  `)
        lines.push(``)
      }

      if (b.notes) {
        lines.push(`> ${b.notes}`)
        lines.push(``)
      }

      lines.push(`*Added by @${b.added_by} on ${b.added_at}*`)
      lines.push(``)
    }

    lines.push(`---`)
    lines.push(``)
  }

  lines.push(`*To add a bench, see [CONTRIBUTING.md](./CONTRIBUTING.md)*`)

  writeFileSync(OUTPUT_FILE, lines.join('\n'))
  console.log(`✅ Catalogue generated → docs/CATALOGUE.md (${features.length} benches across ${Object.keys(byRegion).length} regions)`)
}

generateCatalogue()
