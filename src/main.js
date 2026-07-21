import "./style.css";
/* MOBILE_BROWSE_V2 — remove this import (+ style.mobile-browse.css) to revert mobile list/entry UX */
import "./style.mobile-browse.css";
import { metals } from "./data/metals.js";
import { CONFIDENCE_REFERENCE, SOURCE_REFERENCE } from "./data/sources.js";
import {
  confidenceLabel,
  formatAbundance,
  formatAtomicMass,
  formatConductivity,
  formatDensity,
  formatHardness,
  formatNumber,
  formatTemperature,
  formatThermalConductivity,
  hasValue,
  dataCoverage,
  boilingPointLabel,
  boilingPointTip,
  meltingPointTip,
  sublimesAtOneAtm
} from "./lib/format.js";
import { getFilteredMetals, relativeConductivity } from "./lib/filter.js";
import { displayImageUrl, warmMetalImages } from "./lib/images.js";
import {
  COMPARE_LIMIT,
  COMPARE_PRESETS,
  COMPARE_PROPERTIES,
  bestOfKeys,
  buildCompareRows,
  compareSummaryText,
  reorderCompareKeys,
  toggleCompareKey
} from "./lib/compare.js";

const byKey = new Map(metals.map((m) => [m.key, m]));
const families = [...new Set(metals.map((m) => m.family))].sort();

const SERIES_BLURBS = {
  Alkali: "Soft, highly reactive metals from Group 1 — lithium through francium.",
  "Alkaline earth": "Reactive Group 2 metals, denser and less soft than the alkalis.",
  Transition: "d-block metals spanning titanium to copper and beyond — catalysts, alloys, conductors.",
  "Post-transition": "Softer p-block metals such as aluminum, tin, lead, and gallium.",
  Metalloid: "In-between elements with mixed metallic and nonmetallic behavior.",
  Lanthanide: "The rare-earth 4f series — magnets, phosphors, and specialty alloys.",
  Actinide: "Radioactive 5f series from actinium through lawrencium."
};

const PROP_TIPS = {
  "Atomic number": "Z — the number of protons in the nucleus; defines the element.",
  "Atomic mass": "Average mass of one atom in unified atomic mass units (u) — 1 u ≈ the mass of a single proton.",
  "Melting point": "Temperature where the solid turns to liquid.",
  "Boiling point": "Temperature where the liquid turns to gas.",
  "Sublimation (1 atm)":
    "Temperature where the solid sublimes to gas at ~1 atm. Used when the listed boiling point is below the melting point (e.g. arsenic).",
  Density: "Mass per volume, in g/cm³ (grams per cubic centimetre) — water is 1.0, so a value of 20 is 20× heavier than water.",
  "Electrical conductivity": "How well it carries electric current. Measured in S/m (siemens per metre).",
  "Conductivity vs silver": "Electrical conductivity as a percentage of silver, the best metallic conductor.",
  "Thermal conductivity": "How well it conducts heat. Measured in W/(m·K).",
  "Mohs hardness": "Mohs scratch-hardness scale, 1 (talc) to 10 (diamond).",
  "Brinell hardness": "Brinell hardness — resistance to a hard ball pressed into the surface (MPa).",
  "Crust abundance": "Share of Earth's crust made of this element, by weight.",
  Group: "Chemical family of elements with similar behavior — not a periodic-table column number.",
  Series: "Chemical family of elements with similar behavior — not a periodic-table column number.",
  "Standard state": "Physical state (solid, liquid, gas) at room temperature and pressure.",
  "Year discovered": "Year the element was first identified or isolated.",
  "Electron configuration": "How electrons fill the shells and orbitals around the nucleus.",
  Symbol: "One- or two-letter chemical shorthand used on the periodic table.",
  "Atomic no.": "Z — the number of protons in the nucleus; defines the element.",
  "E-config": "How electrons fill the shells and orbitals around the nucleus.",
  State: "Physical state (solid, liquid, gas) at room temperature and pressure.",
  Discovered: "Year the element was first identified or isolated.",
  "Elec. cond.": "How well it carries electric current. Measured in S/m.",
  "vs silver": "Electrical conductivity as a percentage of silver.",
  "Thermal cond.": "How well it conducts heat. Measured in W/(m·K).",
  Mohs: "Mohs scratch-hardness scale, 1 (talc) to 10 (diamond).",
  Brinell: "Brinell hardness in MPa.",
  "Crust abund.": "Share of Earth's crust made of this element, by weight.",
  "Universe abund.": "Share of all ordinary matter in the universe, by weight."
};

const CONF_COLORS = {
  confirmed: "#7fd4a8",
  "single-source": "#9aa6ab",
  "unverified-model": "#ffb454"
};

/**
 * MOBILE_BROWSE_V2 — compact list + list/entry split under 960px.
 * REVERT: set to false (or delete style.mobile-browse.css import + related helpers).
 */
const MOBILE_BROWSE_V2 = true;
const MOBILE_BROWSE_MQ = "(max-width: 960px)";

function isMobileBrowse() {
  return MOBILE_BROWSE_V2 && window.matchMedia(MOBILE_BROWSE_MQ).matches;
}

const state = {
  page: "dashboard",
  query: "",
  family: "all",
  sort: "atomicNumber",
  selectedKey: "copper",
  view: "encyclopedia",
  compareKeys: ["copper", "silver"],
  compareNotice: "",
  compareQuery: "",
  heroView: "photo",
  /** MOBILE_BROWSE_V2: "list" | "entry" — ignored on desktop */
  mobilePane: "list",
  /** MOBILE_BROWSE_V2: hero view picker expanded on mobile */
  heroControlsOpen: false,
  /** MOBILE_BROWSE_V2: series menu open on entry/list bar */
  seriesMenuOpen: false,
  /** Custom sort menu (avoids native select inside overflow) */
  sortMenuOpen: false,
  /** MOBILE_BROWSE_V2: custom compare add menu (avoids native select) */
  compareAddMenuOpen: false,
  /** MOBILE_BROWSE_V2: compare sheet temperature unit "C" | "F" */
  compareTempUnit: "C"
};

const app = document.querySelector("#app");

function selectedMetal() {
  return byKey.get(state.selectedKey) || metals[0];
}

function compareMetals() {
  return state.compareKeys.map((key) => byKey.get(key)).filter(Boolean);
}

function countFamily(family) {
  return metals.filter((m) => m.family === family).length;
}

function familyImage(family) {
  const withImg = metals.find((m) => m.family === family && displayImageUrl(m));
  return withImg ? displayImageUrl(withImg) : null;
}

function heatColor(t) {
  t = Math.max(0, Math.min(1, t));
  return `hsl(${Math.round(t * 190)}, 65%, 38%)`;
}

function dialGradient(t) {
  const deg = Math.round(t * 360);
  return `${heatColor(0)}, ${heatColor(t * 0.35)} ${Math.round(deg * 0.35)}deg, ${heatColor(t * 0.7)} ${Math.round(deg * 0.7)}deg, ${heatColor(t)} ${deg}deg, #1d2226 0`;
}

function cubeGrad(family) {
  const famColors = {
    Alkali: "#d98f5e",
    "Alkaline earth": "#c9a86a",
    Transition: "#9fb3c4",
    "Post-transition": "#a3b3ab",
    Metalloid: "#b09fc4",
    Lanthanide: "#7fd4a8",
    Actinide: "#e08a63"
  };
  return `linear-gradient(135deg, rgba(11, 13, 14, 0.85), rgba(11, 13, 14, 0.2)), ${famColors[family] || "#9fb3c4"}`;
}

function metalCardMedia(metal, { draggable = false, eager = false } = {}) {
  const src = displayImageUrl(metal);
  if (src) {
    const drag = draggable ? "" : ' draggable="false"';
    const load = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
    return `<img src="${escapeHtml(src)}" alt="" ${load} decoding="async"${drag}>`;
  }
  const reason =
    metal.atomicNumber >= 104
      ? "No photo — synthetic; no macroscopic sample exists"
      : metal.atomicNumber > 92
        ? "No photo — scarce radioactive specimen"
        : "No specimen photo on file";
  return `<span class="card-fallback" style="background: ${cubeGrad(metal.family)}" aria-hidden="true"><span class="card-fallback-sym">${escapeHtml(metal.symbol)}</span><span class="card-fallback-note">${escapeHtml(reason)}</span></span>`;
}

function shellCounts(z) {
  const caps = [2, 8, 18, 32, 32, 18, 8];
  let rem = z;
  const out = [];
  for (let i = 0; i < caps.length && rem > 0; i++) {
    const n = Math.min(rem, caps[i]);
    out.push(n);
    rem -= n;
  }
  return out;
}

function atomShells(z) {
  return shellCounts(z).map((n, i) => {
    const radius = 34 + i * 20;
    return {
      radius,
      size: radius * 2,
      dur: `${9 + i * 3}s`,
      anim: i % 2 ? "om-spin-rev" : "om-spin",
      electrons: Array.from({ length: n }, (_, k) => ({ angle: Math.round((k * 360) / n) }))
    };
  });
}

