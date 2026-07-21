# Reference database (offline pulls)

Separate from the live app data in `src/data/`.

This folder holds **fresh downloads** from Tier‑1/2 sources for every metal already in the catalog. Use it to **compare** against `src/data/metals.js` / `metals-raw.json`, then decide what to merge into the app later.

## Layout

```
reference-db/
  README.md                 ← tracked
  schema.md                 ← tracked (field notes)
  raw/                      ← gitignored (source dumps)
    pubchem/
    wikipedia/
    usgs/
    rsc/                    ← optional (--rsc)
  assembled/                ← gitignored (merged snapshots)
    elements/{key}.json
    index.json
    manifest.json
```

**Nothing under `raw/` or `assembled/` is committed.** Rebuild anytime with the fetch script.

## Fetch

```bash
npm run fetch:reference-db
# force re-download:
npm run fetch:reference-db -- --force
# subset:
npm run fetch:reference-db -- --only=lithium,copper
# live RSC scrape (needs Playwright); default copies app RSC cache into the vault:
npm run fetch:reference-db -- --rsc
```

Catalog keys come from `src/data/metals-raw.json` (same set the app uses).

`raw/` and `assembled/` are **gitignored** (~60 MB after a full pull). Only this README + `schema.md` are tracked.

## Sources pulled

| Source | What | Tier |
| --- | --- | --- |
| PubChem Periodic Table CSV | Identity + melt/boil/density | 1 |
| PubChem element PUG JSON | Per-element record snapshot | 1 |
| Wikipedia REST summary | Short extract (comparison only) | 3 |
| USGS MCS 2025 chapter text | Domestic production chapters we map | 1 |
| RSC Periodic Table | Appearance / uses / abundance (`--rsc`) | 2 |

## Next step (not built yet)

Compare `assembled/elements/*.json` ↔ app `metals.js` and produce a diff report, then selective import into `metals-raw.json` / narratives.
