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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const raw = JSON.parse(fs.readFileSync(path.join(root, "src/data/metals-raw.json"), "utf8"));
const rscAll = JSON.parse(fs.readFileSync(path.join(root, "src/data/rsc/_all.json"), "utf8"));
const rscByKey = new Map(rscAll.map((r) => [r.key, r]));

const USGS_MAP = {
  lithium: "mcs2025-lithium.txt",
  aluminum: "mcs2025-aluminum.txt",
  copper: "mcs2025-copper.txt",
  nickel: "mcs2025-nickel.txt",
  titanium: "mcs2025-titanium.txt",
  iron: "mcs2025-iron-ore.txt",
  gold: "mcs2025-gold.txt",
  silver: "mcs2025-silver.txt",
  zinc: "mcs2025-zinc.txt",
  lead: "mcs2025-lead.txt",
  tin: "mcs2025-tin.txt",
  tungsten: "mcs2025-tungsten.txt",
  molybdenum: "mcs2025-molybdenum.txt",
  cobalt: "mcs2025-cobalt.txt",
  silicon: "mcs2025-silicon.txt",
  antimony: "mcs2025-antimony.txt",
  bismuth: "mcs2025-bismuth.txt",
  cadmium: "mcs2025-cadmium.txt",
  gallium: "mcs2025-gallium.txt",
  germanium: "mcs2025-germanium.txt",
  indium: "mcs2025-indium.txt",
  mercury: "mcs2025-mercury.txt",
  niobium: "mcs2025-niobium.txt",
  rhenium: "mcs2025-rhenium.txt",
  tantalum: "mcs2025-tantalum.txt",
  tellurium: "mcs2025-tellurium.txt",
  thallium: "mcs2025-thallium.txt",
  vanadium: "mcs2025-vanadium.txt",
  beryllium: "mcs2025-beryllium.txt",
  boron: "mcs2025-boron.txt",
  chromium: "mcs2025-chromium.txt",
  manganese: "mcs2025-manganese.txt",
  arsenic: "mcs2025-arsenic.txt",
  magnesium: "mcs2025-magnesium-metal.txt",
  thorium: "mcs2025-thorium.txt",
  // newly mapped industrial-mineral chapters (element ↔ commodity)
  sodium: "mcs2025-salt.txt",
  potassium: "mcs2025-potash.txt",
  calcium: "mcs2025-lime.txt",
  rubidium: "mcs2025-rubidium.txt",
  strontium: "mcs2025-strontium.txt",
  cesium: "mcs2025-cesium.txt",
  barium: "mcs2025-barite.txt",
  zirconium: "mcs2025-zirconium-hafnium.txt",
  hafnium: "mcs2025-zirconium-hafnium.txt",
  // shared chapters
  platinum: "mcs2025-platinum-group.txt",
  palladium: "mcs2025-platinum-group.txt",
  rhodium: "mcs2025-platinum-group.txt",
  ruthenium: "mcs2025-platinum-group.txt",
  iridium: "mcs2025-platinum-group.txt",
  osmium: "mcs2025-platinum-group.txt",
  lanthanum: "mcs2025-rare-earths.txt",
  cerium: "mcs2025-rare-earths.txt",
  praseodymium: "mcs2025-rare-earths.txt",
  neodymium: "mcs2025-rare-earths.txt",
  samarium: "mcs2025-rare-earths.txt",
  europium: "mcs2025-rare-earths.txt",
  gadolinium: "mcs2025-rare-earths.txt",
  terbium: "mcs2025-rare-earths.txt",
  dysprosium: "mcs2025-rare-earths.txt",
  holmium: "mcs2025-rare-earths.txt",
  erbium: "mcs2025-rare-earths.txt",
  thulium: "mcs2025-rare-earths.txt",
  ytterbium: "mcs2025-rare-earths.txt",
  lutetium: "mcs2025-rare-earths.txt",
  yttrium: "mcs2025-rare-earths.txt",
  scandium: "mcs2025-rare-earths.txt",
  promethium: "mcs2025-rare-earths.txt"
};

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

  if (hasRscNarrative) {
    overview = [rsc.appearance, rsc.naturalAbundance ? clip(rsc.naturalAbundance, 320) : ""]
      .filter(Boolean)
      .join(" ");
    // Prefer USGS for industrial production detail when available; else RSC natural abundance.
    production = usgsExcerpt || rsc.naturalAbundance || "";
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
        "RSC accordion scrape for appearance/uses/natural abundance; USGS MCS 2025 Domestic Production and Use excerpts where a commodity chapter is mapped. Confirmed = RSC + USGS. Single-source = RSC only (or USGS only if RSC missing)."
    },
    null,
    2
  )
);

console.log("Upgrade complete:", stats);
console.log("Wrote scripts/narratives.mjs");
