/**
 * Pull online reference data for every catalog metal into reference-db/
 * (gitignored). Does not modify src/data app files.
 *
 *   node scripts/fetch-reference-db.mjs
 *   node scripts/fetch-reference-db.mjs --force
 *   node scripts/fetch-reference-db.mjs --rsc
 *   node scripts/fetch-reference-db.mjs --only lithium,copper
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { USGS_MAP, usgsPdfUrl } from "./usgs-map.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dbRoot = path.join(root, "reference-db");
const rawDir = path.join(dbRoot, "raw");
const assembledDir = path.join(dbRoot, "assembled");
const elementsDir = path.join(assembledDir, "elements");

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const wantRsc = args.has("--rsc");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlyKeys = onlyArg
  ? new Set(
      onlyArg
        .slice("--only=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  : null;

const catalog = JSON.parse(fs.readFileSync(path.join(root, "src/data/metals-raw.json"), "utf8"));
const metals = onlyKeys ? catalog.filter((m) => onlyKeys.has(m.key)) : catalog;

const RSC_SLUG = { aluminum: "aluminium", cesium: "caesium" };
const UA = "MetalsEncyclopediaReferenceDB/0.1 (local research pull; contact: local)";

function ensureDirs() {
  for (const d of [
    path.join(rawDir, "pubchem", "elements"),
    path.join(rawDir, "wikipedia"),
    path.join(rawDir, "usgs"),
    path.join(rawDir, "rsc"),
    elementsDir
  ]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function existsFresh(file) {
  if (force || !fs.existsSync(file) || fs.statSync(file).size <= 2) return false;
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    if (j && typeof j === "object" && "ok" in j && j.ok === false) return false;
  } catch {
    /* binary / csv / non-json */
  }
  return true;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url, { retries = 5 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "*/*" }
      });
      if (res.status === 429) {
        const wait = 2000 * (i + 1);
        await sleep(wait);
        throw new Error(`HTTP 429 for ${url}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      await sleep(500 * (i + 1));
    }
  }
  throw lastErr;
}

async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
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

async function pullPubchemCsv() {
  const out = path.join(rawDir, "pubchem", "periodictable.csv");
  if (existsFresh(out)) {
    console.log("PubChem CSV: cache hit");
    return parseCsv(fs.readFileSync(out, "utf8"));
  }
  console.log("PubChem CSV: downloading…");
  const csv = await fetchText("https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/CSV");
  fs.writeFileSync(out, csv);
  return parseCsv(csv);
}

async function pullPubchemElement(metal) {
  const out = path.join(rawDir, "pubchem", "elements", `${metal.key}.json`);
  if (existsFresh(out)) return JSON.parse(fs.readFileSync(out, "utf8"));
  // Full element dossier (Identifiers, Properties, History, Uses, Sources, …)
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/element/${metal.atomicNumber}/JSON`;
  try {
    const data = await fetchJson(url);
    const wrapped = {
      ok: true,
      fetchedAt: new Date().toISOString(),
      url,
      recordTitle: data?.Record?.RecordTitle || metal.name,
      sectionHeadings: (data?.Record?.Section || []).map((s) => s.TOCHeading),
      data
    };
    writeJson(out, wrapped);
    return wrapped;
  } catch (err) {
    const wrapped = {
      ok: false,
      fetchedAt: new Date().toISOString(),
      url,
      error: String(err?.message || err)
    };
    writeJson(out, wrapped);
    return wrapped;
  }
}

const WIKI_TITLE = {
  mercury: "Mercury (element)",
  cesium: "Caesium",
  aluminum: "Aluminium",
  lead: "Lead",
  indium: "Indium"
};

async function pullWikipedia(metal) {
  const out = path.join(rawDir, "wikipedia", `${metal.key}.json`);
  if (existsFresh(out)) return JSON.parse(fs.readFileSync(out, "utf8"));
  const title = WIKI_TITLE[metal.key] || metal.name;
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const data = await fetchJson(url);
    const wrapped = {
      ok: true,
      fetchedAt: new Date().toISOString(),
      url,
      title: data.title,
      extract: data.extract,
      description: data.description,
      content_urls: data.content_urls,
      thumbnail: data.thumbnail || null,
      tier: 3
    };
    writeJson(out, wrapped);
    return wrapped;
  } catch (err) {
    const wrapped = { ok: false, fetchedAt: new Date().toISOString(), url, error: String(err?.message || err), tier: 3 };
    writeJson(out, wrapped);
    return wrapped;
  }
}