function compactDelta(delta) {
  const m = /^([+\u2212-])([\d,]+(?:\.\d+)?)(.*)$/.exec(delta || "");
  if (!m) return delta;
  const n = parseFloat(m[2].replace(/,/g, ""));
  if (!Number.isFinite(n)) return delta;
  const fmtNum = (v) =>
    v >= 10000
      ? v.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 })
      : v.toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 2 : 1 });
  const num = fmtNum(n);
  if (m[3].trim() === "°C") {
    return `${m[1]}${num} °C / ${m[1]}${fmtNum(n * 1.8)} °F`;
  }
  return `${m[1]}${num}${m[3]}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function goHome() {
  state.page = "dashboard";
  state.family = "all";
  state.query = "";
  renderApp();
}

function openSeriesHub() {
  state.page = "series";
  // Warm one specimen per family so hub tiles feel instant.
  warmMetalImages(
    families.map((f) => metals.find((m) => m.family === f && displayImageUrl(m))).filter(Boolean),
    { limit: 16 }
  );
  renderApp();
}

function openSources() {
  state.page = "sources";
  renderApp();
}

function openBrowse({ family = "all", view = "encyclopedia", selectFirst = true } = {}) {
  state.page = "browse";
  state.family = family;
  state.view = view;
  state.query = "";
  state.mobilePane = "list"; // MOBILE_BROWSE_V2
  state.seriesMenuOpen = false;
  if (selectFirst) {
    const filtered = getFilteredMetals(metals, state);
    if (filtered.length) state.selectedKey = filtered[0].key;
    warmMetalImages(filtered, { limit: 48 });
  } else {
    warmMetalImages(getFilteredMetals(metals, state), { limit: 48 });
  }
  renderApp();
}

let closeSeriesMenuListener = null;
let closeHeroMenuListener = null;
let closeSortMenuListener = null;
let closeCompareAddListener = null;

function clearSeriesMenuListener() {
  if (closeSeriesMenuListener) {
    document.removeEventListener("click", closeSeriesMenuListener);
    closeSeriesMenuListener = null;
  }
}

function clearHeroMenuListener() {
  if (closeHeroMenuListener) {
    document.removeEventListener("click", closeHeroMenuListener);
    closeHeroMenuListener = null;
  }
}

function clearSortMenuListener() {
  if (closeSortMenuListener) {
    document.removeEventListener("click", closeSortMenuListener);
    closeSortMenuListener = null;
  }
}

function clearCompareAddListener() {
  if (closeCompareAddListener) {
    document.removeEventListener("click", closeCompareAddListener);
    closeCompareAddListener = null;
  }
}

const SORT_OPTIONS = [
  { value: "atomicNumber", label: "Atomic number" },
  { value: "name", label: "Name" },
  { value: "densityDesc", label: "Density" },
  { value: "meltingDesc", label: "Melting point" },
  { value: "conductivityDesc", label: "Conductivity" }
];

function sortPickerHtml() {
  return `
    <div class="sort-wrap">
      <button
        type="button"
        class="sort-trigger"
        id="sort-trigger"
        aria-haspopup="listbox"
        aria-expanded="${state.sortMenuOpen ? "true" : "false"}"
        aria-controls="sort-menu"
      >
        Sort <span aria-hidden="true">▾</span>
      </button>
      <div class="sort-menu" id="sort-menu" role="listbox" aria-label="Sort by" ${state.sortMenuOpen ? "" : "hidden"}>
        ${SORT_OPTIONS.map(
          (o) =>
            `<button type="button" role="option" data-sort="${o.value}" aria-selected="${o.value === state.sort}">${escapeHtml(o.label)}</button>`
        ).join("")}
      </div>
    </div>`;
}

function bindSortPicker() {
  clearSortMenuListener();
  document.querySelector("#sort-trigger")?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.sortMenuOpen = !state.sortMenuOpen;
    if (state.sortMenuOpen) {
      state.seriesMenuOpen = false;
      clearSeriesMenuListener();
    }
    const wrap = document.querySelector(".sort-wrap");
    const menu = document.querySelector("#sort-menu");
    const trigger = document.querySelector("#sort-trigger");
    if (!wrap || !menu || !trigger) {
      renderBrowse();
      return;
    }
    trigger.setAttribute("aria-expanded", state.sortMenuOpen ? "true" : "false");
    if (state.sortMenuOpen) menu.removeAttribute("hidden");
    else menu.setAttribute("hidden", "");
    if (state.sortMenuOpen) {
      closeSortMenuListener = (ev) => {
        if (ev.target.closest?.(".sort-wrap")) return;
        clearSortMenuListener();
        state.sortMenuOpen = false;
        menu.setAttribute("hidden", "");
        trigger.setAttribute("aria-expanded", "false");
      };
      setTimeout(() => document.addEventListener("click", closeSortMenuListener), 0);
    }
  });
  document.querySelectorAll("#sort-menu [data-sort]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearSortMenuListener();
      state.sort = btn.dataset.sort;
      state.sortMenuOpen = false;
      const menu = document.querySelector("#sort-menu");
      const trigger = document.querySelector("#sort-trigger");
      menu?.setAttribute("hidden", "");
      trigger?.setAttribute("aria-expanded", "false");
      document.querySelectorAll("#sort-menu [data-sort]").forEach((b) => {
        b.setAttribute("aria-selected", b.dataset.sort === state.sort ? "true" : "false");
      });
      refreshMetalList();
    });
  });
}

function setFamilyFilter(family) {
  clearSeriesMenuListener();
  state.family = family;
  state.seriesMenuOpen = false;
  const next = getFilteredMetals(metals, state);
  if (next.length && !next.some((m) => m.key === state.selectedKey)) {
    state.selectedKey = next[0].key;
  }
  renderBrowse();
}

function seriesMenuOptionsHtml() {
  return `${families
    .map(
      (f) =>
        `<button type="button" role="option" data-family="${escapeHtml(f)}" aria-selected="${f === state.family}">${escapeHtml(f)}</button>`
    )
    .join("")}
    <button type="button" role="option" data-family="all" aria-selected="${state.family === "all"}">All series</button>`;
}

function seriesPickerHtml(seriesLabel) {
  return `
    <div class="entry-series">
      <button
        type="button"
        class="entry-series-name"
        id="entry-series-trigger"
        aria-haspopup="listbox"
        aria-expanded="${state.seriesMenuOpen ? "true" : "false"}"
        aria-controls="entry-series-menu"
      >
        ${escapeHtml(seriesLabel)}
      </button>
      <div
        class="entry-series-menu"
        id="entry-series-menu"
        role="listbox"
        aria-label="Series"
        ${state.seriesMenuOpen ? "" : "hidden"}
      >
        ${seriesMenuOptionsHtml()}
      </div>
    </div>`;
}

function bindSeriesPicker() {
  clearSeriesMenuListener();
  document.querySelector("#entry-series-trigger")?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.seriesMenuOpen = !state.seriesMenuOpen; // MOBILE_BROWSE_V2
    if (state.seriesMenuOpen) {
      state.heroControlsOpen = false;
      clearHeroMenuListener();
    }
    renderBrowse();
  });
  document.querySelectorAll("#entry-series-menu [data-family]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setFamilyFilter(btn.dataset.family);
    });
  });
  if (state.seriesMenuOpen) {
    closeSeriesMenuListener = (e) => {
      if (
        e.target.closest?.(
          ".entry-series, .search-sort, .mobile-series-bar, .sort-wrap, .view-tabs, .browse-crumbs"
        )
      ) {
        return;
      }
      clearSeriesMenuListener();
      state.seriesMenuOpen = false;
      const menu = document.querySelector("#entry-series-menu");
      const trigger = document.querySelector("#entry-series-trigger");
      menu?.setAttribute("hidden", "");
      trigger?.setAttribute("aria-expanded", "false");
    };
    setTimeout(() => document.addEventListener("click", closeSeriesMenuListener), 0);
  }
}

function bindTipFollow() {
  document.addEventListener(
    "mousemove",
    (e) => {
      const host = e.target?.closest?.("[data-om-tip]");
      if (!host) return;
      const pop = host.querySelector("[data-tip-pop]");
      if (!pop) return;
      const w = 240;
      let x = e.clientX + 14;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
      pop.style.position = "fixed";
      pop.style.left = `${x}px`;
      pop.style.top = `${Math.max(8, e.clientY - 12)}px`;
      pop.style.transform = "translateY(-100%)";
      pop.style.bottom = "auto";
      pop.style.right = "auto";
    },
    { passive: true }
  );
}

function renderApp() {
  if (state.page === "dashboard") {
    renderDashboard();
    return;
  }
  if (state.page === "series") {
    renderSeriesHub();
    return;
  }
  if (state.page === "sources") {
    renderSources();
    return;
  }
  renderBrowse();
}

function renderDashboard() {
  app.innerHTML = `
    <div class="console-shell">
      <header class="console-header">
        <span class="console-brand">
          <span class="console-dot" aria-hidden="true"></span>
          <strong>MAT/ENC</strong>
        </span>
        <span class="console-label">Console</span>
        <span class="console-status">${metals.length} ENTRIES · TIER 1–2 DATA</span>
      </header>
      <main class="dash-main">
        <div class="dash-hero">
          <div>
            <p class="dash-kicker">// Materials reference index</p>
            <h1>Materials<br />Encyclopedia</h1>
          </div>
          <p class="dash-hero-copy">What each material is, how it is made, scientific facts, and images. Metals are live; composites and organics dock here later as sibling catalogs.</p>
        </div>
        <div class="catalog-grid" aria-label="Catalogs">
          <button type="button" class="catalog-card" data-action="series">
            <span class="catalog-code">CAT.01</span>
            <span class="catalog-eyebrow">Catalog · live</span>
            <h2>Metals</h2>
            <p>All entries, or drill into a chemical series — alkali, transition, lanthanide, and the rest.</p>
            <span class="catalog-meta">${metals.length} ENTRIES · ${families.length} SERIES →</span>
          </button>
          <div class="catalog-slot">
            <span class="catalog-code">CAT.02</span>
            <span class="catalog-eyebrow">Catalog · planned</span>
            <h2>Composites</h2>
            <p>Laminates, fiber-reinforced systems, engineered boards. Slot reserved.</p>
            <span class="catalog-meta">DOCKS HERE LATER</span>
          </div>
          <div class="catalog-slot">
            <span class="catalog-code">CAT.03</span>
            <span class="catalog-eyebrow">Catalog · planned</span>
            <h2>Organics</h2>
            <p>Wood species, natural fibers, biopolymers. Slot reserved.</p>
            <span class="catalog-meta">DOCKS HERE LATER</span>
          </div>
        </div>
        <div class="tool-grid" aria-label="Tools">
          <button type="button" class="tool-card" data-action="compare">
            <span class="eyebrow">Tool</span>
            <h2>Compare</h2>
            <p>Stack up to four metals with deltas and bars.</p>
            <span class="meta">Open →</span>
          </button>
          <button type="button" class="tool-card" data-action="table">
            <span class="eyebrow">Tool</span>
            <h2>Data Table</h2>
            <p>Melting, density, conductivity in rows.</p>
            <span class="meta">Open →</span>
          </button>
          <button type="button" class="tool-card" data-action="sources">
            <span class="eyebrow">Reference</span>
            <h2>Sources</h2>
            <p>PubChem, RSC, USGS provenance per entry.</p>
            <span class="meta">Tier 1–2 →</span>
          </button>
        </div>
      </main>
    </div>
  `;

  document.querySelector('[data-action="series"]')?.addEventListener("click", openSeriesHub);
  document.querySelector('[data-action="sources"]')?.addEventListener("click", openSources);
  document.querySelector('[data-action="compare"]')?.addEventListener("click", () =>
    openBrowse({ family: "all", view: "compare", selectFirst: false })
  );
  document.querySelector('[data-action="table"]')?.addEventListener("click", () =>
    openBrowse({ family: "all", view: "table", selectFirst: false })
  );
}

function renderSources() {
  const confCounts = { confirmed: 0, "single-source": 0, "unverified-model": 0 };
  for (const m of metals) {
    const key = m.narrativeConfidence || "unverified-model";
    if (key in confCounts) confCounts[key] += 1;
    else confCounts["unverified-model"] += 1;
  }

  const sourceRows = SOURCE_REFERENCE.map(
    (s) => `
      <article class="source-ref">
        <header class="source-ref-head">
          <span class="source-ref-tier">Tier ${s.tier}</span>
          <span class="source-ref-role">${escapeHtml(s.role)}</span>
        </header>
        <h2>${escapeHtml(s.title)}</h2>
        <p>${escapeHtml(s.blurb)}</p>
        <a class="source-ref-link" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>
      </article>`
  ).join("");

  const confRows = CONFIDENCE_REFERENCE.map((c) => {
    const count = confCounts[c.id] ?? 0;
    const color = CONF_COLORS[c.id] || "var(--muted)";
    return `
      <div class="source-conf-row">
        <span class="source-conf-label" style="color: ${color}">${escapeHtml(c.label)}</span>
        <span class="source-conf-count">${count}</span>
        <p>${escapeHtml(c.meaning)}</p>
      </div>`;
  }).join("");

  app.innerHTML = `
    <div class="console-shell">
      <main class="page-main sources-page">
        <nav class="crumbs" aria-label="Breadcrumb">
          <button type="button" class="crumb-link" data-nav="home">Console</button>
          <span aria-hidden="true">/</span>
          <span>Sources</span>
        </nav>
        <header class="series-hero">
          <h1>Sources &amp; confidence</h1>
          <p>Where encyclopedia text and property numbers come from. Per-entry citations also live under each metal’s Sources panel.</p>
        </header>
        <section class="source-ref-grid" aria-label="Data sources">
          ${sourceRows}
        </section>
        <section class="source-conf" aria-label="Narrative confidence">
          <h2>Narrative confidence</h2>
          <p class="source-conf-lead">Labels on each entry. Counts across ${metals.length} metals:</p>
          ${confRows}
        </section>
      </main>
    </div>
  `;

  document.querySelector('[data-nav="home"]')?.addEventListener("click", goHome);
}

function renderSeriesHub() {
  const tiles = families
    .map((family) => {
      const count = countFamily(family);
      const img = familyImage(family);
      return `
        <button type="button" class="series-tile" data-series="${escapeHtml(family)}">
          <span class="series-tile-head">
            <span class="name-chip">${escapeHtml(family)}</span>
            <span class="count-chip">${count}</span>
          </span>
          <span class="series-tile-media">
            ${img ? `<img src="${img}" alt="" loading="lazy" decoding="async">` : ""}
          </span>
          <span class="blurb">${escapeHtml(SERIES_BLURBS[family] || "Metals in this series.")}</span>
        </button>`;
    })
    .join("");

  app.innerHTML = `
    <div class="console-shell">
      <main class="page-main">
        <nav class="crumbs" aria-label="Breadcrumb">
          <button type="button" class="crumb-link" data-nav="home">Console</button>
          <span aria-hidden="true">/</span>
          <span>Metals</span>
        </nav>
        <header class="series-hero">
          <h1>Metals by series</h1>
          <p>Element families — alkali, transition, lanthanide, and the rest — not periodic-table column numbers.</p>
        </header>
        <section class="series-grid" aria-label="Metals hub">
          ${tiles}
          <button type="button" class="series-all" data-series="all">
            <span class="series-tile-head">
              <span class="name-chip">All metals</span>
              <span class="count-chip">${metals.length}</span>
            </span>
            <span class="series-tile-desc">
              The full catalog — alkali through actinide, plus metalloids. One searchable list with photos, properties, production notes, and compare tools. No series filter applied.
            </span>
            <span class="blurb">Every metallic and metalloid entry, one list.</span>
          </button>
        </section>
      </main>
    </div>
  `;

  document.querySelector('[data-nav="home"]')?.addEventListener("click", goHome);
  document.querySelectorAll("button[data-series]").forEach((btn) => {
    btn.addEventListener("click", () => openBrowse({ family: btn.dataset.series }));
  });
}

function renderBrowse() {
  clearSeriesMenuListener();
  clearHeroMenuListener();
  clearSortMenuListener();
  state.sortMenuOpen = false;
  const filtered = getFilteredMetals(metals, state);
  const seriesLabel = state.family === "all" ? "All metals" : state.family;
  const showToolbar = state.view !== "compare";
  const mobile = isMobileBrowse();
  const mobilePane =
    mobile && state.view === "encyclopedia" ? state.mobilePane : mobile ? "list" : "desktop";
  const onMobileEntry = mobilePane === "entry";

  app.innerHTML = `
    <div class="console-shell">
      <main class="browse-main" data-mobile-pane="${mobilePane}" data-browse-view="${state.view}">
        <nav class="browse-crumbs" aria-label="Breadcrumb">
          <button type="button" class="crumb-link" data-nav="home">Console</button>
          <span aria-hidden="true">/</span>
          <button type="button" class="crumb-link" data-nav="series">Metals</button>
          <span aria-hidden="true">/</span>
          <span>${escapeHtml(seriesLabel)}</span>
          <span class="view-tabs" role="group" aria-label="View mode">
            <button type="button" class="mobile-console" data-nav="home">Console</button>
            <button type="button" data-view="encyclopedia" aria-pressed="${state.view === "encyclopedia"}">Entry</button>
            <button type="button" data-view="compare" aria-pressed="${state.view === "compare"}">Compare</button>
            <button type="button" data-view="table" aria-pressed="${state.view === "table"}">Table</button>
          </span>
        </nav>
        ${
          showToolbar && !mobile
            ? `<div class="browse-toolbar">
          ${seriesPickerHtml(seriesLabel)}
          <span class="count" role="status" aria-live="polite">${filtered.length} shown</span>
        </div>`
            : ""
        }
        ${
          !onMobileEntry && mobile
            ? `<div class="mobile-series-bar">
          <button type="button" class="back-series" id="mobile-back-series" aria-label="Back to metals by series">‹</button>
          ${seriesPickerHtml(seriesLabel)}
          ${showToolbar ? `<span class="mobile-series-count" role="status" aria-live="polite">${filtered.length} shown</span>` : ""}
        </div>`
            : ""
        }
        <div id="browse-content"></div>
      </main>
    </div>
  `;

  document.querySelectorAll('[data-nav="home"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearSeriesMenuListener();
      clearSortMenuListener();
      clearHeroMenuListener();
      goHome();
    });
  });
  document.querySelector('[data-nav="series"]')?.addEventListener("click", openSeriesHub);
  document.querySelector("#mobile-back-series")?.addEventListener("click", (e) => {
    e.stopPropagation();
    clearSeriesMenuListener();
    clearSortMenuListener();
    clearHeroMenuListener();
    clearCompareAddListener();
    openSeriesHub();
  });
  // Only the view-tab buttons — not <main data-view>, which would steal
  // clicks from <details>/links inside the page and force a full re-render.
  document.querySelectorAll("button[data-view]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearSeriesMenuListener();
      clearSortMenuListener();
      clearHeroMenuListener();
      clearCompareAddListener();
      state.view = btn.dataset.view;
      if (state.view !== "encyclopedia") state.mobilePane = "list"; // MOBILE_BROWSE_V2
      state.seriesMenuOpen = false;
      state.sortMenuOpen = false;
      state.heroControlsOpen = false;
      state.compareAddMenuOpen = false;
      renderBrowse();
    });
  });
  const content = document.querySelector("#browse-content");
  if (state.view === "encyclopedia") {
    content.innerHTML = renderEncyclopedia(filtered);
    bindEncyclopedia(filtered);
  } else if (state.view === "compare") {
    content.innerHTML = renderCompare();
    bindCompare();
  } else {
    content.innerHTML = renderTable(filtered);
    bindTable();
  }
  // One custom Hybrid series picker (desktop toolbar, mobile list bar, or mobile entry bar).
  if (!onMobileEntry) bindSeriesPicker();
  warmMetalImages(filtered, { limit: 48 });
}

function metalCardsHtml(filtered) {
  return filtered
    .map((m, i) => {
      const r = relativeConductivity(m);
      const current = m.key === state.selectedKey ? ' aria-current="true"' : "";
      const sigma = hasValue(r) ? `σ ${r.toFixed(0)}%` : "σ —";
      const meta =
        state.family !== "all" && state.family === m.family
          ? sigma
          : `${escapeHtml(m.family)} · ${sigma}`;
      const eager = m.key === state.selectedKey || i < 9;
      return `
        <button type="button" class="metal-card" data-key="${m.key}"${current}>
          ${metalCardMedia(m, { eager })}
          <span class="shade" aria-hidden="true"></span>
          <strong class="name">${escapeHtml(m.name)}</strong>
          <span class="row">
            <span class="meta">${meta}</span>
            <span class="symbol">${escapeHtml(m.symbol)}</span>
          </span>
        </button>`;
    })
    .join("");
}

function bindMetalCards() {
  document.querySelectorAll(".metal-card[data-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedKey = btn.dataset.key;
      if (isMobileBrowse()) state.mobilePane = "entry"; // MOBILE_BROWSE_V2
      renderBrowse();
    });
  });
}

/** Update list/count without remounting search/sort (keeps focus + native select open). */
function refreshMetalList() {
  const filtered = getFilteredMetals(metals, state);
  const cards = document.querySelector(".metal-cards");
  if (!cards) {
    renderBrowse();
    return filtered;
  }
  cards.innerHTML = metalCardsHtml(filtered) || '<p class="empty-state">No elements match that search.</p>';
  bindMetalCards();
  const count = document.querySelector(".mobile-series-count");
  if (count) count.textContent = `${filtered.length} shown`;
  const deskCount = document.querySelector(".browse-toolbar .count");
  if (deskCount) deskCount.textContent = `${filtered.length} shown`;
  return filtered;
}

function renderEncyclopedia(filtered) {
  const metal = selectedMetal();
  const rel = relativeConductivity(metal);
  const shells = atomShells(metal.atomicNumber);
  const faces = ["rotateY(0deg)", "rotateY(90deg)", "rotateY(180deg)", "rotateY(270deg)", "rotateX(90deg)", "rotateX(-90deg)"];
  const grad = cubeGrad(metal.family);
  const list = metalCardsHtml(filtered);

  const statCards = [
    {
      label: "Melting",
      value: hasValue(metal.meltingPoint)
        ? `${formatNumber(metal.meltingPoint, 0)} °C / ${formatNumber((metal.meltingPoint * 9) / 5 + 32, 0)} °F`
        : "—"
    },
    {
      label: sublimesAtOneAtm(metal) ? "Sublim." : "Boiling",
      value: hasValue(metal.boilingPoint)
        ? `${formatNumber(metal.boilingPoint, 0)} °C / ${formatNumber((metal.boilingPoint * 9) / 5 + 32, 0)} °F`
        : "—"
    },
    { label: "Density", value: hasValue(metal.density) ? `${formatNumber(metal.density, 2)} g/cm³` : "—" },
    { label: "Cond. vs Ag", value: hasValue(rel) ? `${rel.toFixed(0)}%` : "—" },
    { label: "Mohs", value: hasValue(metal.mohsHardness) ? formatNumber(metal.mohsHardness, 1) : "—" },
    { label: "Crust", value: formatAbundance(metal.crustAbundancePercent) }
  ]
    .map(
      (st) => `
      <div class="stat-card">
        <p class="label">${st.label}</p>
        <p class="value">${escapeHtml(st.value)}</p>
      </div>`
    )
    .join("");

  const boilLabel = boilingPointLabel(metal);
  const dataRows = [
    ["Symbol", metal.symbol],
    ["Atomic no.", String(metal.atomicNumber)],
    ["Atomic mass", formatAtomicMass(metal.atomicMass)],
    ["E-config", metal.electronConfiguration || "Unknown"],
    ["State", metal.standardState || "Unknown"],
    ["Discovered", metal.yearDiscovered || "Unknown"],
    ["Series", metal.family],
    ["Melting point", formatTemperature(metal.meltingPoint)],
    [boilLabel, formatTemperature(metal.boilingPoint)],
    ["Density", formatDensity(metal.density, 3)],
    ["Elec. cond.", formatConductivity(metal.conductivity)],
    ["vs silver", hasValue(rel) ? `${rel.toFixed(1)}%` : "Unavailable"],
    ["Thermal cond.", formatThermalConductivity(metal.thermalConductivity)],
    ["Mohs", formatHardness(metal.mohsHardness)],
    ["Brinell", formatHardness(metal.brinellHardness, "MPa")],
    ["Crust abund.", formatAbundance(metal.crustAbundancePercent)],
    ["Universe abund.", formatAbundance(metal.universeAbundancePercent)]
  ]
    .map(([label, value]) => {
      const unavailable = value === "Unavailable";
      const tip =
        label === "Melting point"
          ? meltingPointTip(metal)
          : label === boilLabel || label === "Boiling point" || label === "Sublimation (1 atm)"
            ? boilingPointTip(metal)
            : PROP_TIPS[label] || label;
      return `
      <div class="data-row${unavailable ? " is-unavailable" : ""}">
        <dt data-om-tip="1"><span class="label">${escapeHtml(label)}</span><span data-tip-pop="1">${escapeHtml(tip)}</span></dt>
        <dd>${escapeHtml(value)}</dd>
      </div>`;
    })
    .join("");

  const coverage = dataCoverage(metal);
  const coverageBits = [coverage.note].filter(Boolean);
  if (sublimesAtOneAtm(metal)) {
    coverageBits.push(
      "At 1 atm this element sublimes rather than boiling; the sheet shows Sublimation (1 atm) for the lower temperature."
    );
  }
  const coverageNote = coverageBits.length
    ? `<aside class="coverage-note" data-level="${coverage.level}"><strong>Data coverage</strong> — ${escapeHtml(coverageBits.join(" "))}</aside>`
    : "";

  const facts = (metal.notableFacts || [])
    .map((f) => `<li>${escapeHtml(f)}</li>`)
    .join("");

  const notes = metal.commodityNotes;
  const commodityHtml =
    notes && (notes.recycling || notes.substitutes || notes.world)
      ? `<details class="commodity-notes">
            <summary>USGS commodity notes</summary>
            <div class="commodity-notes-body">
              ${
                notes.recycling
                  ? `<section><h3>Recycling</h3><p>${escapeHtml(notes.recycling)}</p></section>`
                  : ""
              }
              ${
                notes.world
                  ? `<section><h3>World resources</h3><p>${escapeHtml(notes.world)}</p></section>`
                  : ""
              }
              ${
                notes.substitutes
                  ? `<section><h3>Substitutes</h3><p>${escapeHtml(notes.substitutes)}</p></section>`
                  : ""
              }
            </div>
          </details>`
      : "";
  const narrativeSources = (metal.narrativeSources || [])
    .map(
      (s) =>
        `<li><a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a> <span class="tier">Tier ${s.tier}</span></li>`
    )
    .join("");
  const propertySources = (metal.propertySources || [])
    .map(
      (s) =>
        `<li><a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a> <span class="tier">Tier ${s.tier}</span></li>`
    )
    .join("");

  const cubeFaces = faces
    .map(
      (r) =>
        `<div class="cube-face" style="transform: ${r} translateZ(85px); background: ${grad};"><span>${escapeHtml(metal.symbol)}</span></div>`
    )
    .join("");

  const atomHtml = shells
    .map(
      (sh) => `
      <div class="atom-shell" style="left: calc(50% - ${sh.radius}px); top: calc(50% - ${sh.radius}px); width: ${sh.size}px; height: ${sh.size}px; animation: ${sh.anim} ${sh.dur} linear infinite;">
        ${sh.electrons
          .map(
            (el) =>
              `<span class="atom-e" style="transform: rotate(${el.angle}deg) translateX(${sh.radius}px);"></span>`
          )
          .join("")}
      </div>`
    )
    .join("");

  const heroPhoto = state.heroView === "photo";
  const hero3d = state.heroView === "3d";
  const heroAtomic = state.heroView === "atomic";
  const mobilePane = isMobileBrowse() ? state.mobilePane : "desktop";

  return `
    <section class="browse-layout" data-mobile-pane="${mobilePane}">
      <aside class="metal-aside" aria-label="Filtered metals">
        <div class="search-sort">
          <input id="metal-search" type="search" autocomplete="off" placeholder="Search — Copper, Kroll, toxic" aria-label="Search" value="${escapeHtml(state.query)}" />
          ${sortPickerHtml()}
        </div>
        <div class="metal-cards-scroll">
          <div class="metal-cards">
            ${list || '<p class="empty-state">No elements match that search.</p>'}
          </div>
        </div>
      </aside>
      <article>
        <div class="mobile-entry-bar">
          <button type="button" class="back-list" id="mobile-back-list" aria-label="Back to list">‹</button>
          ${isMobileBrowse() ? seriesPickerHtml(state.family === "all" ? "All metals" : state.family) : ""}
          <div class="hero-controls hero-controls--bar" role="group" aria-label="Hero view" data-open="${state.heroControlsOpen ? "true" : "false"}">
            <button type="button" class="hero-controls-toggle" id="hero-controls-toggle" aria-expanded="${state.heroControlsOpen ? "true" : "false"}" aria-controls="hero-controls-panel">
              ${heroPhoto ? "Photo" : hero3d ? "3D" : "Atomic"} ▾
            </button>
            <div class="hero-controls-panel" id="hero-controls-panel">
              <button type="button" data-hero="photo" aria-pressed="${heroPhoto}">Photo</button>
              <button type="button" data-hero="3d" aria-pressed="${hero3d}">3D Sample</button>
              <button type="button" data-hero="atomic" aria-pressed="${heroAtomic}">Atomic</button>
              <span class="meta">${escapeHtml(metal.family)}</span>
              <span class="meta">Z ${metal.atomicNumber}</span>
              <span class="meta">Disc. ${escapeHtml(metal.yearDiscovered || "unknown")}</span>
            </div>
          </div>
        </div>
        <figure class="hero">
          ${
            heroPhoto
              ? (() => {
                  const src = displayImageUrl(metal);
                  return src
                    ? `<img class="hero-blur" src="${escapeHtml(src)}" alt="" aria-hidden="true" loading="eager" decoding="async" />
                   <img class="hero-photo" src="${escapeHtml(src)}" alt="${escapeHtml(metal.name)} sample" loading="eager" fetchpriority="high" decoding="async" />`
                    : `<div class="hero-fallback-symbol" style="background: ${cubeGrad(metal.family)}">
                     <span class="hero-fallback-sym">${escapeHtml(metal.symbol)}</span>
                     <span class="hero-fallback-note">${
                       metal.atomicNumber >= 104
                         ? "No photo — synthetic; no macroscopic sample exists"
                         : metal.atomicNumber > 92
                           ? "No photo — scarce radioactive specimen"
                           : "No specimen photo on file"
                     }</span>
                   </div>`;
                })()
              : ""
          }
          ${
            hero3d
              ? `<div class="hero-3d">
                  <div class="cube">${cubeFaces}</div>
                  <span class="hero-caption">SAMPLE CUBE · ρ ${hasValue(metal.density) ? metal.density.toFixed(2) : "—"} g/cm³ · placeholder for scanned model</span>
                </div>`
              : ""
          }
          ${
            heroAtomic
              ? `<div class="hero-atomic">
                  <div class="atom-stage">
                    ${atomHtml}
                    <div class="atom-core">${escapeHtml(metal.symbol)}</div>
                  </div>
                  <span class="hero-caption">BOHR MODEL · Z=${metal.atomicNumber} · SHELLS ${shellCounts(metal.atomicNumber).join("·")}</span>
                </div>`
              : ""
          }
          <div class="hero-controls hero-controls--float" role="group" aria-label="Hero view">
            <div class="hero-controls-panel">
              <button type="button" data-hero="photo" aria-pressed="${heroPhoto}">Photo</button>
              <button type="button" data-hero="3d" aria-pressed="${hero3d}">3D Sample</button>
              <button type="button" data-hero="atomic" aria-pressed="${heroAtomic}">Atomic</button>
              <span class="meta">${escapeHtml(metal.family)}</span>
              <span class="meta">Z ${metal.atomicNumber}</span>
              <span class="meta">Disc. ${escapeHtml(metal.yearDiscovered || "unknown")}</span>
            </div>
          </div>
          <div class="hero-fade" aria-hidden="true"></div>
          <h1 class="hero-title">${escapeHtml(metal.name)}</h1>
        </figure>

        <div class="stat-strip" aria-label="Key stats">${statCards}</div>
        ${coverageNote}

        <div class="entry-grid">
          <div>
            <section class="prose-block"><h2>What it is</h2><p>${escapeHtml(metal.overview)}</p></section>
            <section class="prose-block"><h2>How it is made</h2><p>${escapeHtml(metal.production)}</p></section>
            <section class="prose-block"><h2>Uses</h2><p>${escapeHtml(metal.uses)}</p></section>
            ${commodityHtml}
            ${
              facts
                ? `<section class="prose-block"><h2>Notable facts</h2><ul>${facts}</ul></section>`
                : ""
            }
            <section class="note-box">
              <h2>Handling note</h2>
              <p>${escapeHtml(metal.safety || "No handling note recorded.")}</p>
            </section>
          </div>
          <aside style="display:grid;gap:16px;align-content:start;">
            <section class="data-sheet" aria-label="Scientific facts">
              <h2>Full data sheet</h2>
              <dl>${dataRows}</dl>
            </section>
            <div class="compare-actions">
              <button type="button" class="btn-primary" id="toggle-compare">${state.compareKeys.includes(metal.key) ? "Remove from compare" : "Add to compare"}</button>
              <button type="button" class="btn-ghost" id="open-compare">Open compare</button>
            </div>
          </aside>
        </div>
        <details class="sources-block">
          <summary>
            Sources & confidence — narrative:
            <span style="color:${CONF_COLORS[metal.narrativeConfidence] || "#d7dde0"}">${confidenceLabel(metal.narrativeConfidence)}</span>
          </summary>
          <div class="sources-body">
            <p class="note">Numeric identity and thermo/density fields track PubChem’s periodic-table dataset. Conductivity, hardness, and abundance come from the prior PeriodicTable.com/Wolfram-backed set. Narratives come from RSC Periodic Table text; where a USGS chapter is also mapped, the badge is <strong>Dual-sourced</strong> (provenance from two source families — not a per-claim fact-check). Known RSC errors are patched in <code>narrative-overrides.mjs</code>.</p>
            <div class="source-columns">
              <ul>${narrativeSources || "<li>None listed</li>"}</ul>
              <div>
                <ul>${propertySources}</ul>
                <p><a href="${metal.pubchemUrl}" target="_blank" rel="noopener">Open PubChem element page</a></p>
                <p class="note">Specimen image: ${escapeHtml(metal.imageCredit || "No image on file")}${
                  metal.imageSourceUrl
                    ? ` — <a href="${metal.imageSourceUrl}" target="_blank" rel="noopener">source</a>`
                    : ""
                }</p>
              </div>
            </div>
          </div>
        </details>
      </article>
