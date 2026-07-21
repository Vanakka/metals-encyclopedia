/**
 * Audit "How it is made" production blurbs for shared/generic commodity text.
 * Run: node scripts/audit-production.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { metals } from "../src/data/metals.js";
import { USGS_MAP } from "./usgs-map.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SHARED = new Set([
  "mcs2025-rare-earths.txt",
  "mcs2025-platinum-group.txt",
  "mcs2025-zirconium-hafnium.txt"
]);

/** Same set as USGS_PREFER_RSC_PRODUCTION in upgrade-narratives.mjs */
const PREFER_RSC = new Set([
  ...SHARED,
  "mcs2025-salt.txt",
  "mcs2025-potash.txt",
  "mcs2025-lime.txt",
  "mcs2025-barite.txt"
]);

/** Commodity aliases where USGS talks about the mineral/product, not the element name. */
const ALIAS = {
  sodium: ["salt", "brine", "sodium"],
  potassium: ["potash", "potassium", "sylvinite", "langbeinite"],
  calcium: ["lime", "calcium", "quicklime", "hydrated"],
  barium: ["barite", "barium", "baryte"],
  iron: ["iron ore", "iron", "pellet"],
  magnesium: ["magnesium"],
  silicon: ["silicon", "ferrosilicon", "polysilicon"]
};

const GENERIC_OPENERS =
  /^(rare earths were mined|the platinum[- ]group|platinum[- ]group metals|domestic production of salt|in 2024, an estimated .* lime)/i;

const byExact = new Map();
const byOpen120 = new Map();
const rows = [];

for (const m of metals) {
  const prod = String(m.production || "").trim();
  const usgs = USGS_MAP[m.key] || null;
  const prodL = prod.toLowerCase();
  const name = m.name.toLowerCase();
  const nameHit = prodL.includes(name);
  const aliases = ALIAS[m.key] || [name];
  const aliasHit = aliases.some((a) => prodL.includes(a.toLowerCase()));
  const open120 = prod.slice(0, 120);

  if (!byExact.has(prod)) byExact.set(prod, []);
  byExact.get(prod).push(m.key);
  if (!byOpen120.has(open120)) byOpen120.set(open120, []);
  byOpen120.get(open120).push(m.key);

  rows.push({
    key: m.key,
    name: m.name,
    family: m.family,
    usgs,
    shared: usgs ? SHARED.has(usgs) : false,
    preferRsc: usgs ? PREFER_RSC.has(usgs) : false,
    aliasMap: Boolean(ALIAS[m.key]),
    nameHit,
    aliasHit,
    genericOpener: GENERIC_OPENERS.test(prod),
    len: prod.length,
    preview: prod.replace(/\s+/g, " ").slice(0, 160),
    conf: m.narrativeConfidence
  });
}

const exactDupes = [...byExact.entries()]
  .filter(([, keys]) => keys.length > 1)
  .map(([text, keys]) => ({
    count: keys.length,
    keys,
    preview: text.replace(/\s+/g, " ").slice(0, 160)
  }));

const openDupes = [...byOpen120.entries()]
  .filter(([, keys]) => keys.length > 1)
  .map(([preview, keys]) => ({ count: keys.length, keys, preview: preview.replace(/\s+/g, " ") }));

const noName = rows.filter((r) => !r.nameHit && !r.aliasHit);
const preferRscStillUsgsy = rows.filter(
  (r) =>
    r.preferRsc &&
    /rare earths were mined|platinum-group metals were|domestic production of salt|marketable potash|quicklime and hydrated lime|mined barite/i.test(
      r.preview
    )
);
const aliasOffTopic = rows.filter((r) => r.aliasMap && !r.nameHit && PREFER_RSC.has(r.usgs || ""));
const sharedStillUsgs = preferRscStillUsgsy.filter((r) => r.shared);
const genericOpeners = rows.filter((r) => r.genericOpener);
const shortOrPlaceholder = rows.filter(
  (r) => r.len < 80 || /not yet verified/i.test(r.preview)
);

// Pairwise: metals on same USGS file that still share identical production
const byUsgsFile = new Map();
for (const r of rows) {
  if (!r.usgs) continue;
  if (!byUsgsFile.has(r.usgs)) byUsgsFile.set(r.usgs, []);
  byUsgsFile.get(r.usgs).push(r.key);
}
const multiMapFiles = [...byUsgsFile.entries()]
  .filter(([, keys]) => keys.length > 1)
  .map(([file, keys]) => {
    const prods = keys.map((k) => metals.find((m) => m.key === k).production);
    const unique = new Set(prods);
    return {
      file,
      keys,
      uniqueProductionTexts: unique.size,
      allIdentical: unique.size === 1
    };
  });

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalMetals: rows.length,
    withUsgsMap: rows.filter((r) => r.usgs).length,
    sharedChapterMapped: rows.filter((r) => r.shared).length,
    preferRscMapped: rows.filter((r) => r.preferRsc).length,
    exactDuplicateGroups: exactDupes.length,
    metalsInExactDupes: exactDupes.reduce((n, d) => n + d.keys.length, 0),
    open120DuplicateGroups: openDupes.length,
    noNameOrAlias: noName.length,
    preferRscStillUsgsCommodityBlurb: preferRscStillUsgsy.length,
    aliasMissingElementName: aliasOffTopic.length,
    sharedStillUsgsGroupBlurb: sharedStillUsgs.length,
    genericOpeners: genericOpeners.length,
    shortOrPlaceholder: shortOrPlaceholder.length,
    multiElementUsgsFiles: multiMapFiles.length,
    multiElementStillIdentical: multiMapFiles.filter((f) => f.allIdentical).length
  },
  multiElementUsgsFiles: multiMapFiles,
  exactDuplicateProduction: exactDupes,
  open120DuplicateProduction: openDupes,
  preferRscStillUsgsCommodityBlurb: preferRscStillUsgsy.map((r) => ({
    key: r.key,
    usgs: r.usgs,
    preview: r.preview
  })),
  sharedStillUsgsGroupBlurb: sharedStillUsgs,
  noNameOrAlias: noName.map((r) => ({
    key: r.key,
    usgs: r.usgs,
    conf: r.conf,
    preview: r.preview
  })),
  aliasCommodityMissingElementName: aliasOffTopic.map((r) => ({
    key: r.key,
    usgs: r.usgs,
    preview: r.preview
  })),
  genericOpeners: genericOpeners.map((r) => ({
    key: r.key,
    usgs: r.usgs,
    preview: r.preview
  })),
  shortOrPlaceholder: shortOrPlaceholder.map((r) => ({
    key: r.key,
    len: r.len,
    usgs: r.usgs,
    preview: r.preview
  }))
};

const outPath = path.join(root, "src/data/production-audit-report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
console.log("\nMulti-element USGS files:");
console.log(JSON.stringify(multiMapFiles, null, 2));
console.log("\nExact duplicate groups:", exactDupes.length);
if (exactDupes.length) console.log(JSON.stringify(exactDupes, null, 2));
console.log("\nNo name/alias hit:", noName.length);
if (noName.length) console.log(JSON.stringify(report.noNameOrAlias, null, 2));
console.log("\nAlias maps missing element name:", aliasOffTopic.length);
if (aliasOffTopic.length) console.log(JSON.stringify(report.aliasCommodityMissingElementName, null, 2));
console.log("\nShared still USGS-generic:", sharedStillUsgs.length);
console.log("\nWrote", outPath);