async function pullUsgsChapter(filename) {
  const outTxt = path.join(rawDir, "usgs", filename);
  const pdfName = filename.replace(".txt", ".pdf");
  const outPdf = path.join(rawDir, "usgs", pdfName);
  const url = usgsPdfUrl(filename);

  if (existsFresh(outTxt)) {
    return {
      ok: true,
      chapter: filename,
      url,
      text: fs.readFileSync(outTxt, "utf8"),
      fromCache: true
    };
  }

  // Prefer re-using app-local text if present (same MCS 2025 extract), then try PDF download.
  const appLocal = path.join(root, "src/data/usgs/text", filename);
  if (fs.existsSync(appLocal)) {
    const text = fs.readFileSync(appLocal, "utf8");
    fs.writeFileSync(outTxt, text);
    // Still try to grab PDF for the reference vault
    if (!existsFresh(outPdf)) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": UA } });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(outPdf, buf);
        }
      } catch {
        /* optional */
      }
    }
    return { ok: true, chapter: filename, url, text, fromAppLocal: true };
  }

  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outPdf, buf);
    // PDF binary stored; text extraction needs pdftotext — note in record
    return {
      ok: true,
      chapter: filename,
      url,
      pdfPath: outPdf,
      text: null,
      note: "PDF downloaded; no local pdftotext — use app usgs/text or install poppler"
    };
  } catch (err) {
    return { ok: false, chapter: filename, url, error: String(err?.message || err) };
  }
}

