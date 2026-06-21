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

  const labels = { sales: "Sales", items: "Sales Items", customers: "Customers", materials: "Materials", resources: "Resources", statuses: "Status" };
  count.textContent = labels[name] || name;
  body.innerHTML = '<div class="loading"><i data-lucide="loader-2" class="spin"></i> Loading...</div>';
  safeIcons();

  const t0 = performance.now();
  try {
    const renderers = { sales: renderSales, items: renderItems, customers: renderCustomers, materials: renderMaterials, resources: renderResources, statuses: renderStatuses };
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
  const items = await api("/api/items");

  const usage = {};
  items.forEach((i) => {
    if (!usage[i.material_id]) usage[i.material_id] = { qty: 0, total: 0, orders: 0 };
    usage[i.material_id].qty += i.quantity;
    usage[i.material_id].total += i.total_price;
    usage[i.material_id].orders++;
  });

  const enriched = data.map((r) => {
    const u = usage[r.id] || { qty: 0, total: 0, orders: 0 };
    return { ...r, used_in: u.orders, total_qty: u.qty, revenue: u.total };
  });

  body.innerHTML = '<div id="materials-table"></div>';

  DataTable(document.getElementById("materials-table"), {
    tableName: "materials",
    data: enriched,
    columns: [
      { key: "id", label: "ID", render: (v) => `<span class="mono">${v}</span>`, rawValue: (v) => v },
      { key: "description", label: "Description" },
      { key: "unit", label: "Unit", render: (v) => `<span class="tag tag-violet">${v}</span>` },
      { key: "used_in", label: "Used in", numeric: true, render: (v) => `${v} orders`, rawValue: (v) => v },
      { key: "total_qty", label: "Total Qty Sold", numeric: true, render: (v) => v.toLocaleString("pt-BR"), rawValue: (v) => v },
      { key: "revenue", label: "Total Revenue", numeric: true, render: (v) => `<strong>R$ ${fmt(v)}</strong>`, rawValue: (v) => v },
    ],
  });
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
