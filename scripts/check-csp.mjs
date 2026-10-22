// Every page's hash CSP covers every inline script it ships.
//   node scripts/check-csp.mjs                 the build in out/ (CI, deploy)
//   node scripts/check-csp.mjs --live BASE P…  pages of the live site
//                                              (smoke.sh): the <meta> policy
//                                              and the header one beside it
// A miss here means a page whose inline scripts the browser refuses — the
// site renders but nothing on it runs.
import { readFileSync } from 'node:fs'
import { HEADER_CSP, cspProblems } from '../src/csp.ts'
import { htmlFiles } from './finalize-export.mjs'

const args = process.argv.slice(2)
let bad = 0
const report = (where, problems) => {
  for (const p of problems) console.error(`FAIL ${where}: ${p}`)
  if (problems.length) bad++
}

if (args[0] === '--live') {
  const [base, ...paths] = args.slice(1)
  if (!base || paths.length === 0) throw new Error('usage: check-csp.mjs --live BASE PATH…')
  for (const path of paths) {
    const res = await fetch(base + path, { headers: { 'Sec-Fetch-Mode': 'navigate', Accept: 'text/html' } })
    const problems = res.ok ? await cspProblems(await res.text()) : [`HTTP ${res.status}`]
    if (res.headers.get('content-security-policy') !== HEADER_CSP) {
      problems.push(`header CSP is "${res.headers.get('content-security-policy')}", want HEADER_CSP`)
    }
    report(path, problems)
    if (!problems.length) console.log(`OK   ${path}`)
  }
} else {
  const files = htmlFiles()
  if (files.length === 0) throw new Error('no HTML in out/ — run npm run build first')
  for (const file of files) report(file, await cspProblems(readFileSync(file, 'utf8')))
  if (!bad) console.log(`check-csp: OK — ${files.length} pages, every inline script hashed in its own policy`)
}
process.exit(bad ? 1 : 0)
