/** Element key → USGS chapter filename (shared by narratives + reference-db fetch). */
export const USGS_MAP = {
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
  /** Fuel mineral — not in MCS 2025; USGS Fact Sheet 2025–3057 (Apr 2026). */
  uranium: "fs20253057-uranium.txt",
  sodium: "mcs2025-salt.txt",
  potassium: "mcs2025-potash.txt",
  calcium: "mcs2025-lime.txt",
  rubidium: "mcs2025-rubidium.txt",
  strontium: "mcs2025-strontium.txt",
  cesium: "mcs2025-cesium.txt",
  barium: "mcs2025-barite.txt",
  zirconium: "mcs2025-zirconium-hafnium.txt",
  hafnium: "mcs2025-zirconium-hafnium.txt",
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
  /** Own MCS chapter — rare-earths text explicitly excludes most scandium. */
  scandium: "mcs2025-scandium.txt"
  // promethium: no MCS commodity chapter (synthetic; absent from rare-earth trade stats)
};

/**
 * Mapped chapter filenames that must NOT count as covering these element keys.
 * Prevents Dual-sourced + group commodityNotes on metals the chapter excludes
 * or never documents (phase-5 audit: Pm on rare-earths; Sc if remapped wrongly).
 */
export const USGS_COVERAGE_EXCLUSIONS = {
  "mcs2025-rare-earths.txt": new Set(["promethium", "scandium"])
};

/**
 * Whether a mapped USGS chapter should confer Dual-sourced provenance and
 * commodityNotes for this element. Exclusions win even if a production excerpt
 * can be sliced from the file.
 */
export function usgsChapterCovers(elementKey, filename, text = "") {
  if (!filename) return false;
  const excluded = USGS_COVERAGE_EXCLUSIONS[filename];
  if (excluded?.has(elementKey)) return false;
  // Chapter body can also disclaim coverage (rare-earths → scandium).
  if (
    elementKey === "scandium" &&
    text &&
    /exclude[sd]?\s+most\s+scandium|exclude[sd]?\s+scandium/i.test(text)
  ) {
    return false;
  }
  return true;
}

/** Non-MCS chapters: custom title + PDF URL for citations and vault fetch. */
export const USGS_SOURCE_META = {
  "fs20253057-uranium.txt": {
    title:
      "USGS Fact Sheet 2025–3057: Uranium—Deposits, production and resources, market dynamics, and supply chain risks",
    url: "https://pubs.usgs.gov/fs/2025/3057/fs20253057.pdf"
  }
};

export function usgsPdfUrl(filename) {
  const meta = USGS_SOURCE_META[filename];
  if (meta?.url) return meta.url;
  return `https://pubs.usgs.gov/periodicals/mcs2025/${filename.replace(".txt", ".pdf")}`;
}

export function usgsSourceTitle(filename) {
  const meta = USGS_SOURCE_META[filename];
  if (meta?.title) return meta.title;
  const slug = filename.replace("mcs2025-", "").replace(".txt", "");
  return `USGS Mineral Commodity Summaries 2025 (${slug})`;
}
