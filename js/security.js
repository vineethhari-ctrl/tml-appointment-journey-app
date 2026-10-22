/* Security Guard module, TML view (P11 gate dashboard, P12 vehicle movement register), rebuilt from the user's Security & Reception
   prototype (TML portal). Every figure comes from the same linked visit records as the Control Tower, so it rolls up and agrees with
   the Security Guard KPIs on the Modules screen. Proposed screens; TML raises delay escalations, it does not operate the gate. */
(function () {
  const App = window.App, M = App.M, D = App.D, S = App.state, esc = App.esc, U = D.units, H = App.handlers;
  const { table, pageRows, showing, pager, sel, inp, filterBtns } = App.ui;
  const views = App.modules.appointment.views, today = D.today, CT = M.controlTower;
  const RFID_TH = CT.thresholds.find(t => t.id === "rfid");
  const pad = n => String(n).padStart(2, "0");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dmy = iso => `${+iso.slice(8)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(2, 4)}`;
  const hhmm = (h, m) => `${pad(h)}:${pad(m)}`;
  const gateIn = v => `${dmy(v.date)} | ${hhmm(v.gateHour, v.gateMin)}`;
  const gateOut = v => v.delivered ? `${dmy(v.outDate)} | ${hhmm(v.outHour, v.outMin)}` : null;
  const tripOut = (v, t) => `${dmy(v.date)} | ${hhmm(t.out, t.outMin)}`;
  const tripIn = (v, t) => { if (!t.returned) return null; const x = t.out * 60 + t.outMin + t.minutes; return `${dmy(v.date)} | ${hhmm(Math.floor(x / 60), x % 60)}`; };
  const zoneOf = v => U[U[v.dealer].parent].parent;
  const dealerName = id => U[id].name;
  const isInside = v => !!(v.jc && v.jc.status !== "closed");
  const isAgeing = v => isInside(v) && v.jc.ageDays > 3;
  const CATS = ["Vehicles Inside Workshop", "Vehicle Movement Register", "Gate In", "Gate Out", "Road Test Out", "Road Test In", "Active Road Tests"];
  const CAT = {
    "Vehicles Inside Workshop": isInside, "Vehicle Movement Register": () => true, "Gate In": () => true, "Gate Out": v => v.delivered,
    "Road Test Out": v => v.roadTests.length > 0, "Road Test In": v => v.roadTests.some(t => t.returned), "Active Road Tests": v => v.roadTests.some(t => !t.returned)
  };
  const day = () => S.filters.sgday || "all";
  const inDay = (v, d) => d === "all" || v.date === today;

  /* ---------- metrics (same definitions as the sg_* KPIs on the Modules screen) ---------- */
  App.sgm = (unit, d = "all", bd = S.bd) => {
    const m = { gateIn: 0, gateOut: 0, rtOut: 0, rtIn: 0, inside: 0, activeRt: 0, activeRt20: 0, ageing: 0, vipRv: 0, rfid: 0, manual: 0 };
    for (const v of D.visits) {
      if (!App.inScope(v, unit) || (bd !== "All" && v.bd !== bd) || !inDay(v, d)) continue;
      m.gateIn++; if (v.delivered) m.gateOut++;
      if (isInside(v)) { m.inside++; if (isAgeing(v)) m.ageing++; }
      if (v.vip || v.rv) m.vipRv++;
      v.entryMode === "RFID Auto-Gate" ? m.rfid++ : m.manual++;
      v.roadTests.forEach(t => { m.rtOut++; if (t.returned) m.rtIn++; else { m.activeRt++; if (t.minutes > 20) m.activeRt20++; } });
    }
    return m;
  };
  const pctOf = (a, b) => b ? Math.round(100 * a / b) : null;
  const ragRfid = (p, n) => p == null || n < RFID_TH.minSample ? "na" : p >= RFID_TH.value ? "g" : p >= RFID_TH.value * 0.9 ? "a" : "r";
  const scopeVisits = () => D.visits.filter(v => App.inScope(v) && App.bdOk(v) && inDay(v, day()));
  const daySeg = () => `<span class="seg-label">Gate-in date</span><span class="seg" role="group" aria-label="Gate-in date">${[["all", "Last 7 days"], ["today", "Today"]].map(([v, t]) =>
    `<button data-h="sgday" data-v="${v}" aria-pressed="${day() === v}">${t}</button>`).join("")}</span>`;
  H.sgday = t => { S.filters.sgday = t.dataset.v; S.page = 1; App.render(); };
  H.sgcat = t => { App.go("sgreg", { ...S.filters, cat: t.dataset.cat, vflt: t.dataset.vflt || "", q: "", guard: "", dealer: "" }); };

  /* ---------- escalation (TML raises it; the Dealer GM and the territory CSM act on it) ---------- */
  const escFor = v => D.sgEscalations.find(e => e.visitId === v.id);
  const escModal = v => {
    const csm = U[v.dealer].csm, phone = U[v.dealer].csmPhone, cur = escFor(v);
    App.modal(cur ? "Update escalation" : "Escalate delay to the Dealer GM", `<div class="bd-box"><div class="note">Vehicle</div><b>${esc(v.reg)} · ${esc(v.model)}</b>
      <div class="note">Customer</div><b>${esc(v.customer)}</b><div class="note">Dealership</div><b>${esc(dealerName(v.dealer))}</b>
      <div class="note">Goes to</div><b>Dealer GM, ${esc(dealerName(v.dealer))} · copy TML territory CSM ${esc(csm ? csm.split(" (")[0] : "–")}${phone ? " " + esc(phone) : ""}</b></div>
      <fieldset class="field" style="border:0;padding:0;margin:10px 0"><legend class="note">Severity</legend>
        <label><input type="radio" name="sg-sev" value="High" ${!cur || cur.priority === "High" ? "checked" : ""}> High priority</label>
        <label style="margin-left:14px"><input type="radio" name="sg-sev" value="Critical" ${cur && cur.priority === "Critical" ? "checked" : ""}> Critical priority</label></fieldset>
      <label class="field" for="sg-note">Action directive for the Dealer GM and CSM<textarea id="sg-note" rows="3">${esc(cur ? cur.reason : "Please share the reason for the delay and the committed delivery time.")}</textarea></label>`,
      [{ label: "Cancel" }, { label: "Dispatch escalation", primary: true, onClick: r => {
        const pr = r.querySelector("input[name=sg-sev]:checked").value, note = r.querySelector("#sg-note").value.trim() || "Please review.";
        if (cur) Object.assign(cur, { priority: pr, reason: note, status: "Dispatched to Dealer GM", by: S.role });
        else D.sgEscalations.unshift({ id: window.TMLUID("SGE", D.sgEscalations.length + 1), visitId: v.id, dealer: v.dealer, reg: v.reg, model: v.model, priority: pr, reason: note, csm, status: "Dispatched to Dealer GM", when: today + " 12:00", by: S.role });
        S.escalations.push({ from: S.role, to: "Dealer GM", topic: "Gate delay " + v.reg });
        if (App.fu && !cur) App.fu.add({ module: "security_guard", kind: "escalate", visit: v.id, ref: v.id, dealer: v.dealer, division: v.division, bd: v.bd, reg: v.reg, priority: pr, due: today, note });
        App.render(); App.toast(`Escalation for ${v.reg} sent to the Dealer GM of ${dealerName(v.dealer)}`);
      } }]);
  };
  H.sgesc = t => { if (!App.can("escalate")) return App.toast("Escalation not available"); escModal(D.visits.find(v => v.id === t.dataset.id)); };
  D.sgEscalations = D.sgEscalations || [];

  /* ---------- P11: gate dashboard ---------- */
  views.sgDash = tab => {
    D.sgEscalations = D.sgEscalations || [];
    const u = U[S.unit], d = day(), m = App.sgm(S.unit, d);
    const tile = (cat, n, label, bg, vflt = "") => `<button class="sg-tile" style="background:${bg}" data-h="sgcat" data-cat="${esc(cat)}" data-vflt="${vflt}"><b>${n}</b><span>${esc(label)}</span></button>`;
    const gov = (cat, vflt, n, label, color, ico, sub) => `<button class="sg-gov" data-h="sgcat" data-cat="${esc(cat)}" data-vflt="${vflt}"><span class="sg-gov-top"><span class="sg-ico" style="color:${color}" aria-hidden="true">${ico}</span><b style="color:${color}">${n}</b></span><span class="sg-gov-l">${esc(label)} ›</span><small class="note">${esc(sub)}</small></button>`;
    const rfidP = pctOf(m.rfid, m.gateIn);
    const rows = (u.children.length ? u.children : [S.unit]).map(id => ({ id, m: App.sgm(id, d) }));
    const childLvl = App.levelLabel(U[rows[0].id].level), canDrill = u.children.length && App.can("drill_down");
    const keys = ["gateIn", "gateOut", "rtOut", "rtIn", "inside", "ageing", "vipRv", "rfid", "manual"];
    const ok = !u.children.length || keys.every(k => rows.reduce((s, r) => s + r.m[k], 0) === m[k]);
    const cols = [{ h: childLvl, f: r => canDrill ? `<button class="row-btn" data-unit="${r.id}">${esc(U[r.id].name)}</button>` : esc(U[r.id].name) },
      { h: "Gate in", num: 1, f: r => r.m.gateIn }, { h: "Gate out", num: 1, f: r => r.m.gateOut }, { h: "RT out", num: 1, f: r => r.m.rtOut }, { h: "RT in", num: 1, f: r => r.m.rtIn },
      { h: "Inside workshop", num: 1, f: r => r.m.inside }, { h: "Ageing &gt; 3 days", num: 1, f: r => r.m.ageing }, { h: "VIP / RV", num: 1, f: r => r.m.vipRv },
      { h: "RFID auto", num: 1, f: r => r.m.rfid }, { h: "Manual scans", num: 1, f: r => r.m.manual },
      { h: `RFID compliance (target ≥ ${RFID_TH.value}%)`, num: 1, f: r => { const p = pctOf(r.m.rfid, r.m.gateIn), g = ragRfid(p, r.m.gateIn), w = { g: "meets target", a: "within 10% of target", r: "below target", na: "too few records" }[g];
        return `<span class="rag-pill rag-${g}" title="${w}"><span class="sr-only">${w}: </span>${p == null ? "–" : p + "%"}</span>`; } },
      { h: "TML CSM lead", f: r => esc(U[r.id].csm || "–") }];
    const foot = `<tfoot><tr><td>Total ${esc(u.name)}</td>${keys.map(k => `<td class="num">${m[k]}</td>`).join("")}<td class="num">${rfidP == null ? "–" : rfidP + "%"}</td><td></td></tr></tfoot>`;
    const esc_ = D.sgEscalations.filter(e => App.inScope({ dealer: e.dealer }));
    const log = esc_.length ? esc_.map(e => `<li><span class="chip ${e.priority === "Critical" ? "red" : "amber"}">${esc(e.priority)}</span><div><b>${esc(e.reg)}</b> · ${esc(dealerName(e.dealer))} · ${esc(U[U[e.dealer].parent].name)}
        <div class="sub">${esc(e.reason)}</div><div class="sub">CSM: ${esc(e.csm || "–")} · ${esc(e.status)}${e.by ? " · raised by " + esc(e.by) : ""}</div></div><span class="sub" style="margin-left:auto">${esc(e.when)}</span></li>`).join("")
      : '<li class="note">No escalations in this scope yet.</li>';
    const dealers = App.dealersUnder(S.unit);
    return App.pageHead("SECURITY GUARD · GATE DASHBOARD · " + App.levelLabel(u.level).toUpperCase(), tab) + App.scopeBanner() +
      `<p class="note" style="margin-top:-6px">TML's view of the dealership gates (rebuilt from the Security &amp; Reception prototype): who came in, who went out, road tests, what is still inside and where gate discipline (RFID) slips. Counts cover ${d === "today" ? "vehicles that came in today" : "the last 7 days of visits"} and are the same records as the Control Tower, so they add up.</p>
      <div class="scope" style="gap:10px 16px">${daySeg()}</div>
      <section class="card"><div class="card-h">TODAY'S SUMMARY (NETWORK AGGREGATE · ${dealers.length} DEALERSHIP${dealers.length === 1 ? "" : "S"} IN SCOPE)<span class="link"><button class="btn small primary" data-h="sgcat" data-cat="Vehicle Movement Register">Open Vehicle Movement Register (${m.gateIn})</button></span></div>
        <div class="card-b"><div class="sg-tiles">${tile("Gate In", m.gateIn, "Gate In", "#cbefd8")}${tile("Gate Out", m.gateOut, "Gate Out", "#e1f6ea")}${tile("Road Test Out", m.rtOut, "Road Test Out", "#fef5df")}${tile("Road Test In", m.rtIn, "Road Test In", "#fcefb8")}
        ${tile("Vehicles Inside Workshop", m.inside, "Vehicle Inside Workshop", "#fff", "")}${tile("Active Road Tests", m.activeRt, "Active Road Test Count", "#fff")}</div></div></section>
      <section class="card" style="margin-top:16px"><div class="card-h">TML GOVERNANCE &amp; SLA EXCEPTIONS</div><div class="card-b"><div class="sg-govs">
        ${gov("Vehicles Inside Workshop", "AGEING", m.ageing, "Ageing > 3 days", "var(--red)", "⏱", "Open JC, vehicle still inside")}${gov("Vehicles Inside Workshop", "VIPRV", m.vipRv, "VIP & Repeat (RV)", "var(--purple)", "★", "Priority customers")}
        ${gov("Vehicle Movement Register", "", rfidP == null ? "–" : rfidP + "%", "RFID gate compliance", "var(--blue)", "📡", `${m.rfid} of ${m.gateIn} auto · target ≥ ${RFID_TH.value}%`)}${gov("Active Road Tests", "RT20", m.activeRt20, "Active RT > 20 min", "var(--amber-t)", "⚠", `${m.activeRt} road tests out now`)}</div></div></section>
      <section class="card" style="margin:16px 0"><div class="card-h">${esc(u.children.length ? "ZONE & REGIONAL DEALERSHIP COMPLIANCE MATRIX · BY " + childLvl.toUpperCase() : "GATE COMPLIANCE · " + childLvl.toUpperCase())}
        ${u.children.length ? (ok ? '<span class="check-ok link">✓ Rows add up to the total</span>' : '<span class="check-bad link">✗ Roll-up mismatch</span>') : ""}</div><div class="card-b" style="padding:0">${table(cols, rows, "Gate compliance by " + childLvl, u.children.length ? foot : "")}</div></section>
      <section class="card"><div class="card-h">CSM &amp; DEALER GM ESCALATION LOG<span class="link note">${esc_.length} dispatched</span></div><div class="card-b"><ul class="list-plain">${log}</ul>
        <p class="note">Escalations are raised from the Movement Register (open a vehicle, then Escalate delay). They go to the Dealer GM with the territory CSM copied. Proposed.</p></div></section>` + App.actionsPanel();
  };

  /* ---------- P12: vehicle movement register ---------- */
  views.sgRegister = tab => {
    D.sgEscalations = D.sgEscalations || [];
    const f = S.filters, cat = CATS.includes(f.cat) ? f.cat : "Vehicle Movement Register", q = App.norm(f.q || ""), vf = f.vflt || "";
    const base = scopeVisits(), guards = [...new Set(base.map(v => v.guard))].sort(), dealers = [...new Set(base.map(v => v.dealer))];
    const rows = base.filter(v => CAT[cat](v) && (!f.guard || v.guard === f.guard) && (!f.dealer || v.dealer === f.dealer) && (!q || [v.reg, v.vin, v.customer].some(x => App.norm(x).includes(q)))
      && (!f.visit || v.source === f.visit) && (vf !== "AGEING" || isAgeing(v)) && (vf !== "VIPRV" || v.vip || v.rv) && (vf !== "RT20" || v.roadTests.some(t => !t.returned && t.minutes > 20)))
      .sort((a, b) => (b.date + hhmm(b.gateHour, b.gateMin)).localeCompare(a.date + hhmm(a.gateHour, a.gateMin)) || a.id.localeCompare(b.id));
    const trips = rows.reduce((s, v) => s + v.roadTests.filter(t => cat === "Active Road Tests" ? !t.returned : cat === "Road Test In" ? t.returned : true).length, 0);
    const second = v => {
      const last = v.roadTests[v.roadTests.length - 1];
      if (cat === "Gate Out") return ["Gate Out Time", gateOut(v)];
      if (cat === "Vehicles Inside Workshop") return ["Bay", v.bay];
      if (cat === "Road Test Out") return ["Road Test Out Time", tripOut(v, last)];
      if (cat === "Road Test In") { const t = [...v.roadTests].reverse().find(x => x.returned); return ["Road Test In Time", tripIn(v, t)]; }
      if (cat === "Active Road Tests") { const t = v.roadTests.find(x => !x.returned); return ["Out for", `<span class="${t.minutes > 20 ? "txt-red" : ""}">${t.minutes} min</span>`]; }
      return ["Gate Out Time", gateOut(v) || "Still inside"];
    };
    const rtLog = v => v.roadTests.length ? `<details><summary>${v.roadTests.length} trip${v.roadTests.length > 1 ? "s" : ""}</summary>${v.roadTests.map(t => `<div class="note">RT #${t.no} · ${esc(t.driver)} · ${esc(t.guard)} · Out ${tripOut(v, t).split("| ")[1]} → In ${t.returned ? tripIn(v, t).split("| ")[1] : "not back"} · <b>${t.minutes} min</b></div>`).join("")}</details>` : "0";
    const L2 = { "Gate Out": "Gate Out Time", "Vehicles Inside Workshop": "Bay", "Road Test Out": "Road Test Out Time", "Road Test In": "Road Test In Time", "Active Road Tests": "Out for" };
    const cols = () => [
      { h: "Vehicle No.", f: v => `<b>${esc(v.reg)}</b>${v.vip ? ' <span class="chip purple">VIP</span>' : ""}${v.rv ? ' <span class="chip amber" title="Repeat visit">RV</span>' : ""}<div class="note">${esc(v.vin)}</div>` },
      { h: "Model", f: v => esc(v.model) }, { h: "Customer", f: v => esc(v.customer) },
      { h: "Dealership", f: v => `${esc(dealerName(v.dealer))}<div class="note">${esc(U[zoneOf(v)].name)}</div>` },
      { h: "Visit Type", f: v => App.chip(v.source === "Appointment" ? "Appointment" : "Walk In", v.source === "Appointment" ? "green" : "blue") },
      { h: "Gate In", f: v => gateIn(v) }, { h: L2[cat] || "Gate Out Time", f: v => { const [, v2] = second(v); return v2 || "–"; } },
      { h: "Road Tests", f: rtLog },
      { h: "Security Guard", f: v => esc(v.guard) }, { h: "Entry Mode", f: v => esc(v.entryMode) },
      { h: "Job Card", f: v => v.jc ? esc(v.jc.id) + " · " + esc(v.jc.type) : "Not opened" },
      { h: "TML CSM", f: v => esc((U[v.dealer].csm || "–").split(" (")[0]) },
      { h: "Action", f: v => { const e1 = escFor(v); return `${e1 ? `<span class="chip amber" title="${esc(e1.reason)}">Escalated</span> ` : ""}<button class="btn ${e1 ? "" : "primary"} small" data-h="sgesc" data-id="${v.id}" ${App.can("escalate") ? "" : 'aria-disabled="true"'}>${e1 ? "Update" : "Escalate delay"}</button>`; } }];
    const page = pageRows(rows);
    const meta = cat === "Vehicles Inside Workshop" ? "Vehicles" : cat.startsWith("Road Test") || cat === "Active Road Tests" ? `Vehicles (${trips} trips)` : cat === "Vehicle Movement Register" ? "Gate In" : cat;
    return App.pageHead("SECURITY GUARD · " + cat.toUpperCase(), tab) + App.scopeBanner() +
      `<div class="sg-pills" role="group" aria-label="Register view">${CATS.map(c => `<button class="btn small ${c === cat ? "primary" : ""}" data-h="sgcat" data-cat="${esc(c)}" aria-pressed="${c === cat}">${esc(c)}</button>`).join("")}</div>
      <div class="scope" style="gap:10px 16px">${daySeg()}${vf ? `<span class="chip amber">Filter: ${{ AGEING: "ageing over 3 days", VIPRV: "VIP and repeat visits", RT20: "active road tests over 20 min" }[vf]}</span>` : ""}</div>
      <div class="filters" role="search">${inp("f-q", "Search vehicle, VIN or customer", f.q)}${sel("f-guard", "Security Guard", guards, f.guard)}${sel("f-visit", "Visit Type", [["Appointment", "Appointment"], ["Walk-in", "Walk In"]], f.visit)}${sel("f-dealer", "Dealership", dealers.map(d => [d, dealerName(d)]), f.dealer)}<span class="grow"></span>${filterBtns()}</div>
      <div class="list-meta"><b>${rows.length} ${meta}</b> · ${showing(rows.length)}</div>
      ${rows.length ? `${table(cols(), page, "Vehicle movement register")}${pager(rows.length)}` : '<section class="card"><div class="card-b"><b>No matching vehicles found</b><p class="note">No vehicles match the scope, date or filters. Use Clear to reset.</p></div></section>'}
      <p class="note">One row per vehicle visit. Gate out is recorded when the vehicle is delivered; a road test is counted from the gate going out to it coming back. Vehicles inside = job card not closed.</p>` + App.actionsPanel();
  };
})();
