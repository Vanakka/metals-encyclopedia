import "./style.css";
import { metals } from "./data/metals.js";
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
  dataCoverage
} from "./lib/format.js";
import { getFilteredMetals, relativeConductivity } from "./lib/filter.js";
import {
  COMPARE_LIMIT,
  COMPARE_PRESETS,
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
  heroView: "photo"
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
  const withImg = metals.find((m) => m.family === family && m.imageUrl);
  return withImg?.imageUrl || null;
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
  renderApp();
}

function openBrowse({ family = "all", view = "encyclopedia", selectFirst = true } = {}) {
  state.page = "browse";
  state.family = family;
  state.view = view;
  state.query = "";
  if (selectFirst) {
    const filtered = getFilteredMetals(metals, state);
    if (filtered.length) state.selectedKey = filtered[0].key;
  }
  renderApp();
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
            <p class="dash-kicker">// Materials reference console</p>
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
          <button type="button" class="tool-card" data-action="browse">
            <span class="eyebrow">Reference</span>
            <h2>Sources</h2>
            <p>PubChem, RSC, USGS provenance per entry.</p>
            <span class="meta">Tier 1–2</span>
          </button>
          <button type="button" class="tool-card" disabled>
            <span class="eyebrow">Coming later</span>
            <h2>3D Viewer</h2>
            <p>Sample + atomic model, mount reserved.</p>
            <span class="meta">Placeholder</span>
          </button>
        </div>
      </main>
    </div>
  `;

  document.querySelector('[data-action="series"]')?.addEventListener("click", openSeriesHub);
  document.querySelector('[data-action="browse"]')?.addEventListener("click", () => openBrowse({ family: "all" }));
  document.querySelector('[data-action="compare"]')?.addEventListener("click", () =>
    openBrowse({ family: "all", view: "compare", selectFirst: false })
  );
  document.querySelector('[data-action="table"]')?.addEventListener("click", () =>
    openBrowse({ family: "all", view: "table", selectFirst: false })
  );
}

function renderSeriesHub() {
  const tiles = families
    .map((family) => {
      const count = countFamily(family);
      const img = familyImage(family);
      return `
        <button type="button" class="series-tile" data-series="${escapeHtml(family)}">
          ${img ? `<img src="${img}" alt="" loading="lazy" decoding="async">` : ""}
          <span class="shade" aria-hidden="true"></span>
          <span class="name-chip">${escapeHtml(family)}</span>
          <span class="count-chip">${count} metal${count === 1 ? "" : "s"} →</span>
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
          <button type="button" class="series-all" data-series="all">
            <span class="title">All metals</span>
            <span class="copy">Every metallic and metalloid entry, one list.</span>
            <span class="meta">${metals.length} entries →</span>
          </button>
          ${tiles}
        </section>
      </main>
    </div>
  `;

  document.querySelector('[data-nav="home"]')?.addEventListener("click", goHome);
  document.querySelectorAll("[data-series]").forEach((btn) => {
    btn.addEventListener("click", () => openBrowse({ family: btn.dataset.series }));
  });
}

function renderBrowse() {
  const filtered = getFilteredMetals(metals, state);
  const seriesLabel = state.family === "all" ? "All metals" : state.family;
  const showToolbar = state.view !== "compare";

  app.innerHTML = `
    <div class="console-shell">
      <main class="browse-main">
        <nav class="browse-crumbs" aria-label="Breadcrumb">
          <button type="button" class="crumb-link" data-nav="home">Console</button>
          <span aria-hidden="true">/</span>
          <button type="button" class="crumb-link" data-nav="series">Metals</button>
          <span aria-hidden="true">/</span>
          <span>${escapeHtml(seriesLabel)}</span>
          <span class="view-tabs" role="group" aria-label="View mode">
            <button type="button" data-view="encyclopedia" aria-pressed="${state.view === "encyclopedia"}">Entry</button>
            <button type="button" data-view="compare" aria-pressed="${state.view === "compare"}">Compare</button>
            <button type="button" data-view="table" aria-pressed="${state.view === "table"}">Table</button>
          </span>
        </nav>
        ${
          showToolbar
            ? `<div class="browse-toolbar">
          <h1>${escapeHtml(seriesLabel)}</h1>
          <select id="family-filter" aria-label="Series">
            <option value="all">All series</option>
            ${families.map((f) => `<option value="${f}" ${f === state.family ? "selected" : ""}>${f}</option>`).join("")}
          </select>
          <span class="count">${filtered.length} shown</span>
        </div>`
            : ""
        }
        <div id="browse-content"></div>
      </main>
    </div>
  `;

  document.querySelector('[data-nav="home"]')?.addEventListener("click", goHome);
  document.querySelector('[data-nav="series"]')?.addEventListener("click", openSeriesHub);
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.view = btn.dataset.view;
      renderBrowse();
    });
  });
  document.querySelector("#family-filter")?.addEventListener("change", (e) => {
    state.family = e.target.value;
    const next = getFilteredMetals(metals, state);
    if (next.length && !next.some((m) => m.key === state.selectedKey)) {
      state.selectedKey = next[0].key;
    }
    renderBrowse();
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
}

function renderEncyclopedia(filtered) {
  const metal = selectedMetal();
  const rel = relativeConductivity(metal);
  const shells = atomShells(metal.atomicNumber);
  const faces = ["rotateY(0deg)", "rotateY(90deg)", "rotateY(180deg)", "rotateY(270deg)", "rotateX(90deg)", "rotateX(-90deg)"];
  const grad = cubeGrad(metal.family);
  const list = filtered
    .map((m) => {
      const r = relativeConductivity(m);
      const current = m.key === state.selectedKey ? ' aria-current="true"' : "";
      return `
        <button type="button" class="metal-card" data-key="${m.key}"${current}>
          ${m.imageUrl ? `<img src="${m.imageUrl}" alt="" loading="lazy" decoding="async">` : ""}
          <span class="shade" aria-hidden="true"></span>
          <strong class="name">${escapeHtml(m.name)}</strong>
          <span class="row">
            <span class="meta">${escapeHtml(m.family)} · ${hasValue(r) ? `σ ${r.toFixed(0)}%` : "σ —"}</span>
            <span class="symbol">${escapeHtml(m.symbol)}</span>
          </span>
        </button>`;
    })
    .join("");

  const statCards = [
    {
      label: "Melting",
      value: hasValue(metal.meltingPoint)
        ? `${formatNumber(metal.meltingPoint, 0)} °C / ${formatNumber((metal.meltingPoint * 9) / 5 + 32, 0)} °F`
        : "—"
    },
    {
      label: "Boiling",
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

  const dataRows = [
    ["Symbol", metal.symbol],
    ["Atomic no.", String(metal.atomicNumber)],
    ["Atomic mass", formatAtomicMass(metal.atomicMass)],
    ["E-config", metal.electronConfiguration || "Unknown"],
    ["State", metal.standardState || "Unknown"],
    ["Discovered", metal.yearDiscovered || "Unknown"],
    ["Series", metal.family],
    ["Melting point", formatTemperature(metal.meltingPoint)],
    ["Boiling point", formatTemperature(metal.boilingPoint)],
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
      return `
      <div class="data-row${unavailable ? " is-unavailable" : ""}">
        <dt data-om-tip="1"><span class="label">${escapeHtml(label)}</span><span data-tip-pop="1">${escapeHtml(PROP_TIPS[label] || label)}</span></dt>
        <dd>${escapeHtml(value)}</dd>
      </div>`;
    })
    .join("");

  const coverage = dataCoverage(metal);
  const coverageNote = coverage.note
    ? `<aside class="coverage-note" data-level="${coverage.level}"><strong>Data coverage</strong> — ${escapeHtml(coverage.note)}</aside>`
    : "";

  const facts = (metal.notableFacts || [])
    .map((f) => `<li>${escapeHtml(f)}</li>`)
    .join("");
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

  return `
    <section class="browse-layout">
      <aside class="metal-aside" aria-label="Filtered metals">
        <div class="search-sort">
          <input id="metal-search" type="search" autocomplete="off" placeholder="Search — Copper, Kroll, toxic" aria-label="Search" value="${escapeHtml(state.query)}" />
          <span class="sort-wrap">Sort <span aria-hidden="true">▾</span>
            <select id="sort-select" aria-label="Sort by">
              <option value="atomicNumber" ${state.sort === "atomicNumber" ? "selected" : ""}>Atomic number</option>
              <option value="name" ${state.sort === "name" ? "selected" : ""}>Name</option>
              <option value="densityDesc" ${state.sort === "densityDesc" ? "selected" : ""}>Density</option>
              <option value="meltingDesc" ${state.sort === "meltingDesc" ? "selected" : ""}>Melting point</option>
              <option value="conductivityDesc" ${state.sort === "conductivityDesc" ? "selected" : ""}>Conductivity</option>
            </select>
          </span>
        </div>
        <div class="metal-cards">
          ${list || '<p class="empty-state">No elements match that search.</p>'}
        </div>
      </aside>
      <article>
        <figure class="hero">
          ${
            heroPhoto
              ? metal.imageUrl
                ? `<img class="hero-blur" src="${metal.imageUrl}" alt="" aria-hidden="true" loading="lazy" decoding="async" />
                   <img class="hero-photo" src="${metal.imageUrl}" alt="${escapeHtml(metal.name)} sample" loading="lazy" decoding="async" />`
                : `<div class="hero-fallback-symbol">${escapeHtml(metal.symbol)}</div>`
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
          <div class="hero-controls" role="group" aria-label="Hero view">
            <button type="button" data-hero="photo" aria-pressed="${heroPhoto}">Photo</button>
            <button type="button" data-hero="3d" aria-pressed="${hero3d}">3D Sample</button>
            <button type="button" data-hero="atomic" aria-pressed="${heroAtomic}">Atomic</button>
            <span class="meta">${escapeHtml(metal.family)}</span>
            <span class="meta">Z ${metal.atomicNumber}</span>
            <span class="meta">Disc. ${escapeHtml(metal.yearDiscovered || "unknown")}</span>
  </div>
          <div class="hero-fade" aria-hidden="true"></div>
          <h2 class="hero-title">${escapeHtml(metal.name)}</h2>
        </figure>

        <div class="stat-strip" aria-label="Key stats">${statCards}</div>
        ${coverageNote}

        <div class="entry-grid">
          <div>
            <section class="prose-block"><h3>What it is</h3><p>${escapeHtml(metal.overview)}</p></section>
            <section class="prose-block"><h3>How it is made</h3><p>${escapeHtml(metal.production)}</p></section>
            <section class="prose-block"><h3>Uses</h3><p>${escapeHtml(metal.uses)}</p></section>
            ${
              facts
                ? `<section class="prose-block"><h3>Notable facts</h3><ul>${facts}</ul></section>`
                : ""
            }
            <section class="note-box">
              <h3>Handling note</h3>
              <p>${escapeHtml(metal.safety || "No handling note recorded.")}</p>
            </section>
            <section class="sources-block">
              <h3>Sources & confidence — narrative: <span style="color:${CONF_COLORS[metal.narrativeConfidence] || "#d7dde0"}">${confidenceLabel(metal.narrativeConfidence)}</span></h3>
              <p class="note">Numeric identity and thermo/density fields track PubChem’s periodic-table dataset. Conductivity, hardness, and abundance come from the prior PeriodicTable.com/Wolfram-backed set. Narratives are built from RSC Periodic Table text; where a USGS Mineral Commodity Summaries 2025 chapter exists, production is dual-sourced and marked Confirmed.</p>
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
            </section>
          </div>
          <aside style="display:grid;gap:16px;align-content:start;">
            <section class="data-sheet" aria-label="Scientific facts">
              <h3>Full data sheet</h3>
              <dl>${dataRows}</dl>
            </section>
            <div class="compare-actions">
              <button type="button" class="btn-primary" id="toggle-compare">${state.compareKeys.includes(metal.key) ? "Remove from compare" : "Add to compare"}</button>
              <button type="button" class="btn-ghost" id="open-compare">Open compare</button>
            </div>
          </aside>
  </div>
      </article>
</section>
  `;
}

function bindEncyclopedia(filtered) {
  document.querySelector("#metal-search")?.addEventListener("input", (e) => {
    state.query = e.target.value;
    renderBrowse();
  });
  document.querySelector("#sort-select")?.addEventListener("change", (e) => {
    state.sort = e.target.value;
    renderBrowse();
  });
  document.querySelectorAll(".metal-card[data-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedKey = btn.dataset.key;
      renderBrowse();
    });
  });
  document.querySelectorAll("[data-hero]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.heroView = btn.dataset.hero;
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

function renderCompare() {
  const selected = compareMetals();
  const rows = buildCompareRows(selected);
  const options = compareAddOptions(state.compareQuery || "");

  const cards = selected
    .map((m, i) => {
      const selectedCls = m.key === state.selectedKey ? " is-selected" : "";
      return `
        <div class="compare-card${selectedCls}" draggable="true" data-compare-key="${m.key}">
          ${m.imageUrl ? `<img src="${m.imageUrl}" alt="" loading="lazy" decoding="async" draggable="false">` : ""}
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
          <h2>Head to head</h2>
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
      ${state.compareNotice ? `<p class="notice">${escapeHtml(state.compareNotice)}</p>` : ""}
      <div class="compare-cards" aria-label="Compared metals">${cards || '<p class="empty-state">No metals selected.</p>'}</div>
      <div class="compare-matrix" style="grid-template-columns: 10.5rem repeat(${colCount}, minmax(9rem, 1fr));">
        <span class="matrix-col" style="background:#14181a"></span>
        ${headerCols}
        ${matrixRows}
  </div>
      <section class="production-section" aria-label="How each metal is made">
        <h3>How they are made</h3>
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
  }
  renderBrowse();
}

function bindCompare() {
  document.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.compareKeys = state.compareKeys.filter((k) => k !== btn.dataset.remove);
      state.compareNotice = "";
      renderBrowse();
    });
  });
  document.querySelectorAll("[data-select]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedKey = btn.dataset.select;
      renderBrowse();
    });
  });
  document.querySelectorAll("[data-preset]").forEach((btn) => {
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
}

function renderTable(filtered) {
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
  document.querySelectorAll("[data-row-key]").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedKey = row.dataset.rowKey;
      state.view = "encyclopedia";
      renderBrowse();
    });
  });
}

bindTipFollow();
renderApp();
