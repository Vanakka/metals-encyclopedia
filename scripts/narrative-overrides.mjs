/**
 * Curated corrections for known-false or outdated RSC prose.
 * Applied by upgrade-narratives.mjs after RSC/USGS merge so re-scrapes
 * don't silently reintroduce errors. Prefer USGS MCS figures when cited.
 *
 * Deep audit 2026-07-20 phase 4.
 */
export const NARRATIVE_OVERRIDES = {
  lithium: {
    note: "RSC still says Chile leads; USGS MCS 2025 mine output: Australia #1, Chile #2.",
    overviewReplace: [
      {
        from: /Most lithium is currently produced in Chile, from brines that…?/,
        to: "Australia is the leading producer (hard-rock spodumene); Chile is second (brine operations)."
      }
    ]
  },
  aluminum: {
    note: "RSC mislabels bauxite/cryolite as aluminium silicates.",
    overviewReplace: [
      {
        from:
          /It is usually found in minerals such as bauxite and cryolite\. These minerals are aluminium silicates\./,
        to: "It is usually extracted from bauxite (hydrated aluminium oxides/hydroxides); cryolite (Na₃AlF₆) is a fluoride flux used in smelting, not a silicate ore."
      }
    ]
  },
  manganese: {
    note: "RSC attributes permanganate’s oxidiser role to Mn(II) oxide.",
    usesReplace: [
      {
        from:
          /Manganese\(II\) oxide is a powerful oxidising agent and is used in quantitative analysis\./,
        to: "Potassium permanganate (KMnO₄) is a powerful oxidising agent used in quantitative analysis."
      }
    ]
  },
  gold: {
    note: "RSC mining geography is decades out of date; use USGS MCS 2025 world figures.",
    overviewReplace: [
      {
        from:
          /About 1500 tonnes of gold are mined each year\. About two-thirds of this comes from South Africa and most of the rest from Russia\./,
        to: "Worldwide mine production was about 3,300 tonnes in 2024 (USGS). China, Russia, Australia, Canada, and the United States were the leading producers; South Africa is no longer among the top producers."
      }
    ]
  },
  flerovium: {
    note: "RSC wrongly says Fl forms in nuclear reactors; actual route is heavy-ion fusion.",
    overview:
      "A highly radioactive metal, of which only a few atoms have ever been made. It is produced in particle accelerators by heavy-ion fusion of plutonium-244 with calcium-48, not in nuclear reactors.",
    production:
      "Flerovium is made by bombarding plutonium-244 targets with calcium-48 ions in a heavy-ion accelerator (first reported by JINR Dubna). It cannot be reached by neutron capture in a reactor."
  },
  promethium: {
    note: "RSC conflates the constellation Andromeda with the Andromeda Galaxy.",
    overviewReplace: [
      {
        from: /a star in the Andromeda galaxy is manufacturing promethium/,
        to: "a star in the constellation Andromeda (Milky Way; HR 465) is manufacturing promethium"
      }
    ],
    productionReplace: [
      {
        from: /a star in the Andromeda galaxy is manufacturing promethium/,
        to: "a star in the constellation Andromeda (Milky Way; HR 465) is manufacturing promethium"
      }
    ]
  }
};

function applyReplaces(text, rules) {
  if (!text || !rules?.length) return text;
  let out = text;
  for (const { from, to } of rules) {
    out = out.replace(from, to);
  }
  return out;
}

/** Mutate a built narrative entry with curated overrides. */
export function applyNarrativeOverrides(key, entry) {
  const o = NARRATIVE_OVERRIDES[key];
  if (!o) return entry;

  let overview = entry.overview;
  let production = entry.production;
  let uses = entry.uses;

  if (o.overview != null) overview = o.overview;
  if (o.production != null) production = o.production;
  if (o.uses != null) uses = o.uses;

  overview = applyReplaces(overview, o.overviewReplace);
  production = applyReplaces(production, o.productionReplace);
  uses = applyReplaces(uses, o.usesReplace);

  return { ...entry, overview, production, uses };
}
