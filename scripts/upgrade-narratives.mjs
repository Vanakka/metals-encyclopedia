/**
 * Rebuild scripts/narratives.mjs content from retrieved Tier-1/2 sources:
 * - RSC Periodic Table (Appearance / Uses / Natural abundance) — Tier 2
 * - USGS Mineral Commodity Summaries 2025 where available — Tier 1
 * - PubChem element page links retained as Tier 1 property/identity anchors
 *
 * Confidence:
 * - confirmed (UI: Dual-sourced): RSC narrative fields present AND a USGS chapter
 *   that actually covers this element (not merely mapped / excerpt-extractable)
 * - single-source: RSC narrative fields present, no covering USGS chapter
 * - unverified-model: RSC scrape missing (should be rare)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  USGS_MAP,
  usgsChapterCovers,
  usgsPdfUrl,
  usgsSourceTitle
} from "./usgs-map.mjs";
import { applyNarrativeOverrides, NARRATIVE_OVERRIDES } from "./narrative-overrides.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const raw = JSON.parse(fs.readFileSync(path.join(root, "src/data/metals-raw.json"), "utf8"));
const rscAll = JSON.parse(fs.readFileSync(path.join(root, "src/data/rsc/_all.json"), "utf8"));
const rscByKey = new Map(rscAll.map((r) => [r.key, r]));

/** Chapters whose Domestic Production text is not about this element as metal.
 * Shared group chapters (REE, PGM, Zr–Hf) and industrial-mineral aliases (salt/potash/lime/barite).
 * Prefer RSC natural abundance for the UI “How it is made” blurb; USGS still counts toward Dual-sourced.
 */
const USGS_PREFER_RSC_PRODUCTION = new Set([
  "mcs2025-rare-earths.txt",
  "mcs2025-platinum-group.txt",
  "mcs2025-zirconium-hafnium.txt",
  "mcs2025-salt.txt",
  "mcs2025-potash.txt",
  "mcs2025-lime.txt",
  "mcs2025-barite.txt"
]);

