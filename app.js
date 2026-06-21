const cache = {};
let currentSection = "sales";

function safeIcons() {
  if (typeof lucide !== "undefined") lucide.createIcons({ nameAttr: "data-lucide" });
}

document.addEventListener("DOMContentLoaded", () => {
  safeIcons();
  bindNavigation();
  loadSection(currentSection);
});

function bindNavigation() {
  document.querySelectorAll(".rail-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      if (section === currentSection) return;
      document.querySelector(".rail-link.active")?.classList.remove("active");
      link.classList.add("active");
      currentSection = section;
      loadSection(section);
    });
  });
}

async function api(endpoint) {
  if (cache[endpoint]) return cache[endpoint];
  const res = await fetch(endpoint);
  const data = await res.json();
  cache[endpoint] = data;
  return data;
}

async function loadSection(name) {
  const body = document.getElementById("stageBody");
  const count = document.getElementById("stageCount");
  const timer = document.getElementById("loadTime");

  const labels = { sales: "Sales", items: "Sales Items", customers: "Customers", materials: "Materials", material_groups: "Material Groups", resources: "Resources", routing: "Routing", capacity: "Capacity", statuses: "Status" };
  count.textContent = labels[name] || name;
  body.innerHTML = '<div class="loading"><i data-lucide="loader-2" class="spin"></i> Loading...</div>';
  safeIcons();

  const t0 = performance.now();
  try {
    const renderers = { sales: renderSales, items: renderItems, customers: renderCustomers, materials: renderMaterials, material_groups: renderMaterialGroups, resources: renderResources, routing: renderRouting, capacity: renderCapacity, statuses: renderStatuses };
    if (renderers[name]) await renderers[name](body);
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
  }

  timer.textContent = `${(performance.now() - t0).toFixed(0)}ms`;
  safeIcons();
  updateTarget();
}

async function updateTarget() {
  const sales = await api("/api/sales");
  const closed = sales.filter((s) => s.status === "closed").reduce((a, s) => a + s.total_price, 0);
  const total = sales.reduce((a, s) => a + s.total_price, 0);
  const pct = total > 0 ? Math.round((closed / total) * 100) : 0;
  document.getElementById("targetFill").style.width = pct + "%";
  document.getElementById("targetValue").textContent = `${pct}% closed (R$ ${fmt(closed)})`;
}

function fmt(n) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ════════════════════════════════════════════════════════════════
//  DataTable — generic filterable, reorderable table component
// ════════════════════════════════════════════════════════════════

const FILTER_MODES = [
  { id: "contains",    label: "Contains" },
  { id: "not_contains",label: "Not contains" },
  { id: "equals",      label: "Equals" },
  { id: "not_equals",  label: "Not equals" },
  { id: "starts_with", label: "Starts with" },
  { id: "ends_with",   label: "Ends with" },
  { id: "gt",          label: "Greater than" },
  { id: "lt",          label: "Less than" },
  { id: "gte",         label: "≥" },
  { id: "lte",         label: "≤" },
  { id: "empty",       label: "Is empty" },
  { id: "not_empty",   label: "Is not empty" },
];

function applyFilter(cellVal, filterVal, mode) {
  const cv = String(cellVal ?? "").toLowerCase();
  const fv = String(filterVal).toLowerCase();
  switch (mode) {
    case "contains":     return cv.includes(fv);
    case "not_contains": return !cv.includes(fv);
    case "equals":       return cv === fv;
    case "not_equals":   return cv !== fv;
    case "starts_with":  return cv.startsWith(fv);
    case "ends_with":    return cv.endsWith(fv);
    case "gt":           return parseFloat(cellVal) > parseFloat(filterVal);
    case "lt":           return parseFloat(cellVal) < parseFloat(filterVal);
    case "gte":          return parseFloat(cellVal) >= parseFloat(filterVal);
    case "lte":          return parseFloat(cellVal) <= parseFloat(filterVal);
    case "empty":        return cv === "";
    case "not_empty":    return cv !== "";
    default:             return cv.includes(fv);
  }
}

/**
 * columns: [{ key, label, render?(val,row), numeric?, rawValue?(val,row) }]
 * data: array of row objects
 * tableName: string shown in header
 */
