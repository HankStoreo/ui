// KPI tile behaviour. Loads with the page and keeps up with changes, through one MutationObserver on the document:
//  - draws each data-spark sparkline (monotone cubic, so it never overshoots a peak or trough); a value alone between
//    gaps is a dot; fewer than two numbers draws nothing
//  - sizes each figure by its length (--kpi-len), leaving out any .sr-only word
//  - names a static tile (div.kpi[tabindex]) as a group labelled by its figure and label
//  - describes each tile by its data-tip, through a hidden element and aria-describedby
// Call kpiTile.render(root) to redo a part of the page by hand.
(() => {
  const W = 100, H = 40, PAD = 3
  function monotonePath(p) {
    const n = p.length;
    if (n === 0) return '';
    const f = (v) => +v.toFixed(2);
    if (n === 1) return `M${f(p[0][0])},${f(p[0][1])}`;
    if (n === 2) return `M${f(p[0][0])},${f(p[0][1])}L${f(p[1][0])},${f(p[1][1])}`;
    const d = [], m = [];
    for (let i = 0; i < n - 1; i++) d[i] = (p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
      if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    let s = `M${f(p[0][0])},${f(p[0][1])}`;
    for (let i = 0; i < n - 1; i++) {
      const dx = (p[i + 1][0] - p[i][0]) / 3;
      s += `C${f(p[i][0] + dx)},${f(p[i][1] + m[i] * dx)} ${f(p[i + 1][0] - dx)},${f(p[i + 1][1] - m[i + 1] * dx)} ${f(p[i + 1][0])},${f(p[i + 1][1])}`;
    }
    return s;
  }
  let n = 0
  function draw(tile) {
    const raw = tile.dataset.spark || ''
    const old = tile.querySelector(':scope > .kpi-spark')
    if (old && old.dataset.series === raw) return
    const s = parse(raw)
    old?.remove()
    const vals = s.filter((v) => v !== null)
    if (vals.length < 2 || s.length < 2) { tile.classList.remove('kpi--spark'); return }
    const max = Math.max(...vals), min = Math.min(...vals), r = (max - min) || 1
    const pt = (v, i) => [(i / (s.length - 1)) * W, PAD + (1 - (v - min) / r) * (H - PAD * 2)]

    const runs = []
    s.forEach((v, i) => { if (v === null) return; const last = runs.at(-1); if (last && last.at(-1)[2] === i - 1) last.push([...pt(v, i), i]); else runs.push([[...pt(v, i), i]]) })
    const f = (x) => +x.toFixed(2)
    const curve = (run) => monotonePath(run.map(([x, y]) => [x, y]))
    const lines = runs.filter((run) => run.length > 1)
    const line = lines.map(curve).join('')
    const area = lines.map((run) => `${curve(run)} L${f(run.at(-1)[0])},${H} L${f(run[0][0])},${H} Z`).join('')
    const dots = runs.filter((run) => run.length === 1).map(([[x, y]]) => `M${f(x)},${f(y)}h0`).join('')
    const id = `kpi-spark-${++n}`
    tile.insertAdjacentHTML('afterbegin', `<svg class="kpi-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
      `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop class="wash-top" offset="0"/><stop class="wash-bot" offset="1"/></linearGradient>` +

      `<filter id="${id}-g" filterUnits="userSpaceOnUse" x="-10" y="-20" width="${W + 20}" height="${H + 40}"><feGaussianBlur stdDeviation="2"/></filter></defs>` +
      (area ? `<path class="area" d="${area}" fill="url(#${id})"/><path class="glow" d="${line}" filter="url(#${id}-g)"/><path class="hi" d="${line}"/><path class="line" d="${line}"/>` : '') +
      (dots ? `<path class="dot" d="${dots}"/>` : '') + '</svg>')
    tile.firstElementChild.dataset.series = raw
    tile.classList.add('kpi--spark')
  }
  const NUM = /^-?(\d+(\.\d*)?|\.\d+)$/
  function parse(raw) { return raw.trim() ? raw.split(',').map((t) => (NUM.test(t.trim()) ? Number(t.trim()) : null)) : [] }
  function measure(v) {
    const text = [...v.childNodes].filter((c) => !(c.nodeType === 1 && c.matches('.sr-only'))).map((c) => c.textContent).join('')
    v.style.setProperty('--kpi-len', [...text.trim()].length)
  }
  let ids = 0
  const idOf = (el) => { if (!el.id) { let id; do id = `kpi-part-${++ids}`; while (document.getElementById(id)); el.id = id } return el.id }
  function name(tile) {
    if (!tile.hasAttribute('role')) tile.setAttribute('role', 'group')
    if (tile.hasAttribute('aria-label') || tile.hasAttribute('aria-labelledby')) return
    const parts = tile.querySelectorAll(':scope > .kpi-v, :scope > .kpi-l')
    if (parts.length) tile.setAttribute('aria-labelledby', [...parts].map(idOf).join(' '))
  }
  let descs = 0
  function describe(tile) {
    const text = (tile.dataset.tip || '').trim()
    let d = tile.dataset.descId ? document.getElementById(tile.dataset.descId) : null
    const ids = (tile.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)
    if (!text) {
      if (d) { tile.setAttribute('aria-describedby', ids.filter((i) => i !== d.id).join(' ')); d.remove(); delete tile.dataset.descId }
      return
    }
    if (!d) {
      d = document.createElement('span'); d.className = 'kpi-desc'; d.hidden = true
      let id; do id = `kpi-desc-${++descs}`; while (document.getElementById(id))
      d.id = id; tile.dataset.descId = id; tile.after(d)
    }
    if (d.textContent !== text) d.textContent = text
    if (!ids.includes(d.id)) tile.setAttribute('aria-describedby', [...ids, d.id].join(' '))
  }
  function kpiSpark(root = document) {
    root.querySelectorAll('.kpi > .kpi-v').forEach(measure)
    root.querySelectorAll('div.kpi[tabindex]').forEach(name)
    root.querySelectorAll('.kpis').forEach((band) => { [...band.querySelectorAll(':scope > .kpi')].forEach((t, i) => { t.style.setProperty('--kpi-i', i) }) })
    root.querySelectorAll('.kpi[data-spark], .kpi--spark').forEach(draw)
    root.querySelectorAll('.kpi[data-tip]').forEach(describe)
  }
  window.kpiTile = { render: kpiSpark }
  function start() {
    kpiSpark()
    new MutationObserver((recs) => {
      for (const r of recs) {
        if (r.type === 'attributes') { if (r.target.matches('.kpi')) { if (r.attributeName === 'data-tip') describe(r.target); else draw(r.target) } continue }
        const fig = r.target.nodeType === 1 ? r.target.closest('.kpi > .kpi-v') : r.target.parentElement?.closest('.kpi > .kpi-v')
        if (fig) measure(fig)
        for (const el of r.addedNodes) if (el.nodeType === 1 && !el.matches('svg.kpi-spark, .kpi-desc')) {
          el.querySelectorAll?.('.kpi > .kpi-v').forEach(measure); if (el.matches('.kpi > .kpi-v')) measure(el)
          if (el.matches('.kpi[data-spark]')) draw(el)
          if (el.matches('div.kpi[tabindex]')) name(el); el.querySelectorAll?.('div.kpi[tabindex]').forEach(name)
          if (el.matches('.kpi[data-tip]')) describe(el); el.querySelectorAll?.('.kpi[data-tip]').forEach(describe)
          if (el.querySelector?.('.kpi[data-spark]')) kpiSpark(el.matches('.kpis') ? el.parentNode : el)
        }
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-spark', 'data-tip'] })
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start()
})();
