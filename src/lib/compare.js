import {
  formatAbundance,
  formatAtomicMass,
  formatConductivity,
  formatDensity,
  formatHardness,
  formatNumber,
  formatTemperature,
  formatThermalConductivity,
  hasValue
} from "./format.js";
import { relativeConductivity } from "./filter.js";

export const COMPARE_LIMIT = 4;

export const COMPARE_PROPERTIES = [
  {
    id: "atomicNumber",
    label: "Atomic number",
    type: "number",
    higher: "higher",
    get: (m) => m.atomicNumber,
    format: (m) => String(m.atomicNumber)
  },
  {
    id: "atomicMass",
    label: "Atomic mass",
    type: "number",
    higher: "higher",
    get: (m) => m.atomicMass,
    format: (m) => formatAtomicMass(m.atomicMass)
  },
  {
    id: "meltingPoint",
    label: "Melting point",
    type: "number",
    higher: "higher",
    get: (m) => m.meltingPoint,
    format: (m) => formatTemperature(m.meltingPoint),
    deltaSuffix: " °C"
  },
  {
    id: "boilingPoint",
    label: "Boiling point",
    type: "number",
    higher: "higher",
    get: (m) => m.boilingPoint,
    format: (m) => formatTemperature(m.boilingPoint),
    deltaSuffix: " °C"
  },
  {
    id: "density",
    label: "Density",
    type: "number",
    higher: "higher",
    get: (m) => m.density,
    format: (m) => formatDensity(m.density, 3),
    deltaSuffix: " g/cm³"
  },
  {
    id: "conductivity",
    label: "Electrical conductivity",
    type: "number",
    higher: "higher",
    get: (m) => m.conductivity,
    format: (m) => formatConductivity(m.conductivity),
    deltaSuffix: " S/m"
  },
  {
    id: "relConductivity",
    label: "Conductivity vs silver",
    type: "number",
    higher: "higher",
    get: (m) => relativeConductivity(m),
    format: (m) => {
      const rel = relativeConductivity(m);
      return hasValue(rel) ? `${formatNumber(rel, 1)}%` : "Unavailable";
    },
    deltaSuffix: " pts"
  },
  {
    id: "thermalConductivity",
    label: "Thermal conductivity",
    type: "number",
    higher: "higher",
    get: (m) => m.thermalConductivity,
    format: (m) => formatThermalConductivity(m.thermalConductivity),
    deltaSuffix: " W/(m·K)"
  },
  {
    id: "mohsHardness",
    label: "Mohs hardness",
    type: "number",
    higher: "higher",
    get: (m) => m.mohsHardness,
    format: (m) => formatHardness(m.mohsHardness)
  },
  {
    id: "brinellHardness",
    label: "Brinell hardness",
    type: "number",
    higher: "higher",
    get: (m) => m.brinellHardness,
    format: (m) => formatHardness(m.brinellHardness, "MPa"),
    deltaSuffix: " MPa"
  },
  {
    id: "crustAbundance",
    label: "Crust abundance",
    type: "number",
    higher: "higher",
    get: (m) => m.crustAbundancePercent,
    format: (m) => formatAbundance(m.crustAbundancePercent),
    deltaSuffix: " pts"
  },
  {
    id: "family",
    label: "Group",
    type: "text",
    get: (m) => m.family,
    format: (m) => m.family
  },
  {
    id: "standardState",
    label: "Standard state",
    type: "text",
    get: (m) => m.standardState,
    format: (m) => m.standardState || "Unknown"
  },
  {
    id: "yearDiscovered",
    label: "Year discovered",
    type: "text",
    get: (m) => m.yearDiscovered,
    format: (m) => m.yearDiscovered || "Unknown"
  },
  {
    id: "electronConfiguration",
    label: "Electron configuration",
    type: "text",
    get: (m) => m.electronConfiguration,
    format: (m) => m.electronConfiguration || "Unknown"
  }
];

