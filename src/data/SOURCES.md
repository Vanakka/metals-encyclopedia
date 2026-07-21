# Metals Encyclopedia — where data comes from

Use this file when something is missing or wrong. It lists **what we store**, **where it comes from**, and **where to look next**.

---

## Quick map

| Need | Primary place to look | Already in repo? |
| --- | --- | --- |
| Identity (Z, mass, config, state, discovery year) | PubChem periodic table | Yes → `metals-raw.json` via original extract / PubChem CSV |
| Melt / boil / density | PubChem periodic table | Yes → `metals-raw.json` |
| Electrical / thermal conductivity, Mohs, Brinell, abundances | PeriodicTable.com / Wolfram ElementData | Yes → `metals-raw.json` (null = N/A there) |
| What it is / uses / biology | RSC Periodic Table | Yes → `src/data/rsc/` |
| Industrial production (US) | USGS MCS 2025 chapter | Partial → `src/data/usgs/text/` + map in `scripts/upgrade-narratives.mjs` |
| Specimen photo | Wikimedia Commons | Yes → `imageUrl` / credit fields in raw |
| Narrative confidence | RSC ± USGS dual-source rule | Built by `scripts/upgrade-narratives.mjs` |

Rebuild after source changes:

```bash
npm run upgrade:narratives   # RSC + USGS → narratives.mjs
npm run build:data           # raw + narratives → metals.js
# or: npm run build
```

---

## Sources in detail

### 1. PubChem Periodic Table (Tier 1)

- **URL:** https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/CSV  
- **Element pages:** `https://pubchem.ncbi.nlm.nih.gov/element/{Name}`  
- **Good for:** Atomic number, atomic mass, electron configuration, standard state, year discovered, melting/boiling point, density.  
- **We store:** Subset in `src/data/metals-raw.json`.  
- **We do not store:** Full PubChem compound records, spectra, toxicity dossiers, isotope tables.  
- **When to revisit:** Thermo/density null or wrong → re-check PubChem element page / CSV; patch `metals-raw.json` then `npm run build:data`.

### 2. PeriodicTable.com / Wolfram ElementData (Tier 2)

- **URL pattern:** `https://periodictable.com/Elements/{ZZZ}/data.html` (Z zero-padded to 3)  
- **Good for:** Electrical conductivity (S/m), thermal conductivity, Mohs, Brinell, crust/universe/ocean abundance.  
- **We store:** Those fields in `metals-raw.json` when present.  
- **Gap rule:** If the page says **N/A**, leave null — do not invent. Scraper: `scripts/scrape-property-gaps.mjs`.  
- **When to revisit:** Hardness/conductivity missing for a *stable* metal → open that data.html; if still N/A, try CRC / NIST (new Tier-1/2 source) and document the override in `property-overrides.json`.

### 3. RSC Periodic Table (Tier 2)

- **URL pattern:** `https://periodic-table.rsc.org/element/{Z}/{slug}`  
- **Scraper:** `scripts/scrape-rsc.mjs` → `src/data/rsc/{key}.json` + `_all.json`  
- **We pull:** Appearance, Uses, Natural abundance, Biological role.  
- **We do not pull:** History accordion, full atomic-data panels, media beyond text.  
- **Used in app as:** overview (appearance + clipped abundance), uses, notableFacts (from biological role), production fallback if no USGS.  
- **When to revisit:** Weak encyclopedia prose → re-scrape RSC; optionally add History later by extending the scraper.

### 4. USGS Mineral Commodity Summaries 2025 (Tier 1)

- **Chapter PDFs:** `https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-{slug}.pdf`  
- **Local text:** `src/data/usgs/text/mcs2025-*.txt`  