</section>
  `;
}

function bindEncyclopedia(filtered) {
  document.querySelector("#metal-search")?.addEventListener("input", (e) => {
    state.query = e.target.value;
    refreshMetalList();
  });
  document.querySelector("#metal-search")?.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });
  document.querySelector("#metal-search")?.addEventListener("click", (e) => {
    e.stopPropagation();
  });
  bindSortPicker();
  bindMetalCards();
  document.querySelector("#mobile-back-list")?.addEventListener("click", () => {
    state.mobilePane = "list"; // MOBILE_BROWSE_V2
    state.heroControlsOpen = false;
    state.seriesMenuOpen = false;
    state.sortMenuOpen = false;
    clearSeriesMenuListener();
    clearHeroMenuListener();
    clearSortMenuListener();
    renderBrowse();
  });
  // Series picker is bound once from renderBrowse (desktop toolbar / mobile list)
  // or here when the only picker lives on the mobile entry bar.
  if (isMobileBrowse() && state.mobilePane === "entry") bindSeriesPicker();
  document.querySelector("#hero-controls-toggle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    clearHeroMenuListener();
    state.heroControlsOpen = !state.heroControlsOpen; // MOBILE_BROWSE_V2
    if (state.heroControlsOpen) {
      state.seriesMenuOpen = false;
      state.sortMenuOpen = false;
      clearSeriesMenuListener();
      clearSortMenuListener();
    }
    renderBrowse();
  });
  if (state.heroControlsOpen) {
    clearHeroMenuListener();
    closeHeroMenuListener = (e) => {
      if (e.target.closest?.(".hero-controls--bar")) return;
      clearHeroMenuListener();
      state.heroControlsOpen = false;
      renderBrowse();
    };
    setTimeout(() => document.addEventListener("click", closeHeroMenuListener), 0);
  }
  document.querySelectorAll("button[data-hero]").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearHeroMenuListener();
      state.heroView = btn.dataset.hero;
      if (isMobileBrowse()) state.heroControlsOpen = false; // MOBILE_BROWSE_V2
      renderBrowse();
    });
  });
  document.querySelector("#toggle-compare")?.addEventListener("click", () => {
    const key = selectedMetal().key;
    const next = toggleCompareKey(state.compareKeys, key);
    if (next.length === state.compareKeys.length && !state.compareKeys.includes(key)) {
      state.compareNotice = `Compare supports up to ${COMPARE_LIMIT} metals.`;
    } else {
      state.compareKeys = next;
      state.compareNotice = "";
    }
    renderBrowse();
  });
  document.querySelector("#open-compare")?.addEventListener("click", () => {
    const key = selectedMetal().key;
    if (!state.compareKeys.includes(key)) {
      state.compareKeys = toggleCompareKey(state.compareKeys, key);
    }
    state.view = "compare";
    renderBrowse();
  });
  void filtered;
}

function compareAddOptions(query = "") {
  const q = query.trim().toLowerCase();
  return metals
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((m) => {
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.symbol.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q) ||
        m.key.includes(q)
      );
    })
    .map((m) => `<option value="${m.key}">${m.name} (${m.symbol})</option>`)
    .join("");
}

function compareAddCandidates(query = "") {
  const q = query.trim().toLowerCase();
  return metals
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((m) => {
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.symbol.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q) ||
        m.key.includes(q)
      );
    });
}

function propLabelWordsHtml(label) {
  return String(label)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `<span>${escapeHtml(w)}</span>`)
    .join("");
}

function mobileCompareDelta(row, cell, index, selected) {
  if (index === 0) return cell.isBest ? "max" : "baseline";
  if (row.type !== "number") return cell.delta;
  const prop = COMPARE_PROPERTIES.find((p) => p.id === row.id);
  if (!prop) return compactDelta(cell.delta);
  const base = prop.get(selected[0]);
  const val = prop.get(selected[index]);
  if (!hasValue(base) || !hasValue(val) || typeof base !== "number" || typeof val !== "number" || base === 0) {
    return compactDelta(cell.delta);
  }
  const pct = Math.round(((val - base) / Math.abs(base)) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

/** Narrow-column text for mobile sheet cells (temps: °C or °F). */
function mobileCompareCellText(row, cell, selected, index) {
  if (row.id === "meltingPoint" || row.id === "boilingPoint") {
    const prop = COMPARE_PROPERTIES.find((p) => p.id === row.id);
    const v = prop?.get(selected[index]);
    if (!hasValue(v) || typeof v !== "number") return cell.text === "Unavailable" ? "—" : cell.text;
    if (state.compareTempUnit === "F") {
      const f = (v * 9) / 5 + 32;
      return `${formatNumber(f, 1)} °F`;
    }
    return `${formatNumber(v, 1)} °C`;
  }
  return cell.text;
}

function renderCompareMobile() {
  const selected = compareMetals();
  const rows = buildCompareRows(selected);
  const n = Math.max(selected.length, 1);

  const presets = COMPARE_PRESETS.map(
    (p) =>
      `<button type="button" class="btn-ghost preset-btn" data-preset="${p.id}">${escapeHtml(p.label)}</button>`
  ).join("");

  const addItems = compareAddCandidates(state.compareQuery || "")
    .map((m) => {
      const inSet = state.compareKeys.includes(m.key);
      return `<button type="button" data-add-key="${m.key}" ${inSet ? "disabled" : ""}>${escapeHtml(m.name)} <span>${escapeHtml(m.symbol)}${inSet ? " · in set" : ""}</span></button>`;
    })
    .join("");

  const gutterProps = rows
    .map((row) => `<div class="compare-sheet-prop">${propLabelWordsHtml(row.label)}</div>`)
    .join("");

  const cols = selected
    .map((m, i) => {
      const cells = rows
        .map((row) => {
          const cell = row.cells[i];
          const sub = mobileCompareDelta(row, cell, i, selected);
          const text = mobileCompareCellText(row, cell, selected, i);
          const isTemp = row.id === "meltingPoint" || row.id === "boilingPoint";
          const tempAttrs = isTemp
            ? ` data-temp-toggle="1" role="button" tabindex="0" title="Tap to switch °C / °F" aria-label="Temperature in °${state.compareTempUnit}, tap to switch"`
            : "";
          return `
            <div class="compare-sheet-cell ${cell.isBest ? "is-best" : ""}${isTemp ? " is-temp" : ""}"${tempAttrs}>
              <span class="num"><span class="num-text">${escapeHtml(text)}</span>${cell.isBest ? '<span class="star" aria-label="Row leader">★</span>' : ""}</span>
              <span class="sub">${escapeHtml(sub)}</span>
            </div>`;
        })
        .join("");
      return `
        <div class="compare-sheet-col ${i === 0 ? "is-baseline" : ""}" data-compare-key="${m.key}">
          <div class="compare-sheet-head" data-drag-head="${m.key}" title="Drag to reorder">
            <button type="button" class="remove" data-remove="${m.key}" aria-label="Remove ${escapeHtml(m.name)}">×</button>
            ${metalCardMedia(m)}
            <span class="name">${escapeHtml(m.name)}</span>
          </div>
          ${cells}
        </div>`;
    })
    .join("");

  const production = selected
    .map(
      (m) => `
      <p><strong>${escapeHtml(m.name)}</strong> ${escapeHtml(m.production)}</p>`
    )
    .join("");

  return `
    <section class="compare-mobile">
      <h1 class="compare-page-title">Head to head</h1>
      <p class="compare-mobile-meta">Up to ${COMPARE_LIMIT} · first is baseline</p>
      <div class="compare-presets" role="group" aria-label="Best-of presets">${presets}</div>
      <div class="compare-mobile-tools">
        <button type="button" class="compare-add-trigger" id="compare-add-trigger" aria-haspopup="dialog" aria-expanded="${state.compareAddMenuOpen ? "true" : "false"}">
          Add metal… <span aria-hidden="true">${state.compareAddMenuOpen ? "▴" : "▾"}</span>
        </button>
        <button type="button" class="btn-ghost" id="copy-compare">Copy</button>
        <button type="button" class="btn-ghost" id="clear-compare">Clear</button>
      </div>
      <p class="notice" role="status" aria-live="polite">${escapeHtml(state.compareNotice || "")}</p>
      ${
        selected.length
          ? `<div class="compare-sheet" aria-label="Comparison sheet">
        <div class="compare-sheet-gutter">
          <div class="compare-sheet-corner" aria-hidden="true"></div>
          ${gutterProps}
        </div>
        <div class="compare-sheet-cols" style="grid-template-columns: repeat(${n}, minmax(0, 1fr));">
          ${cols}
        </div>
      </div>
      <p class="compare-mobile-hint">${n} across · drag headers to reorder</p>`
          : `<p class="empty-state">No metals selected. Use Add metal… or a preset.</p>`
      }
      <details class="compare-production">
        <summary>How they are made</summary>
        <div class="compare-production-body">${production || "<p>Add metals to see production notes.</p>"}</div>
      </details>
      <div class="compare-add-backdrop" id="compare-add-backdrop" ${state.compareAddMenuOpen ? "" : "hidden"}></div>
      <div class="compare-add-sheet" id="compare-add-sheet" role="dialog" aria-modal="true" aria-labelledby="compare-add-title" ${state.compareAddMenuOpen ? "" : "hidden"}>
        <div class="compare-add-grab" aria-hidden="true"></div>
        <h3 id="compare-add-title">Add metal</h3>
        <input type="search" id="add-search" placeholder="Search — Copper…" aria-label="Filter metals to add" value="${escapeHtml(state.compareQuery || "")}" />
        <div class="compare-add-list" role="listbox">${addItems}</div>
      </div>
    </section>
  `;
}

function renderCompare() {
  if (isMobileBrowse()) return renderCompareMobile();

  const selected = compareMetals();
  const rows = buildCompareRows(selected);
  const options = compareAddOptions(state.compareQuery || "");

  const cards = selected
    .map((m, i) => {
      const selectedCls = m.key === state.selectedKey ? " is-selected" : "";
      return `
        <div class="compare-card${selectedCls}" draggable="true" data-compare-key="${m.key}">
          ${metalCardMedia(m)}
          <span class="shade" aria-hidden="true"></span>
          <button type="button" class="remove" data-remove="${m.key}" aria-label="Remove ${escapeHtml(m.name)}">×</button>
          <button type="button" class="select" data-select="${m.key}">
            <strong class="name">${escapeHtml(m.name)}</strong>
            ${i === 0 ? '<em class="baseline">Baseline</em>' : ""}
            <span class="row" style="display:flex;justify-content:space-between;width:100%;">
              <span class="meta" style="color:rgba(250,248,245,0.75);font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(m.family)}</span>
              <span class="symbol">${escapeHtml(m.symbol)}</span>
            </span>
          </button>
        </div>`;
    })
    .join("");

  const presets = COMPARE_PRESETS.map(
    (p) =>
      `<button type="button" class="btn-ghost preset-btn" data-preset="${p.id}">${escapeHtml(p.label)}</button>`
  ).join("");

  const colCount = Math.max(selected.length, 1);
  const headerCols = selected
    .map(
      (m, i) =>
        `<span class="matrix-col ${i === 0 ? "is-baseline" : ""}">${escapeHtml(m.symbol)} · ${escapeHtml(m.name)}${i === 0 ? " · BASELINE" : ""}</span>`
    )
    .join("");

  const matrixRows = rows
    .map((row) => {
      const baseName = selected[0]?.name || "";
      const cells = row.cells
        .map((cell, i) => {
          const bar = row.bars[i];
          const hasDial = row.type === "number" && bar != null;
          const isMax = cell.isBest;
          const name = selected[i].name;
          let verdict;
          if (row.type !== "number") {
            verdict =
              i === 0
                ? `${name} sets the baseline: ${cell.text}.`
                : cell.delta === "Same"
                  ? `${name} matches the baseline (${cell.text}).`
                  : `${name}: ${cell.text} — differs from ${baseName}.`;
          } else if (i === 0) {
            verdict = `${name} is the baseline for deltas${isMax ? " and the row leader." : "."}`;
          } else {
            const d = compactDelta(cell.delta);
            verdict = `${name}: ${d} vs ${baseName}${isMax ? " — row leader." : cell.isWorst ? " — lowest in this set." : "."}`;
          }
          const t = hasDial ? bar / 100 : 0;
          return `
            <span class="matrix-cell ${isMax ? "is-best" : ""}" data-om-tip="1">
              ${
                hasDial
                  ? `<span class="dial" style="background: conic-gradient(from 180deg, ${dialGradient(t)}); box-shadow: inset 0 0 0 1px #232a2e;"><span class="dial-inner">${Math.round(bar)}%</span></span>`
                  : ""
              }
              <span class="cell-text">${escapeHtml(cell.text)}<span class="cell-sub">${escapeHtml(
                hasDial ? (isMax ? "row max" : "of leader") : i === 0 ? "baseline" : cell.delta
              )}</span></span>
              ${isMax ? `<span class="row-star" aria-label="Row leader">★</span>` : ""}
              <span data-tip-pop="1">${escapeHtml(verdict)}</span>
            </span>`;
        })
        .join("");
      return `
        <span class="matrix-label" data-om-tip="1"><span style="border-bottom:1px dotted #565f63">${escapeHtml(row.label)}</span><span data-tip-pop="1">${escapeHtml(PROP_TIPS[row.label] || row.label)}</span></span>
        ${cells}`;
    })
    .join("");

  const production = selected
    .map(
      (m) => `
      <article class="production-card">
        <h4>${escapeHtml(m.name)}</h4>
        <p class="family">${escapeHtml(m.family)}</p>
        <p>${escapeHtml(m.production)}</p>
      </article>`
    )
    .join("");

  return `
    <section>
      <div class="compare-head">
        <div>
          <h1>Head to head</h1>
          <p>Up to 4 metals · drag cards to reorder · first is baseline · dials show % of each row's leader.</p>
        </div>
        <div class="compare-tools">
          <div class="add-metal">
            <input type="search" id="add-search" placeholder="Search to add — Tungsten…" aria-label="Filter metals to add" value="${escapeHtml(state.compareQuery || "")}" />
            <span class="pick"><span aria-hidden="true">▾</span>
              <select id="add-pick" aria-label="Add metal">
                <option value="">Add metal…</option>
                ${options}
              </select>
            </span>
          </div>
          <button type="button" class="btn-ghost" id="copy-compare" style="min-height:40px">Copy</button>
          <button type="button" class="btn-ghost" id="clear-compare" style="min-height:40px">Clear</button>
        </div>
      </div>
      <div class="compare-presets" role="group" aria-label="Best-of presets">${presets}</div>
      <p class="notice" role="status" aria-live="polite">${escapeHtml(state.compareNotice || "")}</p>
      <div class="compare-cards" aria-label="Compared metals">${cards || '<p class="empty-state">No metals selected.</p>'}</div>
      <div class="compare-matrix" style="grid-template-columns: 10.5rem repeat(${colCount}, minmax(9rem, 1fr));">
        <span class="matrix-col" style="background:#14181a"></span>
        ${headerCols}
        ${matrixRows}
  </div>
      <section class="production-section" aria-label="How each metal is made">
        <h2>How they are made</h2>
        <div class="production-cards">${production}</div>
      </section>
    </section>
  `;
}

function addMetalToCompare(key) {
  if (!key) return;
  const m = byKey.get(key);
  if (!m) return;
  const next = toggleCompareKey(state.compareKeys, key);
  if (next.length === state.compareKeys.length && !state.compareKeys.includes(key)) {
    state.compareNotice = `Compare supports up to ${COMPARE_LIMIT} metals.`;
  } else if (state.compareKeys.includes(key)) {
    state.compareNotice = `${m.name} is already in the compare set.`;
  } else {
    state.compareKeys = next;
    state.compareNotice = "";
    state.compareAddMenuOpen = false;
    state.compareQuery = "";
  }
  renderBrowse();
}

function fitCompareSheetLabels() {
  document.querySelectorAll(".compare-sheet-prop").forEach((cell) => {
    const spans = [...cell.querySelectorAll("span")];
    const cs = getComputedStyle(cell);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const maxH = Math.max(6, (cell.clientHeight - padY) / Math.max(spans.length, 1));
    spans.forEach((span) => {
      let lo = 6;
      let hi = maxH;
      let best = lo;
      while (lo <= hi) {
        const mid = (lo + hi) / 2;
        span.style.fontSize = `${mid}px`;
        if (span.scrollWidth <= span.clientWidth + 0.5) {
          best = mid;
          lo = mid + 0.25;
        } else {
          hi = mid - 0.25;
        }
      }
      span.style.fontSize = `${Math.min(best, maxH)}px`;
    });
  });

  document.querySelectorAll(".compare-sheet-head .name").forEach((el) => {
    const cs = getComputedStyle(el);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    // Strict: never taller than the bar’s inner height
    const maxPx = Math.max(6, el.clientHeight - padY);
    let lo = 6;
    let hi = maxPx;
    let best = lo;
    while (lo <= hi) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = `${mid}px`;
      if (el.scrollWidth <= el.clientWidth + 0.5) {
        best = mid;
        lo = mid + 0.25;
      } else {
        hi = mid - 0.25;
      }
    }
    el.style.fontSize = `${Math.min(best, maxPx)}px`;
  });

  document.querySelectorAll(".compare-sheet-cell .num-text").forEach((el) => {
    const cell = el.closest(".compare-sheet-cell");
    if (!cell) return;
    const cs = getComputedStyle(cell);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const maxPx = Math.max(6, Math.min(14, (cell.clientHeight - padY) * 0.55));
    let lo = 6;
    let hi = maxPx;
    let best = lo;
    while (lo <= hi) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = `${mid}px`;
      if (el.scrollWidth <= el.clientWidth + 0.5) {
        best = mid;
        lo = mid + 0.25;
      } else {
        hi = mid - 0.25;
      }
    }
    el.style.fontSize = `${Math.min(best, maxPx)}px`;
  });
}

function setCompareAddOpen(open) {
  state.compareAddMenuOpen = open;
  const backdrop = document.querySelector("#compare-add-backdrop");
  const sheet = document.querySelector("#compare-add-sheet");
  const trigger = document.querySelector("#compare-add-trigger");
  if (!backdrop || !sheet || !trigger) return;
  trigger.setAttribute("aria-expanded", open ? "true" : "false");
  const chevron = trigger.querySelector("span");
  if (chevron) chevron.textContent = open ? "▴" : "▾";
  if (open) {
    backdrop.removeAttribute("hidden");
    sheet.removeAttribute("hidden");
    requestAnimationFrame(() => {
      backdrop.classList.add("is-open");
      sheet.classList.add("is-open");
    });
  } else {
    backdrop.classList.remove("is-open");
    sheet.classList.remove("is-open");
    backdrop.setAttribute("hidden", "");
    sheet.setAttribute("hidden", "");
  }
}

function bindCompareMobileAdd() {
  clearCompareAddListener();
  const trigger = document.querySelector("#compare-add-trigger");
  const backdrop = document.querySelector("#compare-add-backdrop");
  if (!trigger) return;

  if (state.compareAddMenuOpen) {
    backdrop?.classList.add("is-open");
    document.querySelector("#compare-add-sheet")?.classList.add("is-open");
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    setCompareAddOpen(!state.compareAddMenuOpen);
  });
  backdrop?.addEventListener("click", () => setCompareAddOpen(false));

  document.querySelector("#add-search")?.addEventListener("input", (e) => {
    state.compareQuery = e.target.value;
    const list = document.querySelector(".compare-add-list");
    if (!list) return;
    list.innerHTML = compareAddCandidates(state.compareQuery)
      .map((m) => {
        const inSet = state.compareKeys.includes(m.key);
        return `<button type="button" data-add-key="${m.key}" ${inSet ? "disabled" : ""}>${escapeHtml(m.name)} <span>${escapeHtml(m.symbol)}${inSet ? " · in set" : ""}</span></button>`;
      })
      .join("");
    list.querySelectorAll("button[data-add-key]").forEach((btn) => {
      btn.addEventListener("click", () => addMetalToCompare(btn.dataset.addKey));
    });
  });

  document.querySelectorAll(".compare-add-list button[data-add-key]").forEach((btn) => {
    btn.addEventListener("click", () => addMetalToCompare(btn.dataset.addKey));
  });
}

function bindCompareSheetReorder() {
  const colsRoot = document.querySelector(".compare-sheet-cols");
  if (!colsRoot) return;

  const colNodes = () => [...colsRoot.querySelectorAll(".compare-sheet-col[data-compare-key]")];
  let dragKey = null;
  let activePointer = null;

  const clearDropTargets = () => {
    colNodes().forEach((el) => el.classList.remove("is-drop-target"));
  };

  const colFromPoint = (x, y) => {
    const hit = document.elementFromPoint(x, y);
    return hit?.closest?.(".compare-sheet-col[data-compare-key]") || null;
  };

  const finishReorder = (fromKey, toKey) => {
    clearDropTargets();
    colNodes().forEach((el) => el.classList.remove("is-dragging"));
    dragKey = null;
    activePointer = null;
    if (!fromKey || !toKey || fromKey === toKey) return;
    state.compareKeys = reorderCompareKeys(state.compareKeys, fromKey, toKey);
    state.compareNotice = "";
    renderBrowse();
  };

  colsRoot.querySelectorAll(".compare-sheet-head").forEach((head) => {
    head.addEventListener("pointerdown", (e) => {
      if (e.target.closest?.(".remove")) return;
      if (e.button != null && e.button !== 0) return;
      const col = head.closest(".compare-sheet-col[data-compare-key]");
      if (!col) return;
      dragKey = col.dataset.compareKey;
      activePointer = e.pointerId;
      col.classList.add("is-dragging");
      head.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    head.addEventListener("pointermove", (e) => {
      if (activePointer !== e.pointerId || !dragKey) return;
      const target = colFromPoint(e.clientX, e.clientY);
      clearDropTargets();
      if (target && target.dataset.compareKey !== dragKey) {
        target.classList.add("is-drop-target");
      }
    });

    const endPointer = (e) => {
      if (activePointer !== e.pointerId || !dragKey) return;
      const fromKey = dragKey;
      const target = colFromPoint(e.clientX, e.clientY);
      try {
        head.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      finishReorder(fromKey, target?.dataset?.compareKey);
    };

    head.addEventListener("pointerup", endPointer);
    head.addEventListener("pointercancel", endPointer);
  });
}

function bindCompare() {
  document.querySelectorAll("button[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.compareKeys = state.compareKeys.filter((k) => k !== btn.dataset.remove);
      state.compareNotice = "";
      renderBrowse();
    });
  });
  document.querySelectorAll("button[data-select]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedKey = btn.dataset.select;
      renderBrowse();
    });
  });
  document.querySelectorAll("button[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = COMPARE_PRESETS.find((p) => p.id === btn.dataset.preset);
      if (!preset) return;
      const keys = bestOfKeys(metals, preset.get, COMPARE_LIMIT);
      if (!keys.length) {
        state.compareNotice = "No metals with data for that preset.";
        renderBrowse();
        return;
      }
      state.compareKeys = keys;
      state.selectedKey = keys[0];
      state.compareNotice = preset.notice;
      renderBrowse();
    });
  });

  document.querySelector("#clear-compare")?.addEventListener("click", () => {
    state.compareKeys = [state.selectedKey];
    state.compareNotice = "";
    renderBrowse();
  });
  document.querySelector("#copy-compare")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(compareSummaryText(compareMetals()));
      state.compareNotice = "Comparison copied to clipboard.";
    } catch {
      state.compareNotice = "Could not copy automatically — select the table manually.";
    }
    renderBrowse();
  });

  if (isMobileBrowse()) {
    bindCompareMobileAdd();
    bindCompareSheetReorder();
    document.querySelectorAll("[data-temp-toggle]").forEach((el) => {
      const toggle = (e) => {
        e.stopPropagation();
        state.compareTempUnit = state.compareTempUnit === "C" ? "F" : "C";
        renderBrowse();
      };
      el.addEventListener("click", toggle);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle(e);
        }
      });
    });
    requestAnimationFrame(() => {
      fitCompareSheetLabels();
      document.fonts?.ready?.then(() => fitCompareSheetLabels());
    });
    return;
  }

  let dragKey = null;
  const cardsRoot = document.querySelector(".compare-cards");
  const cardNodes = [...document.querySelectorAll(".compare-card[data-compare-key]")];

  const clearDropTargets = () => {
    cardNodes.forEach((el) => el.classList.remove("is-drop-target"));
  };

  const cardFromPoint = (x, y) => {
    const hit = document.elementFromPoint(x, y);
    return hit?.closest?.(".compare-card[data-compare-key]") || null;
  };

  const setDropTarget = (card) => {
    clearDropTargets();
    if (!card || card.dataset.compareKey === dragKey) return;
    card.classList.add("is-drop-target");
  };

  cardNodes.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      if (e.target.closest?.(".remove")) {
        e.preventDefault();
        return;
      }
      dragKey = card.dataset.compareKey;
      card.classList.add("is-dragging");
      cardsRoot?.classList.add("is-reordering");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragKey);
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      cardsRoot?.classList.remove("is-reordering");
      clearDropTargets();
      dragKey = null;
    });
  });

  cardsRoot?.addEventListener("dragover", (e) => {
    if (!dragKey) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(cardFromPoint(e.clientX, e.clientY));
  });

  cardsRoot?.addEventListener("dragleave", (e) => {
    if (!cardsRoot.contains(e.relatedTarget)) clearDropTargets();
  });

  cardsRoot?.addEventListener("drop", (e) => {
    e.preventDefault();
    const fromKey = dragKey || e.dataTransfer.getData("text/plain");
    const target = cardFromPoint(e.clientX, e.clientY) || e.target.closest?.(".compare-card[data-compare-key]");
    const toKey = target?.dataset?.compareKey;
    cardsRoot.classList.remove("is-reordering");
    clearDropTargets();
    if (!fromKey || !toKey || fromKey === toKey) return;
    state.compareKeys = reorderCompareKeys(state.compareKeys, fromKey, toKey);
    state.compareNotice = "";
    renderBrowse();
  });

  document.querySelector("#add-pick")?.addEventListener("change", (e) => {
    const key = e.target.value;
    e.target.value = "";
    addMetalToCompare(key);
  });
  document.querySelector("#add-search")?.addEventListener("input", (e) => {
    state.compareQuery = e.target.value;
    const select = document.querySelector("#add-pick");
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">Add metal…</option>${compareAddOptions(state.compareQuery)}`;
    if ([...select.options].some((o) => o.value === current)) select.value = current;
  });
}

