/**
 * Download Commons specimen images into public/samples/ for same-origin instant loads.
 * Run: node scripts/fetch-sample-images.mjs [--force] [--only=lithium,copper]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "samples");
const mapPath = path.join(root, "src", "data", "sample-images.json");
const raw = JSON.parse(fs.readFileSync(path.join(root, "src/data/metals-raw.json"), "utf8"));

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg
  ? new Set(
      onlyArg
        .slice("--only=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  : null;

const UA = "MetalsEncyclopediaSampleFetch/0.1 (local build; caches Commons thumbs)";

fs.mkdirSync(outDir, { recursive: true });

function extFromType(ct, url) {
  const t = String(ct || "").toLowerCase();
  if (t.includes("svg")) return "svg";
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
  const m = /\.(svg|png|jpe?g|webp|gif)(?:\?|$)/i.exec(url || "");
  if (m) return m[1].toLowerCase().replace("jpeg", "jpg");
  return "jpg";
}

function existingForKey(key) {
  if (!fs.existsSync(outDir)) return null;
  const hit = fs.readdirSync(outDir).find((f) => f === key || f.startsWith(`${key}.`));
  return hit ? path.join(outDir, hit) : null;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function download(metal) {
  if (!metal.imageUrl) return { key: metal.key, ok: false, skip: "no imageUrl" };
  const existing = existingForKey(metal.key);
  if (existing && !force) {
    const rel = `/samples/${path.basename(existing)}`;
    return { key: metal.key, ok: true, cached: true, path: rel };
  }

  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(metal.imageUrl, {
        headers: { "User-Agent": UA, Accept: "image/*,*/*" },
        redirect: "follow"
      });
      if (res.status === 429) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = extFromType(res.headers.get("content-type"), res.url);
      const file = `${metal.key}.${ext}`;
      // Remove other extensions for this key
      for (const f of fs.readdirSync(outDir)) {
        if (f.startsWith(`${metal.key}.`) && f !== file) fs.unlinkSync(path.join(outDir, f));
      }
      fs.writeFileSync(path.join(outDir, file), buf);
      return { key: metal.key, ok: true, path: `/samples/${file}`, bytes: buf.length };
    } catch (err) {
      lastErr = err;
      await sleep(400 * (attempt + 1));
    }
  }
  return { key: metal.key, ok: false, error: String(lastErr?.message || lastErr) };
}

const list = only ? raw.filter((m) => only.has(m.key)) : raw;
const map = {};
try {
  if (fs.existsSync(mapPath)) {
    const prev = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    Object.assign(map, prev.images || {});
  }
} catch {
  /* start fresh */
}
// Sync map from files already on disk
for (const metal of raw) {
  const existing = existingForKey(metal.key);
  if (existing) map[metal.key] = `/samples/${path.basename(existing)}`;
}

console.log(`Fetching ${list.length} sample images → public/samples/`);
let ok = 0;
let fail = 0;
for (let i = 0; i < list.length; i++) {
  const metal = list[i];
  process.stdout.write(`\r  [${i + 1}/${list.length}] ${metal.key}          `);
  const result = await download(metal);
  if (result.ok && result.path) {
    map[metal.key] = result.path;
    ok += 1;
  } else {
    fail += 1;
    if (result.error) console.log(`\n  fail ${metal.key}: ${result.error}`);
  }
  await sleep(120);
}

fs.writeFileSync(
  mapPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      note: "Local same-origin sample paths. Rebuild with npm run fetch:samples",
      images: map
    },
    null,
    2
  ) + "\n"
);

console.log(`\nDone. ok=${ok} fail=${fail}. Map → src/data/sample-images.json`);
