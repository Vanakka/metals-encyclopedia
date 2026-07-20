import { hasValue } from "./format.js";

const SILVER_CONDUCTIVITY = 6.2e7;

export function relativeConductivity(metal) {
  if (!hasValue(metal.conductivity)) return null;
  return (metal.conductivity / SILVER_CONDUCTIVITY) * 100;
}

export function getFilteredMetals(metals, { query, family, sort }) {
  const q = query.trim().toLowerCase();
  const filtered = metals.filter((metal) => {
    const haystack = [
      metal.name,
      metal.symbol,
      metal.family,
      metal.sourceCategory,
      metal.overview,
      metal.production,
      metal.uses,
      metal.safety,
      ...(metal.notableFacts || [])
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !q || haystack.includes(q);
    const matchesFamily = family === "all" || metal.family === family;
    return matchesQuery && matchesFamily;
  });

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    atomicNumber: (a, b) => a.atomicNumber - b.atomicNumber,
    densityDesc: (a, b) => (b.density ?? -Infinity) - (a.density ?? -Infinity),
    meltingDesc: (a, b) => (b.meltingPoint ?? -Infinity) - (a.meltingPoint ?? -Infinity),
    conductivityDesc: (a, b) => (b.conductivity ?? -Infinity) - (a.conductivity ?? -Infinity)
  };

  return filtered.sort(sorters[sort] || sorters.name);
}

export function familyClassName(family) {
  return `family-${family.replace(/\s+/g, "-").replace(/[^A-Za-z-]/g, "")}`;
}
