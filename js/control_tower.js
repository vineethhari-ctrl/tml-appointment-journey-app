/* Control Tower (P6) and Modules (P7): TML views that link all dealership modules through one visit record
   (appointment -> pickup & drop -> gate -> reception -> JC -> eQC / washing -> helpdesk -> parts -> authorization / claim
   -> delivery -> feedback). Proposed screens; every figure is computed live from D.visits / D.pickups / appointments,
   so roll-ups always add up. */
(function () {
  const App = window.App, M = App.M, D = App.D, S = App.state, esc = App.esc, U = D.units, H = App.handlers;
  const views = App.modules.appointment.views;
  const CT = M.controlTower, MODS = M.modules.items, HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const KEYS = ["visits", "visitsAppt", "visitsWalk", "pickupVisits", "pickupJc", "pdTotal", "pdUnassigned", "pdDelayed", "pdCancelled", "pdCompleted", "pdProgress", "drivers", "jcs", "jcMech", "jcMechClosed", "jcMechTat", "jcBody", "jcBodyClosed", "jcBodyTat",
    "jcUnassigned", "jcWaitParts", "jcRework", "jcPtdOver", "qcQueue", "washQueue", "bayUsed", "baysTotal", "jcOpen", "jcProg", "jcReady", "jcClosed", "jcOver3", "tatSum", "tatN", "apptJc", "jcOpenA", "jcProgA", "jcReadyA", "jcClosedA", "eqcPassed", "eqcFailed", "washed", "thdRaised", "thdResolved", "thdOpen", "thdDays",
    "fuOpen", "jcMechLate", "jcBodyLate", "trkAttn", "clTotal", "clCreated", "clSubmitted", "clAccepted", "clSettled", "clRejected", "clAged", "spdOpenMr", "spdPna", "spdPend", "spdRet", "spdQry", "spdUni", "spdSched", "thdActive", "thdGt48", "thdAct", "thdRef", "thdEw", "thdPf", "spdIssued", "spdPending", "authReq", "authApproved", "authPending", "authRejected", "authHours", "claims", "claimsApproved", "claimValue", "delivered", "ratingN", "ratingSum", "revisit", "rtOut", "rtIn", "rtActive", "rtActive20", "rfidAuto", "vipRv", "plTotal", "plUnassigned", "plInterested", "plNotInterested", ...HOURS.map(h => "gh" + h)];
  const ST = { open: "jcOpen", in_progress: "jcProg", ready: "jcReady", closed: "jcClosed" };

  /* A Pickup & Drop trip is counted once, by the first rule that applies: cancelled, delayed, driver not assigned, completed, otherwise in progress. */
  App.tripBucket = p => {
    const req = [p.pickupStatus, p.dropStatus].filter(x => x !== "NA");
    if (req.includes("Cancelled")) return "cancelled";
    if (req.includes("Delayed")) return "delayed";
    if (req.includes("Driver Not Assigned")) return "unassigned";
    return req.every(x => x === "Pickup Done" || x === "Drop Done") ? "completed" : "progress";
  };
  /* ---------- metrics from the linked records ---------- */
  App.tm = (unitId, bd = S.bd) => {
    const m = Object.fromEntries(KEYS.map(k => [k, 0]));
    const ok = r => App.inScope(r, unitId) && (bd === "All" || r.bd === bd);
    for (const v of D.visits) {
      if (!ok(v)) continue;
      m.visits++; v.source === "Appointment" ? m.visitsAppt++ : m.visitsWalk++; m["gh" + v.gateHour]++;
      if (v.pickup) { m.pickupVisits++; if (v.jc) m.pickupJc++; }
      if (v.jc) {
        const st = v.jc.status; m.jcs++; m[ST[st]]++;
        if (v.jc.type === "Mechanical") { m.jcMech++; if (st === "closed") { m.jcMechClosed++; m.jcMechTat += v.jc.tatDays; } }
        else { m.jcBody++; if (st === "closed") { m.jcBodyClosed++; m.jcBodyTat += v.jc.tatDays; } }
        if (st !== "closed" && v.jc.ageDays > 3) m.jcOver3++;
        const sg = v.jc.stage; if (sg === "unassigned") m.jcUnassigned++; if (sg === "waiting_parts") m.jcWaitParts++; if (v.jc.reworkCycles) m.jcRework++;
        if (st !== "closed" && v.jc.ptd < D.today) { m.jcPtdOver++; if (v.jc.type === "Mechanical") m.jcMechLate++; else m.jcBodyLate++; } if (sg === "qc_queue" || sg === "qc_in_progress") m.qcQueue++; if (sg === "washing_queue" || sg === "washing_wip") m.washQueue++; if (st !== "closed" && v.jc.bay) m.bayUsed++;
        if (st === "closed") { m.tatSum += v.jc.tatDays; m.tatN++; }
        if (v.source === "Appointment") { m.apptJc++; m[ST[st] + "A"]++; }
      }
      if (v.eqc === "passed") m.eqcPassed++; else if (v.eqc === "failed") m.eqcFailed++;
      if (v.washed) m.washed++;
      if (v.thd) { m.thdRaised++; if (v.thd.status === "resolved") { m.thdResolved++; m.thdDays += v.thd.days; } else m.thdOpen++; }
      if (v.spd) v.spd.status === "issued" ? m.spdIssued++ : m.spdPending++;
      if (v.auth) { m.authReq++; m.authHours += v.auth.hours; m[{ approved: "authApproved", pending: "authPending", rejected: "authRejected" }[v.auth.status]]++; }
      if (v.claim) { m.claims++; if (v.claim.status === "approved") { m.claimsApproved++; m.claimValue += v.claim.amount; } }
      if (App.trk && App.trk.attn().has(v.id)) m.trkAttn++;
      if (v.delivered) m.delivered++;
      if (v.rating) { m.ratingN++; m.ratingSum += v.rating; }
      if (v.revisit) m.revisit++;
      if (v.entryMode === "RFID Auto-Gate") m.rfidAuto++;
      if (v.vip || v.rv) m.vipRv++;
      v.roadTests.forEach(t => { m.rtOut++; if (t.returned) m.rtIn++; else { m.rtActive++; if (t.minutes > 20) m.rtActive20++; } });
    }
    for (const r of D.productLeads) { if (!ok(r)) continue; m.plTotal++; if (!r.assignedTo) m.plUnassigned++; if (r.status === "interested") m.plInterested++; else if (r.status === "not_interested") m.plNotInterested++; }
    for (const p of D.pickups) { if (!ok(p)) continue; m.pdTotal++; m[{ unassigned: "pdUnassigned", delayed: "pdDelayed", cancelled: "pdCancelled", completed: "pdCompleted", progress: "pdProgress" }[App.tripBucket(p)]]++; }
    for (const f of D.followUps || []) if (ok(f) && f.status !== "Closed") m.fuOpen++;
    const clKey = { Created: "clCreated", Submitted: "clSubmitted", Accepted: "clAccepted", Settled: "clSettled", Rejected: "clRejected" };
    for (const c of D.claims || []) { if (!ok(c)) continue; m.clTotal++; m[clKey[c.status]]++; if ((c.status === "Created" || c.status === "Submitted") && c.age > M.claims.agedDays) m.clAged++; }
    for (const c of D.thdCases) { if (!ok(c)) continue; if (c.status === "open") { m.thdActive++; if (c.ageHours >= 48) m.thdGt48++; if (c.actionable) m.thdAct++; if (c.sub === "toCoc" || c.sub === "toPlant") m.thdRef++; } else if (c.closedWith === "Early Warning") m.thdEw++; else if (c.closedWith === "Product Feedback") m.thdPf++; }
    if (D.spd) { for (const r of D.spd.mrs) if (ok(r) && r.status === "Open") m.spdOpenMr++; for (const l of D.spd.pna) if (ok(l)) { m.spdPna++; if (!l.ordered) m.spdPend++; } m.spdRet += D.spd.returns.filter(ok).length; m.spdQry += D.spd.queries.filter(r => ok(r) && r.status === "Open").length; m.spdUni += D.spd.unidentified.filter(ok).length;
      const lim = new Date(D.today); lim.setDate(lim.getDate() + 7); const limS = lim.toISOString().slice(0, 10); for (const a of D.appointments) if (ok(a) && ["booked", "confirmed", "rescheduled"].includes(a.status) && a.date > D.today && a.date <= limS) m.spdSched++; }
    m.baysTotal = U[unitId].level === "division" ? null : App.dealersUnder(unitId).length * M.sandbox.jc.bays.length;
    m.drivers = U[unitId].level === "division" ? null : App.dealersUnder(unitId).reduce((s, d) => s + (U[d].drivers || 0), 0);
    return m;
  };
  const pct = (a, b) => b ? Math.round(100 * a / b) : null;
  const avg = (a, b) => b ? Math.round(10 * a / b) / 10 : null;
  const peak = m => { const mx = Math.max(...HOURS.map(h => m["gh" + h])); return mx ? `${HOURS.filter(h => m["gh" + h] === mx).map(h => h + ":00").join(", ")}` : null; };
  /* KPI formulas (ids are listed per module in model.json) */
  const KPI = {
    appts: m => m.appts, show_rate: m => pct(m.reported, m.reported + m.no_show), confirmed: m => m.confirmed, rescheduled: m => m.rescheduled, cancelled: m => m.cancelled, no_show: m => m.no_show,
    pd_total: m => m.pdTotal, pd_unassigned: m => m.pdUnassigned, pd_delayed: m => m.pdDelayed, pd_cancelled: m => m.pdCancelled, pd_completed: m => m.pdCompleted,
    pd_completion: m => pct(m.pdCompleted, m.pdTotal), pd_drivers: m => m.drivers, pd_jc_conv: m => pct(m.pickupJc, m.pickupVisits),
    visits: m => m.visits, visits_appt: m => m.visitsAppt, visits_walk: m => m.visitsWalk, appt_share: m => pct(m.visitsAppt, m.visits), jc_conv: m => pct(m.jcs, m.visits),
    sg_gate_in: m => m.visits, sg_gate_out: m => m.delivered, sg_rt_out: m => m.rtOut, sg_rt_in: m => m.rtIn, sg_inside: m => m.jcs - m.jcClosed, sg_active_rt: m => m.rtActive,
    sg_active_rt20: m => m.rtActive20, sg_ageing: m => m.jcOver3, sg_vip_rv: m => m.vipRv, sg_rfid: m => pct(m.rfidAuto, m.visits), inflow_avg: m => avg(m.visits, CT.windowDays), peak_hour: peak,
    mech_jcs: m => m.jcMech, mech_open: m => m.jcMech - m.jcMechClosed, mech_closed: m => m.jcMechClosed, mech_tat: m => avg(m.jcMechTat, m.jcMechClosed),
    body_jcs: m => m.jcBody, body_open: m => m.jcBody - m.jcBodyClosed, body_closed: m => m.jcBodyClosed, body_tat: m => avg(m.jcBodyTat, m.jcBodyClosed),
    jc_total: m => m.jcs, jc_open: m => m.jcOpen, jc_prog: m => m.jcProg, jc_ready: m => m.jcReady, jc_closed: m => m.jcClosed, jc_over3: m => m.jcOver3, jc_tat: m => avg(m.tatSum, m.tatN),
    eqc_done: m => m.eqcPassed + m.eqcFailed, eqc_pass: m => pct(m.eqcPassed, m.eqcPassed + m.eqcFailed), eqc_failed: m => m.eqcFailed, washed: m => m.washed,
    spd_open_mr: m => m.spdOpenMr, spd_pna: m => m.spdPna, spd_pending: m => m.spdPend, spd_returns: m => m.spdRet, spd_queries: m => m.spdQry, spd_unident: m => m.spdUni, spd_sched7: m => m.spdSched,
    thd_active: m => m.thdActive, thd_gt48: m => m.thdGt48, thd_actionable: m => m.thdAct, thd_referred: m => m.thdRef, thd_closed_ew: m => m.thdEw, thd_closed_pf: m => m.thdPf,
    thd_raised: m => m.thdRaised, thd_resolved: m => m.thdResolved, thd_open: m => m.thdOpen, thd_days: m => avg(m.thdDays, m.thdResolved),
    spd_requests: m => m.spdIssued + m.spdPending, spd_fill: m => pct(m.spdIssued, m.spdIssued + m.spdPending), spd_pending: m => m.spdPending,
    auth_req: m => m.authReq, auth_rate: m => pct(m.authApproved, m.authReq), auth_pending: m => m.authPending, auth_rejected: m => m.authRejected, auth_hours: m => avg(m.authHours, m.authReq),
    attn_appt: m => m.no_show, attn_pd: m => m.pdUnassigned + m.pdDelayed, attn_sg: m => m.rtActive20, attn_mech: m => m.jcMechLate, attn_body: m => m.jcBodyLate, attn_trk: m => m.trkAttn,
    attn_eqc: m => m.jcRework, attn_thd: m => m.thdGt48, attn_spd: m => m.spdPend, attn_claims: m => m.clAged,
    cj_inservice: m => m.visits - m.delivered, fu_open: m => m.fuOpen,
    cl_total: m => m.clTotal, cl_created: m => m.clCreated, cl_submitted: m => m.clSubmitted, cl_accepted: m => m.clAccepted, cl_settled: m => m.clSettled, cl_rejected: m => m.clRejected, cl_aged: m => m.clAged,
    claims: m => m.claims, claim_value: m => m.claimValue,
    pl_total: m => m.plTotal, pl_unassigned: m => m.plUnassigned, pl_interested: m => m.plInterested, pl_interest_rate: m => pct(m.plInterested, m.plInterested + m.plNotInterested),
    trk_unassigned: m => m.jcUnassigned, trk_wait_parts: m => m.jcWaitParts, trk_ptd_over: m => m.jcPtdOver, trk_bay_used: m => m.bayUsed, trk_bay_util: m => m.baysTotal ? pct(m.bayUsed, m.baysTotal) : null,
    qi_pending: m => m.qcQueue, qi_rework: m => m.jcRework, wash_queue: m => m.washQueue,
    delivered: m => m.delivered, ratings: m => m.ratingN, rating_avg: m => avg(m.ratingSum, m.ratingN), revisit: m => m.revisit
  };
  App.kpi = { defs: KPI, all: unit => ({ ...App.metrics(unit), ...App.tm(unit) }), fmt: (def, v) => fmt(def, v) };
  const fmt = (def, v) => v == null ? "–" : def.kind === "pct" ? v + "%" : def.kind === "amount" ? "₹" + Number(v).toLocaleString("en-IN") : def.kind === "avg" ? v.toFixed(1) : def.kind === "text" ? esc(v) : Number(v).toLocaleString("en-IN");
  const bar = (label, n, total, color, extra = "", cols = "150px 1fr 110px") => `<div class="bar-row" style="grid-template-columns:${cols}"><span>${label}</span><span class="bar" role="img" aria-label="${esc(label)} ${n}"><i style="width:${Math.min(100, App.pct(n, total))}%;background:${color}"></i></span><span class="v">${n} <small class="note">${total ? App.pct(n, total) + "%" : ""}${extra}</small></span></div>`;

  /* ---------- scorecard, thresholds, alerts ---------- */
  const scoreOf = (a, t) => ({
    show_rate: [pct(a.reported, a.reported + a.no_show), a.reported + a.no_show], jc_conv: [pct(t.jcs, t.visits), t.visits], tat: [avg(t.tatSum, t.tatN), t.tatN],
    jc_over3: [pct(t.jcOver3, t.jcs - t.jcClosed), t.jcs - t.jcClosed], conv: [pct(t.apptJc, a.reported + a.no_show + a.cancelled), a.reported + a.no_show + a.cancelled], rfid: [pct(t.rfidAuto, t.visits), t.visits], auth_rate: [pct(t.authApproved, t.authReq), t.authReq], rating: [avg(t.ratingSum, t.ratingN), t.ratingN]
  });
  const rag = (th, v, n) => {
    if (v == null || n < th.minSample) return "na";
    if (th.dir === "min") return v >= th.value ? "g" : v >= th.value * 0.9 ? "a" : "r";
    return v <= th.value ? "g" : v <= th.value * 1.1 ? "a" : "r";
  };
  const ragCell = (th, v, n) => { const r = rag(th, v, n), word = { g: "meets threshold", a: "within 10% of threshold", r: "worse than threshold", na: "too few records" }[r];
    return `<td class="num rag-${r}" title="${esc(th.label)}: ${word}"><span class="sr-only">${word}: </span>${v == null ? "–" : (["tat", "rating"].includes(th.id) ? v.toFixed(1) : v) + th.unit}</td>`; };
  App.scorecard = unitId => { const a = App.metrics(unitId), t = App.tm(unitId), sc = scoreOf(a, t);
    return { a, t, cells: CT.thresholds.map(th => ({ th, v: sc[th.id][0], n: sc[th.id][1], r: rag(th, sc[th.id][0], sc[th.id][1]) })) }; };

  /* Reasons an appointment did not convert, counted once per appointment (cancelled, no show, rescheduled, arrived without a job card). */
  App.reasons = (unitId, bd = S.bd) => {
    const out = { cancelled: {}, no_show: {}, rescheduled: {}, no_jc: {} }, add = (k, r) => { out[k][r] = (out[k][r] || 0) + 1; };
    for (const a of D.appointments) {
      if (!App.inScope(a, unitId) || (bd !== "All" && a.bd !== bd)) continue;
      if (a.reason && out[a.status]) add(a.status, a.reason);
      if (a.noJcReason) add("no_jc", a.noJcReason);
    }
    return out;
  };
  const topReason = o => { const e = Object.entries(o).sort((x, y) => y[1] - x[1]); return e.length ? `${e[0][0]} (${e[0][1]})` : "–"; };
  const sumObj = o => Object.values(o).reduce((a, b) => a + b, 0);
  views.conv = tab => {
    const u = U[S.unit], a = App.metrics(S.unit), t = App.tm(S.unit), R = App.reasons(S.unit);
    const open = a.booked + a.confirmed + a.rescheduled, closed = a.reported + a.no_show + a.cancelled, conv = pct(t.apptJc, closed);
    const funnel = `<div class="bars">${bar("Appointments generated", a.appts, a.appts, "var(--blue)")}${bar("Still open (booked, confirmed, rescheduled)", open, a.appts, "var(--purple)")}${bar("Closed out", closed, a.appts, "#6b7280")}
      ${bar("↳ Arrived (vehicle came in)", a.reported, closed, "var(--blue)")}${bar("   ↳ Job card opened", t.apptJc, closed, "var(--green)")}${bar("      ↳ Job card closed / delivered", t.jcClosedA, closed, "#14532d")}
      ${bar("   ↳ Arrived, no job card", a.reported - t.apptJc, closed, "#9aa3b2")}${bar("↳ No show", a.no_show, closed, "var(--red)")}${bar("↳ Cancelled", a.cancelled, closed, "#6b7280")}</div>
      <p class="note" style="margin-top:8px">Percentages in this card are of the appointments closed out (arrived, no show or cancelled). Rescheduled appointments are still open.</p>`;
    const reasonCard = (title, obj, color, total) => { const rows = Object.entries(obj).sort((x, y) => y[1] - x[1]), n = total || sumObj(obj);
      return `<section class="card"><div class="card-h">${esc(title)} <span class="link note">${n}</span></div><div class="card-b">${rows.length ? `<div class="bars">${rows.map(([r, c]) =>
        `<div class="bar-row" style="grid-template-columns:200px 1fr 80px"><span>${esc(r)}</span><span class="bar" role="img" aria-label="${esc(r)} ${c}"><i style="width:${100 * c / Math.max(1, rows[0][1])}%;background:${color}"></i></span><span class="v">${c} <small class="note">${App.pct(c, n)}%</small></span></div>`).join("")}</div>` : '<p class="note">None in this scope.</p>'}</div></section>`; };
    let breakdown = "";
    if (u.children.length) {
      const kids = u.children.map(id => ({ id, a: App.metrics(id), t: App.tm(id), r: App.reasons(id) })), childLvl = App.levelLabel(U[u.children[0]].level), canDrill = App.can("drill_down");
      const cl = x => x.a.reported + x.a.no_show + x.a.cancelled;
      const sums = (f) => kids.reduce((s2, k) => s2 + f(k), 0);
      const ok = sums(k => k.a.appts) === a.appts && sums(cl) === closed && sums(k => k.t.apptJc) === t.apptJc && sums(k => k.a.cancelled) === a.cancelled && ["cancelled", "no_show", "rescheduled", "no_jc"].every(g => sums(k => sumObj(k.r[g])) === sumObj(R[g]));
      const cols = [{ h: childLvl, f: k => canDrill ? `<button class="row-btn" data-unit="${k.id}">${esc(U[k.id].name)}</button>` : esc(U[k.id].name) }, { h: "Appointments", num: 1, f: k => k.a.appts }, { h: "Closed out", num: 1, f: cl },
        { h: "Arrived", num: 1, f: k => k.a.reported }, { h: "JC opened", num: 1, f: k => k.t.apptJc }, { h: "Conversion", num: 1, f: k => { const c = pct(k.t.apptJc, cl(k)); return c == null ? "–" : c + "%"; } },
        { h: "Cancelled", num: 1, f: k => k.a.cancelled }, { h: "Cancelled %", num: 1, f: k => { const c = pct(k.a.cancelled, cl(k)); return c == null ? "–" : c + "%"; } }, { h: "No show", num: 1, f: k => k.a.no_show }, { h: "Rescheduled", num: 1, f: k => k.a.rescheduled },
        { h: "Top cancel reason", f: k => esc(topReason(k.r.cancelled)) }, { h: "Top reason, no JC", f: k => esc(topReason(k.r.no_jc)) }];
      const foot = `<tfoot><tr><td>Total ${esc(u.name)}</td><td class="num">${a.appts}</td><td class="num">${closed}</td><td class="num">${a.reported}</td><td class="num">${t.apptJc}</td><td class="num">${conv == null ? "–" : conv + "%"}</td><td class="num">${a.cancelled}</td>
        <td class="num">${pct(a.cancelled, closed) ?? "–"}%</td><td class="num">${a.no_show}</td><td class="num">${a.rescheduled}</td><td>${esc(topReason(R.cancelled))}</td><td>${esc(topReason(R.no_jc))}</td></tr></tfoot>`;
      breakdown = `<section class="card" style="margin:16px 0"><div class="card-h">BY ${esc(childLvl.toUpperCase())} ${ok ? '<span class="check-ok link">✓ Rows add up to the total</span>' : '<span class="check-bad link">✗ Roll-up mismatch</span>'}</div><div class="card-b" style="padding:0">${App.ui.table(cols, kids, "Appointment to job card conversion by " + childLvl, foot)}</div></section>`;
    }
    return App.pageHead("APPOINTMENT TO JOB CARD CONVERSION · " + App.levelLabel(u.level).toUpperCase(), tab) + App.scopeBanner() +
      `<p class="note" style="margin-top:-6px">Out of the appointments generated in your scope: how many became job cards, how many were cancelled, did not show or were rescheduled, and why. Every appointment is counted once; reasons are counted once per appointment. The reasons list is a proposal to confirm with TML.</p>
      <div class="grid g4">${App.stat("📅", a.appts, "Appointments generated", "var(--purple)")}${App.stat("📋", t.apptJc, "Job cards opened from appointments", "var(--green)")}${App.stat("🎯", conv == null ? "–" : conv + "%", "Conversion (of appointments closed out)", "var(--blue)")}${App.stat("✖", a.cancelled, `Cancelled (${pct(a.cancelled, closed) ?? 0}% of closed out)`, "var(--red)")}</div>
      <div class="grid g3"><section class="card" style="grid-column: span 2"><div class="card-h">FROM APPOINTMENT TO JOB CARD</div><div class="card-b">${funnel}</div></section>
        ${App.donutCard("Appointment status", M.appointmentStatuses.map(x => ({ label: x.label, value: a[x.id], color: x.color })), a.appts, "Appointments")}</div>
      <div class="grid g2">${reasonCard("WHY APPOINTMENTS WERE CANCELLED", R.cancelled, "#6b7280")}${reasonCard("WHY CUSTOMERS DID NOT SHOW", R.no_show, "var(--red)")}
        ${reasonCard("WHY APPOINTMENTS WERE RESCHEDULED", R.rescheduled, "var(--amber)")}${reasonCard("WHY ARRIVALS DID NOT GET A JOB CARD", R.no_jc, "#9aa3b2")}</div>
      ${breakdown}` + App.actionsPanel();
  };
  views.tower = tab => {
    const u = U[S.unit], a = App.metrics(S.unit), t = App.tm(S.unit), upcoming = a.booked + a.confirmed;
    const days = CT.windowDays, kids = u.children;
    const st = M.appointmentStatuses.map(s => ({ label: s.label, value: a[s.id], color: s.color }));
    const jcA = [{ label: "Open", value: t.jcOpenA, color: "var(--blue)" }, { label: "In progress", value: t.jcProgA, color: "var(--amber)" }, { label: "Ready for delivery", value: t.jcReadyA, color: "var(--purple)" }, { label: "Closed", value: t.jcClosedA, color: "var(--green)" }];
    const flow = `<div class="bars">${bar("Appointments generated", a.appts, a.appts, "var(--blue)")}
      ${bar("↳ Customer arrived (Reported)", a.reported, a.appts, "var(--blue)")}${bar("   ↳ JC opened", t.apptJc, a.appts, "var(--green)", ` · ${pct(t.apptJc, a.reported) ?? 0}% of arrivals`)}
      ${bar("   ↳ Arrived, no JC", a.reported - t.apptJc, a.appts, "#9aa3b2")}${bar("↳ Rescheduled", a.rescheduled, a.appts, "var(--amber)")}${bar("↳ Cancelled", a.cancelled, a.appts, "#6b7280")}
      ${bar("↳ No show", a.no_show, a.appts, "var(--red)")}${bar("↳ Still to come (Booked + Confirmed)", upcoming, a.appts, "var(--purple)")}</div>`;
    const maxH = Math.max(1, ...HOURS.map(h => t["gh" + h]));
    const chart = `<svg viewBox="0 0 400 150" role="img" aria-label="Gate entries by hour: ${HOURS.map(h => h + ":00 " + t["gh" + h]).join(", ")}" style="width:100%;height:auto">${HOURS.map((h, i) => `<rect x="${14 + i * 38}" y="${115 - 95 * t["gh" + h] / maxH}" width="26" height="${95 * t["gh" + h] / maxH}" rx="3" fill="${t["gh" + h] === maxH ? "var(--blue)" : "#b9cdf3"}"/>
      <text x="${27 + i * 38}" y="${110 - 95 * t["gh" + h] / maxH}" font-size="9" text-anchor="middle" fill="#1f2937">${t["gh" + h] || ""}</text><text x="${27 + i * 38}" y="132" font-size="9" text-anchor="middle" fill="#5b6474">${h}:00</text>`).join("")}</svg>`;
    // scorecard by child unit
    let score = "", alerts = "";
    if (kids.length) {
      const rows = kids.map(id => ({ id, ...App.scorecard(id) })), canDrill = App.can("drill_down");
      const cnt = r => r.cells.filter(c => c.r === "r").length;
      rows.sort((x, y) => cnt(y) - cnt(x));
      const childLvl = App.levelLabel(U[kids[0]].level);
      const tot = App.scorecard(S.unit);
      score = `<section class="card" style="margin:16px 0"><div class="card-h">SCORECARD BY ${esc(childLvl.toUpperCase())}<span class="link note">Thresholds: ${CT.thresholds.map(th => `${th.label} ${th.dir === "min" ? "≥" : "≤"} ${th.value}${th.unit}`).join(" · ")}</span></div><div class="card-b" style="padding:0">
        <div class="table-wrap"><table><caption class="sr-only">Scorecard by ${esc(childLvl)}</caption><thead><tr><th scope="col">${esc(childLvl)}</th><th class="num" scope="col">Appointments</th>${CT.thresholds.map(th => `<th class="num" scope="col">${esc(th.label)}</th>`).join("")}<th class="num" scope="col">Red flags</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>${canDrill ? `<button class="row-btn" data-unit="${r.id}">${esc(U[r.id].name)}</button>` : esc(U[r.id].name)}</td><td class="num">${r.a.appts}</td>${r.cells.map(c => ragCell(c.th, c.v, c.n)).join("")}<td class="num">${cnt(r)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>Total ${esc(u.name)}</td><td class="num">${tot.a.appts}</td>${tot.cells.map(c => ragCell(c.th, c.v, c.n)).join("")}<td class="num">${tot.cells.filter(c => c.r === "r").length}</td></tr></tfoot></table></div></div></section>`;
      const al = [];
      rows.forEach(r => r.cells.filter(c => c.r === "r").forEach(c => al.push({ id: r.id, th: c.th, v: c.v })));
      alerts = `<section class="card"><div class="card-h">ALERTS (RED)<span class="link note">${al.length} found</span></div><div class="card-b"><ul class="list-plain">
        ${al.slice(0, 10).map(x => `<li><span class="chip red">Red</span><div>${esc(U[x.id].name)}<div class="sub">${esc(x.th.label)} ${["tat", "rating"].includes(x.th.id) ? x.v.toFixed(1) : x.v}${x.th.unit} (${x.th.dir === "min" ? "target ≥" : "target ≤"} ${x.th.value}${x.th.unit})</div></div>
          <span style="margin-left:auto"><button class="btn small" data-act="escalate" ${App.can("escalate") ? "" : 'aria-disabled="true" data-deny="Escalation not available"'}>Escalate</button></span></li>`).join("") || '<li class="note">No red alerts in this scope.</li>'}</ul>
        ${al.length > 10 ? `<p class="note">Showing 10 of ${al.length}.</p>` : ""}</div></section>`;
    }
    return App.pageHead("CONTROL TOWER · " + App.levelLabel(u.level).toUpperCase(), tab) + App.scopeBanner() +
      `<p class="note" style="margin-top:-6px">One linked record per vehicle visit (appointment → pickup &amp; drop → gate → reception → JC → eQC / washing → delivery), so every number below can be followed into the next module. Visits and JCs cover the ${esc(CT.window)}.</p>
      <div class="grid g4">${App.stat("📅", a.appts, "Appointments generated", "var(--purple)")}${App.stat("🚗", t.visits, `Vehicles received (${days} days)`)}${App.stat("📋", t.jcs, "JCs opened", "var(--green)")}${App.stat("🏁", t.delivered, "Vehicles delivered", "var(--amber-t)")}</div>
      <div class="grid g3"><section class="card" style="grid-column: span 2"><div class="card-h">APPOINTMENTS GENERATED → WHAT HAPPENED (EVERY APPOINTMENT COUNTED ONCE)</div><div class="card-b">${flow}</div></section>
        ${App.donutCard("JCs opened from appointments", jcA, t.apptJc, "JCs", `<p class="note" style="margin-top:10px">Open JCs: ${t.jcOpenA + t.jcProgA + t.jcReadyA} of ${t.apptJc} (not yet closed).</p>`)}</div>
      <div class="grid g3">${App.donutCard("Appointment status", st, a.appts, "Appointments")}
        <section class="card"><div class="card-h">DEALERSHIP INFLOW (${days} DAYS)</div><div class="card-b"><p style="margin:0 0 10px"><b style="font-size:22px">${(t.visits / days).toFixed(1)}</b> vehicles per day on average (${t.visits} in ${days} days)</p><div class="bars">
          ${bar("From appointments", t.visitsAppt, t.visits, "var(--purple)", "", "105px 1fr 78px")}${bar("Walk-ins", t.visitsWalk, t.visits, "var(--green)", "", "105px 1fr 78px")}${bar("Via Pickup & Drop", t.pickupVisits, t.visits, "var(--amber)", "", "105px 1fr 78px")}</div>
          <p class="note" style="margin-top:10px">Gate entries by hour (peak ${esc(peak(t) || "–")}):</p>${chart}</div></section>
        <section class="card"><div class="card-h">VEHICLE → JC → DELIVERY</div><div class="card-b"><div class="bars">${bar("Vehicles received", t.visits, t.visits, "var(--blue)", "", "105px 1fr 78px")}${bar("JC opened", t.jcs, t.visits, "var(--green)", "", "105px 1fr 78px")}
          ${bar("eQC passed first time", t.eqcPassed, t.eqcPassed + t.eqcFailed, "var(--purple)", "", "105px 1fr 78px")}${bar("Delivered", t.delivered, t.jcs, "var(--amber)", "", "105px 1fr 78px")}${bar("JC not closed, older than 3 days", t.jcOver3, t.jcs - t.jcClosed, "var(--red)", "", "105px 1fr 78px")}</div>
          <p class="note" style="margin-top:10px">Average JC turnaround: <b>${t.tatN ? (t.tatSum / t.tatN).toFixed(1) + " days" : "–"}</b></p></div></section></div>` +
      score + alerts + App.actionsPanel();
  };

  /* ---------- P7: modules in tile order ---------- */
  views.modules = tab => {
    const sel = MODS.find(x => x.id === S.filters.mod) || MODS[0], u = U[S.unit], all = App.kpi.all(S.unit);
    const tiles = MODS.map(mod => { const k = mod.kpis.slice(0, 4).map(d => `<span><b>${fmt(d, KPI[d.id](all))}</b> <small>${esc(d.label)}</small></span>`).join("");
      return `<button class="tile" id="tile-${mod.id}" data-h="mod" data-id="${mod.id}" aria-pressed="${mod.id === sel.id}"><span class="tile-top"><span class="tile-name">${esc(mod.label)}${mod.parts.length ? `<small>${mod.parts.map(esc).join(" · ")}</small>` : ""}${mod.full ? `<small>${esc(mod.full)}</small>` : ""}</span><span class="tile-ico" aria-hidden="true">${mod.icon}</span></span>
        ${mod.attention ? `<span class="tile-attn${KPI[mod.attention.id](all) ? "" : " ok"}" title="${esc(mod.attention.label)} (Proposed rule)"><b>${KPI[mod.attention.id](all)}</b> needs attention <small>${esc(mod.attention.label)}</small></span>` : ""}<span class="tile-kpis">${k}</span>${mod.kpis.length > 4 ? `<small class="note">+${mod.kpis.length - 4} more in the table below</small>` : ""}<span class="chip ${mod.screens === "observed" || mod.tmlScreens ? "blue" : "grey"}">${[mod.screens === "observed" ? "Dealer screens: observed" : "", mod.tmlScreens ? "TML screens: " + mod.tmlScreens : "", mod.screens === "login_only" ? "Numbers only (no module screens)" : "", mod.screens === "pending" ? "Screens: to be added" : ""].filter(Boolean).join(" · ")}</span></button>`; }).join("");
    const cols = sel.attention ? [...sel.kpis, { id: sel.attention.id, label: "Needs attention: " + sel.attention.label, kind: "count" }] : sel.kpis;
    const rowsIds = u.children.length ? u.children : [S.unit], rows = rowsIds.map(id => ({ id, m: App.kpi.all(id) }));
    const skipDiv = d => d.id === "pd_drivers" && rowsIds.some(id => U[id].level === "division");
    const sumOk = u.children.length && cols.filter(d => ["count", "amount"].includes(d.kind) && !skipDiv(d)).every(d => rows.reduce((s, r) => s + KPI[d.id](r.m), 0) === KPI[d.id](all));
    const childLvl = u.children.length ? App.levelLabel(U[rowsIds[0]].level) : App.levelLabel(u.level);
    const table = `<div class="table-wrap"><table><caption class="sr-only">${esc(sel.label)} KPIs by ${esc(childLvl)}</caption><thead><tr><th scope="col">${esc(childLvl)}</th>${cols.map(d => `<th class="num" scope="col">${esc(d.label)}</th>`).join("")}</tr></thead><tbody>
      ${rows.map(r => `<tr><td>${u.children.length && App.can("drill_down") ? `<button class="row-btn" data-unit="${r.id}">${esc(U[r.id].name)}</button>` : esc(U[r.id].name)}</td>${cols.map(d => `<td class="num">${fmt(d, KPI[d.id](r.m))}</td>`).join("")}</tr>`).join("")}</tbody>
      <tfoot><tr><td>Total ${esc(u.name)}</td>${cols.map(d => `<td class="num">${fmt(d, KPI[d.id](all))}</td>`).join("")}</tr></tfoot></table></div>`;
    return App.pageHead("MODULES · KPIs BY DEALERSHIP MODULE", tab) + App.scopeBanner() +
      `<p class="note" style="margin-top:-6px">The twelve dealership modules in the order of the module screen. Select a module to see its KPIs by ${esc(childLvl.toLowerCase())}. Every module has TML screens in the left menu with the records behind these numbers (and the decisions TML owns); the Receptionist module is a login page only, so it has numbers only.</p>
      <div class="tiles">${tiles}</div>
      <section class="card" style="margin-top:16px"><div class="card-h">${sel.icon} ${esc(sel.label.toUpperCase())}${sel.full ? " (" + esc(sel.full.toUpperCase()) + ")" : ""} · BY ${esc(childLvl.toUpperCase())}
        ${u.children.length ? (sumOk ? '<span class="check-ok link">✓ Counts add up to the total</span>' : '<span class="check-bad link">✗ Roll-up mismatch</span>') : ""}</div><div class="card-b" style="padding:0">${table}</div></section>` + App.actionsPanel();
  };
  H.mod = t => { S.filters.mod = t.dataset.id; App.render(); const el = document.getElementById("tile-" + t.dataset.id); el && el.focus(); };
})();
