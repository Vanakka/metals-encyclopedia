export function hasValue(value) {
  return value !== null && value !== undefined && value !== "" && !Number.isNaN(value);
}

export function formatNumber(value, decimals = 1) {
  if (!hasValue(value)) return "Unavailable";
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals
  });
}

export function formatTemperature(celsius) {
  if (!hasValue(celsius)) return "Unavailable";
  const fahrenheit = (celsius * 9) / 5 + 32;
  return `${formatNumber(celsius, 1)} °C / ${formatNumber(fahrenheit, 1)} °F`;
}

export function formatConductivity(value) {
  if (!hasValue(value)) return "Unavailable";
  if (value >= 1e6) return `${formatNumber(value / 1e6, 2)} MS/m`;
  if (value >= 1e3) return `${formatNumber(value / 1e3, 2)} kS/m`;
  return `${formatNumber(value, 2)} S/m`;
}

export function formatDensity(value, decimals = 3) {
  if (!hasValue(value)) return "Unavailable";
  return `${formatNumber(value, decimals)} g/cm³`;
}

export function formatAtomicMass(value) {
  if (!hasValue(value)) return "Unavailable";
  return `${formatNumber(value, 4)} u`;
}

export function formatThermalConductivity(value) {
  if (!hasValue(value)) return "Unavailable";
  return `${formatNumber(value, 2)} W/(m·K)`;
}

export function formatHardness(value, unit = "") {
  if (!hasValue(value)) return "Unavailable";
  return unit ? `${formatNumber(value, 2)} ${unit}` : formatNumber(value, 2);
}

export function formatAbundance(value) {
  if (!hasValue(value)) return "Unavailable";
  if (value === 0) return "0%";
  if (value < 1e-6) return `${value.toExponential(2)}%`;
  if (value < 0.01) return `${formatNumber(value, 6)}%`;
  return `${formatNumber(value, 4)}%`;
}

export function formatDelta(value, suffix = "") {
  if (!hasValue(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 3)}${suffix}`;
}

export function confidenceLabel(confidence) {
  switch (confidence) {
    case "confirmed":
      return "Confirmed";
    case "single-source":
      return "Single-source";
    case "unverified-model":
      return "Unverified (model knowledge)";
    default:
      return confidence || "Unknown";
  }
}

const COVERAGE_FIELDS = [
  "meltingPoint",
  "boilingPoint",
  "density",
  "conductivity",
  "thermalConductivity",
  "mohsHardness",
  "brinellHardness"
];

/** Classify how complete bulk physical data is for UI callouts. */
export function dataCoverage(metal) {
  const missing = COVERAGE_FIELDS.filter((f) => !hasValue(metal[f])).length;
  if (metal.atomicNumber >= 104) {
    return {
      level: "synthetic",
      missing,
      note: "Synthetic superheavy — no macroscopic sample; bulk properties are not measured."
    };
  }
  if (metal.atomicNumber > 92) {
    return {
      level: "radioactive-limited",
      missing,
      note: "Post-uranium actinide — many bulk values are sparse or unavailable in reference sets."
    };
  }
  if (missing >= 3) {
    return {
      level: "sparse",
      missing,
      note: `${missing} bulk properties are not measured in the PubChem / Wolfram reference set (shown as Unavailable).`
    };
  }
  if (missing > 0) {
    return {
      level: "partial",
      missing,
      note: `${missing} bulk propert${missing === 1 ? "y is" : "ies are"} unavailable in the curated reference set.`
    };
  }
  return { level: "full", missing: 0, note: "" };
}