function DataTable(container, { columns, data, tableName }) {
  let colOrder = columns.map((_, i) => i);
  const filters = {};
  const filterModes = {};
  columns.forEach((c) => { filters[c.key] = ""; filterModes[c.key] = "contains"; });

  const uniqueVals = {};
  columns.forEach((c) => {
    const set = new Set();
    data.forEach((row) => {
      const v = c.rawValue ? c.rawValue(row[c.key], row) : row[c.key];
      if (v != null && String(v).trim()) set.add(String(v));
    });
    uniqueVals[c.key] = [...set].sort();
  });

  function getFilteredData() {
    return data.filter((row) =>
      columns.every((col) => {
        const fv = filters[col.key];
        const mode = filterModes[col.key];
        if (!fv && mode !== "empty" && mode !== "not_empty") return true;
        const raw = col.rawValue ? col.rawValue(row[col.key], row) : row[col.key];
        return applyFilter(raw, fv, mode);
      })
    );
  }

  function render() {
    const filtered = getFilteredData();
    const orderedCols = colOrder.map((i) => columns[i]);

    const activeFilters = Object.keys(filters).filter((k) => filters[k] || filterModes[k] === "empty" || filterModes[k] === "not_empty").length;

    container.innerHTML = `
      <div class="section-panel">
        <div class="section-header">
          <span class="section-title"><i data-lucide="database"></i> ${tableName}</span>
          <span class="section-meta">${filtered.length}${filtered.length !== data.length ? " / " + data.length : ""} records${activeFilters ? ` · ${activeFilters} filter${activeFilters > 1 ? "s" : ""} active` : ""}</span>
        </div>
        <div class="dt-table-wrap">
          <table class="data-table dt" id="dt-${tableName}">
            <thead>
              <tr class="dt-header-row">
                ${orderedCols.map((col, vi) => `
                  <th class="${col.numeric ? "num" : ""}" draggable="true" data-colidx="${colOrder[vi]}">
                    <div class="dt-th-content">
                      <span class="dt-drag-handle" title="Drag to reorder"><i data-lucide="grip-vertical"></i></span>
                      <span class="dt-th-label">${col.label}</span>
                    </div>
                  </th>
                `).join("")}
              </tr>
              <tr class="dt-filter-row">
                ${orderedCols.map((col) => `
                  <th class="dt-filter-cell">
                    <div class="dt-filter-wrap">
                      <button class="dt-filter-mode-btn" data-key="${col.key}" title="${FILTER_MODES.find((m) => m.id === filterModes[col.key])?.label || "Contains"}">
                        <i data-lucide="sliders-horizontal"></i>
                      </button>
                      <div class="dt-filter-input-wrap">
                        <input class="dt-filter-input" type="text" data-key="${col.key}"
                          placeholder="Filter..." value="${filters[col.key]}"
                          ${filterModes[col.key] === "empty" || filterModes[col.key] === "not_empty" ? "disabled" : ""} />
                        <div class="dt-suggestions" data-key="${col.key}"></div>
                      </div>
                      ${filters[col.key] ? `<button class="dt-filter-clear" data-key="${col.key}" title="Clear"><i data-lucide="x"></i></button>` : ""}
                    </div>
                  </th>
                `).join("")}
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `<tr><td colspan="${orderedCols.length}" class="dt-empty">No records match the current filters</td></tr>` : ""}
              ${filtered.map((row) =>
                `<tr>${orderedCols.map((col) => {
                  const val = row[col.key];
                  const rendered = col.render ? col.render(val, row) : (val ?? "—");
                  return `<td class="${col.numeric ? "num" : ""}">${rendered}</td>`;
                }).join("")}</tr>`
              ).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    safeIcons();
    bindEvents();
  }

  function bindEvents() {
    const table = container.querySelector(`#dt-${tableName}`);
    if (!table) return;

    // Filter inputs — typing + suggestions
    table.querySelectorAll(".dt-filter-input").forEach((input) => {
      const key = input.dataset.key;
      const sugBox = table.querySelector(`.dt-suggestions[data-key="${key}"]`);

      input.addEventListener("input", () => {
        filters[key] = input.value;
        showSuggestions(key, input.value, sugBox, input);
        render();
      });

      input.addEventListener("focus", () => {
        showSuggestions(key, input.value, sugBox, input);
      });

      input.addEventListener("blur", () => {
        setTimeout(() => { sugBox.innerHTML = ""; sugBox.classList.remove("open"); }, 180);
      });
    });

    // Filter mode buttons
    table.querySelectorAll(".dt-filter-mode-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllModals();
        const key = btn.dataset.key;
        const rect = btn.getBoundingClientRect();
        showModeMenu(key, rect);
      });
    });

    // Clear buttons
    table.querySelectorAll(".dt-filter-clear").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        filters[key] = "";
        filterModes[key] = "contains";
        render();
      });
    });

    // Drag and drop columns
    const headers = table.querySelectorAll(".dt-header-row th[draggable]");
    let dragIdx = null;

    headers.forEach((th) => {
      th.addEventListener("dragstart", (e) => {
        dragIdx = parseInt(th.dataset.colidx);
        th.classList.add("dt-dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      th.addEventListener("dragend", () => {
        th.classList.remove("dt-dragging");
        headers.forEach((h) => h.classList.remove("dt-drag-over"));
        dragIdx = null;
      });

      th.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        th.classList.add("dt-drag-over");
      });

      th.addEventListener("dragleave", () => {
        th.classList.remove("dt-drag-over");
      });

      th.addEventListener("drop", (e) => {
        e.preventDefault();
        const dropIdx = parseInt(th.dataset.colidx);
        if (dragIdx !== null && dragIdx !== dropIdx) {
          const fromPos = colOrder.indexOf(dragIdx);
          const toPos = colOrder.indexOf(dropIdx);
          colOrder.splice(fromPos, 1);
          colOrder.splice(toPos, 0, dragIdx);
          render();
        }
      });
    });
  }

  function showSuggestions(key, val, sugBox, input) {
    const matches = uniqueVals[key].filter((v) =>
      v.toLowerCase().includes((val || "").toLowerCase())
    ).slice(0, 12);

    if (matches.length === 0 || (matches.length === 1 && matches[0].toLowerCase() === val.toLowerCase())) {
      sugBox.innerHTML = "";
      sugBox.classList.remove("open");
      return;
    }

    sugBox.innerHTML = matches.map((m) => {
      const highlighted = highlightMatch(m, val);
      return `<div class="dt-suggestion-item" data-val="${m.replace(/"/g, "&quot;")}">${highlighted}</div>`;
    }).join("");
    sugBox.classList.add("open");

    sugBox.querySelectorAll(".dt-suggestion-item").forEach((item) => {
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        filters[key] = item.dataset.val;
        input.value = item.dataset.val;
        sugBox.innerHTML = "";
        sugBox.classList.remove("open");
        render();
      });
    });
  }

  function highlightMatch(text, query) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return text.slice(0, idx) + "<mark>" + text.slice(idx, idx + query.length) + "</mark>" + text.slice(idx + query.length);
  }

  function showModeMenu(key, rect) {
    let menu = document.getElementById("dt-mode-menu");
    if (menu) menu.remove();

    menu = document.createElement("div");
    menu.id = "dt-mode-menu";
    menu.className = "dt-mode-menu";
    menu.innerHTML = FILTER_MODES.map((m) =>
      `<div class="dt-mode-item ${filterModes[key] === m.id ? "active" : ""}" data-mode="${m.id}">${m.label}</div>`
    ).join("");

    document.body.appendChild(menu);
    const menuRect = menu.getBoundingClientRect();
    let top = rect.bottom + 4;
    let left = rect.left;
    if (top + menuRect.height > window.innerHeight) top = rect.top - menuRect.height - 4;
    if (left + menuRect.width > window.innerWidth) left = window.innerWidth - menuRect.width - 8;
    menu.style.top = top + "px";
    menu.style.left = left + "px";

    menu.querySelectorAll(".dt-mode-item").forEach((item) => {
      item.addEventListener("click", () => {
        filterModes[key] = item.dataset.mode;
        if (item.dataset.mode === "empty" || item.dataset.mode === "not_empty") {
          filters[key] = "";
        }
        menu.remove();
        render();
      });
    });

    setTimeout(() => {
      document.addEventListener("click", function handler(e) {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener("click", handler); }
      });
    }, 0);
  }

  function closeAllModals() {
    const m = document.getElementById("dt-mode-menu");
    if (m) m.remove();
  }

  render();
}

