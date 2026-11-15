// Records the README gifs (and an mp4 of each) from the demo pages. Rerun after any visual change:
//   npm run media            (needs ffmpeg on PATH; PW_CHROMIUM_CHANNEL=chrome to use an installed Chrome)
// Each clip drives the real components with Playwright and records the browser viewport only. The page is shown at
// 2x zoom so text stays sharp after scaling down. A small dot stands in for the pointer, since headless recordings
// have no cursor; it is drawn by this script, not by the components.
const { chromium } = require('@playwright/test')
const { spawn, execFileSync } = require('node:child_process')
const { mkdirSync, rmSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

const ROOT = join(__dirname, '..')
const OUT = join(__dirname, 'media')
const TMP = join(OUT, '.raw')
const PORT = 4175
const BASE = `http://127.0.0.1:${PORT}/src/components`
const ZOOM = 2
const VIEW = { width: 1600, height: 900 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Pointer stand-in: a dot that follows the mouse and shrinks while pressed. Mouse coordinates are unzoomed, so divide.
const POINTER = (z) => {
  addEventListener('DOMContentLoaded', () => {
    const d = document.createElement('div')
    d.style.cssText = 'position:fixed;left:0;top:0;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:rgb(0 0 0/.35);border:1.5px solid #fff;box-shadow:0 0 0 1px rgb(0 0 0/.4);pointer-events:none;z-index:2147483647;transition:scale 80ms;opacity:0'
    document.body.append(d)
    addEventListener('mousemove', (e) => { d.style.opacity = 1; d.style.translate = `${e.clientX / z}px ${e.clientY / z}px` }, true)
    addEventListener('mousedown', () => { d.style.scale = .7 }, true)
    addEventListener('mouseup', () => { d.style.scale = 1 }, true)
  })
}

// Glide the mouse to the centre of an element.
async function glide(page, sel, steps = 18) {
  const b = await page.locator(sel).boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps })
}

const CLIPS = [
  {
    name: 'button-hover-press', page: 'button', crop: '#variants + .btn-row', alt: 'Hovering and pressing the primary, default and danger buttons: each lifts on hover and sinks when pressed.',
    async run(page) {
      for (const sel of ['#variants + .btn-row .btn--primary', '#variants + .btn-row .btn:not([class*="--"])', '#variants + .btn-row .btn--danger']) {
        await glide(page, sel); await sleep(500)
        await page.mouse.down(); await sleep(260); await page.mouse.up(); await sleep(450)
      }
      await page.mouse.move(10, 10, { steps: 18 }); await sleep(400)
    },
  },
  {
    name: 'button-busy', page: 'button', crop: '#guard', alt: 'Clicking Save: a spinner replaces the label for two seconds, and the button keeps its width.',
    async run(page) {
      await glide(page, '#try-save'); await sleep(400)
      await page.mouse.down(); await sleep(120); await page.mouse.up(); await sleep(700)
      for (let i = 0; i < 2; i++) { await page.mouse.down(); await sleep(100); await page.mouse.up(); await sleep(250) }
      await sleep(1600)
    },
  },
  {
    name: 'button-danger-dark', page: 'button', theme: 'dark', crop: '#variants + .btn-row', alt: 'In dark mode, the danger button is quiet at rest and fills red on hover.',
    async run(page) {
      await glide(page, '#variants + .btn-row .btn--danger'); await sleep(1100)
      await page.mouse.move(10, 10, { steps: 18 }); await sleep(700)
      await glide(page, '#variants + .btn-row .btn--danger'); await sleep(900)
    },
  },
  {
    name: 'button-keyboard', page: 'button', crop: '#variants + .btn-row', alt: 'Tabbing through the buttons: each shows a focus ring in its own colour.',
    async run(page) {
      await page.locator('#theme').focus(); await sleep(300)
      for (let i = 0; i < 3; i++) { await page.keyboard.press('Tab'); await sleep(650) }
      await page.keyboard.press('Shift+Tab'); await sleep(500)
    },
  },
  {
    name: 'kpi-tile', page: 'kpi-tile', crop: '#spark', padTop: 96, reload: true, alt: 'KPI tiles: the sparklines draw in from left to right, then a tile lifts on hover and shows its definition.',
    async run(page) {
      await sleep(1500)
      await glide(page, '#spark > a.kpi:nth-of-type(2)'); await sleep(1300)
      await glide(page, '#spark > a.kpi:nth-of-type(3)'); await sleep(1300)
      await page.mouse.move(10, 10, { steps: 18 }); await sleep(500)
    },
  },
]

async function record(browser, clip) {
  const context = await browser.newContext({ viewport: VIEW, colorScheme: clip.theme || 'light', recordVideo: { dir: TMP, size: VIEW } })
  await context.addInitScript(POINTER, ZOOM)
  // Zoom in, and hide the demo page's own headings and notes so only the component is in frame.
  await context.addInitScript((z) => addEventListener('DOMContentLoaded', () => {
    document.documentElement.style.zoom = z
    const s = document.createElement('style'); s.textContent = 'h2, .demo-bar, .demo-note, #presses { visibility: hidden; }'; document.head.append(s)
  }), ZOOM)
  const page = await context.newPage()
  const t0 = Date.now()
  await page.goto(`${BASE}/${clip.page}/index.html`)
  const target = page.locator(clip.crop)
  await target.scrollIntoViewIfNeeded()
  if (!clip.reload) await sleep(1200) // let the page settle before the clip starts
  const box = await target.boundingBox()
  const start = (Date.now() - t0) / 1000 - (clip.reload ? 0.6 : 0)
  await clip.run(page)
  const dur = (Date.now() - t0) / 1000 - start
  await context.close()
  return { file: await page.video().path(), start: Math.max(0, start), dur, box }
}

function encode(clip, { file, start, dur, box }) {
  const pad = 28, top = clip.padTop ?? pad // room for the shadows, the focus ring and (KPI) the tooltip
  const even = (n) => Math.max(2, Math.round(n / 2) * 2)
  const x = Math.max(0, Math.round(box.x - pad)), y = Math.max(0, Math.round(box.y - top))
  const w = even(Math.min(VIEW.width - x, box.width + pad * 2)), h = even(Math.min(VIEW.height - y, box.height + top + pad))
  const crop = `crop=${w}:${h}:${x}:${y}`
  const width = Math.min(800, w)
  const common = ['-y', '-loglevel', 'error', '-ss', start.toFixed(2), '-t', dur.toFixed(2), '-i', file]
  execFileSync('ffmpeg', [...common, '-vf', `${crop},fps=20,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, join(OUT, `${clip.name}.gif`)])
  execFileSync('ffmpeg', [...common, '-vf', `${crop},scale=${even(width)}:-2:flags=lanczos`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', '-an', join(OUT, `${clip.name}.mp4`)])
  console.log(`${clip.name}: ${dur.toFixed(1)}s · alt: ${clip.alt}`)
}

;(async () => {
  mkdirSync(TMP, { recursive: true })
  const server = spawn(process.execPath, [join(ROOT, 'test/e2e/serve.js')], { env: { ...process.env, PORT }, stdio: 'ignore' })
  await sleep(400)
  const browser = await chromium.launch({ channel: process.env.PW_CHROMIUM_CHANNEL || undefined })
  try {
    const only = process.argv[2]
    for (const clip of CLIPS.filter((c) => !only || c.name === only)) encode(clip, await record(browser, clip))
  } finally {
    await browser.close(); server.kill(); rmSync(TMP, { recursive: true, force: true })
  }
  console.log('Files:', readdirSync(OUT).filter((f) => !f.startsWith('.')).join(', '))
})()
