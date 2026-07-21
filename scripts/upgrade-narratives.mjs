/**
 * Rebuild scripts/narratives.mjs content from retrieved Tier-1/2 sources:
 * - RSC Periodic Table (Appearance / Uses / Natural abundance) — Tier 2
 * - USGS Mineral Commodity Summaries 2025 where available — Tier 1
 * - PubChem element page links retained as Tier 1 property/identity anchors
 *
 * Confidence:
 * - confirmed: RSC narrative fields present AND USGS production excerpt present
 *   (independent: RSC encyclopedia vs USGS commodity survey)
 * - single-source: RSC narrative fields present, no USGS chapter mapped
 * - unverified-model: RSC scrape missing (should be rare)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { USGS_MAP } from "./usgs-map.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const raw = JSON.parse(fs.readFileSync(path.join(root, "src/data/metals-raw.json"), "utf8"));
const rscAll = JSON.parse(fs.readFileSync(path.join(root, "src/data/rsc/_all.json"), "utf8"));
const rscByKey = new Map(rscAll.map((r) => [r.key, r]));

/** Chapters whose Domestic Production text is not about this element as metal.
 * Shared group chapters (REE, PGM, Zr–Hf) and industrial-mineral aliases (salt/potash/lime/barite).
 * Prefer RSC natural abundance for the UI “How it is made” blurb; USGS still counts as Confirmed.
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

function usgsProductionExcerpt(text, maxLen = 700) {
  if (!text) return "";
  // Prefer the Domestic Production and Use paragraph.
  const marker = "Domestic Production and Use:";
  const idx = text.indexOf(marker);
  let chunk = idx >= 0 ? text.slice(idx + marker.length) : text;
  // Cut at next major section header-ish line
  const cutMarks = ["\nRecycling:", "\nImport Sources", "\nSalient Statistics", "\nEvents, Trends"];
  let end = chunk.length;
  for (const mark of cutMarks) {
    const at = chunk.indexOf(mark);
    if (at >= 0) end = Math.min(end, at);
  }
  chunk = chunk.slice(0, end).replace(/\s+/g, " ").trim();
  if (chunk.length > maxLen) {
    chunk = chunk.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
  }
  return chunk;
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
  const usgsExcerpt = usgsProductionExcerpt(usgsText);

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
  const usgsSource = usgsFile
    ? {
        title: `USGS Mineral Commodity Summaries 2025 (${usgsFile.replace("mcs2025-", "").replace(".txt", "")})`,
        url: `https://pubs.usgs.gov/periodicals/mcs2025/${usgsFile.replace(".txt", ".pdf")}`,
        tier: 1
      }
    : null;

  const hasRscNarrative = Boolean(rsc?.ok && (rsc.appearance || rsc.uses || rsc.naturalAbundance));

  let overview = "";
  let production = "";
  let uses = "";
  let narrativeConfidence = "unverified-model";
  const narrativeSources = [];

  const preferRscProduction = Boolean(usgsFile && USGS_PREFER_RSC_PRODUCTION.has(usgsFile));

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
    if (usgsExcerpt) {
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
    if (usgsExcerpt) {
      narrativeSources.push(usgsSource, pubchem);
      narrativeConfidence = "single-source";
      stats.singleSource += 1;
    } else {
      narrativeSources.push(pubchem);
      narrativeConfidence = "unverified-model";
      stats.unverified += 1;
    }
  }

  narratives[metal.key] = {
    overview: clip(overview, 700),
    production: clip(production, 900),
    uses: clip(uses, 900),
    notableFacts: hasRscNarrative ? notableFromRsc(rsc) : [],
    narrativeConfidence,
    narrativeSources: narrativeSources.filter(Boolean)
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
      method:
        "RSC accordion scrape for appearance/uses/natural abundance; USGS MCS 2025 Domestic Production and Use excerpts where a commodity chapter is mapped. Group/alias chapters (rare-earths, platinum-group, zirconium-hafnium, salt, potash, lime, barite) keep USGS as a Confirmed source but use RSC natural abundance for the production blurb. Confirmed = RSC + USGS. Single-source = RSC only (or USGS only if RSC missing)."
    },
    null,
    2
  )
);

console.log("Upgrade complete:", stats);
console.log("Wrote scripts/narratives.mjs");
