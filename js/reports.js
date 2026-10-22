/* Reports & Trends (P29, proposed) and the record / export choosers of the action panel.
   - Trends: day by day numbers for every module in the TML scope (last 14 days to the next 7 days), with the change of the last 7 days
     against the 7 days before.
   - Reports: named reports per module; each downloads ALL rows in the TML scope (every page, current PV/EV selection), with a file name that
     says what it is, the scope and the date. The "Export" action and "View lists and records" open choosers that list them with row counts. */
(function () {
  const App = window.App, M = App.M, D = App.D, S = App.state, esc = App.esc, U = D.units, H = App.handlers, today = D.today;
  const views = App.modules.appointment.views, T = App.tmlui, { table } = App.ui, { head, dname, reg } = T;
  const inS = r => App.inScope({ dealer: r.dealer }) && (S.bd === "All" || r.bd === S.bd);
  const dmy = iso => iso ? iso.slice(0, 10) : "";
  const stageL = v => { const r = App.trk && App.trk.row(v); return r ? App.trk.STAGE_L[r.d.stage] : ""; };
  const MODN = { appointment: "Appointment", pickup_drop: "Pickup & Drop", security_guard: "Security Guard", jc: "Job Cards", eqc: "eQC & Washing", thd: "Technical Helpdesk", spd: "Spares (SPD)", claims: "Service Claims", cross: "TML journey" };

  /* ---------- reports: every row in scope ---------- */
  const C = (h, f) => [h, f];
  const REPORTS = [
    { id: "appointments", module: "appointment", tab: "list", name: "Appointments", desc: "Every appointment in your scope with its status",
      cols: [C("Appointment", r => r.id), C("Customer", r => r.customer), C("Mobile", r => r.mobile), C("Registration", r => r.reg), C("Model", r => r.ppl + " " + r.pl), C("Service type", r => r.serviceType), C("Date", r => r.date), C("Time", r => r.time), C("Channel", r => r.channel), C("Status", r => r.status), C("Dealership", r => dname(r.dealer)), C("PV/EV", r => r.bd)],
      rows: () => D.appointments.filter(inS) },
    { id: "conversion", module: "appointment", tab: "conv", name: "Appointment to job card, by dealership", desc: "Appointments, arrived, no-show, cancelled, job cards opened and conversion for each dealership",
      cols: [C("Dealership", r => dname(r.d)), C("Appointments", r => r.a), C("Arrived (Reported)", r => r.rep), C("No show", r => r.ns), C("Cancelled", r => r.can), C("Rescheduled", r => r.res), C("Job cards from appointments", r => r.jc), C("Conversion % (JC / closed out)", r => r.conv)],
      rows: () => App.dealersUnder(S.unit).map(d => { const ap = D.appointments.filter(a => a.dealer === d && (S.bd === "All" || a.bd === S.bd)), n = s => ap.filter(a => a.status === s).length, jc = D.visits.filter(v => v.dealer === d && v.apptId && v.jc && (S.bd === "All" || v.bd === S.bd)).length, closed = n("reported") + n("no_show") + n("cancelled");
        return { d, a: ap.length, rep: n("reported"), ns: n("no_show"), can: n("cancelled"), res: n("rescheduled"), jc, conv: closed ? Math.round(100 * jc / closed) : "" }; }) },
    { id: "vehicles", module: "cross", tab: "tracker", name: "Vehicles in service: stage, owner of the next step, stuck since", desc: "Every vehicle inside the dealerships, the module it waits on, who owns the next step and since when",
      cols: [C("Vehicle", r => r.v.reg), C("Model", r => r.v.model), C("Dealership", r => dname(r.v.dealer)), C("Job card", r => r.v.jc ? r.v.jc.id : ""), C("Current stage", r => stageL(r.v)), C("Waiting for", r => r.w ? r.w.item : ""), C("Module", r => r.w ? r.w.module : ""), C("Owner of the next step", r => r.w ? r.w.owner : ""), C("Next step", r => r.w ? r.w.next : ""), C("Stuck since", r => r.w && r.w.since != null ? new Date(r.w.since * 60000).toISOString().slice(0, 16).replace("T", " ") : ""), C("Waiting (hours)", r => r.w && r.w.wait != null ? (r.w.wait / 60).toFixed(1) : ""), C("Past its limit", r => r.w && r.w.over ? "Yes" : "")],
      rows: () => D.visits.filter(v => inS(v) && !v.delivered).map(v => ({ v, w: (App.vtl.waiting(v) || [])[0] })) },
    { id: "jobcards", module: "jc", tab: "jc_all", name: "Job cards", desc: "Every job card in your scope: type, stage, bay, technician, promised date",
      cols: [C("Job card", r => r.jc.id), C("Vehicle", r => r.reg), C("Model", r => r.model), C("Dealership", r => dname(r.dealer)), C("Type", r => r.jc.type), C("Status", r => r.jc.status), C("Stage", r => r.jc.stage), C("Bay", r => r.jc.bay || ""), C("Technician", r => r.jc.technician || ""), C("Promised date", r => r.jc.ptd), C("Age (days)", r => r.jc.ageDays), C("Rework cycles", r => r.jc.reworkCycles || 0)],
      rows: () => D.visits.filter(v => inS(v) && v.jc) },
    { id: "pickup", module: "pickup_drop", tab: "pdtml", name: "Pickup & Drop trips", desc: "Every pickup and drop trip with its status and driver",
      cols: [C("Trip", r => r.id), C("Date", r => r.date), C("Vehicle", r => r.reg), C("Customer", r => r.customer), C("Dealership", r => dname(r.dealer)), C("Mode", r => r.mode), C("Pickup status", r => r.pickupStatus), C("Drop status", r => r.dropStatus), C("Pickup driver", r => r.pickupDriver || ""), C("Drop driver", r => r.dropDriver || ""), C("Trip outcome", r => App.tripBucket(r))],
      rows: () => D.pickups.filter(inS) },
    { id: "gate", module: "security_guard", tab: "sgreg", name: "Gate movements", desc: "Every vehicle received at the gate: entry mode, road tests, delivery",
      cols: [C("Visit", r => r.id), C("Date", r => r.date), C("Gate-in hour", r => r.gateHour + ":" + String(r.gateMin).padStart(2, "0")), C("Vehicle", r => r.reg), C("Dealership", r => dname(r.dealer)), C("Entry mode", r => r.entryMode), C("Source", r => r.source), C("Road tests", r => r.roadTests.length), C("VIP", r => r.vip ? "Yes" : ""), C("Delivered", r => r.delivered ? "Yes" : "No")],
      rows: () => D.visits.filter(inS) },
    { id: "eqc", module: "eqc", tab: "eqc", name: "Quality check and washing", desc: "Every vehicle with its eQC result, rework cycles and wash",
      cols: [C("Visit", r => r.id), C("Vehicle", r => r.reg), C("Dealership", r => dname(r.dealer)), C("Job card", r => r.jc ? r.jc.id : ""), C("eQC result", r => r.eqc || ""), C("Rework cycles", r => r.jc ? r.jc.reworkCycles || 0 : 0), C("Washed", r => r.washed ? "Yes" : "No")],
      rows: () => D.visits.filter(v => inS(v) && (v.eqc || v.washed)) },
    { id: "thd", module: "thd", tab: "thd", name: "Technical helpdesk cases", desc: "Every THD case: team holding it, status, age",
      cols: [C("Case", r => r.id), C("Vehicle", r => r.reg), C("Model", r => r.model), C("Dealership", r => dname(r.dealer)), C("Status", r => r.status), C("With team", r => r.team || ""), C("Sub status", r => r.sub || ""), C("Closed with", r => r.closedWith || ""), C("Raised", r => r.raised.replace("T", " ")), C("Open hours", r => r.ageHours != null ? r.ageHours : "")],
      rows: () => D.thdCases.filter(inS) },
    { id: "mr", module: "spd", tab: "spd", name: "Spares: material requests (MR)", desc: "Every MR with its job card, stage and status",
      cols: [C("MR", r => r.id), C("Dealership", r => dname(r.dealer)), C("Job card", r => r.jc), C("Created", r => r.created.replace("T", " ")), C("Stage", r => r.stage), C("Status", r => r.status), C("Lines", r => r.lines), C("Service type", r => r.serviceType)],
      rows: () => D.spd.mrs.filter(inS) },
    { id: "pna", module: "spd", tab: "spd", name: "Spares: parts not available", desc: "Every part short on a job card and whether it is ordered",
      cols: [C("Part no.", r => r.part), C("Description", r => r.desc), C("MR", r => r.mr), C("Job card", r => r.jc), C("Dealership", r => dname(r.dealer)), C("Required", r => r.required), C("On hand", r => r.onHand), C("Short", r => r.short), C("Ordered", r => r.ordered ? "Yes" : "No")],
      rows: () => D.spd.pna.filter(inS) },
    { id: "claims", module: "claims", tab: "claims", name: "Service claims", desc: "Every claim of every type with status, age, amount and comment",
      cols: [C("Claim", r => r.id), C("Type", r => r.type), C("Status", r => r.status), C("Age (days)", r => r.age), C("Amount (₹)", r => r.amount), C("Job card", r => r.jc), C("Vehicle", r => r.reg), C("Dealership", r => dname(r.dealer)), C("Created", r => r.created.replace("T", " ")), C("Submitted", r => (r.submitted || "").replace("T", " ")), C("VCM comment", r => r.vcm || "")],
      rows: () => (D.claims || []).filter(inS) },
    { id: "followups", module: "cross", tab: "followups", name: "TML follow-ups and responses", desc: "Every follow-up TML raised: asked, priority, due date, status, dealer response, outcome",
      cols: [C("Follow-up", r => r.id), C("Module", r => r.module), C("Asked", r => (App.M.followUps.kinds.find(k => k.id === r.kind) || {}).label || r.kind), C("Vehicle", r => r.reg), C("Record", r => r.ref), C("Dealership", r => dname(r.dealer)), C("Raised by", r => r.raisedBy), C("Raised", r => r.raised.replace("T", " ")), C("Due", r => r.due), C("Priority", r => r.priority), C("Status", r => r.status), C("Dealer response", r => r.response || ""), C("Outcome", r => r.outcome || ""), C("Comments", r => (r.thread || []).length)],
      rows: () => (D.followUps || []).filter(inS) },
    { id: "decisions", module: "cross", tab: "followups", name: "TML decisions", desc: "Claims accepted or rejected and helpdesk cases referred, with who and when",
      cols: [C("Decision", r => r.id), C("Module", r => r.module), C("What", r => r.action), C("Record", r => r.ref), C("Vehicle", r => r.reg), C("Dealership", r => dname(r.dealer)), C("By", r => r.by), C("When", r => r.at.replace("T", " ")), C("Comment", r => r.note || "")],
      rows: () => (D.decisions || []).filter(inS) }
  ];
  const rowsOf = r => { try { return r.rows(); } catch (e) { return []; } };
  const fname = r => `${r.id}_${S.unit}_${S.bd}_${today}.csv`;
  const download = r => { const rows = rowsOf(r), text = "﻿" + [r.cols.map(c => `"${c[0]}"`).join(","), ...rows.map(x => r.cols.map(c => `"${String(c[1](x) ?? "").replace(/"/g, '""')}"`).join(","))].join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = fname(r); document.body.appendChild(a); a.click(); a.remove(); App.toast(`Downloaded ${r.name}: all ${rows.length} rows in your scope (${fname(r)})`); };
  H.rpDl = t => download(REPORTS.find(x => x.id === t.dataset.id));
  const scopeText = () => `${U[S.unit].name} · ${S.bd === "All" ? "PV and EV" : S.bd}`;

  /* ---------- choosers opened by the action panel ---------- */
  App.reports = {
    list: REPORTS,
    exportChooser: mod => { const order = [...REPORTS.filter(r => r.module === mod), ...REPORTS.filter(r => r.module !== mod)];
      App.modal("Export a report (CSV)", `<div class="rp-wide"></div><p class="note" style="margin-top:0">Each report downloads <b>all rows</b> in your scope (every page, not only what is on the screen) for ${esc(scopeText())}. Change the scope or PV / EV first if needed.</p>
        <div class="table-wrap"><table><caption class="sr-only">Reports</caption><thead><tr><th>Report</th><th>What it contains</th><th class="num">Rows</th><th></th></tr></thead><tbody>${order.map(r => `<tr><td><b>${esc(r.name)}</b><br><small class="note">${esc(MODN[r.module])}</small></td><td>${esc(r.desc)}</td><td class="num">${rowsOf(r).length}</td><td><button class="btn small primary" data-h="rpDl" data-id="${r.id}">Download CSV</button></td></tr>`).join("")}</tbody></table></div>`); },
    listChooser: () => { const n = r => rowsOf(r).length;
      App.modal("View which records?", `<div class="rp-wide"></div><p class="note" style="margin-top:0">Lists in ${esc(scopeText())}. Choose the records you want to see.</p><div class="table-wrap"><table><caption class="sr-only">Record lists</caption><tbody>${REPORTS.filter(r => !["conversion", "decisions"].includes(r.id)).map(r => `<tr><td><b>${esc(r.name)}</b><br><small class="note">${esc(MODN[r.module])}</small></td><td class="num">${n(r)}</td><td><button class="btn small primary" data-h="rpOpen" data-tab="${r.tab}" data-id="${r.id}">Open the list</button></td></tr>`).join("")}</tbody></table></div>`); }
  };
  H.rpOpen = t => { const r = REPORTS.find(x => x.id === t.dataset.id); const mb = document.querySelector("#modal-root"); if (mb) mb.innerHTML = ""; App.go(t.dataset.tab, r.id === "claims" ? { sec: "all" } : r.id === "mr" ? { sec: "mr" } : r.id === "pna" ? { sec: "pna" } : {}); };

  /* ---------- trends: day by day ---------- */
  const SERIES = [
    { id: "appts", label: "Appointments (by appointment date)", f: () => D.appointments.filter(inS).map(a => a.date) },
    { id: "received", label: "Vehicles received at the gate", f: () => D.visits.filter(inS).map(v => v.date) },
    { id: "jcs", label: "Job cards opened", f: () => D.visits.filter(v => inS(v) && v.jc).map(v => v.date) },
    { id: "delivered", label: "Vehicles delivered", f: () => D.visits.filter(v => inS(v) && v.delivered).map(v => v.outDate || v.date) },
    { id: "pd", label: "Pickup & Drop trips", f: () => D.pickups.filter(inS).map(p => p.date) },
    { id: "thd", label: "Helpdesk cases raised", f: () => D.thdCases.filter(inS).map(c => c.raised.slice(0, 10)) },
    { id: "mr", label: "Material requests raised", f: () => D.spd.mrs.filter(inS).map(r => r.created.slice(0, 10)) },
    { id: "claims", label: "Claims created", f: () => (D.claims || []).filter(inS).map(c => c.created.slice(0, 10)) },
    { id: "fu", label: "TML follow-ups raised", f: () => (D.followUps || []).filter(inS).map(x => x.raised.slice(0, 10)) }
  ];
  const addD = (iso, n) => { const d = new Date(iso + "T00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const DAYS = Array.from({ length: 21 }, (_, i) => addD(today, i - 13));
  const byDay = s => { const m = Object.fromEntries(DAYS.map(d => [d, 0])); for (const d of s.f()) if (d in m) m[d]++; return m; };
  const chart = (vals, labels) => { const mx = Math.max(1, ...vals), W = 640, Hh = 150, bw = W / vals.length;
    return `<svg viewBox="0 0 ${W} ${Hh + 36}" role="img" aria-label="Daily numbers" style="width:100%;max-width:${W}px">${vals.map((v, i) => { const h = Math.round(v / mx * Hh), fut = labels[i] > today, tod = labels[i] === today;
      return `<g><rect x="${i * bw + 3}" y="${Hh - h + 4}" width="${bw - 6}" height="${h}" rx="3" fill="${fut ? "#c9d8f5" : tod ? "#d98a00" : "#1a56db"}"/><text x="${i * bw + bw / 2}" y="${Hh - h}" text-anchor="middle" font-size="10" fill="#444">${v || ""}</text><text x="${i * bw + bw / 2}" y="${Hh + 18}" text-anchor="middle" font-size="9" fill="#666">${labels[i].slice(8)}</text></g>`; }).join("")}<text x="0" y="${Hh + 33}" font-size="9" fill="#666">Day of month · blue = past, amber = today (${today}), light = coming days</text></svg>`; };
  views.reports = tab => { const f = S.filters, sec = f.sec === "reports" ? "reports" : "trends", sid = (SERIES.find(x => x.id === f.tm) || SERIES[0]).id, s = SERIES.find(x => x.id === sid);
    const seg = `<div class="icon-btns" role="group" aria-label="Reports section" style="gap:8px;margin:10px 0">${[["trends", "Trends by day"], ["reports", "Reports to download"]].map(([k, l]) => `<button class="pillbtn${sec === k ? " on" : ""}" data-h="tmlset" data-k="sec" data-v="${k}" aria-pressed="${sec === k}">${l}</button>`).join("")}</div>`;
    let body;
    if (sec === "trends") {
      const data = byDay(s), vals = DAYS.map(d => data[d]), last7 = DAYS.filter(d => d <= today).slice(-7).reduce((a, d) => a + data[d], 0), prev7 = DAYS.filter(d => d <= today).slice(-14, -7).reduce((a, d) => a + data[d], 0), delta = prev7 ? Math.round(100 * (last7 - prev7) / prev7) : null;
      const all = SERIES.map(x => [x, byDay(x)]);
      body = `<div class="icon-btns" role="group" aria-label="Measure" style="gap:8px;flex-wrap:wrap;margin:6px 0">${SERIES.map(x => `<button class="pillbtn${sid === x.id ? " on" : ""}" data-h="tmlset" data-k="tm" data-v="${x.id}" aria-pressed="${sid === x.id}">${esc(x.label)}</button>`).join("")}</div>
        <section class="card"><div class="card-h">${esc(s.label.toUpperCase())} · ${esc(scopeText().toUpperCase())}</div><div class="card-b">${chart(vals, DAYS)}
        <p style="margin:8px 0 0"><b>${last7}</b> in the last 7 days to ${today} · <b>${prev7}</b> in the 7 days before ${delta == null ? "" : `· <b class="${delta < 0 ? "txt-red" : "txt-green"}">${delta > 0 ? "+" : ""}${delta}%</b> change`}</p></div></section>
        <section class="card" style="margin-top:14px"><div class="card-h">ALL MEASURES BY DAY</div><div class="card-b" style="padding:0"><div class="table-wrap"><table><caption class="sr-only">All measures by day</caption><thead><tr><th>Day</th>${all.map(([x]) => `<th class="num">${esc(x.label.replace(/ \(.*\)/, ""))}</th>`).join("")}</tr></thead><tbody>${DAYS.map(d => `<tr${d === today ? ' style="font-weight:700"' : ""}><td>${d}${d === today ? " (today)" : d > today ? " (coming)" : ""}</td>${all.map(([x, m]) => `<td class="num">${m[d]}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div></section>`;
    } else body = `<section class="card"><div class="card-h">REPORTS · ALL ROWS IN YOUR SCOPE · ${esc(scopeText().toUpperCase())}</div><div class="card-b" style="padding:0">${table([{ h: "Report", f: r => `<b>${esc(r.name)}</b><br><small class="note">${esc(MODN[r.module])}</small>` }, { h: "What it contains", f: r => esc(r.desc) }, { h: "Rows", num: 1, f: r => rowsOf(r).length }, { h: "", f: r => `<button class="btn small primary" data-h="rpDl" data-id="${r.id}">Download CSV</button> <button class="btn small" data-h="rpOpen" data-tab="${r.tab}" data-id="${r.id}">Open the list</button>` }], REPORTS, "Reports")}</div></section>`;
    const chk = rowsOf(REPORTS[0]).length === rowsOf(REPORTS[1]).reduce((n, x) => n + x.a, 0) && rowsOf(REPORTS[3]).length === D.visits.filter(v => inS(v) && v.jc).length, check = chk ? '<span class="check-ok link">✓ Report rows add up (appointments = sum over dealerships; job cards = visits with a job card)</span>' : '<span class="check-bad link">✗ Report rows do not add up</span>';
    return head("REPORTS & TRENDS", tab, "Trends day by day for every module in your scope, and named reports that download every row in your scope (not only the page on the screen). Numbers follow the PV / EV switch and the scope bar.") + `<p style="margin:4px 0">${check}</p>` + seg + body + App.actionsPanel(); };
})();
