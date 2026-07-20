/**
 * Fill null hardness / conductivity fields from periodictable.com (Wolfram ElementData).
 * Writes src/data/property-overrides.json and patches metals-raw.json for Z <= 92 only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const rawPath = path.join(root, "src/data/metals-raw.json");

function decodeEntities(s) {
  return String(s)
    .replace(/&times;/gi, "×")
    .replace(/&nbsp;/gi, " ")
    .replace(/<sup><small>(-?\d+)<\/small><\/sup>/gi, "^$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cellValue(html, prop) {
  const needle = `${prop}.html`;
  const at = html.indexOf(needle);
  if (at < 0) return null;
  const slice = html.slice(at, at + 360);
  const m = slice.match(/<\/a><\/font><\/td><td[^>]*>([\s\S]*?)<\/td>/i);
  if (!m) return null;
  const v = decodeEntities(m[1]);
  if (!v || /^n\/?a$/i.test(v) || v === "-" || v === "—") return null;
  return v;
}

function parseSci(s) {
  const t = String(s).replace(/,/g, "");
  const sci = t.match(/([\d.]+)\s*[×x]\s*10\^([-+]?\d+)/i);
  if (sci) return Number(sci[1]) * 10 ** Number(sci[2]);
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

const FIELDS = [
  ["mohsHardness", "MohsHardness", (s) => parseFloat(s)],
  [
    "brinellHardness",
    "BrinellHardness",
    (s) => {
      const n = parseFloat(String(s).replace(/[^\d.]/g, ""));
      return Number.isFinite(n) ? n : null;
    }
  ],
  ["thermalConductivity", "ThermalConductivity", (s) => parseFloat(s)],
  ["conductivity", "ElectricalConductivity", parseSci],
  ["density", "Density", (s) => parseFloat(s)]
];

const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
const overrides = {};
let patched = 0;

for (const metal of raw) {
  const needs = ["mohsHardness", "brinellHardness", "thermalConductivity", "conductivity", "density"].some(
    (f) => metal[f] == null
  );
  if (!needs || metal.atomicNumber > 92) continue;

  const url = `https://periodictable.com/Elements/${String(metal.atomicNumber).padStart(3, "0")}/data.html`;
  const html = await (await fetch(url)).text();
  const entry = { source: url, fields: {} };

  for (const [field, prop, parse] of FIELDS) {
    if (metal[field] != null) continue;
    const rawVal = cellValue(html, prop);
    if (rawVal == null) continue;
    const parsed = parse(rawVal);
    if (parsed == null || !Number.isFinite(parsed)) continue;
    metal[field] = parsed;
    entry.fields[field] = { value: parsed, raw: rawVal };
    patched += 1;
  }

  if (Object.keys(entry.fields).length) {
    overrides[metal.key] = entry;
    console.log(metal.symbol, entry.fields);
  } else {
    console.log(metal.symbol, "(no fillable values)");
  }
}

fs.writeFileSync(path.join(root, "src/data/property-overrides.json"), JSON.stringify(overrides, null, 2));
fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2));
console.log(`Patched ${patched} field values across ${Object.keys(overrides).length} metals`);