- **Element → chapter map:** `USGS_MAP` in `scripts/upgrade-narratives.mjs`  
- **We use in the UI:** Only the **Domestic Production and Use** paragraph (clipped) — except when the chapter is **not element-specific**: shared groups (rare-earths, platinum-group, zirconium-hafnium) and industrial-mineral aliases (salt→Na, potash→K, lime→Ca, barite→Ba). Those use **RSC Natural abundance** for “How it is made.” USGS still counts toward Confirmed.  
- **Sitting on disk unused:** Recycling, Import Sources, Tariff, Salient Statistics tables, Events/Trends, World production & reserves, Substitutes.  
- **When to revisit:**  
  1. Check whether an MCS chapter exists for the commodity (not always the element name — e.g. Na→salt, K→potash, Ba→barite, Zr/Hf→zirconium-hafnium).  
  2. Download PDF → `pdftotext` → `src/data/usgs/text/`.  
  3. Add key to `USGS_MAP` (and `USGS_PREFER_RSC_PRODUCTION` in `upgrade-narratives.mjs` if the chapter is group-level or a mineral alias).  
  4. `npm run upgrade:narratives && npm run build:data`.  
- **No MCS chapter (examples):** U (2025), Tc, Po, Fr, Ra, Ac, Pa, most superheavies — stay Single-source or sparse; don’t fake USGS.

### 5. Wikimedia Commons (Tier 2)

- **Fields:** `imageUrl`, `imageSourceUrl`, `imageCredit` in `metals-raw.json`.  
- **When to revisit:** Missing photo → Commons search `"{Element} 1cm3 cube"` / electrolytic sample; prefer clear license; update raw fields.

---

## Confidence rule (narratives)

| Label | Meaning |
| --- | --- |
| **Confirmed** | RSC narrative fields present **and** USGS production excerpt mapped |
| **Single-source** | RSC only (or USGS only if RSC missing) |
| **Unverified** | Neither usable (should be rare) |

Defined in `scripts/upgrade-narratives.mjs`.

---

## Coverage / “Unavailable” in the UI

`dataCoverage()` in `src/lib/format.js` labels sparse vs synthetic (Z≥104) vs post-uranium actinides.  
Null bulk properties display as **Unavailable** — usually “not in PubChem/Wolfram,” not “we forgot to scrape.”

---

## Suggested next lookups (by gap type)

| Gap | Look here first | Then |
| --- | --- | --- |
| Production / “how made” thin | USGS MCS chapter for commodity | RSC Natural abundance |
| Uses thin | RSC Uses | USGS Domestic Production and Use (end-use mix) |
| Conductivity / hardness null | periodictable.com `…/data.html` | CRC Handbook / NIST if critical |
| Melting / density null | PubChem element page | RSC / CRC |
| No image | Wikimedia Commons | Leave empty for Sg–Lv |
| Still Single-source | `USGS_MAP` + MCS PDF index | Accept if no chapter |
| Want more USGS on screen | Parse extra sections from `usgs/text` | Don’t paste whole PDF into overview |

---

## File index

| Path | Role |
| --- | --- |
| `src/data/metals-raw.json` | Numeric + image + safety seed |
| `src/data/metals.js` | Built app dataset (do not edit by hand) |
| `src/data/rsc/` | RSC scrape cache |
| `src/data/usgs/text/` | MCS chapter text (PDFs not kept in-repo; re-download from pubs.usgs.gov if needed) |
| `src/data/property-overrides.json` | Notes / future numeric patches |
| `scripts/upgrade-narratives.mjs` | USGS map + narrative merge |
| `scripts/build-metals.mjs` | Merge raw + narratives → `metals.js` |
| `scripts/scrape-rsc.mjs` | Refresh RSC |
| `scripts/scrape-property-gaps.mjs` | Try fill null hardness/conductivity |

---

## Commodity name cheatsheet (element ≠ chapter)

| Element | MCS slug (2025) |
| --- | --- |
| Na | `salt` (also related: `soda-ash`) |
| K | `potash` |
| Ca | `lime` |
| Ba | `barite` |
| Mg | `magnesium-metal` / `magnesium-compounds` |
| Fe | `iron-ore` |
| Zr, Hf | `zirconium-hafnium` |
| Pt-group | `platinum-group` |
| La–Lu, Y, Sc, Pm | `rare-earths` |

Index of chapters: https://pubs.usgs.gov/periodicals/mcs2025/mcs2025.pdf
