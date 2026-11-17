// Minimal static server for the tests (no dependencies). Serves the repo root on PORT (default 4173).
const { createServer } = require('node:http')
const { readFile } = require('node:fs/promises')
const { join, normalize, extname } = require('node:path')

const ROOT = join(__dirname, '../..')
const TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
}
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
  try {
    const body = await readFile(join(ROOT, path))
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }).end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(Number(process.env.PORT) || 4173, '127.0.0.1')
