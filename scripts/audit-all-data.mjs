/**
 * Deep audit of metals.js + RSC cache (all fields except production-only — includes production too).
 * Run: node scripts/audit-all-data.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { metals } from "../src/data/metals.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const rscPath = path.join(root, "src/data/rsc/_all.json");
const rscAll = fs.existsSync(rscPath) ? JSON.parse(fs.readFileSync(rscPath, "utf8")) : [];
const rscByKey = new Map(rscAll.map((r) => [r.key, r]));

const PROP_FIELDS = [
  "meltingPoint",
  "boilingPoint",
  "density",
  "conductivity",
  "thermalConductivity",
  "mohsHardness",
  "brinellHardness",
  "universeAbundancePercent",
  "crustAbundancePercent",
  "oceanAbundancePercent"
];

const IDENTITY = [
  "key",
  "name",
  "symbol",
  "atomicNumber",
  "atomicMass",
  "electronConfiguration",
  "standardState",
  "yearDiscovered",
  "family",
  "sourceCategory"
];

const NARRATIVE = ["summary", "overview", "production", "uses", "safety"];

function isNullish(v) {
  return v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));
}

function clip(s, n = 100) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);
}

const byZ = new Map();
const byKey = new Map();
const bySymbol = new Map();
const findings = {
  identityDupes: [],
  identityMissing: [],
  zGaps: [],
  propertyNulls: Object.fromEntries(PROP_FIELDS.map((f) => [f, []])),
  propertyOutliers: [],
  thermoOrder: [], // BP <= MP
  narrativeThin: [],
  narrativeUnknown: [],
  narrativeDupes: [],
  overviewEqualsSummary: [],
  overviewEqualsProduction: [],
  nameMissingInUses: [],
  nameMissingInOverview: [],
  rscMismatch: [],
  missingImage: [],
  missingNotable: [],
  familyOdd: [],
  confidence: { confirmed: [], "single-source": [], "unverified-model": [], other: [] },
  coverageSparse: [],
  integerMassSuspect: [],
  safetyGeneric: []
};

const GENERIC_SAFETY = new Set();
const safetyCounts = new Map();

for (const m of metals) {
  if (byZ.has(m.atomicNumber)) findings.identityDupes.push({ field: "Z", a: byZ.get(m.atomicNumber), b: m.key });
  else byZ.set(m.atomicNumber, m.key);
  if (byKey.has(m.key)) findings.identityDupes.push({ field: "key", a: m.key, b: m.key });
  else byKey.set(m.key, m);
  if (bySymbol.has(m.symbol)) findings.identityDupes.push({ field: "symbol", a: bySymbol.get(m.symbol), b: m.key });
  else bySymbol.set(m.symbol, m.key);

  for (const f of IDENTITY) {
    if (isNullish(m[f])) findings.identityMissing.push({ key: m.key, field: f });
  }

  for (const f of PROP_FIELDS) {
    if (isNullish(m[f])) findings.propertyNulls[f].push(m.key);
  }

  if (!isNullish(m.meltingPoint) && !isNullish(m.boilingPoint) && m.boilingPoint <= m.meltingPoint) {
    findings.thermoOrder.push({ key: m.key, mp: m.meltingPoint, bp: m.boilingPoint });
  }

  // Density sanity (g/cm3): metals typically 0.5–23; liquids Hg ~13.5; outliers flag
  if (!isNullish(m.density) && (m.density < 0.1 || m.density > 25)) {
    findings.propertyOutliers.push({ key: m.key, field: "density", value: m.density, note: "outside 0.1–25 g/cm³" });
  }
  if (!isNullish(m.mohsHardness) && (m.mohsHardness < 0 || m.mohsHardness > 10.5)) {
    findings.propertyOutliers.push({ key: m.key, field: "mohsHardness", value: m.mohsHardness });
  }
  if (!isNullish(m.meltingPoint) && (m.meltingPoint < -50 || m.meltingPoint > 4500)) {
    findings.propertyOutliers.push({ key: m.key, field: "meltingPoint", value: m.meltingPoint, note: "unusual °C" });
  }
  if (!isNullish(m.conductivity) && m.conductivity < 0) {
    findings.propertyOutliers.push({ key: m.key, field: "conductivity", value: m.conductivity });
  }

  // Integer atomic mass for Z < 104 often means truncated (Li=7, Be=9…)
  if (m.atomicNumber < 104 && Number.isInteger(m.atomicMass) && m.atomicMass < 250) {
    findings.integerMassSuspect.push({ key: m.key, atomicMass: m.atomicMass, Z: m.atomicNumber });
  }

  for (const f of NARRATIVE) {
    const t = String(m[f] || "").trim();
    if (!t || t === "Unknown" || /^not yet verified/i.test(t)) {
      findings.narrativeUnknown.push({ key: m.key, field: f, value: t || "(empty)" });
    } else if (t.length < 40 && f !== "safety") {
      findings.narrativeThin.push({ key: m.key, field: f, len: t.length, preview: clip(t, 80) });
    }
  }

  if (m.summary && m.overview && m.summary === m.overview) {
    findings.overviewEqualsSummary.push(m.key);
  }
  if (m.overview && m.production && m.overview.includes(m.production.slice(0, 80))) {
    // overview often embeds naturalAbundance which equals production for prefer-RSC cases
    const o = m.overview.toLowerCase();
    const p = m.production.toLowerCase();
    if (p.length > 60 && o.includes(p.slice(0, Math.min(120, p.length)))) {
      findings.overviewEqualsProduction.push(m.key);
    }
  }

  const usesL = String(m.uses || "").toLowerCase();
  const ovL = String(m.overview || "").toLowerCase();
  const nameL = m.name.toLowerCase();
  if (m.uses && m.uses !== "Unknown" && !usesL.includes(nameL) && m.atomicNumber < 104) {
    findings.nameMissingInUses.push(m.key);
  }
  if (m.overview && m.overview !== "Unknown" && !ovL.includes(nameL) && m.atomicNumber < 104) {
    // many start with "A soft..." without name — flag only if neither name nor "the element"
    if (!/\bthe element\b/i.test(m.overview) && !ovL.startsWith("a ") && !ovL.startsWith("an ")) {
      findings.nameMissingInOverview.push(m.key);
    }
  }

  if (!m.imageUrl) findings.missingImage.push(m.key);
  if (!m.notableFacts || m.notableFacts.length === 0) findings.missingNotable.push(m.key);

  const conf = m.narrativeConfidence || "other";
  if (findings.confidence[conf]) findings.confidence[conf].push(m.key);
  else findings.confidence.other.push(m.key);

  // Coverage: count null bulk props
  const bulk = ["meltingPoint", "boilingPoint", "density", "conductivity", "thermalConductivity", "mohsHardness", "brinellHardness"];
  const missingBulk = bulk.filter((f) => isNullish(m[f])).length;
  if (missingBulk >= 3) {
    findings.coverageSparse.push({ key: m.key, Z: m.atomicNumber, missingBulk, family: m.family });
  }

  // Safety duplication
  const saf = String(m.safety || "").trim();
  if (saf) {
    safetyCounts.set(saf, (safetyCounts.get(saf) || 0) + 1);
  }

  // Family / sourceCategory loose check
  const fam = String(m.family || "").toLowerCase();
  const src = String(m.sourceCategory || "").toLowerCase();
  if (fam && src && !src.includes(fam.split(" ")[0]) && !fam.includes(src.split(" ")[0])) {
    // allow known mismatches like Metalloid / Metalloid
    if (!(fam === "metalloid" && src.includes("metalloid"))) {
      findings.familyOdd.push({ key: m.key, family: m.family, sourceCategory: m.sourceCategory });
    }
  }

  // RSC cross-check
  const rsc = rscByKey.get(m.key);
  if (rsc?.ok) {
    if (rsc.uses && m.uses && clip(rsc.uses, 80) !== clip(m.uses, 80) && !m.uses.startsWith(clip(rsc.uses, 40))) {
      // only flag if built uses is Unknown/thin but RSC has content
      if (/^Unknown|not yet verified/i.test(m.uses) || m.uses.length < 40) {
        findings.rscMismatch.push({ key: m.key, field: "uses", issue: "RSC has text but metals.js thin/Unknown", rscLen: rsc.uses.length, metalLen: m.uses.length });
      }
    }
    if (rsc.appearance && (!m.overview || m.overview === "Unknown")) {
      findings.rscMismatch.push({ key: m.key, field: "overview", issue: "RSC appearance present, overview missing" });
    }
  } else if (m.atomicNumber < 104) {
    findings.rscMismatch.push({ key: m.key, field: "rsc", issue: "no RSC scrape or ok:false" });
  }
}

// Z continuity among catalog
const zs = [...byZ.keys()].sort((a, b) => a - b);
for (let i = 1; i < zs.length; i++) {
  if (zs[i] !== zs[i - 1] + 1) {
    findings.zGaps.push({ from: zs[i - 1], to: zs[i], missing: zs[i] - zs[i - 1] - 1 });
  }
}

// Exact narrative duplicates (uses / overview / production)
for (const field of ["uses", "overview", "production", "summary"]) {
  const map = new Map();
  for (const m of metals) {
    const t = String(m[field] || "").trim();
    if (t.length < 20) continue;
    if (!map.has(t)) map.set(t, []);
    map.get(t).push(m.key);
  }
  for (const [text, keys] of map) {
    if (keys.length > 1) {
      findings.narrativeDupes.push({ field, count: keys.length, keys, preview: clip(text, 120) });
    }
  }
}

for (const [text, count] of safetyCounts) {
  if (count >= 5) GENERIC_SAFETY.add(text);
}
findings.safetyGeneric = [...safetyCounts.entries()]
  .filter(([, c]) => c >= 5)
  .map(([text, count]) => ({ count, preview: clip(text, 120) }))
  .sort((a, b) => b.count - a.count);

// Null rates
const nullRates = {};
for (const f of PROP_FIELDS) {
  nullRates[f] = {
    count: findings.propertyNulls[f].length,
    pct: Math.round((findings.propertyNulls[f].length / metals.length) * 1000) / 10,
    keys: findings.propertyNulls[f]
  };
}

// Stable metals (Z<=92) with missing key props
const stableMissing = {};
for (const f of ["meltingPoint", "boilingPoint", "density", "conductivity", "thermalConductivity", "mohsHardness", "brinellHardness", "crustAbundancePercent"]) {
  stableMissing[f] = findings.propertyNulls[f].filter((k) => {
    const m = byKey.get(k);
    return m && m.atomicNumber <= 92;
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  scope: {
    definition: "All records in src/data/metals.js (built catalog), cross-checked against src/data/rsc/_all.json",
    totalMetals: metals.length,
    zMin: zs[0],
    zMax: zs[zs.length - 1],
    rscRecords: rscAll.length,
    assumptions: [
      "Catalog is metals+metalloids in the app, not every periodic-table element",
      "Null bulk properties for Z>92 / Z≥104 are often expected (sparse/synthetic)",
      "Integer atomicMass may be PubChem rounding, not necessarily wrong"
    ]
  },
  summary: {
    identityDupes: findings.identityDupes.length,
    identityMissing: findings.identityMissing.length,
    zGapRanges: findings.zGaps.length,
    thermoOrderBad: findings.thermoOrder.length,
    propertyOutliers: findings.propertyOutliers.length,
    integerMassSuspect: findings.integerMassSuspect.length,
    narrativeUnknown: findings.narrativeUnknown.length,
    narrativeThin: findings.narrativeThin.length,
    narrativeExactDupeGroups: findings.narrativeDupes.length,
    overviewEqualsSummary: findings.overviewEqualsSummary.length,
    overviewEmbedsProduction: findings.overviewEqualsProduction.length,
    missingImage: findings.missingImage.length,
    missingNotable: findings.missingNotable.length,
    coverageSparse: findings.coverageSparse.length,
    rscIssues: findings.rscMismatch.length,
    safetyBoilerplateGroups: findings.safetyGeneric.length,
    confidence: Object.fromEntries(Object.entries(findings.confidence).map(([k, v]) => [k, v.length]))
  },
  nullRates,
  stableMetalsMissingProps: Object.fromEntries(
    Object.entries(stableMissing).map(([f, keys]) => [f, { count: keys.length, keys }])
  ),
  zGaps: findings.zGaps,
  identityDupes: findings.identityDupes,
  identityMissing: findings.identityMissing,
  thermoOrder: findings.thermoOrder,
  propertyOutliers: findings.propertyOutliers,
  integerMassSuspect: findings.integerMassSuspect,
  narrativeUnknown: findings.narrativeUnknown,
  narrativeThin: findings.narrativeThin,
  narrativeDupes: findings.narrativeDupes,
  overviewEqualsSummaryCount: findings.overviewEqualsSummary.length,
  overviewEmbedsProduction: findings.overviewEqualsProduction,
  nameMissingInUses: findings.nameMissingInUses,
  missingImage: findings.missingImage,
  missingNotable: findings.missingNotable,
  coverageSparse: findings.coverageSparse,
  rscMismatch: findings.rscMismatch,
  safetyGeneric: findings.safetyGeneric,
  familyOdd: findings.familyOdd.slice(0, 40),
  confidenceLists: findings.confidence
};

const outPath = path.join(root, "src/data/full-data-audit-report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log("=== DEEP DATA AUDIT ===");
console.log(JSON.stringify(report.summary, null, 2));
console.log("\nNull rates (% of catalog):");
for (const [f, r] of Object.entries(nullRates)) {
  console.log(`  ${f}: ${r.count} (${r.pct}%)`);
}
console.log("\nStable Z≤92 missing:");
for (const [f, r] of Object.entries(report.stableMetalsMissingProps)) {
  if (r.count) console.log(`  ${f}: ${r.count} → ${r.keys.join(", ")}`);
}
console.log("\nZ gaps:", JSON.stringify(findings.zGaps));
console.log("\nThermo BP≤MP:", JSON.stringify(findings.thermoOrder));
console.log("\nOutliers:", JSON.stringify(findings.propertyOutliers, null, 2));
console.log("\nInteger mass suspects:", findings.integerMassSuspect.map((x) => `${x.key}=${x.atomicMass}`).join(", "));
console.log("\nNarrative unknown/empty:", findings.narrativeUnknown.length);
console.log(JSON.stringify(findings.narrativeUnknown.slice(0, 40), null, 2));
console.log("\nNarrative exact dupes:");
console.log(JSON.stringify(findings.narrativeDupes, null, 2));
console.log("\nMissing images:", findings.missingImage.join(", ") || "(none)");
console.log("\nMissing notableFacts:", findings.missingNotable.length, findings.missingNotable.slice(0, 20).join(", "));
console.log("\nRSC issues:");
console.log(JSON.stringify(findings.rscMismatch, null, 2));
console.log("\nSafety boilerplate:");
console.log(JSON.stringify(findings.safetyGeneric, null, 2));
console.log("\nSparse coverage (missing≥3 bulk):", findings.coverageSparse.length);
console.log(findings.coverageSparse.map((x) => `${x.key}(Z${x.Z}:${x.missingBulk})`).join(", "));
console.log("\nWrote", outPath);
