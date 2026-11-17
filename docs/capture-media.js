// Records the README gifs (and an mp4 of each) from the demo pages. Rerun after any visual change:
//   npm run media [clip-name]   (needs ffmpeg and gifski on PATH; PW_CHROMIUM_CHANNEL=chrome to use an installed Chrome)
// Each clip drives the real components with Playwright. Frames are captured losslessly (PNG, page zoomed 2x) with
// their timestamps, retimed to a constant frame rate, cropped to the component, then encoded by gifski (gif) and
// x264 (mp4). A small dot stands in for the pointer, since headless captures have no cursor; it is drawn by this
// script, not by the components.
const { chromium } = require('@playwright/test')
const { spawn, execFileSync } = require('node:child_process')
const { mkdirSync, rmSync, readdirSync, writeFileSync, statSync } = require('node:fs')
const { join } = require('node:path')

const ROOT = join(__dirname, '..')
const OUT = join(__dirname, 'media')
const TMP = join(OUT, '.raw')
const PORT = 4175
const BASE = `http://127.0.0.1:${PORT}/src/components`
const Z = 2 // the page is zoomed 2x in a 2x viewport: headless screencasts ignore deviceScaleFactor
const VIEW = { width: 860 * Z, height: 560 * Z }
const FPS = 30
const GIF_MAX_W = 1200 // device pixels: sharp at ~600 CSS px on a retina screen
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Pointer stand-in: a dot that follows the mouse and shrinks while pressed. Mouse coordinates are unzoomed, so divide.
const POINTER = (z) => {
  addEventListener('DOMContentLoaded', () => {
    const d = document.createElement('div')
    d.id = 'cap-ptr'
    d.style.cssText =
      'position:fixed;left:0;top:0;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:rgb(0 0 0/.35);border:1.5px solid #fff;box-shadow:0 0 0 1px rgb(0 0 0/.4);pointer-events:none;z-index:2147483647;transition:scale 80ms;opacity:0'
    document.body.append(d)
    addEventListener(
      'mousemove',
      (e) => {
        d.style.opacity = 1
        d.style.translate = `${e.clientX / z}px ${e.clientY / z}px`
      },
      true,
    )
    addEventListener(
      'mousedown',
      () => {
        d.style.scale = 0.7
      },
      true,
    )
    addEventListener(
      'mouseup',
      () => {
        d.style.scale = 1
      },
      true,
    )
  })
}

// Glide the mouse onto an element (or a point) over `ms`, eased, one step per frame. `at` places the dot so it
// doesn't cover what the clip shows: by default on a button's bottom edge, under the label, icon and spinner.
const BTN = [0.5, 1, -3],
  TILE = [0.86, 0.22, 0]
async function glide(page, to, ms = 520, at = BTN) {
  let x, y
  if (typeof to === 'string') {
    const b = await page.locator(to).boundingBox()
    x = b.x + b.width * at[0]
    y = b.y + b.height * at[1] + at[2] * Z
  } else ({ x, y } = to)
  const from = page._ptr || { x: x - 240, y: y + 180 }
  const n = Math.max(2, Math.round(ms / (1000 / FPS)))
  for (let i = 1; i <= n; i++) {
    const t = i / n,
      e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e)
    await sleep(1000 / FPS)
  }
  page._ptr = { x, y }
}
const away = (page) => glide(page, { x: 20, y: (page._ptr?.y ?? 400) + 280 })
async function press(page, ms = 220) {
  await page.mouse.down()
  await sleep(ms)
  await page.mouse.up()
}
const setTheme = (page, v) =>
  page.evaluate((v) => {
    const s = document.getElementById('theme')
    s.value = v
    s.dispatchEvent(new Event('change'))
  }, v)