// ════════════════════════════════════════════════════════════════
//  Status helpers
// ════════════════════════════════════════════════════════════════

const STATUS_STYLE = {
  draft:         { cls: "tag-muted",  icon: "file-edit" },
  pending:       { cls: "tag-amber",  icon: "clock" },
  approved:      { cls: "tag-teal",   icon: "check" },
  in_production: { cls: "tag-violet", icon: "hard-hat" },
  shipped:       { cls: "tag-coral",  icon: "truck" },
  delivered:     { cls: "tag-teal",   icon: "package-check" },
  invoiced:      { cls: "tag-amber",  icon: "file-text" },
  closed:        { cls: "tag-green",  icon: "check-circle" },
  cancelled:     { cls: "tag-coral",  icon: "x-circle" },
};

function statusTag(status) {
  const s = STATUS_STYLE[status] || { cls: "tag-muted", icon: "circle" };
  return `<span class="tag ${s.cls}"><i data-lucide="${s.icon}"></i> ${status}</span>`;
}

const RESOURCE_TYPE_STYLE = {
  calandra:      { cls: "tag-teal",   icon: "circle-dot" },
  prensa:        { cls: "tag-violet", icon: "arrow-down-to-line" },
  montadora:     { cls: "tag-amber",  icon: "layers" },
};

const RESOURCE_STATUS_STYLE = {
  active:      { cls: "tag-green",  icon: "check-circle" },
  maintenance: { cls: "tag-amber",  icon: "wrench" },
  inactive:    { cls: "tag-muted",  icon: "pause-circle" },
};

// ════════════════════════════════════════════════════════════════
//  Section renderers
// ════════════════════════════════════════════════════════════════

