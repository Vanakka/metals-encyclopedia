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

export function pubchemElementUrl(name) {
  return `https://pubchem.ncbi.nlm.nih.gov/element/${encodeURIComponent(name)}`;
}
