#!/usr/bin/env node
/**
 * Pre-commit guard: blocks commits that could leak personal Bitcoin data.
 *
 * Fails if any staged file
 *   - is a .csv other than sample-data.csv, or
 *   - (other than sample-data.csv) contains something that looks like a Bitcoin
 *     address (bech32 bc1…, legacy/P2SH base58 1…/3…) or a 64-char hex transaction ID.
 *
 * Usage: node scripts/check-secrets.mjs          (checks staged files)
 *        node scripts/check-secrets.mjs --all    (checks all tracked files)
 */
import { execFileSync } from 'node:child_process'

const ALLOWED_CSV = 'sample-data.csv'
const SKIP_CONTENT = new Set([ALLOWED_CSV, 'package-lock.json'])
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip|gz)$/i

const PATTERNS = [
  { name: 'bech32 Bitcoin address', re: /\b(?:bc1|tb1)[ac-hj-np-z02-9]{11,71}\b/gi },
  {
    name: 'base58 Bitcoin address',
    re: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,
    // Real addresses mix letters and digits; skips long plain words/numbers.
    filter: (m) => /[a-zA-Z]/.test(m.slice(1)) && /\d/.test(m.slice(1)),
  },
  { name: '64-char hex transaction ID', re: /\b[0-9a-fA-F]{64}\b/g },
]

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

const all = process.argv.includes('--all')
const files = (all ? git('ls-files') : git('diff', '--cached', '--name-only', '--diff-filter=ACMR'))
  .split('\n')
  .filter(Boolean)

const problems = []

for (const file of files) {
  const base = file.split('/').pop()
  if (/\.csv$/i.test(file) && file !== ALLOWED_CSV) {
    problems.push(`${file}: CSV files must not be committed (only ${ALLOWED_CSV} is allowed)`)
    continue
  }
  if (/\.(xlsx?|ods)$/i.test(file)) {
    problems.push(`${file}: spreadsheet files must not be committed`)
    continue
  }
  if (SKIP_CONTENT.has(file) || SKIP_CONTENT.has(base) || BINARY_EXT.test(file)) continue

  let content
  try {
    content = all ? git('show', `HEAD:${file}`) : git('show', `:${file}`)
  } catch {
    continue
  }

  const lines = content.split('\n')
  lines.forEach((line, i) => {
    for (const { name, re, filter } of PATTERNS) {
      for (const match of line.matchAll(re)) {
        if (filter && !filter(match[0])) continue
        const shown = `${match[0].slice(0, 6)}…${match[0].slice(-4)}`
        problems.push(`${file}:${i + 1}: looks like a ${name} (${shown})`)
      }
    }
  })
}

if (problems.length > 0) {
  console.error('\n✖ Commit blocked — possible personal Bitcoin data:\n')
  for (const p of problems) console.error(`  • ${p}`)
  console.error(
    '\nKeep real exports in private/ (gitignored). Tests and fixtures must use obviously fake identifiers.\n',
  )
  process.exit(1)
}
console.log(`✔ check-secrets: ${files.length} file(s) clean`)