async function renderSales(body) {
  const data = await api("/api/sales");
  const closed = data.filter((s) => s.status === "closed");
  const active = data.filter((s) => s.status !== "closed" && s.status !== "cancelled");
  const totalAll = data.reduce((a, s) => a + s.total_price, 0);
  const totalClosed = closed.reduce((a, s) => a + s.total_price, 0);
  const totalActive = active.reduce((a, s) => a + s.total_price, 0);

  body.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label"><i data-lucide="shopping-bag"></i> Total Orders</span>
        <span class="kpi-value">${data.length}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label"><i data-lucide="loader-2"></i> Active</span>
        <span class="kpi-value">${active.length}</span>
        <span class="kpi-change down">R$ ${fmt(totalActive)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label"><i data-lucide="check-circle"></i> Closed</span>
        <span class="kpi-value">${closed.length}</span>
        <span class="kpi-change up">R$ ${fmt(totalClosed)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label"><i data-lucide="dollar-sign"></i> Total Pipeline</span>
        <span class="kpi-value">R$ ${fmt(totalAll)}</span>
      </div>
    </div>
    <div id="sales-table"></div>
  `;
  safeIcons();

  DataTable(document.getElementById("sales-table"), {
    tableName: "sales_header",
    data,
    columns: [
      { key: "id", label: "ID", render: (v) => `<span class="mono">${v}</span>`, rawValue: (v) => v },
      { key: "customer_name", label: "Customer", render: (v) => `<strong>${v}</strong>` },
      { key: "status", label: "Status", render: (v) => statusTag(v) },
      { key: "total_price", label: "Total Price", numeric: true, render: (v) => `R$ ${fmt(v)}`, rawValue: (v) => v },
    ],
  });
}

async function renderItems(body) {
  const data = await api("/api/items");
  const total = data.reduce((a, r) => a + r.total_price, 0);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = data.filter((r) => r.due_date && r.due_date < today);

  body.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label"><i data-lucide="list"></i> Total Items</span>
        <span class="kpi-value">${data.length}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label"><i data-lucide="dollar-sign"></i> Total Value</span>
        <span class="kpi-value">R$ ${fmt(total)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label"><i data-lucide="alert-triangle"></i> Overdue</span>
        <span class="kpi-value">${overdue.length}</span>
        ${overdue.length > 0 ? '<span class="kpi-change down">Needs attention</span>' : '<span class="kpi-change up">All on track</span>'}
      </div>
    </div>
    <div id="items-table"></div>
  `;
  safeIcons();

  DataTable(document.getElementById("items-table"), {
    tableName: "sales_items",
    data,
    columns: [
      { key: "id", label: "ID", render: (v) => `<span class="mono">${v}</span>`, rawValue: (v) => v },
      { key: "sales_header_id", label: "Sale #", render: (v) => `<span class="mono">${v}</span>`, rawValue: (v) => v },
      { key: "material", label: "Material" },
      { key: "quantity", label: "Qty", numeric: true, render: (v) => v.toLocaleString("pt-BR"), rawValue: (v) => v },
      { key: "unit_price", label: "Unit Price", numeric: true, render: (v) => `R$ ${fmt(v)}`, rawValue: (v) => v },
      { key: "total_price", label: "Total Price", numeric: true, render: (v) => `<strong>R$ ${fmt(v)}</strong>`, rawValue: (v) => v },
      { key: "due_date", label: "Due Date", render: (v, row) => {
        if (!v) return "—";
        const isOverdue = v < today;
        return `<span class="tag ${isOverdue ? "tag-coral" : "tag-teal"}">${v}</span>`;
      }},
    ],
  });
}

async function renderCustomers(body) {
  const data = await api("/api/customers");
  const sales = await api("/api/sales");

  const salesByCustomer = {};
  sales.forEach((s) => {
    if (!salesByCustomer[s.customer_id]) salesByCustomer[s.customer_id] = { count: 0, total: 0 };
    salesByCustomer[s.customer_id].count++;
    salesByCustomer[s.customer_id].total += s.total_price;
  });

  const colors = ["#0f766e", "#5b5bd6", "#c84622", "#b7791f", "#22885d"];
  const enriched = data.map((r) => {
    const s = salesByCustomer[r.id] || { count: 0, total: 0 };
    return { ...r, orders: s.count, total_spent: s.total };
  });

  body.innerHTML = '<div id="customers-table"></div>';

  DataTable(document.getElementById("customers-table"), {
    tableName: "customers",
    data: enriched,
    columns: [
      { key: "id", label: "ID", render: (v) => `<span class="mono">${v}</span>`, rawValue: (v) => v },
      { key: "name", label: "Customer", render: (v, row) => {
        const initials = v.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
        const color = colors[(row.id - 1) % colors.length];
        return `<div class="contact-row"><div class="contact-avatar" style="background:${color}">${initials}</div><div class="contact-info"><span class="contact-name">${v}</span></div></div>`;
      }},
      { key: "email", label: "Email", render: (v) => `<span class="mono">${v || "—"}</span>` },
      { key: "phone", label: "Phone", render: (v) => `<span class="mono">${v || "—"}</span>` },
      { key: "orders", label: "Orders", numeric: true, rawValue: (v) => v },
      { key: "total_spent", label: "Total Spent", numeric: true, render: (v) => `<strong>R$ ${fmt(v)}</strong>`, rawValue: (v) => v },
    ],
  });
}

async function renderMaterials(body) {
  const data = await api("/api/materials");

  body.innerHTML = '<div id="materials-table"></div>';

  DataTable(document.getElementById("materials-table"), {
    tableName: "materials",
    data,
    columns: [
      { key: "id", label: "ID", render: (v) => `<span class="mono">${v}</span>`, rawValue: (v) => v },
      { key: "group_name", label: "Group", render: (v) => `<span class="tag tag-muted">${v}</span>` },
      { key: "description", label: "Description" },
      { key: "unit", label: "Unit", render: (v) => `<span class="tag tag-violet">${v}</span>` },
    ],
  });
}

async function renderMaterialGroups(body) {
  const groups = await api("/api/material_groups");

  body.innerHTML = '<div id="material-groups-table"></div>';

  DataTable(document.getElementById("material-groups-table"), {
    tableName: "material_groups",
    data: groups,
    columns: [
      { key: "id", label: "ID", render: (v) => `<span class="mono">${v}</span>`, rawValue: (v) => v },
      { key: "name", label: "Group", render: (v) => `<strong>${v}</strong>` },
      { key: "description", label: "Description", render: (v) => v || "—" },
    ],
  });
}

async function renderRouting(body) {
  const routing = await api("/api/routing");
  const groups = await api("/api/material_groups");
  const resources = await api("/api/resources");
  const activeRes = resources.filter((r) => r.status !== "inactive");

  // Build lookup: { "groupId-resourceId": time_per_unit }
  const matrix = {};
  routing.forEach((r) => {
    matrix[`${r.material_group_id}-${r.resource_id}`] = r;
  });

  const cellColor = (val) => {
    if (!val) return "";
    if (val <= 20) return "rt-fast";
    if (val <= 50) return "rt-medium";
    return "rt-slow";
  };

  body.innerHTML = `
    <div class="section-panel">
      <div class="section-header">
        <span class="section-title"><i data-lucide="grid-3x3"></i> Routing Matrix</span>
        <span class="section-meta">Time per unit (min) · ${groups.length} groups × ${activeRes.length} resources</span>
      </div>
      <div class="rt-matrix-wrap">
        <table class="rt-matrix">
          <thead>
            <tr>
              <th class="rt-corner"></th>
              ${activeRes.map((r) => `<th class="rt-res-header"><div class="rt-res-label">${r.short_desc}</div><div class="rt-res-code">${r.code}</div></th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${groups.map((g) => `
              <tr>
                <td class="rt-group-cell"><strong>${g.name}</strong></td>
                ${activeRes.map((r) => {
                  const entry = matrix[`${g.id}-${r.id}`];
                  if (entry) {
                    return `<td class="rt-cell ${cellColor(entry.time_per_unit)}" title="${g.name} → ${r.short_desc}: ${entry.time_per_unit} ${entry.time_unit}"><span class="rt-value">${entry.time_per_unit}</span><span class="rt-unit">${entry.time_unit}</span></td>`;
                  }
                  return `<td class="rt-cell rt-empty">—</td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  safeIcons();
}

async function renderResources(body) {
  const data = await api("/api/resources");
  const active = data.filter((r) => r.status === "active").length;
  const maintenance = data.filter((r) => r.status === "maintenance").length;

  body.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label"><i data-lucide="factory"></i> Total Resources</span>
        <span class="kpi-value">${data.length}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label"><i data-lucide="check-circle"></i> Active</span>
        <span class="kpi-value">${active}</span>
        <span class="kpi-change up">${Math.round((active / data.length) * 100)}% operational</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label"><i data-lucide="wrench"></i> Maintenance</span>
        <span class="kpi-value">${maintenance}</span>
        ${maintenance > 0 ? '<span class="kpi-change down">Needs attention</span>' : '<span class="kpi-change up">All clear</span>'}
      </div>
    </div>
    <div id="resources-table"></div>
  `;
  safeIcons();

  DataTable(document.getElementById("resources-table"), {
    tableName: "resources",
    data,
    columns: [
      { key: "id", label: "ID", render: (v) => `<span class="mono">${v}</span>`, rawValue: (v) => v },
      { key: "code", label: "Code", render: (v) => `<span class="mono"><strong>${v}</strong></span>` },
      { key: "short_desc", label: "Short Desc" },
      { key: "resource_group", label: "Group", render: (v) => `<span class="tag tag-muted">${v}</span>` },
      { key: "description", label: "Description" },
      { key: "type", label: "Type", render: (v) => {
        const ts = RESOURCE_TYPE_STYLE[v] || { cls: "tag-muted", icon: "circle" };
        return `<span class="tag ${ts.cls}"><i data-lucide="${ts.icon}"></i> ${v}</span>`;
      }},
      { key: "capacity", label: "Capacity", render: (v) => v || "—" },
      { key: "location", label: "Location", render: (v) => v || "—" },
      { key: "status", label: "Status", render: (v) => {
        const rs = RESOURCE_STATUS_STYLE[v] || { cls: "tag-muted", icon: "circle" };
        return `<span class="tag ${rs.cls}"><i data-lucide="${rs.icon}"></i> ${v}</span>`;
      }},
    ],
  });
}

// ── Capacity ──

const CAP_HOURS_PER_DAY = 24;
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDateShort(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function getISOWeek(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const jan4 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

function getWeekOfMonth(d) {
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  return Math.ceil((d.getDate() + firstDay.getDay()) / 7);
}

function buildBuckets(startDate, horizonDays, xUnit) {
  const buckets = [];
  const start = new Date(startDate);

  if (xUnit === "hours") {
    for (let h = 0; h < horizonDays * CAP_HOURS_PER_DAY; h++) {
      const d = new Date(start);
      d.setHours(d.getHours() + h);
      const hh = String(d.getHours()).padStart(2, "0");
      buckets.push({ label: `${hh}h`, sublabel: fmtDateShort(d), date: d, month: d.getMonth(), weekYear: getISOWeek(d) });
    }
  } else if (xUnit === "days") {
    for (let i = 0; i < horizonDays; i++) {
      const d = addDays(start, i);
      const dow = DAY_NAMES_SHORT[d.getDay()];
      const dd = String(d.getDate()).padStart(2, "0");
      buckets.push({ label: `${dow} ${dd}`, sublabel: dow, date: d, month: d.getMonth(), weekYear: getISOWeek(d) });
    }
  } else if (xUnit === "weeks") {
    const weeks = Math.ceil(horizonDays / 7);
    for (let i = 0; i < weeks; i++) {
      const d = addDays(start, i * 7);
      const wy = getISOWeek(d);
      const wm = getWeekOfMonth(d);
      const mn = MONTH_NAMES[d.getMonth()];
      buckets.push({ label: `W${wy}`, sublabel: `${mn} W${wm}`, date: d, span: 7, month: d.getMonth(), weekYear: wy });
    }
  } else if (xUnit === "months") {
    const endDate = addDays(start, horizonDays);
    let cursor = new Date(start);
    while (cursor < endDate) {
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const bucketEnd = monthEnd < endDate ? monthEnd : endDate;
      const daysInBucket = Math.round((bucketEnd - cursor) / 86400000) + (monthEnd < endDate ? 1 : 0);
      buckets.push({ label: `${MONTH_NAMES[cursor.getMonth()]}`, sublabel: `${cursor.getFullYear()}`, date: new Date(cursor), span: daysInBucket, month: cursor.getMonth() });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }
  return buckets;
}

function getYValue(yUnit) {
  if (yUnit === "hours") return CAP_HOURS_PER_DAY;
  if (yUnit === "days") return 1;
  if (yUnit === "minutes") return CAP_HOURS_PER_DAY * 60;
  if (yUnit === "shifts") return 3;
  return CAP_HOURS_PER_DAY;
}

function getYPerBucket(yUnit, xUnit) {
  const perDay = getYValue(yUnit);
  if (xUnit === "hours") return perDay / CAP_HOURS_PER_DAY;
  if (xUnit === "days") return perDay;
  if (xUnit === "weeks") return perDay * 7;
  if (xUnit === "months") return perDay * 30;
  return perDay;
}

function getYLabel(yUnit) {
  if (yUnit === "hours") return "h";
  if (yUnit === "days") return "d";
  if (yUnit === "minutes") return "min";
  if (yUnit === "shifts") return "shifts";
  return "h";
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

let capState = { horizon: 7, xUnit: "days", yUnit: "hours", selectedResources: null, selectedGroups: null, startDate: todayStr(), viewBy: "group" };

async function renderCapacity(body) {
  const resources = await api("/api/resources");
  const activeRes = resources.filter((r) => r.status === "active");

  const filteredRes = activeRes.filter((r) => capState.selectedGroups === null || capState.selectedGroups.has(r.resource_group));

  body.innerHTML = `
    <div class="cap-controls">
      <div class="cap-control-group">
        <label class="cap-label">Start Date</label>
        <div class="cap-start-date-wrap">
          <input type="date" class="cap-date-input" id="capStartDate" value="${capState.startDate}" />
          <button class="cap-btn cap-today-btn ${capState.startDate === todayStr() ? "active" : ""}" id="capToday" type="button">Today</button>
        </div>
      </div>
      <div class="cap-control-group cap-control-full">
        <label class="cap-label">Horizon</label>
        <div class="cap-horizon-cascade">
          <div class="cap-horizon-row">
            <span class="cap-horizon-row-label">Year</span>
            <div class="cap-horizon-btns">
              ${[2026,2027,2028].map((y) => `<button class="cap-btn ${capState.horizon === "y"+y ? "active" : ""}" data-h="y${y}">${y}</button>`).join("")}
            </div>
          </div>
          <div class="cap-horizon-row">
            <span class="cap-horizon-row-label">Semester</span>
            <div class="cap-horizon-btns">
              <button class="cap-btn ${capState.horizon === "s1" ? "active" : ""}" data-h="s1">S1</button>
              <button class="cap-btn ${capState.horizon === "s2" ? "active" : ""}" data-h="s2">S2</button>
            </div>
          </div>
          <div class="cap-horizon-row">
            <span class="cap-horizon-row-label">Quarter</span>
            <div class="cap-horizon-btns">
              <button class="cap-btn ${capState.horizon === "q1" ? "active" : ""}" data-h="q1">Q1</button>
              <button class="cap-btn ${capState.horizon === "q2" ? "active" : ""}" data-h="q2">Q2</button>
              <button class="cap-btn ${capState.horizon === "q3" ? "active" : ""}" data-h="q3">Q3</button>
              <button class="cap-btn ${capState.horizon === "q4" ? "active" : ""}" data-h="q4">Q4</button>
            </div>
          </div>
          <div class="cap-horizon-row">
            <span class="cap-horizon-row-label">Month</span>
            <div class="cap-horizon-btns">
              ${MONTH_NAMES.map((m, i) => `<button class="cap-btn cap-btn-sm ${capState.horizon === "m"+(i+1) ? "active" : ""}" data-h="m${i+1}">${m}</button>`).join("")}
            </div>
          </div>
          <div class="cap-horizon-row">
            <span class="cap-horizon-row-label">Weeks</span>
            <div class="cap-horizon-btns">
              <button class="cap-btn ${capState.horizon === 7 ? "active" : ""}" data-h="7">1w</button>
              <button class="cap-btn ${capState.horizon === 14 ? "active" : ""}" data-h="14">2w</button>
              <button class="cap-btn ${capState.horizon === 21 ? "active" : ""}" data-h="21">3w</button>
              <button class="cap-btn ${capState.horizon === 28 ? "active" : ""}" data-h="28">4w</button>
            </div>
          </div>
          <div class="cap-horizon-row">
            <span class="cap-horizon-row-label">Days</span>
            <div class="cap-horizon-btns">
              <button class="cap-btn ${capState.horizon === 1 ? "active" : ""}" data-h="1">1d</button>
              <button class="cap-btn ${capState.horizon === 3 ? "active" : ""}" data-h="3">3d</button>
              <button class="cap-btn ${capState.horizon === 5 ? "active" : ""}" data-h="5">5d</button>
              <button class="cap-btn ${capState.horizon === 10 ? "active" : ""}" data-h="10">10d</button>
            </div>
          </div>
        </div>
      </div>
      <div class="cap-control-group">
        <label class="cap-label">View By</label>
        <div class="cap-horizon-btns">
          <button class="cap-btn ${capState.viewBy === "group" ? "active" : ""}" data-view="group">Groups</button>
          <button class="cap-btn ${capState.viewBy === "resource" ? "active" : ""}" data-view="resource">Resources</button>
          <button class="cap-btn ${capState.viewBy === "all" ? "active" : ""}" data-view="all">Combined</button>
        </div>
      </div>
      <div class="cap-control-group">
        <label class="cap-label">X Axis</label>
        <select class="cap-select" id="capXUnit">
          <option value="hours" ${capState.xUnit === "hours" ? "selected" : ""}>Hours</option>
          <option value="days" ${capState.xUnit === "days" ? "selected" : ""}>Days</option>
          <option value="weeks" ${capState.xUnit === "weeks" ? "selected" : ""}>Weeks</option>
          <option value="months" ${capState.xUnit === "months" ? "selected" : ""}>Months</option>
        </select>
      </div>
      <div class="cap-control-group">
        <label class="cap-label">Y Axis</label>
        <select class="cap-select" id="capYUnit">
          <option value="hours" ${capState.yUnit === "hours" ? "selected" : ""}>Hours</option>
          <option value="days" ${capState.yUnit === "days" ? "selected" : ""}>Days</option>
          <option value="minutes" ${capState.yUnit === "minutes" ? "selected" : ""}>Minutes</option>
          <option value="shifts" ${capState.yUnit === "shifts" ? "selected" : ""}>Shifts (8h)</option>
        </select>
      </div>
      <div class="cap-control-group">
        <label class="cap-label">Group</label>
        <div class="cap-resource-toggles" id="capGroupToggles">
          ${[...new Set(activeRes.map((r) => r.resource_group))].map((g) => {
            const on = capState.selectedGroups === null || capState.selectedGroups.has(g);
            return `<label class="cap-resource-toggle ${on ? "on" : ""}" data-group="${g}"><input type="checkbox" ${on ? "checked" : ""} data-group="${g}" /><span class="cap-toggle-code">${g}</span></label>`;
          }).join("")}
        </div>
      </div>
      <div class="cap-control-group">
        <label class="cap-label">Resources</label>
        <div class="cap-resource-toggles" id="capResourceToggles">
          ${filteredRes.map((r) => {
            const checked = capState.selectedResources === null || capState.selectedResources.has(r.id);
            return `<label class="cap-resource-toggle ${checked ? "on" : ""}" data-id="${r.id}"><input type="checkbox" ${checked ? "checked" : ""} data-id="${r.id}" /><span class="cap-toggle-code">${r.short_desc}</span></label>`;
          }).join("")}
        </div>
      </div>
    </div>
    <div id="cap-chart-area"></div>
  `;

  renderCapChart(activeRes, filteredRes);
  bindCapControls(body, activeRes);
  safeIcons();
}

// loadMap: { "YYYY-MM-DD": { resourceId: hours, ... } }
function getLoadForBucket(b, resourceIds, loadMap, yUnit) {
  let totalHours = 0;
  if (capState.xUnit === "hours") {
    const dateStr = `${b.date.getFullYear()}-${String(b.date.getMonth()+1).padStart(2,"0")}-${String(b.date.getDate()).padStart(2,"0")}`;
    resourceIds.forEach((rid) => {
      totalHours += (loadMap[dateStr]?.[rid] || 0) / CAP_HOURS_PER_DAY;
    });
  } else if (capState.xUnit === "days") {
    const dateStr = `${b.date.getFullYear()}-${String(b.date.getMonth()+1).padStart(2,"0")}-${String(b.date.getDate()).padStart(2,"0")}`;
    resourceIds.forEach((rid) => {
      totalHours += (loadMap[dateStr]?.[rid] || 0);
    });
  } else {
    const spanDays = b.span || 7;
    for (let d = 0; d < spanDays; d++) {
      const dd = addDays(b.date, d);
      const dateStr = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,"0")}-${String(dd.getDate()).padStart(2,"0")}`;
      resourceIds.forEach((rid) => {
        totalHours += (loadMap[dateStr]?.[rid] || 0);
      });
    }
  }
  if (yUnit === "hours") return totalHours;
  if (yUnit === "days") return totalHours / CAP_HOURS_PER_DAY;
  if (yUnit === "minutes") return totalHours * 60;
  if (yUnit === "shifts") return totalHours / 8;
  return totalHours;
}

function buildSingleChart(title, subtitle, resCount, buckets, yLabel, resourceIds, loadMap) {
  const maxBuckets = 90;
  const visibleBuckets = buckets.slice(0, maxBuckets);

  let maxY = 0;
  visibleBuckets.forEach((b) => {
    const days = b.span || (capState.xUnit === "hours" ? 1/CAP_HOURS_PER_DAY : 1);
    const val = getYValue(capState.yUnit) * days * resCount;
    if (val > maxY) maxY = val;
  });

  const yTicks = 4;
  const yStep = maxY / yTicks;
  const yTicksArr = [];
  for (let i = yTicks; i >= 0; i--) yTicksArr.push(Math.round(yStep * i * 100) / 100);

  let prevWeek = null;
  const barHtmlParts = [];
  visibleBuckets.forEach((b) => {
    const isNewWeek = capState.xUnit === "days" && prevWeek !== null && b.weekYear !== prevWeek;
    prevWeek = b.weekYear;
    const separatorClass = isNewWeek ? "cap-week-sep" : "";
    const bucketDays = b.span || (capState.xUnit === "hours" ? 1/CAP_HOURS_PER_DAY : 1);
    const capacity = getYValue(capState.yUnit) * bucketDays * resCount;
    const consumed = loadMap ? getLoadForBucket(b, resourceIds, loadMap, capState.yUnit) : 0;
    const available = Math.max(0, capacity - consumed);
    const totalPct = maxY > 0 ? (Math.max(capacity, consumed) / maxY) * 100 : 0;
    const consumedRatio = capacity > 0 ? consumed / Math.max(capacity, consumed) : 0;
    const availRatio = 1 - Math.min(consumedRatio, 1);
    const overloaded = consumed > capacity;
    const consumedRound = Math.round(consumed * 10) / 10;
    const availRound = Math.round(available * 10) / 10;

    barHtmlParts.push(`
      <div class="cap-bar-col ${separatorClass}" title="${b.label}: ${availRound}${yLabel} avail / ${consumedRound}${yLabel} consumed">
        <div class="cap-bar-stack" style="height:${Math.min(totalPct, 100)}%">
          ${availRatio > 0 ? `<div class="cap-bar-avail" style="height:${availRatio * 100}%"></div>` : ""}
          ${consumedRatio > 0 ? `<div class="cap-bar-consumed ${overloaded ? "cap-bar-over" : ""}" style="height:${Math.min(consumedRatio, 1) * 100}%"></div>` : ""}
        </div>
        <div class="cap-bar-labels"><span class="cap-bar-label">${b.label}</span></div>
      </div>`);
  });

  const weekBands = [];
  if (capState.xUnit === "days" && visibleBuckets.length > 0) {
    let rs = 0, rw = visibleBuckets[0].weekYear;
    for (let i = 1; i <= visibleBuckets.length; i++) {
      const c = i < visibleBuckets.length ? visibleBuckets[i].weekYear : -1;
      if (c !== rw) { weekBands.push({ span: i - rs, label: `W${rw}` }); rs = i; rw = c; }
    }
  }

  const monthBands = [];
  if (visibleBuckets.length > 0) {
    let rs = 0, rm = visibleBuckets[0].month;
    for (let i = 1; i <= visibleBuckets.length; i++) {
      const c = i < visibleBuckets.length ? visibleBuckets[i].month : -1;
      if (c !== rm) { const yr = visibleBuckets[rs].date.getFullYear(); monthBands.push({ span: i - rs, label: `${MONTH_NAMES[rm]} ${yr}` }); rs = i; rm = c; }
    }
  }

  return `
    <div class="section-panel cap-multi-panel">
      <div class="section-header">
        <span class="section-title">${title}</span>
        <span class="section-meta">${subtitle}</span>
      </div>
      <div class="cap-chart cap-chart-sm">
        <div class="cap-y-axis">
          ${yTicksArr.map((t) => `<div class="cap-y-tick"><span>${t}${yLabel}</span></div>`).join("")}
        </div>
        <div class="cap-bars-area">
          <div class="cap-grid-lines">
            ${yTicksArr.map(() => `<div class="cap-grid-line"></div>`).join("")}
          </div>
          <div class="cap-bars">${barHtmlParts.join("")}</div>
        </div>
      </div>
      ${weekBands.length > 0 ? `<div class="cap-week-bands"><div class="cap-bands-spacer"></div>${weekBands.map((wb, i) => `<div class="cap-week-band ${i%2===1?"alt":""}" style="flex:${wb.span}"><span>${wb.label}</span></div>`).join("")}</div>` : ""}
      ${monthBands.length > 0 ? `<div class="cap-month-bands"><div class="cap-bands-spacer"></div>${monthBands.map((mb, i) => `<div class="cap-month-band ${i%2===1?"alt":""}" style="flex:${mb.span}"><span>${mb.label}</span></div>`).join("")}</div>` : ""}
    </div>`;
}

async function renderCapChart(activeRes, filteredRes) {
  if (!filteredRes) filteredRes = activeRes;
  const area = document.getElementById("cap-chart-area");
  const startDate = new Date(capState.startDate + "T00:00:00");
  const buckets = buildBuckets(startDate, capState.horizon, capState.xUnit);
  const yLabel = getYLabel(capState.yUnit);

  const selectedRes = filteredRes.filter((r) => capState.selectedResources === null || capState.selectedResources.has(r.id));

  // Fetch load data and build map: { "YYYY-MM-DD": { resourceId: hours } }
  const loadRaw = await api("/api/load");
  const loadMap = {};
  loadRaw.forEach((l) => {
    if (!loadMap[l.date]) loadMap[l.date] = {};
    loadMap[l.date][l.resource_id] = (loadMap[l.date][l.resource_id] || 0) + l.hours;
  });

  let html = "";

  if (capState.viewBy === "group") {
    const groups = [...new Set(selectedRes.map((r) => r.resource_group))];
    groups.forEach((g) => {
      const groupRes = selectedRes.filter((r) => r.resource_group === g);
      const rids = groupRes.map((r) => r.id);
      html += buildSingleChart(g,
        `${groupRes.length} resource${groupRes.length > 1 ? "s" : ""} · ${groupRes.map((r) => r.short_desc).join(", ")}`,
        groupRes.length, buckets, yLabel, rids, loadMap);
    });
  } else if (capState.viewBy === "resource") {
    selectedRes.forEach((r) => {
      html += buildSingleChart(r.short_desc, `${r.code} · ${r.resource_group}`,
        1, buckets, yLabel, [r.id], loadMap);
    });
  } else {
    const rids = selectedRes.map((r) => r.id);
    html += buildSingleChart("All Selected Resources",
      `${selectedRes.length} resource${selectedRes.length > 1 ? "s" : ""}`,
      selectedRes.length, buckets, yLabel, rids, loadMap);
  }

  area.innerHTML = `
    <div class="cap-legend">
      <span class="cap-legend-item"><span class="cap-legend-dot cap-legend-avail"></span> Available</span>
      <span class="cap-legend-item"><span class="cap-legend-dot cap-legend-consumed"></span> Consumed</span>
      <span class="cap-legend-item"><span class="cap-legend-dot cap-legend-over"></span> Overloaded</span>
    </div>
    <div class="cap-charts-grid">${html}</div>`;
  safeIcons();
}

function bindCapControls(body, activeRes) {
  document.getElementById("capStartDate").addEventListener("change", (e) => {
    capState.startDate = e.target.value;
    renderCapacity(body);
  });

  document.getElementById("capToday").addEventListener("click", () => {
    capState.startDate = todayStr();
    renderCapacity(body);
  });

  body.querySelectorAll(".cap-horizon-btns .cap-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const h = btn.dataset.h;
      const startD = new Date(capState.startDate + "T00:00:00");
      const yr = startD.getFullYear();

      if (h.startsWith("y")) {
        const y = parseInt(h.slice(1));
        capState.startDate = `${y}-01-01`;
        capState.horizon = (y % 4 === 0 ? 366 : 365);
      } else if (h === "s1") {
        capState.startDate = `${yr}-01-01`;
        capState.horizon = (yr % 4 === 0 ? 182 : 181);
      } else if (h === "s2") {
        capState.startDate = `${yr}-07-01`;
        capState.horizon = (yr % 4 === 0 ? 184 : 184);
      } else if (h.startsWith("q")) {
        const q = parseInt(h.slice(1));
        const qStart = [0, 0, 3, 6, 9][q];
        capState.startDate = `${yr}-${String(qStart+1).padStart(2,"0")}-01`;
        const s = new Date(yr, qStart, 1);
        const e = new Date(yr, qStart + 3, 1);
        capState.horizon = Math.round((e - s) / 86400000);
      } else if (h.startsWith("m")) {
        const m = parseInt(h.slice(1));
        capState.startDate = `${yr}-${String(m).padStart(2,"0")}-01`;
        const s = new Date(yr, m - 1, 1);
        const e = new Date(yr, m, 1);
        capState.horizon = Math.round((e - s) / 86400000);
      } else {
        capState.horizon = parseInt(h);
      }
      renderCapacity(body);
    });
  });

  body.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      capState.viewBy = btn.dataset.view;
      renderCapacity(body);
    });
  });

  document.getElementById("capXUnit").addEventListener("change", (e) => {
    capState.xUnit = e.target.value;
    renderCapacity(body);
  });

  document.getElementById("capYUnit").addEventListener("change", (e) => {
    capState.yUnit = e.target.value;
    renderCapacity(body);
  });

  // Group toggles
  document.querySelectorAll("#capGroupToggles input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const grp = cb.dataset.group;
      const allGroups = [...new Set(activeRes.map((r) => r.resource_group))];
      if (capState.selectedGroups === null) {
        capState.selectedGroups = new Set(allGroups);
      }
      if (cb.checked) {
        capState.selectedGroups.add(grp);
      } else {
        capState.selectedGroups.delete(grp);
      }
      if (capState.selectedGroups.size === allGroups.length) {
        capState.selectedGroups = null;
      }
      capState.selectedResources = null;
      renderCapacity(body);
    });
  });

  // Resource toggles
  document.querySelectorAll("#capResourceToggles input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = parseInt(cb.dataset.id);
      const filteredRes = activeRes.filter((r) => capState.selectedGroups === null || capState.selectedGroups.has(r.resource_group));
      if (capState.selectedResources === null) {
        capState.selectedResources = new Set(filteredRes.map((r) => r.id));
      }
      if (cb.checked) {
        capState.selectedResources.add(id);
      } else {
        capState.selectedResources.delete(id);
      }
      if (capState.selectedResources.size === filteredRes.length) {
        capState.selectedResources = null;
      }
      renderCapChart(activeRes, filteredRes);
      document.querySelectorAll("#capResourceToggles .cap-resource-toggle").forEach((lbl) => {
        const lid = parseInt(lbl.dataset.id);
        const isOn = capState.selectedResources === null || capState.selectedResources.has(lid);
        lbl.classList.toggle("on", isOn);
        lbl.querySelector("input").checked = isOn;
      });
    });
  });
}

// ── Statuses ──

async function renderStatuses(body) {
  const data = await api("/api/statuses");
  const sales = await api("/api/sales");

  const countByStatus = {};
  const totalByStatus = {};
  sales.forEach((s) => {
    countByStatus[s.status] = (countByStatus[s.status] || 0) + 1;
    totalByStatus[s.status] = (totalByStatus[s.status] || 0) + s.total_price;
  });

  const enriched = data.map((r) => ({
    ...r,
    orders: countByStatus[r.name] || 0,
    total_value: totalByStatus[r.name] || 0,
  }));

  body.innerHTML = '<div id="statuses-table"></div>';

  DataTable(document.getElementById("statuses-table"), {
    tableName: "sales_status",
    data: enriched,
    columns: [
      { key: "id", label: "ID", render: (v) => `<span class="mono">${v}</span>`, rawValue: (v) => v },
      { key: "name", label: "Status", render: (v) => statusTag(v) },
      { key: "description", label: "Description", render: (v) => v || "—" },
      { key: "orders", label: "Orders", numeric: true, rawValue: (v) => v },
      { key: "total_value", label: "Total Value", numeric: true, render: (v) => `<strong>R$ ${fmt(v)}</strong>`, rawValue: (v) => v },
    ],
  });
}
