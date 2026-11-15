// Button press guard. aria-busy="true" and aria-disabled="true" only describe a button; the browser still runs its
// click. This script drops the press on a .btn carrying either flag, before any handler runs: it listens on window in
// the capture phase, and also stops a form submitting. It affects .btn elements only; other buttons and links on the
// page are left alone. Keyboard activation (Enter, Space) arrives as a click, so it is covered. The button keeps focus
// and stays in the tab order, so keyboard and screen-reader users can still reach it and hear its reason. Use the real
// disabled attribute for a button that should leave the tab order. The flags are read on the button itself, never on
// an ancestor.
(() => {
  const CONTROL = '.btn'
  const locked = (el) => el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-busy') === 'true'
  const guard = (e) => {
    const c = e.target instanceof Element ? e.target.closest(CONTROL) : null
    if (!c || !locked(c)) return
    e.preventDefault()
    e.stopImmediatePropagation()
  }

  for (const type of ['click', 'auxclick']) window.addEventListener(type, guard, true)
})()