export function toggleCompareKey(keys, key) {
  if (keys.includes(key)) {
    return keys.filter((k) => k !== key);
  }
  if (keys.length >= COMPARE_LIMIT) {
    return keys;
  }
  return [...keys, key];
}

export const COMPARE_PRESETS = [
  {
    id: "conductivity",
    label: "Best conductors",
    notice: "Loaded top metals by electrical conductivity.",
    get: (m) => m.conductivity
  },
  {
    id: "density",
    label: "Densest",
    notice: "Loaded top metals by density.",
    get: (m) => m.density
  },
  {
    id: "melting",
    label: "Highest melt",
    notice: "Loaded top metals by melting point.",
    get: (m) => m.meltingPoint
  }
];

export function bestOfKeys(list, getValue, limit = COMPARE_LIMIT) {
  return list
    .filter((m) => hasValue(getValue(m)) && typeof getValue(m) === "number")
    .slice()
    .sort((a, b) => getValue(b) - getValue(a))
    .slice(0, limit)
    .map((m) => m.key);
}

export function reorderCompareKeys(keys, fromKey, toKey) {
  if (!fromKey || !toKey || fromKey === toKey) return keys;
  const from = keys.indexOf(fromKey);
  const to = keys.indexOf(toKey);
  if (from < 0 || to < 0) return keys;
  const next = keys.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function buildCompareRows(metals) {
  if (metals.length === 0) return [];

  return COMPARE_PROPERTIES.map((prop) => {
    const values = metals.map((m) => prop.get(m));
    const numericValues = values.filter((v) => hasValue(v) && typeof v === "number");
    let bestIndex = -1;
    let worstIndex = -1;

    if (prop.type === "number" && numericValues.length > 0) {
      const preferHigher = prop.higher !== "lower";
      let best = preferHigher ? -Infinity : Infinity;
      let worst = preferHigher ? Infinity : -Infinity;
      values.forEach((v, i) => {
        if (!hasValue(v)) return;
        if (preferHigher) {
          if (v > best) {
            best = v;
            bestIndex = i;
          }
          if (v < worst) {
            worst = v;
            worstIndex = i;
          }
        } else {
          if (v < best) {
            best = v;
            bestIndex = i;
          }
          if (v > worst) {
            worst = v;
            worstIndex = i;
          }
        }
      });
    }

    const baseline = values[0];
    const cells = metals.map((metal, index) => {
      const value = values[index];
      let delta = "—";
      if (prop.type === "number" && hasValue(value) && hasValue(baseline) && index > 0) {
        const diff = value - baseline;
        const sign = diff > 0 ? "+" : "";
        delta = `${sign}${formatNumber(diff, 3)}${prop.deltaSuffix || ""}`;
      } else if (prop.type === "text" && index > 0) {
        delta = value === baseline ? "Same" : "Different";
      }

      return {
        text: prop.format(metal),
        delta,
        isBest: index === bestIndex && metals.length > 1,
        isWorst: index === worstIndex && metals.length > 1 && bestIndex !== worstIndex
      };
    });

    const maxAbs = prop.type === "number"
      ? Math.max(...numericValues.map((v) => Math.abs(v)), 0)
      : 0;

    return {
      id: prop.id,
      label: prop.label,
      type: prop.type,
      cells,
      bars: metals.map((metal) => {
        const value = prop.get(metal);
        if (prop.type !== "number" || !hasValue(value) || maxAbs === 0) return null;
        return Math.max(4, (Math.abs(value) / maxAbs) * 100);
      })
    };
  });
}

export function compareSummaryText(metals) {
  const rows = buildCompareRows(metals);
  const header = ["Property", ...metals.map((m) => `${m.name} (${m.symbol})`)].join("\t");
  const body = rows
    .map((row) => [row.label, ...row.cells.map((c) => c.text)].join("\t"))
    .join("\n");
  return `${header}\n${body}`;
}