function tableMobileNum(value, format) {
  if (!hasValue(value)) return "—";
  return format(value);
}

function tableMobileConductivity(value) {
  if (!hasValue(value)) return "—";
  const fmt = (n, maxFrac) =>
    Number(n).toLocaleString(undefined, {
      maximumFractionDigits: maxFrac,
      minimumFractionDigits: 0
    });
  if (value >= 1e6) return `${fmt(value / 1e6, 1)}M`;
  if (value >= 1e3) return `${fmt(value / 1e3, 1)}k`;
  return fmt(value, 0);
}

function renderTableMobile(filtered) {
  const longestName = filtered.reduce((a, m) => (m.name.length > a.length ? m.name : a), "Element");
  const rows = filtered
    .map((m) => {
      const melt = tableMobileNum(m.meltingPoint, (v) => formatNumber(v, 0));
      const dens = tableMobileNum(m.density, (v) => formatNumber(v, 2));
      const cond = tableMobileConductivity(m.conductivity);
      const condUnit =
        !hasValue(m.conductivity) ? "" : m.conductivity >= 1e6 ? " MS/m" : m.conductivity >= 1e3 ? " kS/m" : " S/m";
      const condSpoken = !hasValue(m.conductivity)
        ? "unavailable"
        : `${cond.replace(/[Mk]$/, "")}${condUnit}`;
      const selected = m.key === state.selectedKey ? " is-selected" : "";
      const current = m.key === state.selectedKey ? ' aria-current="true"' : "";
      const label = `${m.name}: melting ${melt} °C, density ${dens} g/cm³, conductivity ${condSpoken}`;
      return `
      <li>
        <button type="button" class="table-mobile-row${selected}" data-row-key="${m.key}"${current} aria-label="${escapeHtml(label)}">
          <span class="table-mobile-cell table-mobile-cell--id">
            <span class="name">${escapeHtml(m.name)}</span>
            <span class="series">${escapeHtml(m.family)}</span>
          </span>
          <span class="table-mobile-cell table-mobile-cell--num" aria-hidden="true">${escapeHtml(melt)}</span>
          <span class="table-mobile-cell table-mobile-cell--num" aria-hidden="true">${escapeHtml(dens)}</span>
          <span class="table-mobile-cell table-mobile-cell--num" aria-hidden="true">${escapeHtml(cond)}</span>
        </button>
      </li>`;
    })
    .join("");

  return `
    <section class="table-mobile" aria-label="Metals table">
      <h1 class="table-page-title">Data table</h1>
      <p class="table-mobile-meta">${filtered.length} metals · tap for entry</p>
      <div class="table-mobile-sheet">
        <div class="table-mobile-head" role="row">
          <button type="button" class="table-mobile-cell table-mobile-cell--id${state.sort === "name" ? " is-sorted" : ""}" data-table-sort="name" aria-pressed="${state.sort === "name"}">Element</button>
          <button type="button" class="table-mobile-cell table-mobile-cell--num${state.sort === "meltingDesc" ? " is-sorted" : ""}" data-table-sort="meltingDesc" aria-pressed="${state.sort === "meltingDesc"}">Melting</button>
          <button type="button" class="table-mobile-cell table-mobile-cell--num${state.sort === "densityDesc" ? " is-sorted" : ""}" data-table-sort="densityDesc" aria-pressed="${state.sort === "densityDesc"}">Density</button>
          <button type="button" class="table-mobile-cell table-mobile-cell--num${state.sort === "conductivityDesc" ? " is-sorted" : ""}" data-table-sort="conductivityDesc" aria-pressed="${state.sort === "conductivityDesc"}">Conductivity</button>
        </div>
        <ul class="table-mobile-list">${rows}</ul>
      </div>
      <span class="table-mobile-id-sizer" aria-hidden="true">${escapeHtml(longestName)}</span>
    </section>
  `;
}

