/**
 * Scrape RSC Periodic Table accordion content for each metal.
 * Tier-2 specialist source (RSC cites CRC, Emsley, NIST, BGS).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const raw = JSON.parse(fs.readFileSync(path.join(root, "src/data/metals-raw.json"), "utf8"));
const outDir = path.join(root, "src/data/rsc");
fs.mkdirSync(outDir, { recursive: true });

const RSC_SLUG = {
  aluminum: "aluminium",
  cesium: "caesium"
};

function clean(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function scrapeOne(page, metal) {
  const slug = RSC_SLUG[metal.key] || metal.name.toLowerCase().replace(/\s+/g, "-");
  const url = `https://periodic-table.rsc.org/element/${metal.atomicNumber}/${slug}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);

  // Expand the Uses and properties accordion/tab so content is present.
  const usesTab = page.getByText("Uses and properties", { exact: true }).first();
  if (await usesTab.count()) {
    await usesTab.click();
    await page.waitForTimeout(600);
  }

  const extracted = await page.evaluate(() => {
    const byHeader = {};
    const blocks = [...document.querySelectorAll(".accordian_block, .accordion_block")];
    for (const block of blocks) {
      const header = block.querySelector(".accordian_header, .accordion_header");
      const body = block.querySelector(".accordian_body, .accordion_body, .accordian_content, .accordion_content") || block;
      if (!header) continue;
      const key = header.textContent.replace(/\s+/g, " ").trim();
      const text = (body.innerText || body.textContent || "").replace(/\s+/g, " ").trim();
      // Prefer longer body if header text is duplicated inside.
      const cleaned = text.startsWith(key) ? text.slice(key.length).trim() : text;
      if (!byHeader[key] || cleaned.length > byHeader[key].length) {
        byHeader[key] = cleaned;
      }
    }

    // Fallback: parse from expanded innerText sections.
    const text = document.body.innerText;
    const take = (startLabel, stops) => {
      const start = text.indexOf(startLabel);
      if (start < 0) return "";
      let rest = text.slice(start + startLabel.length);
      let end = rest.length;
      for (const stop of stops) {
        const idx = rest.indexOf("\n" + stop);
        if (idx >= 0) end = Math.min(end, idx);
      }
      return rest.slice(0, end).replace(/\s+/g, " ").trim();
    };

    return {
      byHeader,
      appearance:
        byHeader.Appearance ||
        take("Appearance", ["Uses", "Biological role", "Natural abundance"]),
      uses:
        byHeader.Uses ||
        take("Uses", ["Biological role", "Natural abundance", "History"]),
      naturalAbundance:
        byHeader["Natural abundance"] ||
        take("Natural abundance", ["History", "Atomic data", "Oxidation states"]),
      biologicalRole:
        byHeader["Biological role"] ||
        take("Biological role", ["Natural abundance", "History"])
    };
  });

  const appearance = clean(extracted.appearance);
  const uses = clean(extracted.uses);
  // Guard against catching the tab label "Uses and properties"
  const usesClean = uses === "and properties" ? "" : uses.replace(/^and properties\s*/i, "");
  const naturalAbundance = clean(extracted.naturalAbundance);
  const biologicalRole = clean(extracted.biologicalRole);

  return {
    key: metal.key,
    name: metal.name,
    atomicNumber: metal.atomicNumber,
    url,
    slug,
    fetchedAt: new Date().toISOString(),
    appearance,
    uses: usesClean,
    naturalAbundance,
    biologicalRole,
    ok: Boolean(appearance || usesClean || naturalAbundance)
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];
const failures = [];

for (const metal of raw) {
  process.stdout.write(`RSC ${metal.atomicNumber} ${metal.name}... `);
  try {
    const entry = await scrapeOne(page, metal);
    results.push(entry);
    fs.writeFileSync(path.join(outDir, `${metal.key}.json`), JSON.stringify(entry, null, 2));
    console.log(entry.ok ? `ok (${entry.appearance.length}/${entry.uses.length}/${entry.naturalAbundance.length})` : "empty");
    if (!entry.ok) failures.push(metal.key);
  } catch (err) {
    console.log("fail", err.message);
    failures.push(metal.key);
    results.push({
      key: metal.key,
      name: metal.name,
      atomicNumber: metal.atomicNumber,
      error: String(err.message),
      ok: false
    });
  }
}

await browser.close();
fs.writeFileSync(path.join(outDir, "_all.json"), JSON.stringify(results, null, 2));
fs.writeFileSync(
  path.join(outDir, "_report.json"),
  JSON.stringify({ total: raw.length, ok: results.filter((r) => r.ok).length, failures }, null, 2)
);
console.log(`Done. ok=${results.filter((r) => r.ok).length}/${raw.length}`);
if (failures.length) console.log("Failures:", failures.join(", "));
