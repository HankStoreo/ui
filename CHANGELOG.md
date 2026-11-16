# Changelog

Each release is a git tag (`vX.Y.Z`). Breaking changes to class names, attributes or markup bump the major version.

## v0.1.1 · lint

- Tooling: [Biome](https://biomejs.dev) lint (`npm run lint`, recommended rules, warnings fail) with a CI job beside the tests. The rules match the design-system source the components are exported from.
- Internal fixes from the lint, with no class, markup or visual change: button and KPI tile CSS rules reordered so no rule is overridden by a less specific one earlier in the file (same computed styles); a KPI tile `forEach` callback no longer returns a value; three small fixes in the media script.
- Docs only: two new demo sections (coloured tiles with sparklines; every moving button icon), their gifs, and more media on the landing page. No component changes.

## v0.1.0 · first public release

- Button: primary, go and danger variants; disabled and busy states; directional icons that nudge on hover; a press guard for `.btn`.
- KPI tile: band, figure sizing, sparkline, definitions, state colours, and loading, error and missing states.
- Tokens for light and dark, shared spinner and `.sr-only`, standalone demos, and tests in Chromium, Firefox and WebKit.
