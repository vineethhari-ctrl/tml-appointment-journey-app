/* Core: state, role switcher, scope, permissions, metrics, charts, journey and matrix.
   Modules register themselves in App.modules (only "appointment" today), so a new module
   (e.g. Telecaller) can be added as another js file without changing this one. */
(function () {
  const M = window.MODEL, D = window.DATA;
  const App = window.App = { M, D, modules: {}, state: {
    role: "NSM", tab: null, unit: null, bd: "All", page: 1, filters: {}, selected: new Set(), escalations: [], module: "appointment"
  } };
  const S = App.state;

  /* ---------- helpers ---------- */
  const esc = App.esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  App.$ = sel => document.querySelector(sel);
  App.fmtDate = iso => iso && iso !== "-" ? iso.split("-").reverse().join("-") : "-";
  App.pct = (a, b) => b ? Math.round(100 * a / b) : 0;
  App.role = id => M.roles.find(r => r.id === id);
  App.shortLabel = id => ({ DGM: "Dealer GM", DSA: "Dealer Svc Admin", WSA: "Workshop SA" })[id] || id;
  App.action = id => M.actions.find(a => a.id === id);
  App.perm = (role, action) => M.permissions[role][action];
  App.can = (action, role = S.role) => !!App.perm(role, action).scope;
  App.statusMeta = id => M.appointmentStatuses.find(s => s.id === id);

  /* ---------- units and scope ---------- */
  const U = D.units;
  App.unit = id => U[id];
  App.home = (role = S.role) => M.personas[role].unit;
  App.user = (role = S.role) => M.personas[role].user || null;
  App.ancestors = id => { const out = []; let u = U[id]; while (u) { out.unshift(u.id); u = U[u.parent]; } return out; };
  App.dealersUnder = id => { const u = U[id]; if (u.level === "division") return [u.parent]; return u.level === "dealer" ? [id] : u.children.flatMap(App.dealersUnder); };
  App.countLevel = (id, level) => { const u = U[id]; if (u.level === level) return 1; return u.children.reduce((s, c) => s + App.countLevel(c, level), 0); };
  App.inScope = (rec, unitId = S.unit) => {
    const u = U[unitId];
    if (u.level === "division") return rec.division === unitId;
    if (u.level === "national") return true;
    return App.dealersUnder(unitId).includes(rec.dealer);
  };
  App.bdOk = rec => S.bd === "All" || rec.bd === S.bd;
  App.levelLabel = lvl => (M.levels.find(l => l.id === lvl) || {}).label || lvl;

  App.scopeText = (role = S.role) => {
    const r = App.role(role), h = App.home(role), u = U[h];
    const n = lvl => App.countLevel(h, lvl);
    switch (r.level) {
      case "national": return `National · all regions (${n("region")} regions, ${n("zone")} zones, ${n("area")} areas, ${n("dealer")} dealers)`;
      case "region": return `${u.name} · all zones (${n("zone")} zones, ${n("area")} areas, ${n("dealer")} dealers)`;
      case "zone": return `${u.name} · all areas (${n("area")} areas, ${n("dealer")} dealers)`;
      case "area": return `${u.name} · ${n("dealer")} dealers`;
      case "dealer": return `${u.name} · all divisions (${u.children.length} workshops)`;
      case "own": return `${App.user(role)} · own assigned leads (${u.name})`;
    }
  };

  /* ---------- metrics (computed live from records, so in-app changes keep roll-ups consistent) ---------- */
  App.metrics = (unitId, bd = S.bd) => {
    const ok = r => App.inScope(r, unitId) && (bd === "All" || r.bd === bd);
    const leads = D.leads.filter(ok), appts = D.appointments.filter(ok);
    const m = { leads: leads.length, assigned: 0, attempted: 0, contacted: 0, appts: appts.length, target: 0 };
    leads.forEach(l => { if (l.assignedTo) m.assigned++; if (l.callStatus === "Attempted") m.attempted++; if (l.contact === "Contacted") m.contacted++; });
    m.unassigned = m.leads - m.assigned;
    M.appointmentStatuses.forEach(s => m[s.id] = appts.filter(a => a.status === s.id).length);
    const u = U[unitId];
    if (u.level !== "division") App.dealersUnder(unitId).forEach(d => { m.target += bd === "All" ? D.targets[d].PV + D.targets[d].EV : D.targets[d][bd]; });
    else m.target = null;
    m.showRate = App.pct(m.reported, m.reported + m.no_show);
    return m;
  };

  /* ---------- charts ---------- */
  App.donut = (segs, center, label, size = 150) => {
    const total = segs.reduce((s, x) => s + x.value, 0), r = 15.9, c = 2 * Math.PI * r;
    let off = 0;
    const arcs = total ? segs.filter(s => s.value > 0).map(s => {
      const len = c * s.value / total, gap = segs.filter(x => x.value > 0).length > 1 ? 0.8 : 0;
      const el = `<circle r="${r}" cx="21" cy="21" fill="none" stroke="${s.color}" stroke-width="3.2" stroke-linecap="round"
        stroke-dasharray="${Math.max(len - gap, 0.01)} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 21 21)"></circle>`;
      off += len; return el;
    }).join("") : `<circle r="${r}" cx="21" cy="21" fill="none" stroke="#e5e8ef" stroke-width="3.2"></circle>`;
    const desc = segs.map(s => `${s.label} ${s.value}`).join(", ");
    return `<svg class="donut" width="${size}" height="${size}" viewBox="0 0 42 42" role="img" aria-label="${esc(label)} ${esc(center)}: ${esc(desc)}">
      ${arcs}<text x="21" y="21.5" text-anchor="middle" class="c-num" style="font-size:8px">${esc(center)}</text>
      <text x="21" y="27" text-anchor="middle" class="c-lbl" style="font-size:2.3px">${esc(label.toUpperCase())}</text></svg>`;
  };
  App.legend = segs => `<ul class="legend">${segs.map(s => `<li><span class="dot" style="background:${s.color}"></span>${esc(s.label)}<span class="v">${s.value}${s.suffix || ""}</span></li>`).join("")}</ul>`;
  App.donutCard = (title, segs, center, label, extra = "") => `<section class="card"><div class="card-h">${esc(title)}</div>
    <div class="card-b"><div class="donut-wrap">${App.donut(segs, center, label)}${App.legend(segs)}</div>${extra}</div></section>`;
  App.bars = rows => `<div class="bars">${rows.map(r => `<div class="bar-row"><span>${esc(r.label)}</span>
    <span class="bar" role="img" aria-label="${esc(r.label)} ${esc(r.text)}"><i style="width:${Math.min(100, r.pct)}%;background:${r.color}"></i></span><span class="v">${esc(r.text)}</span></div>`).join("")}</div>`;
  App.stat = (icon, num, label, color = "var(--blue)") => `<section class="card stat"><span class="ico" aria-hidden="true">${icon}</span>
    <div><div class="num" style="color:${color}">${esc(num)}</div><div class="lbl">${esc(label)}</div></div></section>`;
  App.statusChip = id => { const s = App.statusMeta(id); const cls = { booked: "purple", confirmed: "green", reported: "blue", no_show: "red", rescheduled: "amber", cancelled: "grey" }[id];
    return `<span class="chip ${cls}">${esc(s.shownAs || s.label)}</span>`; };
  App.chip = (text, cls) => `<span class="chip ${cls}">${esc(text)}</span>`;
  App.bdTag = bd => `<span class="tag ${bd.toLowerCase()}">${bd}</span>`;

  /* ---------- UI shell ---------- */
  App.toast = msg => { const t = App.$("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(App._tt); App._tt = setTimeout(() => t.hidden = true, 3200); };
  App.modal = (title, body, buttons = [{ label: "Close" }]) => {
    const root = App.$("#modal-root"), prev = document.activeElement;
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt">
      <div class="modal-h"><h2 id="mt">${esc(title)}</h2><button class="x" data-close aria-label="Close">×</button></div>
      <div class="modal-b">${body}</div>
      <div class="modal-f">${buttons.map((b, i) => `<button class="btn ${b.primary ? "primary" : ""}" data-mbtn="${i}">${esc(b.label)}</button>`).join("")}</div></div></div>`;
    const close = () => { root.innerHTML = ""; document.removeEventListener("keydown", onKey); prev && prev.focus && prev.focus(); };
    const onKey = e => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") { const f = [...root.querySelectorAll("button,input,select,textarea")].filter(x => !x.disabled);
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener("keydown", onKey);
    root.querySelector("[data-close]").onclick = close;
    root.querySelector(".modal-back").onclick = e => { if (e.target.classList.contains("modal-back")) close(); };
    buttons.forEach((b, i) => root.querySelector(`[data-mbtn="${i}"]`).onclick = () => { if (!b.onClick || b.onClick(root) !== false) close(); });
    (root.querySelector(".modal-b input, .modal-b select, .modal-b textarea") || root.querySelector("[data-mbtn]")).focus();
    return root;
  };

  App.renderRoles = () => {
    App.$("#roles").innerHTML = M.roleSwitcher.map(g => `<div class="role-group" role="group" aria-label="${g.group} roles">
      <span class="role-group-label">${g.group}</span>
      ${g.roles.map(id => { const r = App.role(id); return `<button class="role-btn" id="role-${id}" data-role="${id}" aria-pressed="${S.role === id}" title="${esc(r.name)}">${id === "DGM" ? "Dealer GM" : id === "DSA" ? "Dealer Service Admin" : id}</button>`; }).join("")}
    </div>`).join("");
    const r = App.role(S.role);
    App.$("#persona").innerHTML = `${esc(r.name)}<small>${esc(App.scopeText())}</small>`;
  };

  App.mod = () => App.modules[S.module];
  App.renderTabs = () => {
    const tabs = App.mod().tabs(S.role);
    App.$("#tabs").innerHTML = `<h2>${esc(App.mod().label)} screens</h2>` + tabs.map(t =>
      `<button class="tab-btn" id="tab-${t.id}" data-tab="${t.id}" ${S.tab === t.id ? 'aria-current="page"' : ""}>${esc(t.label)}<small>${esc(t.sub || "")}</small></button>`).join("");
  };

  App.setRole = role => {
    S.role = role; S.unit = App.home(role); S.tab = App.mod().tabs(role)[0].id; S.bd = "All"; S.page = 1; S.filters = {}; S.selected.clear();
    App.render(); App.$("#main").focus();
  };
  App.go = (tab, filters) => { S.tab = tab; S.page = 1; S.selected.clear(); S.filters = filters || {}; App.render(); App.$("#main").focus(); };
  App.drill = unitId => { S.unit = unitId; S.page = 1; App.render(); };

  App.render = () => {
    const a = document.activeElement, fid = a && a.id && a !== document.body ? a.id : null;
    App.renderRoles(); App.renderTabs();
    const tab = App.mod().tabs(S.role).find(t => t.id === S.tab);
    App.$("#main").innerHTML = App.mod().views[tab.view](tab);
    if (fid) { const el = document.getElementById(fid); if (el && !el.disabled) el.focus(); }
  };

  /* ---------- shared page pieces ---------- */
  App.pageHead = (title, tab) => {
    const badge = tab.basis === "observed"
      ? `<span class="badge observed">Observed · screen ${String(tab.screen).padStart(2, "0")}</span>`
      : tab.basis === "proposed" ? `<span class="badge proposed">Proposed${tab.screen ? " · " + tab.screen : ""}</span>` : "";
    return `<div class="page-head"><h1>${esc(title)}</h1>${badge}</div>`;
  };
  App.bdToggle = (label = "Business division (PV/EV)") => {
    const enabled = App.can("filter_pvev");
    return `<span class="seg-label">${esc(label)}</span><span class="seg" role="group" aria-label="${esc(label)}">${["All", "PV", "EV"].map(v =>
      `<button id="bd-${v}" data-bd="${v}" aria-pressed="${S.bd === v}" ${enabled ? "" : "disabled"}>${v}</button>`).join("")}</span>`;
  };
  App.scopeBanner = (opts = {}) => {
    const r = App.role(S.role), path = App.ancestors(S.unit), homeIdx = path.indexOf(App.home());
    const crumbs = path.slice(homeIdx).map((id, i, arr) => i === arr.length - 1
      ? `<span aria-current="location">${esc(U[id].name)}</span>` : `<button data-unit="${id}">${esc(U[id].name)}</button><span aria-hidden="true">›</span>`).join("");
    return `<section class="scope" aria-label="Data scope">
      <div class="scope-main"><strong>${esc(r.name)} (${esc(r.group)})</strong><span>Data scope: ${esc(App.scopeText())}</span></div>
      ${opts.crumbs === false ? "" : `<nav class="crumbs" aria-label="Drill-down path">${crumbs}</nav>`}
      <div class="right">${opts.bd === false ? "" : App.bdToggle(opts.bdLabel)}${S.escalations.length ? `<span class="chip amber">${S.escalations.length} escalation(s) raised</span>` : ""}</div>
    </section>`;
  };

  App.actionsPanel = () => {
    const cells = M.actions.map(a => {
      const p = App.perm(S.role, a.id);
      if (p.scope) return `<button class="act" data-act="${a.id}"><b>${esc(a.label)}</b><small>Scope: ${esc(M._meta.scopeValues[p.scope])}${p.basis === "assumed" ? ' · <span class="basis">ASSUMED</span>' : ""}</small></button>`;
      return `<button class="act" aria-disabled="true" data-deny="${esc(p.deny)}" title="${esc(p.deny)}"><b>${esc(a.label)}</b><small class="why">Not available: ${esc(p.deny)}</small></button>`;
    }).join("");
    return `<section class="card" style="margin-top:16px"><div class="card-h">Actions for ${esc(App.role(S.role).name)}</div><div class="card-b"><div class="actions-grid">${cells}</div>
      <p class="note">Disabled actions show why. Permissions come from data/model.json (same matrix as the Word document).</p></div></section>`;
  };

  /* ---------- journey (model driven) ---------- */
  App.views = {};
  App.views.journey = tab => {
    const steps = M.journey.steps.map((s, i) => {
      const mine = s.actions.filter(a => App.can(a));
      const on = mine.length > 0;
      return `<article class="step ${on ? "on" : "off"}" aria-label="Step ${i + 1}: ${esc(s.label)}${on ? " (your role acts here)" : ""}">
        <span class="n">${i + 1}</span><h3>${esc(s.label)}</h3>
        ${s.statuses.length ? `<p>Statuses: ${s.statuses.map(x => esc(x)).join(", ")}</p>` : ""}
        <p class="note">Screens: ${s.screens.length ? s.screens.map(x => typeof x === "number" ? String(x).padStart(2, "0") : x).join(", ") : "none in the input"}</p>
        <p class="note">Who acts: ${esc(M.roles.filter(r => s.actions.some(a => M.permissions[r.id][a].scope)).map(r => App.shortLabel(r.id)).join(", ") || "–")}</p>
        <div class="you">${on ? "What you do here:" : "Not your step"}</div>
        ${on ? `<ul>${mine.map(a => `<li>${esc(App.action(a).label)} <span class="note">(${esc(App.perm(S.role, a).scope)})</span></li>`).join("")}</ul>` : ""}
      </article>`;
    }).join("");
    const esc_rule = M.escalation.rules[S.role];
    return App.pageHead("Appointment journey", { basis: "proposed" }) + App.scopeBanner({ bd: false, crumbs: false }) +
      `<p class="note" style="margin-top:-6px">Highlighted steps are the ones this role touches. Lead stages are observed; the order of steps and status transitions are Proposed.</p>
      <div class="journey">${steps}</div>
      ${esc_rule ? `<p class="callout" style="margin-top:14px"><b>Escalation${M.escalation.basis === "user" ? "" : " (Proposed)"}:</b> ${esc(esc_rule)}.</p>` : ""}
      <section class="card lifecycle" style="margin-top:16px"><div class="card-h">Appointment status lifecycle <span class="badge proposed" style="margin-left:8px">Transitions proposed</span></div>
      <div class="card-b">${App.lifecycleSvg()}${App.transitionsTable()}</div></section>`;
  };
  App.lifecycleSvg = () => {
    // Layout: main path on top, recovery states below; curves are routed to avoid crossings.
    const pos = { booked: [100, 120], confirmed: [330, 120], reported: [560, 120], rescheduled: [215, 250], no_show: [445, 250], cancelled: [690, 250] };
    const node = id => { const s = App.statusMeta(id), [x, y] = pos[id];
      return `<g><rect x="${x - 70}" y="${y - 22}" width="140" height="44" rx="22" fill="#fff" stroke="${s.color}" stroke-width="2"/>
        <text x="${x}" y="${y + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${s.color}">${esc(s.label)}</text></g>`; };
    const edgePt = (from, to) => { const [x1, y1] = pos[from], [x2, y2] = pos[to], dx = x2 - x1, dy = y2 - y1;
      const t = Math.min(dx ? 74 / Math.abs(dx) : 1e9, dy ? 26 / Math.abs(dy) : 1e9); return [x1 + dx * t, y1 + dy * t]; };
    const line = (f, t, both) => { const [ax, ay] = edgePt(f, t), [bx, by] = edgePt(t, f);
      return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" ${both ? 'marker-start="url(#arr)"' : ""} marker-end="url(#arr)"/>`; };
    const has = (f, t) => M.lifecycle.transitions.some(x => x.from === f && x.to === t);
    const done = new Set(), out = [];
    const custom = {
      "booked>no_show": `<path d="M85 142 C 40 330, 380 330, 425 274" marker-end="url(#arr)"/>`
    };
    M.lifecycle.transitions.filter(t => t.from).forEach(t => {
      const k = t.from + ">" + t.to; if (done.has(k)) return; done.add(k);
      if (custom[k]) return out.push(custom[k]);
      const back = has(t.to, t.from); if (back) done.add(t.to + ">" + t.from);
      out.push(line(t.from, t.to, back));
    });
    return `<svg viewBox="0 30 800 300" role="img" aria-label="Lifecycle: ${esc(M.lifecycle.transitions.filter(t => t.from).map(t => App.statusMeta(t.from).label + " to " + App.statusMeta(t.to).label).join("; "))}">
      <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#8a93a3"/></marker></defs>
      <g fill="none" stroke="#8a93a3" stroke-width="1.6" stroke-dasharray="5 4">${out.join("")}</g>${Object.keys(pos).map(node).join("")}
      <text x="12" y="320" font-size="11" fill="#5b6474">Dashed arrows = proposed transitions. Two-headed arrow = both directions.</text></svg>`;
  };
  App.transitionsTable = () => `<div class="table-wrap" style="margin-top:12px"><table><caption class="sr-only">Status transitions</caption>
    <thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Trigger</th><th scope="col">Basis</th></tr></thead><tbody>
    ${M.lifecycle.transitions.map(t => `<tr><td>${t.from ? esc(App.statusMeta(t.from).label) : "(call outcome Appt. Booked)"}</td><td>${esc(App.statusMeta(t.to).label)}</td><td>${esc(t.trigger)}</td><td>Proposed</td></tr>`).join("")}
    </tbody></table></div>`;

  /* ---------- permission matrix (model driven) ---------- */
  App.views.matrix = tab => {
    const roles = M.roles.map(r => r.id);
    const head = roles.map(id => `<th scope="col" class="${id === S.role ? "cur" : ""}" title="${esc(App.role(id).name)}">${App.shortLabel(id)}${App.role(id).inSwitcher === false ? "†" : ""}</th>`).join("");
    const rows = M.actions.map(a => `<tr><th scope="row" style="background:none;font-weight:600">${esc(a.label)}${a.basis === "assumed" ? ' <span class="basis">ASSUMED</span>' : ""}</th>${roles.map(id => {
      const p = App.perm(id, a.id), cur = id === S.role ? " cur" : "";
      return p.scope ? `<td class="yes${cur}">✓ ${esc(p.scope)}${p.basis === "assumed" ? "*" : ""}</td>` : `<td class="no${cur}" title="${esc(p.deny)}">–<small>${esc(p.deny)}</small></td>`;
    }).join("")}</tr>`).join("");
    return App.pageHead("Permission matrix", { basis: "" }) +
      `<p class="note">Roles as columns, actions as rows. ✓ shows the data scope; * marks an assumed permission; – shows the reason it is not available. Same matrix as <code>data/model.json</code> and the Word document. Your role's column is highlighted. † Workshop Service Advisor is not in the role switcher (no screen in the input).</p>
      <div class="table-wrap matrix"><table><caption class="sr-only">Role by action permission matrix</caption><thead><tr><th scope="col">Action</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  };

  /* ---------- events (delegated) ---------- */
  App.handlers = {};
  App.start = () => {
    S.unit = App.home(S.role); S.tab = App.mod().tabs(S.role)[0].id;
    document.addEventListener("click", e => {
      const t = e.target.closest("[data-role],[data-tab],[data-unit],[data-bd],[data-act],[data-h]");
      if (!t) return;
      if (t.dataset.role) return App.setRole(t.dataset.role);
      if (t.dataset.tab) return App.go(t.dataset.tab);
      if (t.dataset.unit) return App.drill(t.dataset.unit);
      if (t.dataset.bd) { S.bd = t.dataset.bd; S.page = 1; return App.render(); }
      if (t.dataset.act) { if (t.getAttribute("aria-disabled") === "true") return App.toast(t.dataset.deny); return App.mod().doAction(t.dataset.act, t); }
      if (t.dataset.h) { const fn = App.handlers[t.dataset.h]; if (fn) fn(t, e); }
    });
    document.addEventListener("change", e => { const t = e.target.closest("[data-hc]"); if (t && App.handlers[t.dataset.hc]) App.handlers[t.dataset.hc](t, e); });
    document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("[data-enter]")) { const fn = App.handlers[e.target.dataset.enter]; fn && fn(e.target, e); } });
    App.render();
  };
})();
