# Metals Encyclopedia

Vite web app for metallic / metalloid elements: encyclopedia entries (what it is, how it is made, uses, facts, images), robust multi-metal compare, and a reserved 3D mount for later.

## Run

```bash
npm install
npm run dev
```

## Hosting (Cloudflare Pages)

`vite.config.js` uses `base: '/'` for a custom domain (or `*.pages.dev`) at the site root.

Typical Pages settings: framework **None** or **Vite**, build `npm run build`, output `dist`.

After deploy: **Custom domains** → add your domain (DNS on Cloudflare makes this easy).

## Data accuracy

- **Numeric properties** (mass, electron config, state, discovery year, melting/boiling, density): sourced from PubChem’s periodic-table CSV (see `src/data/pubchem-periodictable.csv`).
- **Conductivity, hardness, abundance**: carried from the prior dataset (PeriodicTable.com / Wolfram ElementData lineage).
- **Images**: Wikimedia Commons URLs from the prior dataset.
- **Narrative prose** (`overview`, `production`, `uses`): generated from retrieved sources via `npm run upgrade:narratives`:
  - **RSC Periodic Table** (Tier 2) — Appearance / Uses / Natural abundance (scraped into `src/data/rsc/`)
  - **USGS Mineral Commodity Summaries 2025** (Tier 1) — Domestic Production and Use excerpts when a chapter is mapped (`src/data/usgs/`)
  - Confidence in UI: **Dual-sourced** = RSC + USGS chapter that covers the element (provenance, not per-claim fact-check); **Single-source** = RSC only (typical for synthetic/superheavy elements without a USGS commodity chapter)

## 3D later

`src/viewer/mount.js` owns the `#element-viewer-3d` slot. Each metal already has `viewer.physicalSample` and `viewer.atomicModel` fields so a Three.js controller can drop in without reshaping encyclopedia data.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local app |
| `npm run scrape:rsc` | Re-fetch RSC accordion text (Playwright) |
| `npm run upgrade:narratives` | Rebuild narratives from RSC + USGS and regenerate `metals.js` |
| `npm run build:data` | Rebuild `src/data/metals.js` from raw + narratives |
| `npm run check:data` | Fail if `metals.js` drifted from raw + narratives (CI / pre-commit) |
| `npm run import:vault:apply` | Apply safe PubChem numeric patches and rebuild `metals.js` |
| `npm run build` | Production bundle |

### Keep `metals.js` in sync

`src/data/metals.js` is generated — do not edit by hand. After changing `metals-raw.json` or `scripts/narratives.mjs`, run `npm run build:data`. CI runs `npm run check:data` on every push/PR.

Optional local pre-commit (auto-rebuilds when raw/narratives are staged):

```bash
git config core.hooksPath .githooks
```
