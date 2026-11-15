// Shared test helpers: the URL of a demo page, and an axe run on it.
// The pages are served over HTTP (test/e2e/serve.js, started by playwright.config.js), as a user would load them.
const demo = (name) => `http://127.0.0.1:4173/src/components/${name}/index.html`

async function axe(page) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
  return page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) })))
}

module.exports = { demo, axe }
