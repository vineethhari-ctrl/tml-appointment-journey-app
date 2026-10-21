/* Appointment module: observed screens (01, 02, 04, 07, 11, 17, 18/19, 20) recreated with
   placeholder data, and proposed TML / Dealer GM screens (P1 to P5). All changes are in memory only. */
(function () {
  const App = window.App, M = App.M, D = App.D, S = App.state, esc = App.esc, U = D.units;
  const H = App.handlers;
  const PAGE = 10;
  const OPEN = ["booked", "confirmed", "rescheduled"];
  const today = D.today;
  const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const proposedScreen = role => M.screens.proposed.find(p => p.role === role);
  const dealerOf = () => App.dealersUnder(S.unit)[0];
  const dealerStaff = (dealer, role) => D.staff.filter(s => s.dealer === dealer && (!role || s.role === role));
  const ownerRole = lvl => ({ region: "RSM", zone: "ZSM", area: "RCSM", dealer: "DGM", division: "DGM" }[lvl]);
  D.settings = D.settings || {};

  /* ---------- tabs per role ---------- */
  const T = (id, label, view, basis, screen, sub) => ({ id, label, view, basis, screen, sub });
  const common = [T("journey", "Journey", "journey", "proposed", "", "Lifecycle and your steps"), T("matrix", "Permission matrix", "matrix", "", "", "All roles × actions")];
  const tabs = role => {
    const p = proposedScreen(role);
    switch (role) {
      case "NSM": case "RSM": case "ZSM": case "RCSM": return [
        T("overview", role === "RCSM" ? "Area Appointment Control" : "Appointment Overview", "overview", "proposed", p.id, "Proposed · " + p.id),
        T("list", "Appointment List", "list", "proposed", p.id, "Proposed · drill-down list"),
        ...(role === "RCSM" ? [T("exceptions", "Exceptions & Reassignment", "exceptions", "proposed", "P4", "Proposed · approvals")] : []), ...common];
      case "DGM": return [T("overview", "Dealer Oversight", "overview", "proposed", "P5", "Proposed · P5"), T("list", "Appointment List", "list", "proposed", "P5", "Proposed · dealer list"), ...common];
      case "CRM": return [T("dash", "CRM Call Control Dashboard", "crmDash", "observed", 1, "Observed · screen 01"),
        T("appt", "Lead Assignment: Appointment List", "crmAppt", "observed", 7, "Observed · screen 07"),
        T("due", "Service Due Leads", "dueLeads", "observed", 2, "Observed · screen 02"), ...common];
      case "CRE": return [T("calling", "Calling List: Appointment List", "creAppt", "observed", 11, "Observed · screen 11"),
        T("tele", "Tele-Caller Dashboard", "teleDash", "observed", 20, "Observed · screen 20"),
        T("search", "Customer Search", "custSearch", "observed", 4, "Observed · screen 04"), ...common];
      case "DSA": return [T("workshop", "Workshop Configuration", "workshop", "observed", 17, "Observed · screen 17 (Smart Slot)"),
        T("employee", "Employee Info", "employee", "observed", 18, "Observed · screens 18 / 19"), ...common];
    }
  };

  /* ---------- shared table pieces ---------- */
  const pager = total => {
    const pages = Math.max(1, Math.ceil(total / PAGE)); if (S.page > pages) S.page = pages;
    return `<nav class="pager" aria-label="Pages"><button class="btn small" id="pg-prev" data-h="page" data-p="${S.page - 1}" ${S.page <= 1 ? "disabled" : ""}>‹ Prev</button>
      <span class="note">Page ${S.page} of ${pages}</span><button class="btn small" id="pg-next" data-h="page" data-p="${S.page + 1}" ${S.page >= pages ? "disabled" : ""}>Next ›</button></nav>`;
  };
  const pageRows = rows => rows.slice((S.page - 1) * PAGE, S.page * PAGE);
  const showing = (n, extra = "") => `Showing ${n ? (S.page - 1) * PAGE + 1 : 0} to ${Math.min(S.page * PAGE, n)} of ${n} entries${extra}`;
  const table = (cols, rows, caption, foot = "") => `<div class="table-wrap"><table><caption class="sr-only">${esc(caption)}</caption>
    <thead><tr>${cols.map(c => `<th scope="col" class="${c.num ? "num" : ""}">${c.h}</th>`).join("")}</tr></thead>
    <tbody>${rows.length ? rows.map(r => `<tr>${cols.map(c => `<td class="${c.num ? "num" : ""}${c.wrap ? " wrap" : ""}">${c.f(r)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${cols.length}" class="note">No records in this scope.</td></tr>`}</tbody>${foot}</table></div>`;
  const sel = (id, label, opts, value) => `<label for="${id}">${esc(label)}<select id="${id}" data-hc="filter" data-f="${id.replace("f-", "")}">
    <option value="">${esc(label)}</option>${opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${value === v ? "selected" : ""}>${esc(t)}</option>`; }).join("")}</select></label>`;
  const inp = (id, label, value, type = "text") => `<label for="${id}">${esc(label)}<input id="${id}" type="${type}" value="${esc(value || "")}" placeholder="${esc(label)}" data-hc="filter" data-enter="filterEnter" data-f="${id.replace("f-", "")}"></label>`;
  const filterBtns = () => `<button class="btn" data-h="clear">Clear</button><button class="btn primary" data-h="search">Search</button>`;
  const leadTabs = active => `<div class="lead-tabs" role="list">${["Service Due Leads", "Appointment List", "PSF Leads", "Product Leads", active === "cre" ? "Campaign Leads" : "Updation Campaign", "Lost Customer"].map(t =>
    t === "Appointment List" ? `<span role="listitem" class="lead-tab active" aria-current="true">${t}</span>` : `<button role="listitem" class="lead-tab" disabled title="Other lead type: outside the Appointment scope">${t}</button>`).join("")}</div>`;
  const fullName = s => esc(s);
  const ownAppts = user => D.appointments.filter(a => a.reminderAssignedTo === user || a.bookedBy === user);

  /* ---------- PROPOSED: TML overview (P1-P4) and Dealer GM oversight (P5) ---------- */
  const views = {};
  views.overview = tab => {
    const u = U[S.unit], m = App.metrics(S.unit), p = proposedScreen(S.role);
    const title = S.role === "RCSM" ? "AREA APPOINTMENT CONTROL" : S.role === "DGM" ? "DEALER APPOINTMENT OVERSIGHT" : "APPOINTMENT OVERVIEW · " + App.levelLabel(u.level).toUpperCase();
    const st = M.appointmentStatuses.map(s => ({ label: s.label, value: m[s.id], color: s.color }));
    const allBd = App.metrics(S.unit, "All"), pv = App.metrics(S.unit, "PV"), ev = App.metrics(S.unit, "EV");
    let html = App.pageHead(title, tab) + App.scopeBanner() +
      `<div class="grid g4">${App.stat("📋", m.leads, "Service due leads")}${App.stat("📅", m.appts, "Appointments booked", "var(--purple)")}
       ${App.stat("✅", m.showRate + "%", "Show rate (Reported / Reported + No Show)", "var(--green)")}
       ${App.stat("🎯", m.target == null ? "n/a" : `${m.appts}/${m.target}`, "Appointments vs target", "var(--amber-t)")}</div>
      <div class="grid g3">${App.donutCard("Appointment status", st, m.appts, "Appointments")}
       ${App.donutCard("Service due leads", [{ label: "Assigned", value: m.assigned, color: "var(--green)" }, { label: "Unassigned", value: m.unassigned, color: "var(--amber)" }], m.leads, "Total leads",
          App.bars([{ label: "Attempted", pct: App.pct(m.attempted, m.assigned), text: `${m.attempted}`, color: "var(--blue)" },
                    { label: "Contacted", pct: App.pct(m.contacted, m.assigned), text: `${m.contacted}`, color: "var(--green)" },
                    { label: "Appt. booked", pct: App.pct(m.appts, m.assigned), text: `${m.appts}`, color: "var(--purple)" }]).replace('class="bars"', 'class="bars" style="margin-top:14px"'))}
       ${App.donutCard("Business division (PV/EV)", [{ label: "PV appointments", value: pv.appts, color: "var(--blue)" }, { label: "EV appointments", value: ev.appts, color: "var(--green)" }], allBd.appts, "All divisions",
          `<p class="note" style="margin-top:10px">Split shown for All; the filter above narrows every other figure.</p>`)}</div>`;
    if (u.children.length) html += breakdown(u, m);
    if (S.role === "DGM") html += workload(dealerOf());
    return html + App.actionsPanel();
  };
  const breakdown = (u, m) => {
    const kids = u.children.map(id => ({ id, m: App.metrics(id) }));
    const keys = ["leads", "unassigned", "appts", ...M.appointmentStatuses.map(s => s.id)];
    const canDrill = App.can("drill_down");
    const sumOk = keys.every(k => kids.reduce((s, k2) => s + k2.m[k], 0) === m[k]) &&
      (kids[0].m.target == null || kids.reduce((s, k) => s + k.m.target, 0) === m.target);
    const childLvl = App.levelLabel(U[u.children[0]].level);
    const cols = [{ h: childLvl, f: r => canDrill ? `<button class="row-btn" data-unit="${r.id}" aria-label="Drill down into ${esc(U[r.id].name)}">${esc(U[r.id].name)}</button>` : esc(U[r.id].name) },
      { h: "Service due leads", num: 1, f: r => r.m.leads }, { h: "Unassigned", num: 1, f: r => r.m.unassigned }, { h: "Appointments", num: 1, f: r => r.m.appts },
      ...M.appointmentStatuses.map(s => ({ h: s.label, num: 1, f: r => r.m[s.id] })),
      { h: "Show rate", num: 1, f: r => r.m.showRate + "%" }, { h: "Target", num: 1, f: r => r.m.target ?? "–" },
      { h: "Achieved", num: 1, f: r => r.m.target ? App.pct(r.m.appts, r.m.target) + "%" : "–" }];
    const foot = `<tfoot><tr><td>Total ${esc(u.name)}</td><td class="num">${m.leads}</td><td class="num">${m.unassigned}</td><td class="num">${m.appts}</td>
      ${M.appointmentStatuses.map(s => `<td class="num">${m[s.id]}</td>`).join("")}<td class="num">${m.showRate}%</td><td class="num">${m.target ?? "–"}</td><td class="num">${m.target ? App.pct(m.appts, m.target) + "%" : "–"}</td></tr></tfoot>`;
    return `<section class="card" style="margin-bottom:16px"><div class="card-h">By ${esc(childLvl)} ${sumOk ? `<span class="check-ok link">✓ Rows add up to the ${esc(App.levelLabel(u.level).toLowerCase())} total</span>` : `<span class="check-bad link">✗ Roll-up mismatch</span>`}</div>
      <div class="card-b" style="padding:0">${table(cols, kids, "Breakdown by " + childLvl, foot)}</div></section>
      ${canDrill ? `<p class="note">Select a name to drill down. Use the path in the scope bar to go back up (not above your own scope).</p>` : ""}`;
  };
  const workload = dealer => {
    const rows = dealerStaff(dealer).map(s => ({ s,
      leads: D.leads.filter(l => l.assignedTo === s.id && App.bdOk(l)).length,
      notAttempted: D.leads.filter(l => l.assignedTo === s.id && l.callStatus === "Not Attempted" && App.bdOk(l)).length,
      booked: D.leads.filter(l => l.assignedTo === s.id && l.outcome === "Appt. Booked" && App.bdOk(l)).length,
      reminders: D.appointments.filter(a => a.reminderAssignedTo === s.id && OPEN.concat("no_show").includes(a.status) && App.bdOk(a)).length }));
    const cols = [{ h: "Staff", f: r => esc(r.s.id) }, { h: "Role", f: r => r.s.role }, { h: "Assigned leads", num: 1, f: r => r.leads },
      { h: "Not attempted", num: 1, f: r => r.notAttempted }, { h: "Appts booked", num: 1, f: r => r.booked }, { h: "Open reminder / no-show calls", num: 1, f: r => r.reminders }];
    return `<section class="card"><div class="card-h">CRE / CRM workload <span class="link"><button class="btn small" data-act="reassign_staff" ${App.can("reassign_staff") ? "" : 'aria-disabled="true"'}>Reassign between CRE and CRM</button></span></div>
      <div class="card-b" style="padding:0">${table(cols, rows, "Staff workload")}</div></section>`;
  };

  /* ---------- PROPOSED: appointment list for TML / Dealer GM ---------- */
  const filterAppts = base => base.filter(a => {
    const f = S.filters, q = (f.q || "").toLowerCase();
    return (!q || [a.customer, a.mobile, a.reg, a.id].some(x => x.toLowerCase().includes(q))) && (!f.status || a.status === f.status) && (!f.channel || a.channel === f.channel);
  });
  views.list = tab => {
    const rows = filterAppts(D.appointments.filter(a => App.inScope(a) && App.bdOk(a))).sort((a, b) => b.date.localeCompare(a.date));
    App._exportRows = rows;
    const cols = [{ h: "Lead ID", f: r => r.id }, { h: "Customer Name", f: r => esc(r.customer) }, { h: "Mobile No.", f: r => r.mobile }, { h: "Reg No.", f: r => r.reg },
      { h: "PPL", f: r => esc(r.ppl) }, { h: "PL", f: r => esc(r.pl) }, { h: "Service Type", f: r => r.serviceType }, { h: "Appt. Date &amp; Time", f: r => `${App.fmtDate(r.date)} ${r.time}` },
      { h: "Channel", f: r => r.channel }, { h: "Status", f: r => App.statusChip(r.status) }, { h: "Dealer", f: r => r.dealer }, { h: "Division", f: r => r.division }, { h: "Business division", f: r => App.bdTag(r.bd) },
      ...(App.can("view_360") ? [{ h: "Action", f: r => `<button class="btn small" data-h="v360" data-mobile="${r.mobile}">View 360 →</button>` }] : [])];
    return App.pageHead("Appointment List · " + U[S.unit].name, tab) + App.scopeBanner() +
      `<div class="filters" role="search">${inp("f-q", "Search name, mobile, reg no., lead ID", S.filters.q)}
        ${sel("f-status", "Status", M.appointmentStatuses.map(s => [s.id, s.label]), S.filters.status)}
        ${sel("f-channel", "Channel", ["IRA", "Inbound Call", "Follow-Up"], S.filters.channel)}<span class="grow"></span>${filterBtns()}</div>
      <div class="list-meta">${showing(rows.length)}<span class="right">${App.can("export") ? `<button class="btn" data-act="export">⬇ Export CSV</button>` : ""}</span></div>
      ${table(cols, pageRows(rows), "Appointments")}${pager(rows.length)}` + App.actionsPanel();
  };

  /* ---------- PROPOSED: RCSM exceptions ---------- */
  views.exceptions = tab => {
    const area = App.ancestors(S.unit).find(id => U[id].level === "area") || App.home();
    const rows = D.exceptions.filter(x => x.area === area);
    const can = App.can("approve_exception");
    const detail = x => x.type.startsWith("Dealer") ? `Move ${x.count} unassigned leads ${x.from} → ${x.to}` : `${x.dealer} ${x.bd} target ${x.from} → ${x.to}`;
    const cols = [{ h: "ID", f: x => x.id }, { h: "Type", wrap: 1, f: x => esc(x.type) }, { h: "Raised by", f: x => esc(x.raisedBy) }, { h: "Details", wrap: 1, f: detail },
      { h: "Reason", wrap: 1, f: x => esc(x.reason) }, { h: "Status", f: x => App.chip(x.status, x.status === "Pending" ? "amber" : x.status === "Approved" ? "green" : "grey") },
      { h: "Decision", f: x => x.status !== "Pending" ? "–" : `<button class="btn small primary" data-h="exc" data-id="${x.id}" data-d="Approved" ${can ? "" : "disabled"}>Approve</button>
        <button class="btn small" data-h="exc" data-id="${x.id}" data-d="Rejected" ${can ? "" : "disabled"}>Reject</button>` }];
    return App.pageHead("Exceptions & Reassignment", tab) + App.scopeBanner({ bd: false }) +
      `<p class="callout">Exceptions are raised by Dealer GMs in ${esc(U[area].name)} (dealer-to-dealer reassignment requests and target change requests) and approved by the RCSM. Approving applies the change to the data.</p>
      ${table(cols, rows, "Exception requests")}
      <div style="margin:16px 0"><button class="btn primary" data-act="reassign_dealers">Reassign leads between dealers…</button></div>` + App.actionsPanel();
  };

  /* ---------- OBSERVED 07: Lead Assignment : Appointment List ---------- */
  views.crmAppt = tab => {
    const base = D.appointments.filter(a => App.inScope(a) && App.bdOk(a));
    const calls = base.filter(a => a.callType !== "-");
    const kpi = S.filters.kpi || "unassigned";
    const scheduled = base.filter(a => a.date >= today && OPEN.includes(a.status));
    const f = S.filters;
    let rows = kpi === "scheduled" ? scheduled : calls.filter(a => kpi === "assigned" ? a.reminderAssignedTo : !a.reminderAssignedTo);
    rows = rows.filter(a => (!f.workshop || a.division === f.workshop) && (!f.calltype || a.callType === f.calltype) && (!f.date || a.date === f.date)
      && (!f.variant || a.pl.toLowerCase().includes(f.variant.toLowerCase())) && (!f.assignee || a.reminderAssignedTo === f.assignee));
    App._exportRows = rows;
    const dealer = dealerOf(), cres = dealerStaff(dealer, "CRE").map(s => s.id);
    const pr = pageRows(rows), allSel = pr.length && pr.every(r => S.selected.has(r.id));
    const canAssign = App.can("assign");
    const cols = [{ h: `<input type="checkbox" aria-label="Select all on page" data-h="selall" ${allSel ? "checked" : ""} ${canAssign ? "" : "disabled"}>`, f: r => `<input type="checkbox" aria-label="Select ${esc(r.customer)}" data-h="sel" data-id="${r.id}" ${S.selected.has(r.id) ? "checked" : ""} ${canAssign ? "" : "disabled"}>` },
      { h: "Customer Name", f: r => esc(r.customer) }, { h: "Mobile No.", f: r => r.mobile }, { h: "Reg No.", f: r => r.reg }, { h: "PPL", f: r => esc(r.ppl) }, { h: "PL", f: r => esc(r.pl) },
      { h: "Service Type", f: r => r.serviceType }, { h: "Call Type", f: r => r.callType === "-" ? "-" : App.chip(r.callType, r.callType === "Reminder" ? "amber" : "red") },
      { h: "Appt Booking<br>Date &amp; Time", f: r => `${App.fmtDate(r.date)}<br>${r.time}` }, { h: "Channel", f: r => App.chip(r.channel, "purple") },
      { h: "Assignment<br>Status", f: r => r.reminderAssignedTo ? `${App.chip("Assigned", "green")} <span class="note">${esc(r.reminderAssignedTo)}</span>` : App.chip("Unassigned", "red") },
      { h: "Call Status", f: r => r.reminderCallStatus === "-" ? "-" : App.chip(r.reminderCallStatus, r.reminderCallStatus === "Attempted" ? "green" : "red") }];
    const k = (id, n, label, color) => `<button class="kpi-tab" id="kpi-${id}" data-h="kpi" data-k="${id}" aria-pressed="${kpi === id}"><b style="color:${color}">${n}</b>${label}</button>`;
    return App.pageHead("Lead Assignment : Appointment List", tab) + App.scopeBanner({ bdLabel: "Vehicle (All / PV / EV)" }) + leadTabs("crm") +
      `<div class="kpi-tabs">${k("unassigned", calls.filter(a => !a.reminderAssignedTo).length, "Unassigned", "var(--red)")}${k("assigned", calls.filter(a => a.reminderAssignedTo).length, "Assigned", "var(--green)")}${k("scheduled", scheduled.length, "Appt. Scheduled", "var(--blue)")}</div>
      <div class="filters" role="search">${sel("f-workshop", "Workshop", U[dealer].children, f.workshop)}${sel("f-calltype", "Call Type", ["Reminder", "No show"], f.calltype)}
        ${inp("f-date", "Appt. Date", f.date, "date")}${inp("f-variant", "Variant", f.variant)}${sel("f-assignee", "Assigned To", cres, f.assignee)}<span class="grow"></span>${filterBtns()}${App.ui.iconBtns()}</div>
      <div class="list-meta">${showing(rows.length, S.selected.size ? ` · ${S.selected.size} selected` : "")}<span class="right">
        <button class="btn primary" data-h="bulkAppt" ${canAssign ? "" : "disabled"}>Bulk Assign</button></span></div>
      ${table(cols, pr, "Appointment list for reminder and no-show calls")}${pager(rows.length)}` + App.actionsPanel();
  };

  /* ---------- OBSERVED 11: Calling List (CRE) ---------- */
  const priority = a => OPEN.includes(a.status) && daysBetween(today, a.date) <= 2 && a.date >= today ? "High" : "Normal";
  views.creAppt = tab => {
    const user = App.user(), f = S.filters, kpi = f.kpi || "all";
    const mine = ownAppts(user).filter(App.bdOk);
    let rows = kpi === "reminder" ? mine.filter(a => a.callType === "Reminder") : kpi === "noshow" ? mine.filter(a => a.status === "no_show") : mine;
    rows = rows.filter(a => (!f.stype || a.serviceType === f.stype) && (!f.ddate || a.serviceDueDate === f.ddate) && (!f.status || a.status === f.status) && (!f.prio || priority(a) === f.prio))
      .sort((a, b) => a.date.localeCompare(b.date));
    const cols = [{ h: "Customer Name", f: r => `<button class="row-btn plain" data-h="call" data-id="${r.id}" aria-label="Call ${esc(r.customer)}">${esc(r.customer)}</button>` },
      { h: "Mobile No.", f: r => r.mobile }, { h: "Reg No.", f: r => r.reg }, { h: "Model", f: r => esc(r.ppl) }, { h: "Service Type", f: r => r.serviceType },
      { h: "Service Due Date", f: r => App.fmtDate(r.serviceDueDate) }, { h: "Service Due Kms", f: r => r.serviceDueKms }, { h: "Appt. Date &amp; Time", f: r => `${App.fmtDate(r.date)}<br>${r.time}` },
      { h: "Status", f: r => App.statusChip(r.status) }, { h: "Last Action", f: r => App.fmtDate(r.lastAction) }];
    const k = (id, n, label, color) => `<button class="kpi-tab" id="kpi-${id}" data-h="kpi" data-k="${id}" aria-pressed="${kpi === id}"><b style="color:${color}">${n}</b>${label}</button>`;
    return App.pageHead("Calling List : Service Due Reminder", tab) + App.scopeBanner({ crumbs: false, bdLabel: "Vehicle (All / PV / EV)" }) + leadTabs("cre") +
      `<div class="kpi-tabs">${k("all", mine.length, "Total Appt. Booked", "var(--blue)")}${k("reminder", mine.filter(a => a.callType === "Reminder").length, "Reminder", "var(--amber-t)")}${k("noshow", mine.filter(a => a.status === "no_show").length, "No Show", "var(--purple)")}</div>
      <div class="filters" role="search">${sel("f-stype", "Service Type", ["Paid Service", "Free Service"], f.stype)}${inp("f-ddate", "Service Due Date", f.ddate, "date")}
        ${sel("f-status", "Status", M.appointmentStatuses.map(s => [s.id, s.label]), f.status)}${sel("f-prio", "Priority", ["High", "Normal"], f.prio)}<span class="grow"></span>${filterBtns()}${App.ui.iconBtns()}</div>
      <div class="list-meta">${showing(rows.length)} · select a customer name to call<span class="right"><button class="btn primary" data-act="book">+ Book appointment</button></span></div>
      ${table(cols, pageRows(rows), "My appointment calling list")}${pager(rows.length)}` + App.actionsPanel();
  };

  /* ---------- list handlers ---------- */
  H.page = t => { S.page = +t.dataset.p; App.render(); };
  H.kpi = t => { S.filters.kpi = t.dataset.k; S.page = 1; S.selected.clear(); App.render(); };
  H.filter = t => { S.filters[t.dataset.f] = t.value; S.page = 1; App.render(); };
  H.filterEnter = t => H.filter(t);
  H.clear = () => { const k = S.filters.kpi; S.filters = k ? { kpi: k } : {}; S.page = 1; App.render(); };
  H.search = () => { document.querySelectorAll("[data-f]").forEach(el => S.filters[el.dataset.f] = el.value); S.page = 1; App.render(); };
  H.sel = t => { t.checked ? S.selected.add(t.dataset.id) : S.selected.delete(t.dataset.id); App.render(); };
  H.selall = t => { document.querySelectorAll('input[data-h="sel"]').forEach(c => t.checked ? S.selected.add(c.dataset.id) : S.selected.delete(c.dataset.id)); App.render(); };
  const assignModal = (ids, apply) => {
    if (!ids.length) return App.toast("Select one or more rows first");
    const cres = dealerStaff(dealerOf(), "CRE");
    App.modal(`Bulk Assign (${ids.length})`, `<label class="field" for="m-cre">Assign to CRE<select id="m-cre">${cres.map(c => `<option>${esc(c.id)}</option>`).join("")}</select></label>`,
      [{ label: "Cancel" }, { label: "Assign", primary: true, onClick: r => { const to = r.querySelector("#m-cre").value; ids.forEach(id => apply(id, to)); S.selected.clear(); App.render(); App.toast(`${ids.length} assigned to ${to}`); } }]);
  };
  H.bulkAppt = () => assignModal([...S.selected], (id, to) => { const a = D.appointments.find(x => x.id === id); a.reminderAssignedTo = to; if (a.reminderCallStatus === "-") a.reminderCallStatus = "Not Attempted"; });
  H.bulkLeads = () => assignModal([...S.selected], (id, to) => { D.leads.find(x => x.id === id).assignedTo = to; });

  /* ---------- CRE call handling ---------- */
  H.call = t => {
    const a = D.appointments.find(x => x.id === t.dataset.id);
    const opts = [];
    if (["booked", "rescheduled"].includes(a.status) && App.can("remind_confirm")) opts.push(["confirm", "Reminder call: customer confirms"]);
    if (a.status === "no_show" && App.can("noshow_followup")) opts.push(["reschedule", "No-show follow-up: reschedule"]);
    if (OPEN.includes(a.status) && App.can("reschedule_cancel")) opts.push(["reschedule", "Reschedule"]);
    if ([...OPEN, "no_show"].includes(a.status) && App.can("reschedule_cancel")) opts.push(["cancel", a.status === "no_show" ? "Cancel (Not Interested)" : "Cancel"]);
    opts.push(["noanswer", "Not contacted (log attempt only)"]);
    const uniq = opts.filter((o, i) => opts.findIndex(x => x[1] === o[1]) === i);
    App.modal(`Call ${a.customer}`, `<div>${a.id} · ${App.fmtDate(a.date)} ${a.time} · ${a.channel} · ${App.statusChip(a.status)}</div>
      ${["reported", "cancelled"].includes(a.status) ? '<p class="note">This appointment is closed; no call action.</p>' : `
      <label class="field" for="m-out">Outcome<select id="m-out">${uniq.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></label>
      <label class="field" for="m-date">New date (for reschedule)<input id="m-date" type="date" value="${addDays(today, 2)}" min="${today}"></label>`}`,
      ["reported", "cancelled"].includes(a.status) ? undefined : [{ label: "Cancel" }, { label: "Save outcome", primary: true, onClick: r => {
        const o = r.querySelector("#m-out").value; a.reminderCallStatus = "Attempted"; a.lastAction = today;
        if (o === "confirm") { a.status = "confirmed"; a.callType = "-"; }
        if (o === "reschedule") { a.status = "rescheduled"; a.date = r.querySelector("#m-date").value || addDays(today, 2); a.callType = "Reminder"; }
        if (o === "cancel") { a.status = "cancelled"; a.callType = "-"; }
        App.render(); App.toast(`${a.id}: ${o === "noanswer" ? "attempt logged" : "status " + App.statusMeta(a.status).label}`);
      } }]);
  };
  const callLeadModal = (preset) => {
    const user = App.user();
    const leads = D.leads.filter(l => l.assignedTo === user && !l.apptId && (preset ? l.outcome === "Call Back" || !l.outcome : true)).slice(0, 40);
    if (!leads.length) return App.toast("No open leads assigned to you");
    const outs = ["Appt. Booked", "Call Back", "Not Interested", "Wrong No.", "Service Enquiry", "Not Contacted"];
    App.modal(preset ? "Book appointment" : "Call customer and log outcome", `<label class="field" for="m-lead">Lead<select id="m-lead">${leads.map(l => `<option value="${l.id}">${esc(l.customer)} · ${l.reg} · ${esc(l.outcome || l.callStatus)}</option>`).join("")}</select></label>
      <label class="field" for="m-o">Outcome<select id="m-o">${outs.map(o => `<option ${o === (preset || "") ? "selected" : ""}>${o}</option>`).join("")}</select></label>
      <div class="form-grid"><label class="field" for="m-d">Appt. date<input id="m-d" type="date" value="${addDays(today, 3)}" min="${today}"></label>
      <label class="field" for="m-t">Time<select id="m-t">${["09:30", "10:30", "11:00", "12:00", "14:30", "16:00"].map(x => `<option>${x}</option>`).join("")}</select></label>
      <label class="field" for="m-c">Channel<select id="m-c"><option>Inbound Call</option><option>IRA</option><option>Follow-Up</option></select></label></div>
      <p class="note">Date, time and channel apply when the outcome is Appt. Booked. Slot capacity comes from the workshop's Smart Slot.</p>`,
      [{ label: "Cancel" }, { label: "Save", primary: true, onClick: r => {
        const l = D.leads.find(x => x.id === r.querySelector("#m-lead").value), o = r.querySelector("#m-o").value;
        l.callStatus = "Attempted"; l.contact = o === "Not Contacted" ? "Not Contacted" : "Contacted"; l.outcome = o === "Not Contacted" ? null : o;
        if (o === "Appt. Booked") {
          const id = "APP-" + (1001 + D.appointments.length);
          D.appointments.push({ id, leadId: l.id, dealer: l.dealer, division: l.division, bd: l.bd, customer: l.customer, mobile: l.mobile, reg: l.reg, ppl: l.ppl, pl: l.pl,
            serviceType: l.serviceType, serviceDueDate: l.dueDate, serviceDueKms: l.dueKms, date: r.querySelector("#m-d").value || addDays(today, 3), time: r.querySelector("#m-t").value,
            channel: r.querySelector("#m-c").value, status: "booked", callType: "Reminder", reminderAssignedTo: user, reminderCallStatus: "Not Attempted", bookedBy: user, lastAction: today });
          l.apptId = id; App.render(); App.toast(`${id} booked for ${l.customer}`);
        } else { App.render(); App.toast(`Outcome logged: ${o}`); }
      } }]);
  };

  /* ---------- proposed TML / Dealer GM modals ---------- */
  const moveLeads = (from, to, count) => {
    const toDiv = U[to].children[0]; let n = 0;
    D.leads.filter(l => l.dealer === from && !l.assignedTo && !l.apptId).slice(0, count).forEach(l => { l.dealer = to; l.division = toDiv; n++; });
    return n;
  };
  const areaDealers = () => { const area = App.ancestors(S.unit).find(id => U[id].level === "area") || App.home(); return U[area].children; };
  const reassignDealersModal = () => {
    const ds = areaDealers();
    App.modal("Reassign leads between dealers", `<p class="note">Moves unassigned service-due leads between dealers in your area (for example when one workshop's slots are full).</p>
      <div class="form-grid"><label class="field" for="m-f">From dealer<select id="m-f">${ds.map(d => `<option>${d}</option>`).join("")}</select></label>
      <label class="field" for="m-to">To dealer<select id="m-to">${ds.map((d, i) => `<option ${i === 1 ? "selected" : ""}>${d}</option>`).join("")}</select></label>
      <label class="field" for="m-n">Number of leads<input id="m-n" type="number" min="1" value="5"></label></div>`,
      [{ label: "Cancel" }, { label: "Reassign", primary: true, onClick: r => {
        const f = r.querySelector("#m-f").value, t = r.querySelector("#m-to").value;
        if (f === t) { App.toast("Choose two different dealers"); return false; }
        const n = moveLeads(f, t, +r.querySelector("#m-n").value); App.render(); App.toast(`${n} unassigned leads moved ${f} → ${t}`);
      } }]);
  };
  H.exc = t => {
    const x = D.exceptions.find(e => e.id === t.dataset.id); x.status = t.dataset.d;
    if (x.status === "Approved") { if (x.type.startsWith("Dealer")) moveLeads(x.from, x.to, x.count); else D.targets[x.dealer][x.bd] = x.to; }
    App.render(); App.toast(`${x.id} ${x.status.toLowerCase()}`);
  };
  const reassignStaffModal = () => {
    const staff = dealerStaff(dealerOf());
    App.modal("Reassign between CRE and CRM", `<div class="form-grid"><label class="field" for="m-f">From<select id="m-f">${staff.map(s => `<option>${esc(s.id)}</option>`).join("")}</select></label>
      <label class="field" for="m-to">To<select id="m-to">${staff.map((s, i) => `<option ${i === 1 ? "selected" : ""}>${esc(s.id)}</option>`).join("")}</select></label>
      <label class="field" for="m-n">Max. items<input id="m-n" type="number" min="1" value="5"></label></div>
      <p class="note">Moves leads not yet attempted and open reminder / no-show calls. Appointments themselves do not change.</p>`,
      [{ label: "Cancel" }, { label: "Reassign", primary: true, onClick: r => {
        const f = r.querySelector("#m-f").value, to = r.querySelector("#m-to").value, n = +r.querySelector("#m-n").value;
        if (f === to) { App.toast("Choose two different people"); return false; }
        const ls = D.leads.filter(l => l.assignedTo === f && l.callStatus === "Not Attempted").slice(0, n); ls.forEach(l => l.assignedTo = to);
        const as = D.appointments.filter(a => a.reminderAssignedTo === f && [...OPEN, "no_show"].includes(a.status)).slice(0, n); as.forEach(a => a.reminderAssignedTo = to);
        App.render(); App.toast(`${ls.length} leads and ${as.length} calls moved ${f} → ${to}`);
      } }]);
  };
  const creTargetsModal = () => {
    const dealer = dealerOf(), cres = dealerStaff(dealer, "CRE"), total = D.targets[dealer].PV + D.targets[dealer].EV;
    App.modal("Split dealer target across CREs · " + dealer, `<p class="note">The monthly dealer target (${total} appointments, PV ${D.targets[dealer].PV} + EV ${D.targets[dealer].EV}) is set by the RCSM. Split it across your CREs; the split must add up to ${total}. To change the dealer target itself, escalate a target change request to the RCSM.</p>
      <div class="table-wrap"><table><thead><tr><th>CRE</th><th>Monthly appointment target</th></tr></thead><tbody>
      ${cres.map(c => `<tr><td>${esc(c.id)}</td><td><input aria-label="${esc(c.id)} target" type="number" min="0" data-ct="${esc(c.id)}" value="${D.creTargets[c.id]}" style="width:90px"></td></tr>`).join("")}</tbody></table></div>`,
      [{ label: "Cancel" }, { label: "Save split", primary: true, onClick: r => {
        const vals = [...r.querySelectorAll("[data-ct]")].map(i => [i.dataset.ct, Math.max(0, Math.round(+i.value))]), sum = vals.reduce((a, [, v]) => a + v, 0);
        if (sum !== total) { App.toast(`The split adds up to ${sum}; it must equal the dealer target ${total}`); return false; }
        vals.forEach(([id, v]) => D.creTargets[id] = v); App.render(); App.toast("CRE targets saved (in this demo session)");
      } }]);
  };
  const setTargetsModal = () => {
    if (S.role === "DGM") return creTargetsModal();
    const u = U[S.unit], unitIds = u.level === "dealer" || u.level === "division" ? [dealerOf()] : u.children;
    const tgt = (id, bd) => App.dealersUnder(id).reduce((s, d) => s + D.targets[d][bd], 0);
    App.modal("Set appointment targets · " + u.name, `<p class="note">Monthly appointment targets per Business division for the level below you (${esc((M.targets.rules.find(x => x.role === S.role) || {}).sets || "")}). Setting a target above dealer level spreads it over the dealers in proportion to their current targets, so roll-ups stay consistent.</p>
      <div class="table-wrap"><table><thead><tr><th>Unit</th><th>PV target</th><th>EV target</th></tr></thead><tbody>
      ${unitIds.map(id => `<tr><td>${esc(U[id].name)}</td><td><input aria-label="${esc(U[id].name)} PV target" type="number" min="0" data-t="${id}|PV" value="${tgt(id, "PV")}" style="width:90px"></td>
        <td><input aria-label="${esc(U[id].name)} EV target" type="number" min="0" data-t="${id}|EV" value="${tgt(id, "EV")}" style="width:90px"></td></tr>`).join("")}</tbody></table></div>`,
      [{ label: "Cancel" }, { label: "Save targets", primary: true, onClick: r => {
        r.querySelectorAll("[data-t]").forEach(inp => {
          const [id, bd] = inp.dataset.t.split("|"), want = Math.max(0, Math.round(+inp.value)), ds = App.dealersUnder(id), cur = tgt(id, bd);
          if (want === cur) return;
          const raw = ds.map(d => cur ? want * D.targets[d][bd] / cur : want / ds.length), fl = raw.map(Math.floor);
          let rem = want - fl.reduce((a, b) => a + b, 0);
          raw.map((v, i) => [v - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rem > 0) { fl[i]++; rem--; } });
          ds.forEach((d, i) => D.targets[d][bd] = fl[i]);
        });
        App.render(); App.toast("Targets saved (in this demo session)");
      } }]);
  };
  const escalateModal = () => {
    const u = U[S.unit], isDgm = S.role === "DGM";
    const area = isDgm ? U[dealerOf()].parent : null;
    const units = isDgm ? [] : (u.children.length && u.level !== "dealer" ? u.children : [u.level === "division" ? u.parent : u.id]);
    const types = isDgm ? ["Dealer-to-dealer reassignment request", "Target change request", ...M.escalation.topics] : M.escalation.topics;
    const root = App.modal(isDgm ? "Escalate to RCSM" : "Raise escalation", `<p class="note">${esc(M.escalation.rules[S.role])}.</p>
      ${isDgm ? "" : `<label class="field" for="m-u">Unit<select id="m-u">${units.map(id => `<option value="${id}">${esc(U[id].name)} → ${ownerRole(U[id].level)}</option>`).join("")}</select></label>`}
      <label class="field" for="m-ty">Topic<select id="m-ty">${types.map(x => `<option>${esc(x)}</option>`).join("")}</select></label>
      ${isDgm ? `<div class="form-grid" id="m-reasg"><label class="field" for="m-to">To dealer (reassignment)<select id="m-to">${U[area].children.filter(d => d !== dealerOf()).map(d => `<option>${d}</option>`).join("")}</select></label>
        <label class="field" for="m-n">Leads (reassignment) / new PV target (target change)<input id="m-n" type="number" min="1" value="5"></label></div>` : ""}
      <label class="field" for="m-note">Note<textarea id="m-note" rows="3">Please review.</textarea></label>`,
      [{ label: "Cancel" }, { label: "Send", primary: true, onClick: r => {
        const ty = r.querySelector("#m-ty").value, note = r.querySelector("#m-note").value;
        if (isDgm && ty.endsWith("request")) {
          const id = "EXC-" + String(D.exceptions.length + 1).padStart(3, "0"), d = dealerOf(), n = +r.querySelector("#m-n").value;
          D.exceptions.push(ty.startsWith("Dealer") ? { id, type: ty, area, from: d, to: r.querySelector("#m-to").value, count: n, status: "Pending", raisedBy: "Dealer GM " + d, reason: note }
            : { id, type: ty, area, dealer: d, bd: "PV", from: D.targets[d].PV, to: n, status: "Pending", raisedBy: "Dealer GM " + d, reason: note });
          S.escalations.push({ from: S.role, to: "RCSM", topic: ty }); App.render(); App.toast(`${id} sent to RCSM for approval`); return;
        }
        const to = isDgm ? "RCSM" : ownerRole(U[r.querySelector("#m-u").value].level);
        S.escalations.push({ from: S.role, to, topic: ty }); App.render(); App.toast(`Escalation "${ty}" sent to ${to}`);
      } }]);
    return root;
  };

  /* ---------- CSV export ---------- */
  const exportCsv = () => {
    const rows = App._exportRows || D.appointments.filter(a => App.inScope(a) && App.bdOk(a));
    const cols = ["id", "customer", "mobile", "reg", "ppl", "pl", "serviceType", "date", "time", "channel", "status", "dealer", "division", "bd"];
    const csv = [cols.join(","), ...rows.map(r => cols.map(c => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `appointments_${S.unit}_${S.bd}.csv`; document.body.appendChild(a); a.click(); a.remove();
    App.toast(`Exported ${rows.length} rows (placeholder data)`);
  };

  /* ---------- action dispatcher (actions panel and inline buttons) ---------- */
  const firstTab = () => tabs(S.role)[0].id;
  const hasTab = id => tabs(S.role).some(t => t.id === id);
  const doAction = (id, el) => {
    if (!App.can(id)) return App.toast(App.perm(S.role, id).deny);
    switch (id) {
      case "view_kpis": case "view_reports": return App.go(S.role === "CRE" ? "tele" : firstTab());
      case "view_list": return App.go(hasTab("list") ? "list" : hasTab("appt") ? "appt" : "calling");
      case "drill_down": App.go(firstTab()); return App.toast("Select a name in the breakdown table to drill down");
      case "filter_pvev": { const b = document.querySelector("[data-bd]"); b && b.focus(); return App.toast("Use the All / PV / EV switch in the scope bar"); }
      case "filter_search": { if (!document.querySelector("[data-f]")) App.go(hasTab("list") ? "list" : hasTab("appt") ? "appt" : hasTab("calling") ? "calling" : firstTab()); const f = document.querySelector("[data-f]"); return f && f.focus(); }
      case "view_360": return hasTab("search") ? App.go("search") : (App.go(hasTab("list") ? "list" : firstTab()), App.toast("Use View 360 on a row of the appointment list"));
      case "export": return exportCsv();
      case "set_targets": return setTargetsModal();
      case "escalate": return escalateModal();
      case "approve_exception": return App.go("exceptions");
      case "reassign_dealers": return reassignDealersModal();
      case "reassign_staff": return reassignStaffModal();
      case "assign": return App.go("appt");
      case "call_log": return callLeadModal(null);
      case "book": return callLeadModal("Appt. Booked");
      case "remind_confirm": return App.go("calling", { kpi: "reminder" });
      case "noshow_followup": return App.go("calling", { kpi: "noshow" });
      case "reschedule_cancel": App.go("calling"); return App.toast("Select a customer name to reschedule or cancel");
      case "config_slots": return App.go("workshop");
      case "config_central_calling": return App.go("employee");
      case "mark_reported": return App.toast("Marked at the workshop by the Workshop Service Advisor");
    }
  };

  App.ui = { PAGE, OPEN, table, pager, pageRows, showing, sel, inp, filterBtns, dealerOf, dealerStaff, ownAppts, daysBetween, addDays, priority };
  App.modules.appointment = { label: "Appointment", tabs, views: Object.assign(views, { journey: App.views.journey, matrix: App.views.matrix }), doAction };
})();
