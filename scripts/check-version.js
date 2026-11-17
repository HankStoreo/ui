// Fails when package.json's version doesn't match the newest "## vX.Y.Z" heading in CHANGELOG.md.
const { readFileSync } = require('node:fs')
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const latest = readFileSync('CHANGELOG.md', 'utf8').match(/^## v(\d+\.\d+\.\d+)/m)?.[1]
if (latest !== version) {
  console.error(`package.json is ${version} but CHANGELOG.md's latest entry is v${latest}`)
  process.exit(1)
}
