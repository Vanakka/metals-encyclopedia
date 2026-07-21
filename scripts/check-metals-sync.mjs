/**
 * Fail if src/data/metals.js is out of sync with metals-raw.json + narratives.mjs.
 * Does not rewrite the file — regenerate with: npm run build:data
 *
 *   node scripts/check-metals-sync.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateMetalsFile } from "./build-metals.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outPath = path.join(root, "src/data/metals.js");

if (!fs.existsSync(outPath)) {
  console.error(`Missing ${path.relative(root, outPath)}. Run: npm run build:data`);
  process.exit(1);
}

const onDisk = fs.readFileSync(outPath, "utf8");
const { file: expected, metals } = generateMetalsFile();

if (onDisk === expected) {
  console.log(`OK — metals.js in sync (${metals.length} metals).`);
  process.exit(0);
}

const diskLines = onDisk.split(/\r?\n/).length;
const expectLines = expected.split(/\r?\n/).length;
console.error("FAIL — src/data/metals.js is stale relative to metals-raw.json + scripts/narratives.mjs.");
console.error(`  on disk: ${onDisk.length} bytes / ${diskLines} lines`);
console.error(`  expected: ${expected.length} bytes / ${expectLines} lines`);
console.error("Fix: npm run build:data");
process.exit(1);