const CLIPS = [
  {
    name: 'button-hover-press',
    page: 'button',
    crop: '#variants + .btn-row',
    alt: 'Hovering and pressing the primary, default and danger buttons: each lifts on hover and sinks when pressed.',
    async run(page) {
      for (const sel of [
        '#variants + .btn-row .btn--primary',
        '#variants + .btn-row .btn:not([class*="--"])',
        '#variants + .btn-row .btn--danger',
      ]) {
        await glide(page, sel)
        await sleep(450)
        await press(page, 260)
        await sleep(450)
      }
      await away(page)
      await sleep(400)
    },
  },
  {
    name: 'button-icons',
    page: 'button',
    crop: '.btn-row:not(#icons-more):has(.icon--next)',
    alt: 'Hovering buttons with icons: each arrow nudges the way its action goes (down to download, forward to continue, up to import, out to share).',
    async run(page) {
      for (const sel of [
        '.btn:has(.icon-move)',
        '.btn-row:not(#icons-more) .btn:has(.icon--next)',
        '.btn:has(.icon--up)',
        '.btn:has(.icon--out)',
      ]) {
        await glide(page, sel, 600)
        await sleep(750)
      }
      await away(page)
      await sleep(500)
    },
  },
  {
    name: 'button-icons-all',
    page: 'button',
    crop: '#icons-more',
    alt: 'Hovering buttons in light and then dark mode: back slides left, refresh turns, add turns a quarter and next slides right.',
    async run(page) {
      const sels = [
        '#icons-more .btn:has(.icon--back)',
        '#icons-more .btn:has(.icon--turn)',
        '#icons-more .btn:has(.icon--add)',
        '#icons-more .btn:has(.icon--next)',
      ]
      await sleep(300)
      for (const sel of sels) {
        await glide(page, sel, 560)
        await sleep(700)
      }
      await away(page)
      await sleep(300)
      await setTheme(page, 'dark')
      await sleep(700)
      for (const sel of sels) {
        await glide(page, sel, 560)
        await sleep(700)
      }
      await away(page)
      await sleep(500)
    },
  },
  {
    name: 'button-busy',
    page: 'button',
    crop: '#guard',
    alt: 'Clicking Save: a spinner replaces the label for two seconds, the button keeps its width, and repeat clicks are ignored.',
    async run(page) {
      await glide(page, '#try-save')
      await sleep(350)
      await press(page, 120)
      await sleep(600)
      for (let i = 0; i < 2; i++) {
        await press(page, 100)
        await sleep(250)
      }
      await sleep(1500)
      await away(page)
      await sleep(300)
    },
  },
  {
    name: 'button-danger-dark',
    page: 'button',
    theme: 'dark',
    crop: '#variants + .btn-row',
    alt: 'In dark mode, the danger button is quiet at rest and fills red on hover.',
    async run(page) {
      await glide(page, '#variants + .btn-row .btn--primary')
      await sleep(700)
      await glide(page, '#variants + .btn-row .btn--danger')
      await sleep(1100)
      await away(page)
      await sleep(700)
      await glide(page, '#variants + .btn-row .btn--danger')
      await sleep(900)
    },
  },
  {
    name: 'button-keyboard',
    page: 'button',
    crop: '#variants + .btn-row',
    alt: 'Tabbing through the buttons: each shows a focus ring in its own colour.',
    async run(page) {
      await page.locator('#theme').focus()
      await sleep(300)
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Tab')
        await sleep(700)
      }
      await page.keyboard.press('Shift+Tab')
      await sleep(600)
    },
  },
  {
    name: 'kpi-tile',
    page: 'kpi-tile',
    crop: '#spark',
    padTop: 70,
    reload: true,
    alt: 'KPI tiles: the sparklines draw in from left to right, then a tile lifts on hover and shows its definition.',
    async run(page) {
      await sleep(1500)
      await glide(page, '#spark > a.kpi:nth-of-type(2)', 520, TILE)
      await sleep(1300)
      await glide(page, '#spark > a.kpi:nth-of-type(3)', 520, TILE)
      await sleep(1300)
      await away(page)
      await sleep(500)
    },
  },
  {
    name: 'kpi-colours',
    page: 'kpi-tile',
    crop: '.kpis:not(#colour-spark):has(.kpi--warn)',
    padTop: 70,
    alt: 'KPI tiles coloured by state (low battery, offline, all passed, none open), in light and then dark mode: each lifts on hover and shows its definition.',
    async run(page) {
      await sleep(500)
      for (const s of ['warn', 'alert', 'ok']) {
        await glide(page, `.kpis:not(#colour-spark) .kpi--${s}`, 520, TILE)
        await sleep(1000)
      }
      await away(page)
      await sleep(300)
      await setTheme(page, 'dark')
      await sleep(900)
      for (const s of ['warn', 'alert', 'ok']) {
        await glide(page, `.kpis:not(#colour-spark) .kpi--${s}`, 520, TILE)
        await sleep(1000)
      }
      await away(page)
      await sleep(600)
    },
  },
  {
    name: 'kpi-colour-spark',
    page: 'kpi-tile',
    crop: '#colour-spark',
    padTop: 70,
    reload: true,
    alt: 'Coloured KPI tiles (healthy, low battery, offline, all passed) whose sparklines draw in, then each lifts on hover, in light and then dark mode.',
    async run(page) {
      await sleep(1500)
      for (const n of [1, 2, 3]) {
        await glide(page, `#colour-spark > a.kpi:nth-of-type(${n})`, 520, TILE)
        await sleep(1000)
      }
      await away(page)
      await sleep(300)
      await setTheme(page, 'dark')
      await sleep(900)
      for (const n of [2, 3, 4]) {
        await glide(page, `#colour-spark > a.kpi:nth-of-type(${n})`, 520, TILE)
        await sleep(1000)
      }
      await away(page)
      await sleep(600)
    },
  },
  {
    name: 'kpi-states',
    page: 'kpi-tile',
    crop: '#states',
    padTop: 70,
    alt: "KPI tile states: loading pulses, couldn't load and no value show a dash, and a long value is abbreviated with the full figure in its definition.",
    async run(page) {
      await sleep(1600)
      await glide(page, '#states > .kpi:has(.kpi-v[aria-label])', 520, TILE)
      await sleep(1500)
      await away(page)
      await sleep(800)
    },
  },
]

