/**
 * Compare reference-db PubChem CSV vs metals-raw.json and apply safe numeric patches.
 *   node scripts/import-vault-numerics.mjs           # dry-run report
 *   node scripts/import-vault-numerics.mjs --apply   # write metals-raw.json + rebuild metals.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeMetalsFile } from "./build-metals.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const apply = process.argv.includes("--apply");

const rawPath = path.join(root, "src/data/metals-raw.json");
const csvPath = path.join(root, "reference-db/raw/pubchem/periodictable.csv");
const reportPath = path.join(root, "src/data/vault-import-report.json");
const overridesPath = path.join(root, "src/data/property-overrides.json");

if (!fs.existsSync(csvPath)) {
  console.error("Missing PubChem CSV. Run: npm run fetch:reference-db");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
const overrides = fs.existsSync(overridesPath)
  ? JSON.parse(fs.readFileSync(overridesPath, "utf8"))
  : {};

/** Manual / IUPAC overrides win over PubChem CSV. */
const massOverrides = {};
for (const [k, v] of Object.entries(overrides.atomicMassOverrides || {})) {
  if (k !== "note" && typeof v === "number") massOverrides[k] = v;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function num(v) {
  if (v === null || v === undefined || v === "" || v === "null") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** PubChem thermo is Kelvin in the CSV. */
function kToC(k) {
  if (k === null) return null;
  return Math.round((k - 273.15) * 100) / 100;
}

const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const byZ = new Map(rows.map((r) => [Number(r.AtomicNumber), r]));

const patches = [];
const skipped = [];

for (const metal of raw) {
  const row = byZ.get(metal.atomicNumber);
  if (!row) {
    skipped.push({ key: metal.key, reason: "no PubChem CSV row" });
    continue;
  }

  const csvMass = num(row.AtomicMass);
  const csvMpC = kToC(num(row.MeltingPoint));
  const csvBpC = kToC(num(row.BoilingPoint));
  const csvDensity = num(row.Density);

  // Atomic mass: prefer explicit override; else if app is integer and CSV has more precision, take CSV;
  // else if they differ by >0.05 and CSV looks more precise, take CSV — but NEVER overwrite overrides.
  if (massOverrides[metal.key] != null) {
    const want = massOverrides[metal.key];
    if (metal.atomicMass !== want) {
      patches.push({
        key: metal.key,
        field: "atomicMass",
        from: metal.atomicMass,
        to: want,
        reason: "IUPAC / property-overrides"
      });
      if (apply) metal.atomicMass = want;
    }
  } else if (csvMass != null && metal.atomicMass != null) {
    const appInt = Number.isInteger(metal.atomicMass);
    const csvMorePrecise = !Number.isInteger(csvMass) && Math.abs(csvMass - metal.atomicMass) >= 0.001;
    if (appInt && csvMorePrecise) {
      patches.push({
        key: metal.key,
        field: "atomicMass",
        from: metal.atomicMass,
        to: csvMass,
        reason: "PubChem CSV more precise than integer app mass"
      });
      if (apply) metal.atomicMass = csvMass;
    }
  }

  // Melting / boiling: only fill nulls from PubChem (don't overwrite curated values)
  if (!Number.isFinite(metal.meltingPoint) && csvMpC != null) {
    patches.push({
      key: metal.key,
      field: "meltingPoint",
      from: metal.meltingPoint,
      to: csvMpC,
      reason: "fill null from PubChem CSV (K→°C)"
    });
    if (apply) metal.meltingPoint = csvMpC;
  }
  if (!Number.isFinite(metal.boilingPoint) && csvBpC != null) {
    patches.push({
      key: metal.key,
      field: "boilingPoint",
      from: metal.boilingPoint,
      to: csvBpC,
      reason: "fill null from PubChem CSV (K→°C)"
    });
    if (apply) metal.boilingPoint = csvBpC;
  }
  if (!Number.isFinite(metal.density) && csvDensity != null && csvDensity > 0) {
    patches.push({
      key: metal.key,
      field: "density",
      from: metal.density,
      to: csvDensity,
      reason: "fill null from PubChem CSV"
    });
    if (apply) metal.density = csvDensity;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: apply ? "apply" : "dry-run",
  patchCount: patches.length,
  note:
    patches.length === 0
      ? "No safe patches. IUPAC mass overrides (e.g. Li 6.94, Pb 207.2) already win over PubChem integers; remaining null MP/BP/density are radioactives/superheavies without usable PubChem CSV values."
      : "Safe patches: override masses; fill null melt/boil/density from PubChem (K→°C).",
  patches,
  skipped
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

if (apply) {
  fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2) + "\n");
  console.log(`Applied ${patches.length} patches → metals-raw.json`);
  writeMetalsFile();
} else {
  console.log(`Dry-run: ${patches.length} patches (pass --apply to write). Report → ${path.relative(root, reportPath)}`);
}

console.log(patches.slice(0, 25));
if (patches.length > 25) console.log(`… +${patches.length - 25} more`);