function readUsgs(filename) {
  const full = path.join(root, "src/data/usgs/text", filename);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

/** Extract a USGS MCS section by header markers; returns cleaned prose. */
function usgsSection(text, startMarkers, endMarkers, maxLen = 650) {
  if (!text) return "";
  let start = -1;
  let markerLen = 0;
  for (const marker of startMarkers) {
    const at = text.indexOf(marker);
    if (at >= 0 && (start < 0 || at < start)) {
      start = at;
      markerLen = marker.length;
    }
  }
  if (start < 0) return "";
  let chunk = text.slice(start + markerLen);
  let end = chunk.length;
  for (const mark of endMarkers) {
    const at = chunk.search(mark);
    if (at >= 0) end = Math.min(end, at);
  }
  chunk = chunk
    .slice(0, end)
    .replace(/\f/g, " ")
    .replace(/Prepared by[\s\S]*?gov\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Drop leading table-ish noise if the section is mostly columns
  if (/Mine production\s+Refinery/i.test(chunk) && chunk.length > 200) {
    const wr = chunk.search(/World Resources:/i);
    if (wr >= 0) chunk = chunk.slice(wr + "World Resources:".length).trim();
  }
  return clip(chunk, maxLen);
}

function usgsProductionExcerpt(text, maxLen = 700) {
  return usgsSection(
    text,
    ["Domestic Production and Use:", "Domestic Production and Resources"],
    [
      /\nRecycling:/,
      /\nImport Sources/,
      /\nSalient Statistics/,
      /\nEvents, Trends/,
      /\nConsumption, Import Reliance/,
      /\nSummary\n/
    ],
    maxLen
  );
}

function usgsCommodityNotes(text) {
  const recycling = usgsSection(
    text,
    ["Recycling:"],
    [/\nImport Sources/, /\nTariff:/, /\nDepletion Allowance/, /\nEvents, Trends/, /\nWorld Mine/],
    550
  );
  const substitutes = usgsSection(
    text,
    ["Substitutes:"],
    [/\ne\n\s*Estimated/, /\n\d+\n/, /\nU\.S\. Geological Survey/, /\nSee Appendix/],
    550
  );
  // Prefer World Resources prose; fall back to World Mine / Global Production (Fact Sheet).
  let world = usgsSection(
    text,
    ["World Resources:"],
    [/\nSubstitutes:/, /\ne\n\s*Estimated/, /\nU\.S\. Geological Survey/, /\n\d+\n\s+[A-Z]/],
    550
  );
  if (!world) {
    world = usgsSection(
      text,
      [
        "World Mine Production and Reserves:",
        "World Mine and Refinery Production and Reserves:",
        "Global Production and Resources"
      ],
      [
        /\nWorld Resources:/,
        /\nSubstitutes:/,
        /\nDomestic Production/,
        /\nConsumption, Import Reliance/,
        /\nUnited States\s+\d/
      ],
      400
    );
  }
  if (!recycling && !substitutes && !world) return null;
  return {
    ...(recycling ? { recycling } : {}),
    ...(substitutes ? { substitutes } : {}),
    ...(world ? { world } : {})
  };
}

function clip(text, maxLen) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
}

function notableFromRsc(rsc) {
  const facts = [];
  if (rsc.biologicalRole) {
    facts.push(clip(rsc.biologicalRole, 220));
  }
  return facts.slice(0, 2);
}

const narratives = {};
const stats = { confirmed: 0, singleSource: 0, unverified: 0 };

for (const metal of raw) {
  const rsc = rscByKey.get(metal.key);
  const usgsFile = USGS_MAP[metal.key];
  const usgsText = usgsFile ? readUsgs(usgsFile) : null;
  const covers = Boolean(usgsFile && usgsText && usgsChapterCovers(metal.key, usgsFile, usgsText));
  const usgsExcerpt = covers ? usgsProductionExcerpt(usgsText) : "";
  const commodityNotes = covers ? usgsCommodityNotes(usgsText) : null;

  const pubchem = {
    title: `PubChem element page: ${metal.name}`,
    url: `https://pubchem.ncbi.nlm.nih.gov/element/${encodeURIComponent(metal.name)}`,
    tier: 1
  };
  const rscSource = rsc?.url
    ? {
        title: `RSC Periodic Table: ${metal.name}`,
        url: rsc.url.startsWith("http")
          ? `https://www.rsc.org/periodic-table/element/${metal.atomicNumber}/${rsc.slug}`
          : rsc.url,
        tier: 2
      }
    : null;
  const usgsSource =
    covers && usgsFile
      ? {
          title: usgsSourceTitle(usgsFile),
          url: usgsPdfUrl(usgsFile),
          tier: 1
        }
      : null;

  const hasRscNarrative = Boolean(rsc?.ok && (rsc.appearance || rsc.uses || rsc.naturalAbundance));

  let overview = "";
  let production = "";
  let uses = "";
  let narrativeConfidence = "unverified-model";
  const narrativeSources = [];

  const preferRscProduction = Boolean(covers && usgsFile && USGS_PREFER_RSC_PRODUCTION.has(usgsFile));

  if (hasRscNarrative) {
    overview = [rsc.appearance, rsc.naturalAbundance ? clip(rsc.naturalAbundance, 320) : ""]
      .filter(Boolean)
      .join(" ");
    // Element-specific USGS chapters win for industrial production. Group/alias chapters
    // (rare earths, PGMs, Zr–Hf, salt/potash/lime/barite) are not about this metal —
    // prefer RSC natural abundance so “How it is made” stays element-specific.
    if (preferRscProduction) {
      production = rsc.naturalAbundance || usgsExcerpt || "";
    } else {
      production = usgsExcerpt || rsc.naturalAbundance || "";
    }
    uses = rsc.uses || "";
    narrativeSources.push(rscSource);
    if (covers && usgsExcerpt) {
      narrativeSources.push(usgsSource);
      narrativeConfidence = "confirmed";
      stats.confirmed += 1;
    } else {
      narrativeConfidence = "single-source";
      stats.singleSource += 1;
    }
    // PubChem as identity/property anchor (does not alone upgrade narrative confidence)
    narrativeSources.push(pubchem);
  } else {
    overview = `${metal.name} (${metal.symbol}) is listed here as a ${metal.family.toLowerCase()} element. Curated RSC narrative text was unavailable at fetch time.`;
    production = usgsExcerpt || "Production route not yet verified from retrieved Tier-1/2 narrative sources.";
    uses = "Uses not yet verified from retrieved Tier-1/2 narrative sources.";
    if (covers && usgsExcerpt) {
      narrativeSources.push(usgsSource, pubchem);
      narrativeConfidence = "single-source";
      stats.singleSource += 1;
    } else {
      narrativeSources.push(pubchem);
      narrativeConfidence = "unverified-model";
      stats.unverified += 1;
    }
  }

  const built = applyNarrativeOverrides(metal.key, {
    overview: overview,
    production: production,
    uses: uses,
    commodityNotes,
    notableFacts: hasRscNarrative ? notableFromRsc(rsc) : [],
    narrativeConfidence,
    narrativeSources: narrativeSources.filter(Boolean)
  });

  narratives[metal.key] = {
    ...built,
    overview: clip(built.overview, 700),
    production: clip(built.production, 900),
    uses: clip(built.uses, 900)
  };
}

const file = `/** Auto-generated by scripts/upgrade-narratives.mjs from retrieved RSC + USGS sources. */\nexport const NARRATIVES = ${JSON.stringify(narratives, null, 2)};\n`;
fs.writeFileSync(path.join(root, "scripts/narratives.mjs"), file);

fs.writeFileSync(
  path.join(root, "src/data/narrative-upgrade-report.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totals: stats,
      metals: Object.keys(narratives).length,
      narrativeOverrides: Object.keys(NARRATIVE_OVERRIDES),
      method:
        "RSC accordion scrape for appearance/uses/natural abundance; USGS MCS 2025 Domestic Production plus Recycling / Substitutes / World Resources excerpts where the mapped chapter covers the element (usgsChapterCovers / USGS_COVERAGE_EXCLUSIONS); uranium uses Fact Sheet 2025–3057; scandium uses mcs2025-scandium (not rare-earths); promethium has no USGS commodity chapter. Curated narrative-overrides.mjs patches known RSC errors. Dual-sourced = RSC + covering USGS (provenance, not per-claim fact-check). Single-source = RSC only (or USGS only if RSC missing)."
    },
    null,
    2
  )
);

console.log("Upgrade complete:", stats);
console.log("Narrative overrides applied:", Object.keys(NARRATIVE_OVERRIDES).join(", "));
console.log("Wrote scripts/narratives.mjs");
