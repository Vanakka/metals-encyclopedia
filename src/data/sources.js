/** Shared citation metadata for property and narrative fields. */

export const PROPERTY_SOURCES = {
  pubchemPeriodicTable: {
    id: "pubchem-ptable",
    title: "PubChem Periodic Table (CSV)",
    url: "https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/CSV",
    page: "https://pubchem.ncbi.nlm.nih.gov/periodic-table/",
    tier: 1,
    covers: [
      "atomicMass",
      "electronConfiguration",
      "standardState",
      "yearDiscovered",
      "meltingPoint",
      "boilingPoint",
      "density",
      "sourceCategory"
    ]
  },
  periodicTableDotCom: {
    id: "periodictable-com",
    title: "PeriodicTable.com / Wolfram ElementData (via prior dataset)",
    url: "https://periodictable.com/",
    tier: 2,
    covers: [
      "conductivity",
      "thermalConductivity",
      "mohsHardness",
      "brinellHardness",
      "crustAbundancePercent",
      "universeAbundancePercent",
      "oceanAbundancePercent"
    ]
  },
  wikimediaCommons: {
    id: "wikimedia-commons",
    title: "Wikimedia Commons element sample images",
    url: "https://commons.wikimedia.org/",
    tier: 2,
    covers: ["imageUrl", "imageSourceUrl", "imageCredit"]
  }
};

/** Dashboard / Sources page — what each provenance feed supplies. */
export const SOURCE_REFERENCE = [
  {
    id: "pubchem",
    title: "PubChem Periodic Table",
    tier: 1,
    role: "Identity & thermo",
    blurb:
      "Atomic number, mass, electron configuration, standard state, discovery year, melting/boiling point, and density.",
    url: "https://pubchem.ncbi.nlm.nih.gov/periodic-table/"
  },
  {
    id: "usgs",
    title: "USGS Mineral Commodity Summaries 2025",
    tier: 1,
    role: "Industrial production",
    blurb:
      "U.S. Domestic Production and Use excerpts where a commodity chapter maps to an element. Group or mineral-alias chapters stay as Confirmed sources; element-specific “how made” text prefers RSC.",
    url: "https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries"
  },
  {
    id: "rsc",
    title: "RSC Periodic Table",
    tier: 2,
    role: "Encyclopedia narrative",
    blurb:
      "Appearance, uses, natural abundance (including element-specific production routes), and biological role.",
    url: "https://periodic-table.rsc.org/"
  },
  {
    id: "periodictable-com",
    title: "PeriodicTable.com / Wolfram ElementData",
    tier: 2,
    role: "Conductivity & hardness",
    blurb:
      "Electrical and thermal conductivity, Mohs and Brinell hardness, and crust/universe/ocean abundance. Null when the source lists N/A.",
    url: "https://periodictable.com/"
  },
  {
    id: "commons",
    title: "Wikimedia Commons",
    tier: 2,
    role: "Specimen images",
    blurb: "Sample photos and credits linked from each entry when a clear licensed image exists.",
    url: "https://commons.wikimedia.org/"
  }
];

export const CONFIDENCE_REFERENCE = [
  {
    id: "confirmed",
    label: "Confirmed",
    meaning: "RSC narrative fields present and a USGS commodity chapter is mapped."
  },
  {
    id: "single-source",
    label: "Single-source",
    meaning: "RSC only (or USGS only if RSC was missing)."
  },
  {
    id: "unverified-model",
    label: "Unverified",
    meaning: "Neither RSC nor USGS narrative usable — rare; usually sparse superheavies."
  }
];

export function pubchemElementUrl(name) {
  return `https://pubchem.ncbi.nlm.nih.gov/element/${encodeURIComponent(name)}`;
}