// Hide everything but the target (and the pointer dot), so neighbouring rows don't show at the crop's edges.
const hideRest = (target) =>
  target.evaluate((el) => {
    for (let n = el; n.parentElement; n = n.parentElement)
      for (const s of n.parentElement.children)
        if (s !== n && s.id !== 'cap-ptr' && !/^(SCRIPT|STYLE|LINK)$/.test(s.tagName)) s.style.visibility = 'hidden'
  })
// The union of the target's children: a row's own box spans the page width, its buttons don't.
async function contentBox(target) {
  const boxes = (await Promise.all((await target.locator(':scope > *').all()).map((c) => c.boundingBox()))).filter(
    (b) => b?.width,
  )
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y))
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  }
}

async function record(browser, clip) {
  const context = await browser.newContext({ viewport: VIEW, colorScheme: clip.theme || 'light' })
  await context.addInitScript(POINTER, Z)
  // Hide the demo page's own headings and notes so only the component is in frame.
  await context.addInitScript(
    (z) =>
      addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.zoom = z
        const s = document.createElement('style')
        s.textContent = 'h2, .demo-bar, .demo-note, .kpis-cap, #presses { visibility: hidden; }'
        document.head.append(s)
      }),
    Z,
  )
  const page = await context.newPage()
  await page.goto(`${BASE}/${clip.page}/index.html`)
  const target = page.locator(clip.crop)
  await target.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await hideRest(target)
  await sleep(clip.reload ? 100 : 1000)
  const box = await contentBox(target)

  const frames = []
  const cdp = await context.newCDPSession(page)
  cdp.on('Page.screencastFrame', (f) => {
    frames.push({ t: f.metadata.timestamp, data: f.data })
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', {
    format: 'png',
    everyNthFrame: 1,
    maxWidth: VIEW.width,
    maxHeight: VIEW.height,
  })
  let start = Date.now() / 1000
  if (clip.reload) {
    // Replay the load animation; scroll back before the first paint so the clip opens on the component.
    await page.evaluate(() => sessionStorage.setItem('cap-y', String(scrollY)))
    await context.addInitScript(() => {
      history.scrollRestoration = 'manual'
      addEventListener('DOMContentLoaded', () => scrollTo(0, +sessionStorage.getItem('cap-y')))
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await hideRest(page.locator(clip.crop))
    start = Date.now() / 1000 - 0.05
  } else await sleep(200)
  await clip.run(page)
  const end = Date.now() / 1000
  await cdp.send('Page.stopScreencast')
  await context.close()
  return { frames, start, end, box }
}

function encode(clip, { frames, start, end, box }) {
  const dir = join(TMP, clip.name),
    seq = join(dir, 'seq')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(seq, { recursive: true })
  // The screencast sends a frame only when the page changes: hold each one until the next, at a fixed frame rate.
  const kept = frames.filter((f) => f.t >= start - 0.001 && f.t <= end)
  const before = frames.filter((f) => f.t < start).pop()
  if (before && !clip.reload) kept.unshift({ ...before, t: start })
  if (!kept.length) throw new Error(`${clip.name}: no frames captured`)
  kept.forEach((f, i) => {
    writeFileSync(join(dir, `${String(i).padStart(5, '0')}.png`), Buffer.from(f.data, 'base64'))
  })
  let list = 'ffconcat version 1.0\n'
  kept.forEach((f, i) => {
    list += `file '${String(i).padStart(5, '0')}.png'\nduration ${((kept[i + 1]?.t ?? end) - f.t).toFixed(4)}\n`
  })
  list += `file '${String(kept.length - 1).padStart(5, '0')}.png'\n`
  writeFileSync(join(dir, 'list.ffconcat'), list)

  const pad = 24 * Z,
    top = (clip.padTop ?? 24) * Z // room for the shadows, the focus ring and (KPI) the definition
  const even = (n) => Math.max(2, Math.round(n / 2) * 2)
  const x = Math.max(0, box.x - pad),
    y = Math.max(0, box.y - top)
  const w = even(Math.min(VIEW.width - x, box.width + pad * 2)),
    h = even(Math.min(VIEW.height - y, box.height + top + pad))
  const crop = `crop=${w}:${h}:${even(x)}:${even(y)}`
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    join(dir, 'list.ffconcat'),
    '-vf',
    `${crop},fps=${FPS}`,
    '-fps_mode',
    'cfr',
    join(seq, '%05d.png'),
  ])

  const gifW = Math.min(GIF_MAX_W, w)
  const pngs = readdirSync(seq)
    .filter((f) => f.endsWith('.png'))
    .sort()
    .map((f) => join(seq, f))
  execFileSync('gifski', [
    '--quiet',
    '--fps',
    String(FPS),
    '--quality',
    '92',
    '--width',
    String(gifW),
    '-o',
    join(OUT, `${clip.name}.gif`),
    ...pngs,
  ])
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-framerate',
    String(FPS),
    '-i',
    join(seq, '%05d.png'),
    '-vf',
    `scale=${even(gifW)}:-2:flags=lanczos`,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '16',
    '-movflags',
    '+faststart',
    '-an',
    join(OUT, `${clip.name}.mp4`),
  ])
  const kb = (f) => Math.round(statSync(join(OUT, f)).size / 1024)
  console.log(
    `${clip.name}: ${(end - start).toFixed(1)}s, ${kept.length} captured frames (${(kept.length / (end - start)).toFixed(0)}/s), ${gifW}px, gif ${kb(`${clip.name}.gif`)} KB, mp4 ${kb(`${clip.name}.mp4`)} KB`,
  )
}

;(async () => {
  mkdirSync(TMP, { recursive: true })
  const server = spawn(process.execPath, [join(ROOT, 'test/e2e/serve.js')], {
    env: { ...process.env, PORT },
    stdio: 'ignore',
  })
  await sleep(400)
  const browser = await chromium.launch({ channel: process.env.PW_CHROMIUM_CHANNEL || undefined })
  try {
    const only = process.argv[2]
    for (const clip of CLIPS.filter((c) => !only || c.name === only)) encode(clip, await record(browser, clip))
  } finally {
    await browser.close()
    server.kill()
    if (!process.env.KEEP_RAW) rmSync(TMP, { recursive: true, force: true })
  }
  console.log(
    'Files:',
    readdirSync(OUT)
      .filter((f) => !f.startsWith('.'))
      .join(', '),
  )
})()
