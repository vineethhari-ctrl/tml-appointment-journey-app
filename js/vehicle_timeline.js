/* Vehicle timeline (P23 vehicle page): ONE chronological list of everything that happened to the vehicle across all modules (appointment,
   pickup & drop, gate, JC, parts, helpdesk, eQC / washing, claims, TML follow-ups), and a "Waiting on" table: what the vehicle is waiting for now,
   who owns the next step and since when (stuck since). Built from the linked visit record; nothing is stored here. */
(function () {
  const App = window.App, D = App.D, esc = App.esc, U = D.units;
  const OWNER = { appt: "Security Guard", sa: "Service Advisor", jco: "Job Controller", tech: "Job Controller", job: "Technician", qc: "Quality Inspector", wash: "Washing team", close: "Job Controller", inv: "Service Advisor", ready: "Service Advisor", drop: "Pickup & Drop team" };
  const dn = id => (U[id] || {}).name || id;
  App.vtl = {
    events: v => { const T = App.trk, r = T.row(v), t = v.touch.t, S0 = v.touch.s, jc = v.jc, ev = [], ok = T.isT;
      const add = (at, module, title, who, state = "done") => ev.push({ at, module, title, who: who || "–", state });
      const a = v.apptId && D.appointments.find(x => x.id === v.apptId), p = v.pickup && D.pickups.find(x => x.id === v.pickup);
      if (a) add(a.date, "Appointment", `${a.id} · ${a.serviceType} · ${a.status.replace("_", " ")}`, a.advisor);
      if (p) add(p.date, "Pickup & Drop", `${p.id} · pickup ${p.pickupStatus}, drop ${p.dropStatus}`, p.pickupDriver || p.pickupManagedBy, p.pickupStatus === "Pickup Done" || p.pickupStatus === "NA" ? "done" : "wip");
      if (ok(t.gate)) add(t.gate, "Security Guard", `Gate in · ${v.entryMode}`, v.guard);
      if (ok(t.sa)) add(t.sa, "Reception", "Service Advisor allocated", v.sa);
      if (jc && ok(t.jco)) add(t.jco, "Job Card", `${jc.id} opened (${jc.type})`, v.touch.jcN);
      if (jc && ok(t.tech)) add(t.tech, "Job Card", "Technician allocated" + (jc.bay ? " · " + jc.bay : ""), jc.technician);
      if (jc && ok(S0.job)) add(S0.job, "Job Card", "Job work started", jc.technician);
      for (const q of (v.touch.pauses || [])) add(q.s, "Job Card", `Paused: ${q.r}${q.e ? "" : " (still paused)"}`, jc && jc.technician, q.e ? "done" : "blocked");
      if (jc && D.spd) { for (const m of D.spd.mrs.filter(x => x.jc === jc.id)) add(m.created, "Spares (SPD)", `${m.id} · ${m.stage} · ${m.status}`, "Dealer Part Manager (DPM)", m.status === "Open" ? "wip" : "done");
        for (const l of D.spd.pna.filter(x => x.jc === jc.id)) add(l.created, "Spares (SPD)", `Part not available: ${l.part} (short ${l.short})${l.ordered ? ", ordered" : ", not ordered"}`, "Dealer Part Manager (DPM)", l.ordered ? "wip" : "blocked"); }
      for (const c of D.thdCases.filter(x => x.visit === v.id)) add(c.raised, "Technical Helpdesk", `${c.id} · ${c.status === "open" ? "with " + c.team : "closed" + (c.closedWith ? " (" + c.closedWith + ")" : "")}`, c.status === "open" ? c.team : "Product Reliability", c.status === "open" ? "blocked" : "done");
      if (ok(t.qc)) add(t.qc, "eQC / Washing", `Quality check${v.eqc ? " · " + v.eqc : ""}${jc && jc.reworkCycles ? " · rework done" : ""}`, v.touch.qcN);
      if (ok(t.wash)) add(t.wash, "eQC / Washing", "Washing done", "Washing team");
      if (ok(t.close)) add(t.close, "Job Card", "Job card closed", v.touch.jcN);
      if (ok(t.inv)) add(t.inv, "Job Card", "Invoice raised", v.sa);
      if (ok(t.drop) && t.drop !== t.inv) add(t.drop, "Pickup & Drop", "Drop done", (p && p.dropDriver) || "–");
      for (const c of (D.claims || []).filter(x => x.visit === v.id)) add(c.created, "Service Claims", `${c.id} · ${c.type} · ${c.status}, ${c.age} days`, "Dealer claim manager", c.status === "Created" || c.status === "Submitted" ? (c.age > App.M.claims.agedDays ? "blocked" : "wip") : "done");
      for (const f of (D.followUps || []).filter(x => x.visit === v.id)) add(f.raised, "TML follow-up", `${f.id} · ${App.M.followUps.kinds.find(k => k.id === f.kind).label} · ${f.status}${f.due < D.today && f.status !== "Closed" ? " (overdue)" : ""}`, f.raisedBy + " → Dealer GM", f.status === "Closed" ? "done" : f.due < D.today ? "blocked" : "wip");
      for (const x of (D.decisions || []).filter(y => y.visit === v.id)) add(x.at, "TML decision", `${x.action} ${x.ref}${x.note ? " · " + x.note : ""}`, x.by + " → Dealer GM");
      if (v.delivered) add(v.outDate || D.today, "Delivery", "Vehicle delivered, gate out", "–");
      return ev.sort((x, y) => x.at.localeCompare(y.at)); },
    waiting: v => { const T = App.trk, r = T.row(v), out = [], d = r && r.d; const now = Date.parse(D.now) / 60000;
      if (d && d.stage !== "delivered") out.push({ item: T.STAGE_L[d.stage] + (d.paused ? " (paused)" : ""), module: d.stage === "appt" ? "Security Guard" : "Job Card", owner: `${T.ownerOf(r) || "–"} (${OWNER[d.stage] || "Dealer"})`, next: T.nextAction(r), since: d.entered != null ? d.entered : null, over: d.level === "over" || d.paused, target: d.target });
      if (v.jc && D.spd) for (const l of D.spd.pna.filter(x => x.jc === v.jc.id && !x.ordered)) out.push({ item: `Part not ordered: ${l.part}`, module: "Spares (SPD)", owner: "Dealer Part Manager (DPM)", next: "Order the part", since: Date.parse(l.created) / 60000, over: true });
      for (const c of D.thdCases.filter(x => x.visit === v.id && x.status === "open")) out.push({ item: `THD ${c.id}`, module: "Technical Helpdesk", owner: c.team, next: "Investigate and refer or close", since: Date.parse(c.raised) / 60000, over: c.ageHours >= 48 });
      for (const c of (D.claims || []).filter(x => x.visit === v.id && (x.status === "Created" || x.status === "Submitted"))) out.push({ item: `Claim ${c.id} (${c.status})`, module: "Service Claims", owner: "Dealer claim manager", next: c.status === "Created" ? "Submit the claim" : "Await approval", since: Date.parse(c.created) / 60000, over: c.age > App.M.claims.agedDays });
      for (const f of (D.followUps || []).filter(x => x.visit === v.id && x.status !== "Closed")) out.push({ item: `${f.id} ${App.M.followUps.kinds.find(k => k.id === f.kind).label}`, module: "TML follow-up", owner: "Dealer GM", next: f.status === "Responded" ? "TML to close" : "Dealer to respond", since: Date.parse(f.raised) / 60000, over: f.due < D.today });
      return out.map(o => ({ ...o, wait: o.since != null ? now - o.since : null })).sort((a, b) => (b.wait || -1) - (a.wait || -1)); },
    card: v => { const T = App.trk, ev = App.vtl.events(v), w = App.vtl.waiting(v), st = { done: "green", wip: "blue", blocked: "red" };
      const wt = w.length ? `<div class="table-wrap"><table><caption class="sr-only">What this vehicle is waiting for</caption><thead><tr><th>Waiting for</th><th>Module</th><th>Owner of the next step</th><th>Next step</th><th>Stuck since</th><th class="num">Waiting</th></tr></thead><tbody>${w.map((o, i) => `<tr><td>${i === 0 && w.length > 1 ? "<b>" : ""}${esc(o.item)}${i === 0 && w.length > 1 ? "</b>" : ""}</td><td>${esc(o.module)}</td><td>${esc(o.owner)}</td><td>${esc(o.next)}</td><td>${o.since != null ? esc(T.shortT(o.since * 60000)) : "–"}</td><td class="num"><span class="${o.over ? "txt-red" : ""}">${o.wait != null ? T.dur(o.wait) : "–"}${o.over ? " ●" : ""}</span></td></tr>`).join("")}</tbody></table></div>` : '<p class="note">Nothing pending: the vehicle is delivered and every record is closed.</p>';
      return `<section class="card" style="margin-top:14px"><div class="card-h">WHO OWNS THE NEXT STEP · STUCK SINCE <span class="badge proposed">Proposed</span></div><div class="card-b" style="padding:0">${wt}<p class="note" style="margin:8px 14px">Red dot: past its target or limit (job stage targets are the BA's illustrative values; THD 48 hours; claims over ${App.M.claims.agedDays} days; follow-up past its due date). The longest wait is in bold.</p></div></section>
        <section class="card" style="margin-top:14px"><div class="card-h">VEHICLE TIMELINE · ALL MODULES · ${ev.length} EVENTS</div><div class="card-b" style="padding:0"><div class="table-wrap"><table><caption class="sr-only">Vehicle timeline across all modules</caption><thead><tr><th>When</th><th>Module</th><th>What</th><th>By</th><th>State</th></tr></thead><tbody>${ev.map(e => `<tr><td>${esc(e.at.length > 10 ? T.shortT(e.at) : e.at.slice(8, 10) + "-" + e.at.slice(5, 7))}</td><td>${esc(e.module)}</td><td>${esc(e.title)}</td><td>${esc(e.who)}</td><td>${App.chip({ done: "Done", wip: "In progress", blocked: "Blocked" }[e.state], st[e.state])}</td></tr>`).join("")}</tbody></table></div></div></section>`; }
  };
})();
