# Metals Encyclopedia

Vite web app for metallic / metalloid elements: encyclopedia entries (what it is, how it is made, uses, facts, images), robust multi-metal compare, and a reserved 3D mount for later.

## Run

```bash
npm install
npm run dev
```

## Data accuracy

- **Numeric properties** (mass, electron config, state, discovery year, melting/boiling, density): sourced from PubChem’s periodic-table CSV (see `src/data/pubchem-periodictable.csv`).
- **Conductivity, hardness, abundance**: carried from the prior dataset (PeriodicTable.com / Wolfram ElementData lineage).
- **Images**: Wikimedia Commons URLs from the prior dataset.
- **Narrative prose** (`overview`, `production`, `uses`): generated from retrieved sources via `npm run upgrade:narratives`:
  - **RSC Periodic Table** (Tier 2) — Appearance / Uses / Natural abundance (scraped into `src/data/rsc/`)
  - **USGS Mineral Commodity Summaries 2025** (Tier 1) — Domestic Production and Use excerpts when a chapter is mapped (`src/data/usgs/`)
  - Confidence in UI: **Confirmed** = RSC + USGS; **Single-source** = RSC only (typical for synthetic/superheavy elements without a USGS commodity chapter)

## 3D later

`src/viewer/mount.js` owns the `#element-viewer-3d` slot. Each metal already has `viewer.physicalSample` and `viewer.atomicModel` fields so a Three.js controller can drop in without reshaping encyclopedia data.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local app |
| `npm run scrape:rsc` | Re-fetch RSC accordion text (Playwright) |
| `npm run upgrade:narratives` | Rebuild narratives from RSC + USGS and regenerate `metals.js` |
| `npm run build:data` | Rebuild `src/data/metals.js` from raw + narratives |
| `npm run build` | Production bundle |
