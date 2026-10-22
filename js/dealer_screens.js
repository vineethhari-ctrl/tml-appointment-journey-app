/* Dealer screens recreated from the screenshots (01, 02, 04, 17, 18/19, 20), with the sandbox data
   shown there (model.sandbox). Screens 07 and 11 live in appointment.js. All edits are in memory only. */
(function () {
  const App = window.App, M = App.M, D = App.D, S = App.state, esc = App.esc, U = D.units, H = App.handlers;
  const { PAGE, OPEN, table, pager, pageRows, showing, sel, inp, filterBtns, dealerOf, dealerStaff, ownAppts, daysBetween } = App.ui;
  const SB = M.sandbox, today = D.today;
  const pad2 = n => String(n).padStart(2, "0");
  const views = App.modules.appointment.views;

  /* ---------- small shared pieces ---------- */
  App.ui.iconBtns = () => `<span class="icon-btns"><button class="icon-btn" data-h="iconbtn" data-k="Assign to user" title="Assign to user" aria-label="Assign to user">👤</button>
    <button class="icon-btn" data-h="iconbtn" data-k="Column settings" title="Column settings" aria-label="Column settings">⚙</button>
    <button class="icon-btn" data-h="iconbtn" data-k="List options" title="List options" aria-label="List options">☰</button></span>`;
  H.iconbtn = t => App.toast(`${t.dataset.k}: shown on the screen, not part of this demo`);
  /* Lead-type pills at the top of the lead screens (as on the screenshots). Lead types shown as links open the screens of this demo. */
  App.ui.leadTabs = active => {
    const cre = S.role === "CRE", labels = cre ? M.productLeads.leadTabsCRE : M.productLeads.leadTabsCRM;
    const nav = cre ? { "Appointment List": "calling", "Product Leads": "callprod" } : { "Service Due Leads": "due", "Appointment List": "appt", "Product Leads": "prod" };
    return `<div class="lead-tabs" role="list">${labels.map(t => t === active ? `<span role="listitem" class="lead-tab active" aria-current="true">${t}</span>`
      : nav[t] ? `<button role="listitem" class="lead-tab" data-tab="${nav[t]}">${t}</button>` : `<button role="listitem" class="lead-tab" disabled title="Other lead type: not part of this demo">${t}</button>`).join("")}</div>`;
  };
  const vehicleToggle = () => App.bdToggle("Vehicle (All / PV / EV)");
  const dist = (total, weights) => { // split a total over weights so the parts add up exactly
    const sum = weights.reduce((a, b) => a + b, 0) || 1, raw = weights.map(w => total * w / sum), fl = raw.map(Math.floor);
    let rem = total - fl.reduce((a, b) => a + b, 0);
    raw.map((v, i) => [v - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rem > 0) { fl[i]++; rem--; } });
    return fl;
  };

  /* ---------- OBSERVED 01: CRM CALL CONTROL DASHBOARD ---------- */
  views.crmDash = tab => {
    const leads = D.leads.filter(l => App.inScope(l) && App.bdOk(l));
    const appts = D.appointments.filter(a => App.inScope(a) && App.bdOk(a) && a.callType !== "-");
    const svc = { a: leads.filter(l => l.assignedTo).length, u: leads.filter(l => !l.assignedTo).length, due: leads.filter(l => !l.apptId && daysBetween(today, l.dueDate) <= 7).length };
    const apl = { a: appts.filter(a => a.reminderAssignedTo).length, u: appts.filter(a => !a.reminderAssignedTo).length, due: appts.filter(a => a.date >= today).length };
    const asg = leads.filter(l => l.assignedTo), cnt = k => asg.filter(l => l.outcome === k).length;
    const att = asg.filter(l => l.callStatus === "Attempted").length, con = asg.filter(l => l.contact === "Contacted").length;
    const col = { att: "var(--blue)", na: "#9aa3b2", con: "var(--green)", nc: "var(--red)", cb: "var(--amber)", ab: "var(--purple)", wn: "#b45309", ni: "#be123c", se: "#0e7490" };
    const outcome = [["Attempted", att, col.att], ["Call Back", cnt("Call Back"), col.cb], ["Not Attempted", asg.length - att, col.na], ["Appt. Booked", cnt("Appt. Booked"), col.ab],
      ["Contacted", con, col.con], ["Wrong No.", cnt("Wrong No."), col.wn], ["Not Contacted", att - con, col.nc], ["Not Interested", cnt("Not Interested"), col.ni], ["Service Enquiry", cnt("Service Enquiry"), col.se]]
      .map(([label, value, color]) => ({ label, value, color }));
    const ring = [outcome[2], outcome[6], outcome[1], outcome[3], outcome[5], outcome[7], outcome[8]];
    const mini = (title, d) => `<div><div class="mini-h">${title}</div><div class="donut-wrap">${App.donut([{ label: "Assigned", value: d.a, color: "var(--green)" }, { label: "Unassigned", value: d.u, color: "var(--amber)" }], d.a + d.u, "Total leads", 84)}
      <ul class="legend"><li><span class="dot" style="background:var(--green)"></span><a class="row-btn plain" href="#" data-h="goAppt" data-k="assigned">Assigned</a><span class="v">${d.a}</span></li>
      <li><span class="dot" style="background:var(--amber)"></span><a class="row-btn plain" href="#" data-h="goAppt" data-k="unassigned">Unassigned</a><span class="v">${d.u}</span></li>
      <li><span class="dot" style="background:#a16207"></span>Due<span class="v">${d.due}</span></li></ul></div></div>`;
    return `<div class="title-row"><h1 style="font-size:20px;margin:0">CRM CALL CONTROL DASHBOARD</h1><span class="badge observed">Observed · screen 01</span></div>` + App.scopeBanner({ bdLabel: "Vehicle (All / PV / EV)" }) +
      `<div class="dash-top"><section class="card"><div class="card-h">🗓 SERVICE DUE LEADS</div><div class="card-b"><div class="svc-cols">
          <div>${App.donut([{ label: "SVC Reminder", value: svc.a + svc.u, color: "var(--blue)" }, { label: "Appointment List", value: apl.a + apl.u, color: "#c7cdd6" }], svc.a + svc.u + apl.a + apl.u, "Total leads", 150)}</div>
          ${mini("SVC REMINDER", svc)}${mini("APPOINTMENT LIST", apl)}</div></div></section>
        <section class="card"><div class="card-h">⏱ CALL OUTCOME ANALYTICS</div><div class="card-b"><div class="donut-wrap">${App.donut(ring, asg.length, "Total assigned", 170)}
          <ul class="legend two">${outcome.map(o => `<li><span class="dot" style="background:${o.color}"></span>${o.label}<span class="v">${o.value}</span></li>`).join("")}</ul></div></div></section></div>
      <div class="lead-cards" aria-label="Other lead types (static sandbox values, outside the Appointment scope)">${SB.otherLeadCards.map(c => `<section class="card"><div class="card-h">◎ ${esc(c.title)}</div><div class="card-b">
        ${App.donut([{ label: "Assigned", value: c.a, color: "var(--green)" }, { label: "Unassigned", value: c.u, color: "var(--amber)" }], c.a + c.u, "Total leads", 104)}
        <ul class="legend"><li><span class="dot" style="background:var(--green)"></span>Assigned<span class="v">${c.a}</span></li><li><span class="dot" style="background:var(--amber)"></span>Unassigned<span class="v">${c.u}</span></li></ul></div></section>`).join("")}</div>
      <p class="note">The other lead-type cards are shown as in the screenshot (static sandbox values, outside the Appointment scope). The service-due, appointment-list and call-outcome figures are computed from the demo data.</p>` + App.actionsPanel();
  };
  H.goAppt = (t, e) => { e && e.preventDefault && e.preventDefault(); App.go("appt", { kpi: t.dataset.k }); };

  /* ---------- OBSERVED 02: Service Due Leads ---------- */
  views.dueLeads = tab => {
    const f = S.filters;
    let rows = D.leads.filter(l => App.inScope(l) && App.bdOk(l) && !l.apptId);
    rows = rows.filter(l => (!f.stype || l.serviceType === f.stype) && (!f.ppl || l.ppl === f.ppl) && (!f.from || l.dueDate >= f.from) && (!f.to || l.dueDate <= f.to)
      && (!f.band || (f.band === "7-9" ? (d => d >= 7 && d <= 9) : (d => d >= 15 && d <= 30))(daysBetween(today, l.dueDate))));
    rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    App._exportRows = rows;
    const pr = pageRows(rows), canAssign = App.can("assign"), allSel = pr.length && pr.every(r => S.selected.has(r.id));
    const cols = [{ h: `<input type="checkbox" aria-label="Select all on page" data-h="selall" ${allSel ? "checked" : ""} ${canAssign ? "" : "disabled"}>`, f: r => `<input type="checkbox" aria-label="Select ${esc(r.customer)}" data-h="sel" data-id="${r.id}" ${S.selected.has(r.id) ? "checked" : ""} ${canAssign ? "" : "disabled"}>` },
      { h: "Mobile No.", f: r => r.mobile }, { h: "Reg No.", f: r => r.reg }, { h: "PPL", f: r => esc(r.ppl) }, { h: "PL", f: r => esc(r.pl) }, { h: "Service Type", f: r => r.serviceType },
      { h: "Due Date ⇅", f: r => App.fmtDate(r.dueDate) }, { h: "Assign Date<br>&amp; Time ⇅", f: r => r.assignedAt ? `${App.fmtDate(r.assignedAt.slice(0, 10))}<br>${r.assignedAt.slice(11)}` : "-" },
      { h: "Status", f: r => r.assignedTo ? App.chip("Assigned", "green") : App.chip("Unassigned", "red") },
      { h: "Days Left ⇅", f: r => `${daysBetween(today, r.dueDate)} Days` }, { h: "Vehicle Type", f: r => r.bd }, { h: "Call Attempt", f: r => r.callStatus === "Attempted" ? "1" : "-" }];
    const bands = [["", "All"], ["7-9", "7-9 Days"], ["15-30", "15-30 Days"]];
    return `<div class="title-row"><h1 style="font-size:20px;margin:0">Service Due Leads</h1><span class="badge observed">Observed · screen 02</span></div>` + App.scopeBanner({ bdLabel: "Vehicle (All / PV / EV)" }) +
      App.ui.leadTabs("Service Due Leads")+
      `<p class="note">Source of appointments: a service-due lead becomes an appointment when the CRE's call outcome is "Appt. Booked". Leads already booked are not listed.</p>
      <div class="filters" role="search">${sel("f-stype", "Service Type", ["Paid Service", "Free Service"], f.stype)}${inp("f-from", "From Date", f.from, "date")}${inp("f-to", "To Date", f.to, "date")}
        ${sel("f-ppl", "PPL", [...new Set(D.leads.map(l => l.ppl))], f.ppl)}<span class="grow"></span>${filterBtns()}${App.ui.iconBtns()}</div>
      <div class="list-meta">${showing(rows.length, S.selected.size ? ` · ${S.selected.size} selected` : "")}<span class="right"><button class="btn primary" data-h="bulkLeads" ${canAssign ? "" : "disabled"}>Bulk Assign</button>
        <span class="seg" role="group" aria-label="Days left">${bands.map(([v, l]) => `<button id="band-${v || "all"}" data-h="band" data-v="${v}" aria-pressed="${(f.band || "") === v}">${l}</button>`).join("")}</span></span></div>
      ${table(cols, pr, "Service due leads")}${pager(rows.length)}` + App.actionsPanel();
  };
  H.band = t => { S.filters.band = t.dataset.v; S.page = 1; App.render(); };

  /* ---------- OBSERVED 20: TELE-CALLER DASHBOARD ---------- */
  views.teleDash = tab => {
    const user = App.user(), dealer = dealerOf();
    const leads = D.leads.filter(l => l.assignedTo === user && App.bdOk(l)), appts = ownAppts(user).filter(App.bdOk);
    const calls = leads.filter(l => l.callStatus === "Attempted").length + appts.filter(a => a.reminderCallStatus === "Attempted").length;
    const connected = leads.filter(l => l.contact === "Contacted").length, booked = leads.filter(l => l.outcome === "Appt. Booked").length;
    const t = D.targets[dealer], ct = D.creTargets[user], target = S.bd === "All" ? ct : Math.round(ct * t[S.bd] / Math.max(1, t.PV + t.EV));
    const callsTarget = target * 3, connTarget = target * 2;
    const rep = appts.filter(a => a.status === "reported").length, ns = appts.filter(a => a.status === "no_show").length, show = App.pct(rep, rep + ns);
    const srcCol = { "Inbound Call": "var(--blue)", "Walk-In Converted": "var(--green)", "Follow-Up Converted": "var(--purple)" };
    const src = Object.keys(srcCol).map(k => ({ label: k, value: appts.filter(a => a.source === k).length, color: srcCol[k] }));
    const todays = appts.filter(a => a.date === today), list = todays.length ? todays : appts.filter(a => a.date > today && OPEN.includes(a.status)).slice(0, 5);
    // performance trend: the totals above spread over the last 7 days (sums equal the tiles)
    const days = [...Array(7)].map((_, i) => App.ui.addDays(today, i - 6));
    const w = u => [...u].reduce((a, c) => a * 31 + c.charCodeAt(0), 7), wt = k => days.map((_, i) => 1 + ((w(user + k) >> i) & 7));
    const series = [["Call", calls, "#1a73e8"], ["Connected Calls", connected, "#1e8e3e"], ["Appointment Booked", booked, "#8e24aa"]].map(([n, tot, c]) => ({ n, c, v: dist(tot, wt(n)) }));
    const mx = Math.max(20, Math.ceil(Math.max(...series.flatMap(s => s.v)) / 20) * 20), X = i => 40 + i * 52, Y = v => 160 - 140 * v / mx;
    const chart = `<svg viewBox="0 0 400 190" role="img" aria-label="Performance trend, last 7 days: ${series.map(s => s.n + " " + s.v.join(", ")).join("; ")}" style="width:100%;height:auto">
      ${[0, 1, 2, 3, 4].map(i => `<line x1="34" x2="390" y1="${Y(mx * i / 4)}" y2="${Y(mx * i / 4)}" stroke="#eceff4"/><text x="28" y="${Y(mx * i / 4) + 3}" font-size="8" text-anchor="end" fill="#5b6474">${Math.round(mx * i / 4)}</text>`).join("")}
      ${series.map(s => `<polyline fill="none" stroke="${s.c}" stroke-width="1.6" points="${s.v.map((v, i) => X(i) + "," + Y(v)).join(" ")}"/>${s.v.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="2.4" fill="${s.c}"/>`).join("")}`).join("")}
      ${days.map((d, i) => `<text x="${X(i)}" y="178" font-size="8" text-anchor="middle" fill="#5b6474">${+d.slice(8)} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+d.slice(5, 7) - 1]}</text>`).join("")}</svg>`;
    const disp = [["Appt. Booked", "Appt. Booked", "var(--blue)"], ["Not Interested", "Not Interested", "var(--green)"], ["Call Back", "Call Back Later", "var(--purple)"], ["Service Enquiry", "Service Enquiry", "var(--amber)"]]
      .map(([o, label, color]) => ({ label, n: leads.filter(l => l.outcome === o).length, color }));
    const dm = Math.max(1, ...disp.map(d => d.n)), fups = leads.filter(l => l.outcome === "Call Back").slice(0, 5);
    const bar = (label, pct, text, color) => `<div class="bar-row" style="grid-template-columns:150px 1fr 70px"><span>${label}</span><span class="bar" role="img" aria-label="${label} ${text}"><i style="width:${Math.min(100, pct)}%;background:${color}"></i></span><span class="v">${text}</span></div>`;
    return `<div class="title-row"><h1 style="font-size:20px;margin:0">TELE-CALLER DASHBOARD</h1><span class="badge observed">Observed · screen 20</span></div>` + App.scopeBanner({ crumbs: false, bdLabel: "Vehicle (All / PV / EV)" }) +
      `<div class="grid g4">${App.stat("👥", calls, "Total Calls")}${App.stat("📞", connected, "Connected Calls", "var(--amber-t)")}${App.stat("📅", booked, "Appt. Booked", "var(--purple)")}${App.stat("🎯", `${target}/${booked}`, "Todays Target (Appt.)", "var(--green)")}</div>
      <div class="grid g3"><section class="card"><div class="card-h">PERFORMANCE TREND</div><div class="card-b"><div class="trend-legend">${series.map(s => `<span><span class="dot" style="background:${s.c}"></span>${s.n}</span>`).join("")}</div>${chart}</div></section>
        <section class="card"><div class="card-h">APPOINTMENT SCORE</div><div class="card-b"><div class="donut-wrap">${App.donut(src, appts.length, "Total", 150)}
          <ul class="score-list">${src.map(s => `<li><span class="dot" style="background:${s.color}"></span>${s.label}<b>${s.value} (${App.pct(s.value, appts.length)}%)</b></li>`).join("")}</ul></div></div></section>
        <section class="card"><div class="card-h">TODAY'S APPOINTMENT (BOOKED) <b style="color:var(--blue)">${todays.length}</b><button class="row-btn link" data-tab="calling">View All ›</button></div><div class="card-b"><ul class="list-plain">
          ${todays.length ? "" : '<li class="note">No appointment today; upcoming ones are shown.</li>'}${list.map(a => `<li><span style="min-width:90px">${esc(a.customer)}</span><span class="adv">${esc(a.advisor)}<small>${a.reg} - ${esc(a.ppl)}</small></span><span style="margin-left:auto">${App.statusChip(a.status)}</span></li>`).join("") || '<li class="note">None</li>'}</ul></div></section></div>
      <div class="grid g3"><section class="card"><div class="card-h">MY PERFORMANCE VS TARGET<button class="row-btn link" data-tab="calling">View All ›</button></div><div class="card-b"><div class="bars">
          ${bar("Total Calls", App.pct(calls, callsTarget), `${calls}/${callsTarget}`, "var(--blue)")}${bar("Connected Calls", App.pct(connected, connTarget), `${connected}/${connTarget}`, "var(--green)")}
          ${bar("Appt. Booked", App.pct(booked, target), `${booked}/${target}`, "var(--purple)")}${bar("Show Rate", App.pct(show, 60), `${show}/60 %`, "var(--amber)")}</div></div></section>
        <section class="card"><div class="card-h">CALL DISPOSITION SUMMARY<button class="row-btn link" data-tab="calling">View All ›</button></div><div class="card-b"><div class="bars">
          ${disp.map(d => bar("👤 " + d.label, 100 * d.n / dm, pad2(d.n), d.color)).join("")}</div></div></section>
        <section class="card"><div class="card-h">RECENT FOLLOW UPS<button class="row-btn link" data-tab="calling">View All ›</button></div><div class="card-b"><ul class="list-plain">${fups.map(l => `<li>${esc(l.customer)}<span class="sub">${l.mobile}</span><span style="margin-left:auto" class="sub">${App.fmtDate(l.dueDate)}</span></li>`).join("") || '<li class="note">None</li>'}</ul></div></section></div>` + App.actionsPanel();
  };

  /* ---------- OBSERVED 04: Customer Search / View 360 ---------- */
  const chassis = reg => "MAT" + reg.replace(/\D/g, "").padEnd(4, "0") + "GALK" + reg.replace(/\D/g, "").slice(-4).padStart(6, "1");
  const searchCustomers = (by, q) => {
    q = (q || "").trim().toLowerCase(); if (!q) return []; const nq = App.norm(q);
    const key = by === "reg" ? "reg" : by === "name" ? "customer" : "mobile";
    const sample = SB.customerSearch.rows.filter(r => App.norm(r[key]).includes(nq)).map(r => ({ ...r, sample: true }));
    const appts = D.appointments.filter(a => App.inScope(a) && App.norm(a[key === "customer" ? "customer" : key]).includes(nq)).map(a => ({ customer: a.customer, mobile: a.mobile, reg: a.reg, chassis: chassis(a.reg), type: "Appointment", id: a.id }));
    const leads = D.leads.filter(l => App.inScope(l) && !l.apptId && App.norm(l[key]).includes(nq)).map(l => ({ customer: l.customer, mobile: l.mobile, reg: l.reg, chassis: chassis(l.reg), type: "Outbound", id: l.id }));
    return [...sample, ...appts, ...leads].slice(0, 30);
  };
  views.custSearch = tab => {
    const f = S.filters, by = f.by || "mobile", q = f.cq === undefined ? SB.customerSearch.query : f.cq, res = searchCustomers(by, q);
    const cls = { Appointment: "blue", Outbound: "purple", Inbound: "green" };
    const cols = [{ h: "Customer Name", f: r => esc(r.customer) }, { h: "Mobile No.", f: r => r.mobile }, { h: "Registration No.", f: r => r.reg }, { h: "Chassis No", f: r => r.chassis },
      { h: "Lead Type", f: r => App.chip(r.type, cls[r.type]) }, { h: "Lead ID", f: r => `<u>${r.id}</u>` },
      { h: "Action", f: r => App.can("view_360") ? `<button class="btn small" data-h="v360" data-mobile="${r.mobile}" data-reg="${r.reg}" data-name="${esc(r.customer)}">View 360 →</button>` : "-" }];
    return `<div class="title-row"><h1 style="font-size:20px;margin:0">Customer Search</h1><span class="badge observed">Observed · screen 04</span></div>` + App.scopeBanner({ crumbs: false, bd: false }) +
      `<div class="filters" role="search"><label for="f-by">Search by<select id="f-by" data-hc="filter" data-f="by">${[["mobile", "Mobile No."], ["reg", "Reg No."], ["name", "Customer Name"]].map(([v, t]) => `<option value="${v}" ${by === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label for="f-cq" class="grow">Search<input id="f-cq" value="${esc(q)}" data-hc="filter" data-enter="filterEnter" data-f="cq"></label><button class="btn primary" data-h="search">Search</button></div>
      <div class="list-meta">${q ? `${res.length} Result${res.length === 1 ? "" : "s"} Found` : "Enter a mobile number, reg no. or name."}</div>
      ${q ? table(cols, res, "Customer search results") : ""}` + App.actionsPanel();
  };
  H.v360 = t => {
    const mob = t.dataset.mobile, reg = t.dataset.reg, appts = D.appointments.filter(a => a.mobile === mob && a.reg === reg), leads = D.leads.filter(l => l.mobile === mob && l.reg === reg);
    const c = appts[0] || leads[0] || { customer: t.dataset.name, mobile: mob, reg, ppl: "-", pl: "-", bd: "PV", dealer: "-", division: "-" };
    App.modal("Customer 360 · " + c.customer, `<p class="note">Read-only view. Sandbox data.</p>
      <div class="form-grid"><div><b>Mobile</b><br>${c.mobile}</div><div><b>Reg No.</b><br>${c.reg}</div><div><b>Vehicle</b><br>${esc(c.ppl)} · ${esc(c.pl)} ${App.bdTag(c.bd)}</div><div><b>Dealer / Division</b><br>${c.dealer} / ${c.division}</div></div>
      <h3 style="margin:8px 0 0;font-size:14px">Appointments</h3>${appts.map(a => `<div>${a.id} · ${App.fmtDate(a.date)} ${a.time} · ${a.channel} · ${App.statusChip(a.status)}</div>`).join("") || '<div class="note">None</div>'}
      <h3 style="margin:8px 0 0;font-size:14px">Service due leads</h3>${leads.map(l => `<div>${l.id} · due ${App.fmtDate(l.dueDate)} · ${esc(l.assignedTo || "Unassigned")} · ${esc(l.outcome || l.callStatus)}</div>`).join("") || '<div class="note">None</div>'}`);
  };
  H.gsearch = t => { const q = (document.getElementById("gsearch") || {}).value || ""; if (!q.trim()) return App.toast("Type a vehicle no., VIN, mobile no. or customer name");
    if (App.mod().tabs(S.role).some(x => x.id === "cust360")) return App.go("cust360", { q: q.trim(), auto: "1" });   // TML: any customer or vehicle (not only those in service); one match opens its 360
    const by = /^\d{10}$/.test(q.trim()) ? "mobile" : /^[A-Za-z]{2}\d/.test(q.trim()) ? "reg" : "name"; App.go("search", { by, cq: q.trim() }); };

  /* ---------- OBSERVED 17: Workshop Configuration (Smart Slot) ---------- */
  views.workshop = tab => {
    const dealer = dealerOf(), q = (S.filters.wq || "").toLowerCase(), can = App.can("config_slots");
    const all = U[dealer].children.map(id => U[id]), rows = all.filter(w => !q || JSON.stringify(w.workshop || w).toLowerCase().includes(q));
    const g = (w, k, fb) => (w.workshop || {})[k] ?? fb;
    const cols = [{ h: "Division", f: w => can ? `<button class="row-btn" data-h="slot" data-id="${w.id}">${w.id}</button>` : `<u>${w.id}</u>` },
      { h: "Workshop Name", f: w => esc(g(w, "name", "Workshop " + w.id)) }, { h: "Dealer Code", f: w => esc(g(w, "dealerCode", dealer)) }, { h: "City", f: w => esc(g(w, "city", "-")) },
      { h: "State", f: w => esc(g(w, "state", "-")) }, { h: "Contact No.", f: w => esc(g(w, "contact", "-")) }, { h: "Status", f: w => App.chip(w.active ? "Active" : "Inactive", w.active ? "green" : "red") },
      { h: "Created On", f: w => g(w, "created", "-") }, { h: "Created By", f: w => esc(g(w, "createdBy", "-")) }];
    return `<div class="title-row"><button class="icon-btn" data-h="back" aria-label="Back">←</button><h1 style="font-size:20px;margin:0">Workshop Configuration</h1><span class="badge observed">Observed · screen 17</span>
        <span class="grow"></span><label class="gsearch" style="max-width:260px"><span class="sr-only">Search here</span><input id="f-wq" value="${esc(S.filters.wq || "")}" placeholder="Search here" data-hc="filter" data-enter="filterEnter" data-f="wq">🔍</label></div>` + App.scopeBanner({ crumbs: false, bd: false }) +
      `<div class="list-meta">Showing ${rows.length} of ${all.length} Results · select a Division to configure its Smart Slot</div>${table(cols, rows, "Workshop configuration")}
      <p class="note">"Division" here is the observed label for a dealer workshop location. It is not the Business division (PV/EV).</p>` + App.actionsPanel();
  };
  H.back = () => App.go(App.mod().tabs(S.role)[0].id);
  H.slot = t => {
    const w = U[t.dataset.id];
    App.modal("Smart Slot · " + w.id, `<div class="form-grid"><label class="field" for="m-slots">Slots per day<input id="m-slots" type="number" min="0" max="80" value="${w.slotsPerDay}"></label>
      <label class="field" for="m-act">Status<select id="m-act"><option value="1" ${w.active ? "selected" : ""}>Active</option><option value="0" ${w.active ? "" : "selected"}>Inactive</option></select></label></div>
      <p class="note">Smart Slot capacity limits how many appointments CREs can book per day at this workshop.</p>`,
      [{ label: "Cancel" }, { label: "Save", primary: true, onClick: r => { w.slotsPerDay = +r.querySelector("#m-slots").value; w.active = r.querySelector("#m-act").value === "1"; App.render(); App.toast(`Smart Slot saved for ${w.id}`); } }]);
  };

  const phoneTable = () => table([{ h: "☑", f: () => '<input type="checkbox" checked aria-label="Select all">' }, { h: "Phone Type", f: r => r.type }, { h: "Phone No", f: r => r.no },
    { h: "Verification Status", f: r => r.verified ? '<span style="color:var(--green)">✔ Verified</span>' : '<span style="color:var(--red)">⚠ <u>Verify</u></span>' }, { h: "Status", f: r => r.status }], SB.employeeSecurityGuard.phones, "Phone numbers");
  /* ---------- OBSERVED 18 / 19: Employee Info ---------- */
  views.employee = tab => {
    const E = SB.employee, dealer = dealerOf(), sg = S.filters.emp === "SG", role = sg ? SB.employeeSecurityGuard.role : S.filters.emp === "CRE" ? "CRE" : "CRM", can = App.can("config_central_calling");
    const central = D.settings[dealer]?.centralCalling ?? true;
    const t2 = { ...tab, screen: sg ? 32 : role === "CRE" ? 19 : 18 }, act = sg ? 0 : E.tabs.length - 1;
    const row = (l, v, o = {}) => `<div class="erow"><span>${o.req ? '<b style="color:var(--red)">* </b>' : ""}${l}</span>${o.select ? `<select disabled aria-label="${l}"><option>${esc(v)}</option></select>` : `<input value="${esc(v)}" readonly aria-label="${l}">`}</div>`;
    const dummy = n => App.toast(`${n}: shown on the screen, not part of this demo`);
    return `<div class="title-row"><h1 style="font-size:20px;margin:0">👤 Employee Info</h1><span class="badge observed">Observed · screen ${t2.screen}</span><span class="grow"></span>
        <button class="btn" data-h="dummy" data-k="Employee Info download">⬇ Employee Info</button><button class="btn primary" data-h="dummy" data-k="Save">Save</button></div>` + App.scopeBanner({ crumbs: false, bd: false }) +
      `<div class="filters"><label for="f-emp">Show screen<select id="f-emp" data-hc="filter" data-f="emp"><option value="CRM" ${role === "CRM" ? "selected" : ""}>18 · Employee Role = CRM</option><option value="CRE" ${role === "CRE" ? "selected" : ""}>19 · Employee Role = CRE</option><option value="SG" ${sg ? "selected" : ""}>32 · Employee Role = Security Guard</option></select></label></div>
      <section class="card"><div class="card-b"><div class="emp-grid">
        <div><div class="emp-pic">Profile Picture</div><p style="display:flex;gap:8px;margin:10px 0 0"><button class="btn primary small" data-h="dummy" data-k="Upload">⬆ Upload</button><button class="btn small" data-h="dummy" data-k="Clear">Clear</button></p></div>
        <div class="emp-col">${row("Dealer", E.dealer, { req: 1 })}${row("Division Name", E.divisionName, { req: 1 })}${row("Employee Name", E.employeeName, { req: 1 })}${row("Employee No", E.employeeNo, { req: 1 })}
          ${row("Employee Type", E.employeeType, { req: 1 })}${row("Employee Role", role, { req: 1, select: 1 })}${row("Contact No (Mob.)", E.contact, { req: 1 })}</div>
        <div class="emp-col">${row("Date of Joining", E.doj)}${row("Company E-Mail ID", E.companyEmail, { req: 1 })}${row("Private E-Mail ID", E.privateEmail)}${row("Date of Birth", E.dob)}${row("Gender", E.gender, { select: 1 })}
          ${row("Aadhar No", E.aadhar, { req: 1 })}${row("Pan No", E.pan)}${row("Driving License", E.drivingLicense, { req: 1 })}</div>
        <div class="emp-col">${row("Work Experience / Passout", E.experience)}${row("Today's Attendance", E.attendance)}${row("Remarks", E.remarks)}${row("Status", E.status, { select: 1 })}${row("Authentication", E.authentication, { select: 1 })}${row("Date of Leaving", E.dol)}</div>
      </div></div></section>
      <div class="tab-strip" role="tablist">${E.tabs.map((x, i) => `<button role="tab" aria-selected="${i === act}" ${i === act ? 'aria-current="true"' : ""} data-h="dummy" data-k="${esc(x)} tab">${esc(x)}</button>`).join("")}</div>
      <p style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin:0 0 10px"><button class="btn" data-h="dummy" data-k="Edit">✎ Edit</button><button class="btn" data-h="dummy" data-k="Add">⊕ Add</button><button class="btn" data-h="dummy" data-k="Delete">🗑 Delete</button>
        <button class="btn primary" data-h="${sg ? "dummy" : "saveCentral"}" data-k="Save" ${can || sg ? "" : "disabled"}>Save</button><button class="btn" data-h="dummy" data-k="Refresh">⟳ Refresh</button></p>
      ${sg ? phoneTable() : table([{ h: "☑", f: () => '<input type="checkbox" checked aria-label="Select all">' }, { h: "Feature", f: () => "Central Calling at dealer Level" },
        { h: "Action", f: () => `<fieldset style="border:0;padding:0;margin:0"><legend class="sr-only">Central Calling at dealer Level</legend><label><input type="radio" name="cc" value="1" ${central ? "checked" : ""} ${can ? "" : "disabled"}> Yes</label> <label><input type="radio" name="cc" value="0" ${central ? "" : "checked"} ${can ? "" : "disabled"}> No</label></fieldset>` },
        { h: "Dealer Code", f: () => E.featureDealerCode }, { h: "Status", f: () => "Active" }], [{}], "Additional feature parameters")}` + App.actionsPanel();
  };
  H.dummy = t => App.toast(`${t.dataset.k}: shown on the screen, not part of this demo`);
  H.saveCentral = () => { const v = document.querySelector('input[name="cc"]:checked').value === "1"; const d = dealerOf(); D.settings[d] = { centralCalling: v }; App.toast(`Central Calling at dealer Level set to ${v ? "Yes" : "No"} for ${d}`); };

  /* ---------- Product Leads: Lead Assignment (CRM, screen 10) and Calling List (CRE, screen 15) ---------- */
  const PSTAT = { unassigned: "red", not_contacted: "red", attempted: "amber", interested: "green", not_interested: "grey" };
  const PLABEL = Object.fromEntries(M.productLeads.statuses.map(x => [x.id, x.label]));
  const flag = (on, label, red) => `<span class="flag ${on ? "yes" : red ? "no" : "off"}" role="img" aria-label="${label}: ${on ? "yes" : "no"}">${on ? "✔" : red ? "✖" : "○"}</span>`;
  const prodScope = () => D.productLeads.filter(r => App.inScope(r) && App.bdOk(r));
  const prodCols = (extra) => [
    ...extra.lead, { h: "Mobile No.", f: r => r.mobile }, ...(extra.sev ? [{ h: "Customer Severity", f: r => r.severity }] : []), { h: "Reg No.", f: r => r.reg },
    { h: "PPL", f: r => esc(r.ppl) }, { h: "PL", f: r => esc(r.pl) }, { h: "Opportunity<br>Count", f: r => pad2(r.opps) },
    ...(extra.type ? [{ h: "Opportunity<br>Type", f: r => M.productLeads.flags.filter(x => r[x.id]).map(x => x.label).join(", ") }] : []),
    ...M.productLeads.flags.map(x => ({ h: `<abbr title="${esc(x.full)}">${x.label}</abbr>`, f: r => flag(r[x.id], x.label, extra.red) })),
    ...(extra.dealer ? [{ h: "Dealer", f: r => esc(r.division) }] : []), { h: "Assigned To", f: r => esc(r.assignedTo || "-") },
    { h: "Status", f: r => App.chip(PLABEL[r.status], PSTAT[r.status]) }];
  const titleRow = (title, tab) => `<div class="title-row"><button class="icon-btn" data-h="back" aria-label="Back">←</button><h1 style="font-size:20px;margin:0">${title}</h1><span class="badge observed">Observed · screen ${tab.screen}</span></div>`;
  const workshops = () => U[dealerOf()].children;

  views.crmProd = tab => {
    const f = S.filters, base = prodScope(), kpi = f.kpi || "unassigned", canAssign = App.can("assign");
    const nU = base.filter(r => !r.assignedTo).length, nA = base.length - nU;
    const rows = base.filter(r => (kpi === "assigned" ? r.assignedTo : !r.assignedTo) && (!f.workshop || r.division === f.workshop) && (!f.ppl || r.ppl === f.ppl));
    const pr = pageRows(rows), allSel = pr.length && pr.every(r => S.selected.has(r.id));
    const cols = prodCols({ lead: [{ h: `<input type="checkbox" aria-label="Select all on page" data-h="selall" ${allSel ? "checked" : ""} ${canAssign ? "" : "disabled"}>`, f: r => `<input type="checkbox" aria-label="Select ${esc(r.customer)}" data-h="sel" data-id="${r.id}" ${S.selected.has(r.id) ? "checked" : ""} ${canAssign ? "" : "disabled"}>` },
      { h: "Customer Name", f: r => esc(r.customer) }], sev: true });
    const k = (id, n, label, color) => `<button class="kpi-tab" id="kpi-${id}" data-h="kpi" data-k="${id}" aria-pressed="${kpi === id}"><b style="color:${color}">${n}</b>${label}</button>`;
    return titleRow("Lead Assignment : Product Leads", tab) + App.scopeBanner({ bdLabel: "Vehicle (All / PV / EV)" }) + App.ui.leadTabs("Product Leads") +
      `<div class="kpi-tabs">${k("unassigned", nU, "Unassigned", "var(--red)")}${k("assigned", nA, "Assigned", "var(--green)")}</div>
      <div class="filters" role="search">${sel("f-workshop", "Workshop", workshops(), f.workshop)}${sel("f-ppl", "PPL", [...new Set(D.productLeads.map(l => l.ppl))], f.ppl)}<span class="grow"></span>
        <button class="btn primary" data-h="search">Search 🔍</button><button class="btn" data-h="clear">Clear</button>
        <button class="btn" data-h="bulkProd" ${canAssign && S.selected.size ? "" : 'aria-disabled="true"'} title="${canAssign ? "Select leads first" : "Done by dealer CRM"}">Assign Leads</button>${App.ui.iconBtns()}</div>
      <div class="list-meta">${showing(rows.length, S.selected.size ? ` · ${S.selected.size} selected` : "")}<span class="right"><button class="btn primary" data-h="bulkProd" ${canAssign ? "" : "disabled"}>Bulk Assign</button></span></div>
      ${table(cols, pr, "Product leads")}${pager(rows.length)}
      <p class="note">${M.productLeads.flags.map(x => `<b>${x.label}</b> = ${esc(x.full)}`).join(" · ")}. A filled circle means the customer's vehicle has that opportunity; Opportunity Count is how many.</p>` + App.actionsPanel();
  };
  const assignProd = ids => {
    if (!ids.length) return App.toast("Select one or more rows first");
    const cres = dealerStaff(dealerOf(), "CRE");
    App.modal(`Assign ${ids.length} product lead${ids.length > 1 ? "s" : ""}`, `<label class="field" for="m-cre">Assign to CRE<select id="m-cre">${cres.map(c => `<option>${esc(c.id)}</option>`).join("")}</select></label>`,
      [{ label: "Cancel" }, { label: "Assign", primary: true, onClick: r => { const to = r.querySelector("#m-cre").value;
        ids.forEach(id => { const l = D.productLeads.find(x => x.id === id); l.assignedTo = to; l.assignedAt = today + " 10:00"; l.status = "not_contacted"; });
        S.selected.clear(); App.render(); App.toast(`${ids.length} product lead${ids.length > 1 ? "s" : ""} assigned to ${to}`); } }]);
  };
  H.bulkProd = t => { if (t && t.getAttribute && t.getAttribute("aria-disabled") === "true") return App.toast(App.can("assign") ? "Select leads first" : "Done by dealer CRM"); assignProd([...S.selected]); };

  views.creProd = tab => {
    const user = App.user(), f = S.filters, kpi = f.kpi || "all", mine = prodScope().filter(r => r.assignedTo === user);
    const q = (f.variant || "").toLowerCase();
    const rows = mine.filter(r => (kpi === "all" || r.status === kpi) && (!f.workshop || r.division === f.workshop) && (!q || (r.ppl + " " + r.pl).toLowerCase().includes(q)));
    const cols = prodCols({ lead: [{ h: "Customer Name", f: r => `<button class="row-btn plain" data-h="callprod" data-id="${r.id}" aria-label="Call ${esc(r.customer)}">${esc(r.customer)}</button>` }], type: true, red: true, dealer: true });
    const k = (id, n, label, color) => `<button class="kpi-tab" id="kpi-${id}" data-h="kpi" data-k="${id}" aria-pressed="${kpi === id}"><b style="color:${color}">${n}</b>${label}</button>`;
    const n = st => mine.filter(r => r.status === st).length;
    return titleRow("Calling List : Non Service Leads", tab) + App.scopeBanner({ crumbs: false, bdLabel: "Vehicle (All / PV / EV)" }) + App.ui.leadTabs("Product Leads") +
      `<div class="kpi-tabs">${k("all", mine.length, "Total Assigned", "var(--blue)")}${k("not_contacted", n("not_contacted"), "Not Contacted", "var(--red)")}${k("attempted", n("attempted"), "Attempted", "var(--amber-t)")}
        ${k("interested", n("interested"), "Interested", "var(--green)")}${k("not_interested", n("not_interested"), "Not Interested", "var(--grey)")}</div>
      <div class="filters" role="search">${sel("f-workshop", "Dealer", workshops(), f.workshop)}${inp("f-variant", "Variant", f.variant)}<span class="grow"></span>${filterBtns()}${App.ui.iconBtns()}</div>
      <div class="list-meta">${showing(rows.length)} · select a customer name to call</div>
      ${table(cols, pageRows(rows), "My product leads calling list")}${pager(rows.length)}` + App.actionsPanel();
  };
  H.callprod = t => {
    const l = D.productLeads.find(x => x.id === t.dataset.id), can = App.can("call_log");
    App.modal(`Call ${l.customer}`, `<div>${l.mobile} · ${esc(l.ppl)} ${esc(l.pl)} · ${App.chip(PLABEL[l.status], PSTAT[l.status])}</div>
      <p class="note">Opportunities: ${M.productLeads.flags.filter(x => l[x.id]).map(x => x.label).join(", ")} (${l.opps})</p>
      ${can ? `<label class="field" for="m-po">Outcome<select id="m-po"><option value="interested">Interested</option><option value="not_interested">Not Interested</option><option value="attempted">Attempted (no answer)</option></select></label>` : '<p class="note">Calling is done by the CRE.</p>'}`,
      can ? [{ label: "Cancel" }, { label: "Save outcome", primary: true, onClick: r => { l.status = r.querySelector("#m-po").value; App.render(); App.toast(`${l.customer}: ${PLABEL[l.status]}`); } }] : undefined);
  };

  /* ---------- P8: Dealer's Screens (read-only): a TML position opens the dealer-side screens for a dealer in scope ---------- */
  H.exitref = () => App.exitRef();
  const refDealer = () => { const list = App.dealersUnder(App.home()), cur = S.filters.dealer || (["dealer", "division"].includes(U[S.unit].level) ? (U[S.unit].level === "dealer" ? S.unit : U[S.unit].parent) : null);
    return list.includes(cur) ? cur : list[0]; };
  H.refdealer = t => { S.filters.dealer = t.value; App.render(); };
  H.openref = t => { const sc = M.screens.observed.find(x => String(x.id) === t.dataset.id); App.enterRef(sc.role, sc.tab, refDealer(), sc.filters); };
  views.dealerscreens = tab => {
    const list = App.dealersUnder(App.home()), dealer = refDealer(), groups = ["CRM", "CRE", "PDA", "WSA", "JCC", "QIN", "DSA", "THD", "SPD"];
    const screens = M.screens.observed.filter(x => x.tab && x.launcher !== false);
    return App.pageHead("DEALER'S SCREENS (READ-ONLY)", tab) + App.scopeBanner({ bd: false, crumbs: false }) +
      `<p class="note" style="margin-top:-6px">TML positions do not operate the dealership's screens. To see what sits behind a number, open the dealer's own screens here: they are recreated from the screenshots and open <b>read-only</b> for the dealer you choose.</p>
      <div class="filters"><label for="f-dealer">Dealer<select id="f-dealer" data-hc="refdealer">${list.map(d => `<option value="${d}" ${d === dealer ? "selected" : ""}>${esc(U[d].name)} · ${esc(U[U[d].parent].name)}</option>`).join("")}</select></label>
        <span class="note">${list.length} dealer${list.length === 1 ? "" : "s"} in your scope</span></div>
      ${groups.map(g => `<h2 style="font-size:14px;margin:16px 0 8px">${esc(App.role(g).name)} <span class="note">(${g === "THD" ? "Technical Helpdesk team, not an app user" : "dealer position, not a TML user"})</span></h2>
        <div class="tiles">${screens.filter(x => x.role === g).map(x => `<button class="tile" data-h="openref" data-id="${x.id}"><span class="tile-top"><span class="tile-name">${esc(x.title)}<small>Screen ${String(x.id).padStart(2, "0")} · opens read-only</small></span></span><span class="chip blue">Observed</span></button>`).join("")}</div>`).join("")}` + App.actionsPanel();
  };

  /* ---------- P9: Product Leads, TML view (EW, AMC, RSA, TMI opportunities by unit, lead list, link to the dealer's screen) ---------- */
  const plAgg = rows => ({ total: rows.length, unassigned: rows.filter(r => !r.assignedTo).length, not_contacted: rows.filter(r => r.status === "not_contacted").length,
    attempted: rows.filter(r => r.status === "attempted").length, interested: rows.filter(r => r.status === "interested").length, not_interested: rows.filter(r => r.status === "not_interested").length,
    ew: rows.filter(r => r.ew).length, amc: rows.filter(r => r.amc).length, rsa: rows.filter(r => r.rsa).length, tmi: rows.filter(r => r.tmi).length });
  const plRows = unit => D.productLeads.filter(r => App.inScope(r, unit) && App.bdOk(r));
  H.openprod = () => App.enterRef("CRM", "prod", refDealer());
  views.prodtml = tab => {
    const f = S.filters, u = U[S.unit], rowsAll = plRows(S.unit), a = plAgg(rowsAll), q = App.norm(f.q || ""), list = App.dealersUnder(App.home()), dealer = refDealer();
    const st = [["Unassigned", a.unassigned, "#d93025"], ["Not Contacted", a.not_contacted, "#9aa3b2"], ["Attempted", a.attempted, "#e8910c"], ["Interested", a.interested, "#1e8e3e"], ["Not Interested", a.not_interested, "#6b7280"]];
    const donutSegs = st.map(([label, value, color]) => ({ label, value, color }));
    const flags = M.productLeads.flags.map(x => ({ label: `${x.label} (${x.full})`, n: a[x.id], id: x.id }));
    const mx = Math.max(1, ...flags.map(x => x.n)), reached = a.interested + a.not_interested;
    // breakdown by the level below, with a roll-up check
    let breakdown = "";
    if (u.children.length) {
      const kids = u.children.map(id => ({ id, a: plAgg(plRows(id)) })), keys = Object.keys(a), childLvl = App.levelLabel(U[u.children[0]].level), canDrill = App.can("drill_down");
      const ok = keys.every(k => kids.reduce((s2, r) => s2 + r.a[k], 0) === a[k]);
      const cols = [{ h: childLvl, f: r => canDrill ? `<button class="row-btn" data-unit="${r.id}">${esc(U[r.id].name)}</button>` : esc(U[r.id].name) },
        { h: "Product leads", num: 1, f: r => r.a.total }, { h: "Unassigned", num: 1, f: r => r.a.unassigned }, { h: "Not Contacted", num: 1, f: r => r.a.not_contacted }, { h: "Attempted", num: 1, f: r => r.a.attempted },
        { h: "Interested", num: 1, f: r => r.a.interested }, { h: "Not Interested", num: 1, f: r => r.a.not_interested },
        ...M.productLeads.flags.map(x => ({ h: `<abbr title="${esc(x.full)}">${x.label}</abbr>`, num: 1, f: r => r.a[x.id] })),
        { h: "Interest rate", num: 1, f: r => { const n = r.a.interested + r.a.not_interested; return n ? Math.round(100 * r.a.interested / n) + "%" : "–"; } }];
      const foot = `<tfoot><tr><td>Total ${esc(u.name)}</td><td class="num">${a.total}</td><td class="num">${a.unassigned}</td><td class="num">${a.not_contacted}</td><td class="num">${a.attempted}</td><td class="num">${a.interested}</td><td class="num">${a.not_interested}</td>
        ${M.productLeads.flags.map(x => `<td class="num">${a[x.id]}</td>`).join("")}<td class="num">${reached ? Math.round(100 * a.interested / reached) + "%" : "–"}</td></tr></tfoot>`;
      breakdown = `<section class="card" style="margin-bottom:16px"><div class="card-h">BY ${esc(childLvl.toUpperCase())} ${ok ? '<span class="check-ok link">✓ Rows add up to the total</span>' : '<span class="check-bad link">✗ Roll-up mismatch</span>'}</div><div class="card-b" style="padding:0">${table(cols, kids, "Product leads by " + childLvl, foot)}</div></section>`;
    }
    // lead list in the layout of the Product Leads screen
    const rows = rowsAll.filter(r => (!f.status || (f.status === "unassigned" ? !r.assignedTo : r.status === f.status)) && (!f.ppl || r.ppl === f.ppl) && (!q || [r.customer, r.mobile, r.reg].some(x => App.norm(x).includes(q))));
    App._exportRows = rows;
    const cols = prodCols({ lead: [{ h: "Customer Name", f: r => esc(r.customer) }], sev: true, dealer: true });
    return App.pageHead("PRODUCT LEADS · " + App.levelLabel(u.level).toUpperCase(), tab) + App.scopeBanner() +
      `<p class="note" style="margin-top:-6px">Product leads are sales opportunities found on a customer's vehicle (not service-due calls): ${M.productLeads.flags.map(x => `<b>${x.label}</b> = ${esc(x.full)}`).join(", ")}. The CRM at the dealership assigns them to CREs, who call the customer.</p>
      <div class="grid g4">${App.stat("🧾", a.total, "Product leads")}${App.stat("📥", a.unassigned, "Unassigned", "var(--red)")}${App.stat("✅", a.interested, "Interested", "var(--green)")}${App.stat("📈", reached ? Math.round(100 * a.interested / reached) + "%" : "–", "Interest rate (of those reached)", "var(--purple)")}</div>
      <div class="grid g2">${App.donutCard("Lead status", donutSegs, a.total, "Product leads")}
        <section class="card"><div class="card-h">OPPORTUNITY TYPES (LEADS WITH EACH)</div><div class="card-b"><div class="bars">${flags.map(x => `<div class="bar-row" style="grid-template-columns:170px 1fr 50px"><span>${esc(x.label)}</span><span class="bar" role="img" aria-label="${esc(x.label)} ${x.n}"><i style="width:${100 * x.n / mx}%;background:var(--blue)"></i></span><span class="v">${x.n}</span></div>`).join("")}</div>
          <p class="note" style="margin-top:10px">A lead can carry more than one opportunity type, so these counts add up to more than the number of leads.</p></div></section>
        </div>
      ${breakdown}
      <div class="filters" role="search">${inp("f-q", "Search name, mobile, reg no.", f.q)}${sel("f-status", "Status", [["unassigned", "Unassigned"], ...M.productLeads.statuses.filter(x => x.id !== "unassigned").map(x => [x.id, x.label])], f.status)}
        ${sel("f-ppl", "PPL", [...new Set(D.productLeads.map(l => l.ppl))], f.ppl)}<span class="grow"></span>${filterBtns()}</div>
      <div class="list-meta">${showing(rows.length)}<span class="right">${App.can("export") ? `<button class="btn" data-act="export">⬇ Export all ${rows.length} rows (CSV)</button>` : ""}</span></div>
      ${table(cols, pageRows(rows), "Product leads")}${pager(rows.length)}` + App.actionsPanel();
  };
})();