async function pullRsc(metal) {
  const out = path.join(rawDir, "rsc", `${metal.key}.json`);
  if (existsFresh(out)) return JSON.parse(fs.readFileSync(out, "utf8"));

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return {
      ok: false,
      error: "playwright not installed — run: npm i -D playwright && npx playwright install chromium"
    };
  }

  const slug = RSC_SLUG[metal.key] || metal.name.toLowerCase().replace(/\s+/g, "-");
  const url = `https://periodic-table.rsc.org/element/${metal.atomicNumber}/${slug}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(700);
    const usesTab = page.getByText("Uses and properties", { exact: true }).first();
    if (await usesTab.count()) {
      await usesTab.click();
      await page.waitForTimeout(500);
    }
    const extracted = await page.evaluate(() => {
      const byHeader = {};
      for (const block of document.querySelectorAll(".accordian_block, .accordion_block")) {
        const header = block.querySelector(".accordian_header, .accordion_header");
        const body =
          block.querySelector(".accordian_body, .accordion_body, .accordian_content, .accordion_content") ||
          block;
        if (!header) continue;
        const key = header.textContent.replace(/\s+/g, " ").trim();
        let text = (body.innerText || "").replace(/\s+/g, " ").trim();
        if (text.startsWith(key)) text = text.slice(key.length).trim();
        if (!byHeader[key] || text.length > byHeader[key].length) byHeader[key] = text;
      }
      return {
        appearance: byHeader.Appearance || "",
        uses: byHeader.Uses || "",
        naturalAbundance: byHeader["Natural abundance"] || "",
        biologicalRole: byHeader["Biological role"] || ""
      };
    });
    const wrapped = {
      ok: true,
      fetchedAt: new Date().toISOString(),
      url,
      slug,
      ...extracted
    };
    writeJson(out, wrapped);
    return wrapped;
  } catch (err) {
    const wrapped = { ok: false, fetchedAt: new Date().toISOString(), url, error: String(err?.message || err) };
    writeJson(out, wrapped);
    return wrapped;
  } finally {
    await browser.close();
  }
}

function mapCsvRow(rows, metal) {
  const byZ = rows.find((r) => Number(r.AtomicNumber || r.AtomicNumber) === metal.atomicNumber);
  const byName = rows.find(
    (r) => String(r.Name || "").toLowerCase() === metal.name.toLowerCase() ||
      String(r.Name || "").toLowerCase() === (metal.key === "aluminum" ? "aluminium" : metal.name.toLowerCase())
  );
  return byZ || byName || null;
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function main() {
  ensureDirs();
  console.log(`Catalog: ${metals.length} metals → ${path.relative(root, dbRoot)}`);

  const csvRows = await pullPubchemCsv();
  const usgsCache = new Map();
  const uniqueUsgs = [...new Set(Object.values(USGS_MAP))];
  console.log(`USGS chapters: ${uniqueUsgs.length} unique files…`);
  for (const file of uniqueUsgs) {
    usgsCache.set(file, await pullUsgsChapter(file));
    await sleep(150);
  }

  let rscBrowserNote = null;
  if (wantRsc) {
    console.log("RSC scrape enabled (Playwright)…");
  } else {
    rscBrowserNote = "skipped (pass --rsc to scrape)";
    console.log("RSC: skipped (use --rsc to enable)");
  }

  const stats = {
    pubchemOk: 0,
    wikiOk: 0,
    usgsOk: 0,
    rscOk: 0,
    errors: []
  };

  console.log("Per-element PubChem + Wikipedia…");
  await mapPool(metals, 2, async (metal, idx) => {
    process.stdout.write(`\r  [${idx + 1}/${metals.length}] ${metal.key}          `);
    const pubchemCsv = mapCsvRow(csvRows, metal);
    const pubchemPug = await pullPubchemElement(metal);
    await sleep(200);
    const wikipedia = await pullWikipedia(metal);
    await sleep(900);

    const usgsFile = USGS_MAP[metal.key] || null;
    const usgs = usgsFile
      ? {
          ...usgsCache.get(usgsFile),
          mappedChapter: usgsFile
        }
      : { ok: false, mappedChapter: null, note: "no USGS MCS chapter mapped for this key" };

    let rsc = { ok: false, note: rscBrowserNote };
    if (wantRsc) {
      rsc = await pullRsc(metal);
      await sleep(300);
    } else {
      // Seed from existing app RSC cache if present (still offline-safe copy into vault)
      const appRsc = path.join(root, "src/data/rsc", `${metal.key}.json`);
      if (fs.existsSync(appRsc)) {
        const copy = JSON.parse(fs.readFileSync(appRsc, "utf8"));
        rsc = { ok: Boolean(copy.ok), fromAppCache: true, ...copy };
        writeJson(path.join(rawDir, "rsc", `${metal.key}.json`), rsc);
      }
    }

    if (pubchemPug?.ok) stats.pubchemOk += 1;
    else stats.errors.push({ key: metal.key, source: "pubchem", error: pubchemPug?.error });
    if (wikipedia?.ok) stats.wikiOk += 1;
    if (usgs?.ok) stats.usgsOk += 1;
    if (rsc?.ok) stats.rscOk += 1;

    const record = {
      key: metal.key,
      name: metal.name,
      symbol: metal.symbol,
      atomicNumber: metal.atomicNumber,
      fetchedAt: new Date().toISOString(),
      sources: {
        pubchemCsv,
        pubchemPug,
        wikipedia,
        usgs,
        rsc
      }
    };
    writeJson(path.join(elementsDir, `${metal.key}.json`), record);
    return record;
  });

  console.log("\nAssembling index…");
  const index = metals.map((m) => {
    const rec = JSON.parse(fs.readFileSync(path.join(elementsDir, `${m.key}.json`), "utf8"));
    return {
      key: m.key,
      name: m.name,
      symbol: m.symbol,
      atomicNumber: m.atomicNumber,
      hasPubchemCsv: Boolean(rec.sources.pubchemCsv),
      hasPubchemPug: Boolean(rec.sources.pubchemPug?.ok),
      hasWikipedia: Boolean(rec.sources.wikipedia?.ok),
      hasUsgs: Boolean(rec.sources.usgs?.ok),
      hasRsc: Boolean(rec.sources.rsc?.ok)
    };
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    catalogCount: metals.length,
    force,
    wantRsc,
    stats,
    paths: {
      raw: "reference-db/raw",
      assembled: "reference-db/assembled"
    }
  };

  writeJson(path.join(assembledDir, "index.json"), index);
  writeJson(path.join(assembledDir, "manifest.json"), manifest);

  console.log("Done.");
  console.log(JSON.stringify(stats, null, 2));
  console.log(`Wrote assembled/elements (${metals.length}) + index.json + manifest.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