function renderTable(filtered) {
  if (isMobileBrowse()) return renderTableMobile(filtered);

  const rows = filtered
    .map(
      (m) => `
      <tr data-row-key="${m.key}" class="${m.key === state.selectedKey ? "is-selected" : ""}">
        <th scope="row"><span class="sym">${escapeHtml(m.symbol)}</span> ${escapeHtml(m.name)}</th>
        <td class="muted-cell">${escapeHtml(m.family)}</td>
        <td class="muted-cell">${escapeHtml(m.standardState || "Unknown")}</td>
        <td class="num">${formatTemperature(m.meltingPoint)}</td>
        <td class="num">${formatDensity(m.density, 3)}</td>
        <td class="num">${formatConductivity(m.conductivity)}</td>
        <td class="muted-cell">${escapeHtml(m.overview.slice(0, 90))}${m.overview.length > 90 ? "…" : ""}</td>
      </tr>`
    )
    .join("");

  return `
    <section>
      <h1 class="table-page-title">Data table</h1>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Element</th>
              <th scope="col">Series</th>
              <th scope="col">State</th>
              <th scope="col" class="num">Melting</th>
              <th scope="col" class="num">Density</th>
              <th scope="col" class="num">Conductivity</th>
              <th scope="col">Summary</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
  </div>
</section>
  `;
}

function bindTable() {
  fitTableMobileIdColumn();
  document.querySelectorAll("button[data-table-sort]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.sort = btn.dataset.tableSort;
      renderBrowse();
    });
  });
  document.querySelectorAll("[data-row-key]").forEach((row) => {
    row.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.selectedKey = row.dataset.rowKey;
      state.view = "encyclopedia";
      if (isMobileBrowse()) state.mobilePane = "entry"; // MOBILE_BROWSE_V2
      // Defer so the same tap cannot hit the view-tabs after DOM replace
      setTimeout(() => renderBrowse(), 0);
    });
  });
}

function fitTableMobileIdColumn() {
  const root = document.querySelector(".table-mobile");
  const sizer = root?.querySelector(".table-mobile-id-sizer");
  if (!root || !sizer) return;
  root.style.setProperty("--table-id-w", `${Math.ceil(sizer.getBoundingClientRect().width)}px`);
}

bindTipFollow();
renderApp();

/* MOBILE_BROWSE_V2: re-render when crossing the mobile breakpoint */
if (MOBILE_BROWSE_V2 && typeof window.matchMedia === "function") {
  window.matchMedia(MOBILE_BROWSE_MQ).addEventListener("change", () => {
    if (state.page === "browse") renderBrowse();
  });
}
