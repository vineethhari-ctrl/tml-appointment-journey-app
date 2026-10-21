/* Service Claims (screens 86 to 92 of the "Claims: Goodwill / Ext Warranty Web" prototype): the All Claims list and the claim information page of
   each claim type (FSB, Warranty, EW, AMC, Goodwill, Part Warranty). TML sees them on screen P27 (counts by type and status that roll up, ageing,
   comments on rejected claims); the dealer's own screens open read-only from "Dealer's Screens". Values are sandbox data linked to real job
   cards (D.claims). Only the fields and sections visible in the screenshots are recreated. */
(function () {
  const App = window.App, M = App.M, D = App.D, S = App.state, esc = App.esc, U = D.units, H = App.handlers;
  const { table, pageRows, showing, pager, sel, inp, filterBtns } = App.ui;
  const views = App.modules.appointment.views, T = App.tmlui, CL = M.claims, CS = D.claims || [];
  const { head, breakdown, csvStore, csvBtn, dname, barRows } = T;
  const TYPES = CL.types, STAT = CL.statuses, two = n => String(n).padStart(2, "0");
  const dmyhms = iso => { if (!iso) return "--"; const d = new Date(iso), h = d.getHours(); return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(h % 12 || 12)}:${two(d.getMinutes())}:${two(d.getSeconds())} ${h < 12 ? "AM" : "PM"}`; };
  const dmyhm = iso => dmyhms(iso).replace(/:(\d\d) (AM|PM)$/, " $2");
  const dmy = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "--";
  const money = n => Number(n).toLocaleString("en-IN");
  const inS = (r, unit = S.unit) => App.inScope({ dealer: r.dealer }, unit);
  const hs = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const aged = c => (c.status === "Created" || c.status === "Submitted") && c.age > CL.agedDays;

  /* ---------- measures by unit (TML and dealer lists use the same counts) ---------- */
  const KEYS = ["total", "Created", "Submitted", "Accepted", "Settled", "Rejected", "aged"];
  const agg = (unit, f = {}) => { const m = Object.fromEntries(KEYS.map(k => [k, 0]));
    for (const c of CS) { if (!inS(c, unit) || (f.type && c.type !== f.type) || (f.bd && f.bd !== "All" && c.bd !== f.bd)) continue; m.total++; m[c.status]++; if (aged(c)) m.aged++; }
    return m; };

  /* ---------- All Claims (screen 86) ---------- */
  const cols = [{ h: "Claim No", f: c => `<a href="#" class="row-btn plain" data-h="claimOpen" data-id="${esc(c.id)}"><u>${esc(c.id)}</u></a>` }, { h: "Claim Creation Date", f: c => dmyhms(c.created) },
    { h: "Claim Submission Date", f: c => dmyhms(c.submitted) }, { h: "Claim Age", f: c => `${c.age} Days` }, { h: "JC No.", f: c => esc(c.jc) }, { h: "JC Date", f: c => dmyhms(c.jcDate + "T10:00") },
    { h: "Chassis No.", f: c => esc(c.chassis) }, { h: "Registration No.", f: c => esc(c.reg) }, { h: "Invoice No.", f: c => esc(c.invoice) }, { h: "Invoice Date", f: c => dmyhms(c.invDate + "T10:00") },
    { h: "Status", f: c => `<span class="chip ${{ Created: "blue", Submitted: "amber", Accepted: "green", Settled: "green", Rejected: "red" }[c.status]}">${c.status}</span>` }, { h: "VCM Comment", f: c => esc(c.vcm || "--") }];
  H.claimOpen = t => { const c = CS.find(x => x.id === t.dataset.id); if (!c) return; const ty = TYPES.find(x => x.id === c.type); if (!ty.detail) return App.toast(`The ${ty.name} claim page is not in the screens received`); S.filters = { ...S.filters, claimNo: c.id }; App.go(ty.detail); };
  const typeBtns = f => `<div class="icon-btns" role="group" aria-label="Claim type" style="gap:8px;flex-wrap:wrap;margin:10px 0">${TYPES.map(t => `<button class="pillbtn${(f.ctype || "FSB") === t.id ? " on" : ""}" data-h="tmlset" data-k="ctype" data-v="${t.id}" aria-pressed="${(f.ctype || "FSB") === t.id}">${esc(t.name)}</button>`).join("")}</div>`;
  const bdBtns = f => `<span class="icon-btns" role="group" aria-label="PV or EV">${["All", "PV", "EV"].map(b => `<button class="pillbtn${(f.cbd || "All") === b ? " on" : ""}" data-h="tmlset" data-k="cbd" data-v="${b}" aria-pressed="${(f.cbd || "All") === b}">${b}</button>`).join("")}</span>`;
  const statTabs = (f, m) => `<div class="icon-btns" role="group" aria-label="Claim status" style="gap:14px;flex-wrap:wrap;margin:8px 0">${STAT.map(s => `<button class="pillbtn${(f.cst || "Created") === s ? " on" : ""}" data-h="tmlset" data-k="cst" data-v="${s}" aria-pressed="${(f.cst || "Created") === s}">${two(m[s])} ${s}</button>`).join("")}</div>`;
  const alert = () => { const c = CS.filter(x => inS(x) && aged(x)).sort((a, b) => b.age - a.age)[0];
    return c ? `<div class="card" role="alert" style="padding:8px 14px;border-color:#f3c0bd;margin:8px 0"><span class="txt-red">⚠ SLA Breached</span> · ${esc(c.id)} is ${c.age} days old and still ${c.status}</div>` : ""; };
  const claimsList = f => { const q = App.norm(f.q || ""), ty = f.ctype || "FSB", st = f.cst || "Created", bd = f.cbd || "All", base = CS.filter(c => inS(c) && c.type === ty && (bd === "All" || c.bd === bd)), m = agg(S.unit, { type: ty, bd });
    const rows = base.filter(c => c.status === st && (!q || [c.id, c.jc, c.chassis, c.reg, c.invoice].some(x => App.norm(x).includes(q)))).sort((a, b) => b.created.localeCompare(a.created));
    return { rows, m, all: base }; };
  views.claimsAll = tab => { const f = S.filters, { rows, m } = claimsList(f);
    return `<div class="title-row"><h1 style="font-size:20px;margin:0">All Claims</h1><span class="badge observed">Observed · Claims screen 86</span></div>` + App.scopeBanner({ crumbs: false, bd: false }) + alert() + typeBtns(f) +
      `<div class="filters" role="search"><b style="font-size:16px">Claim Manager Actionables</b>${bdBtns(f)}<span class="grow"></span>${inp("f-q", "Search request, job card, customer…", f.q)}${filterBtns()}</div>` + statTabs(f, m) +
      `<div class="list-meta">${showing(rows.length)}</div>${table(cols, pageRows(rows), "All Claims")}${pager(rows.length)}<p class="note">Read-only reference of the Claims screen. Sandbox data linked to the dealer's job cards. The date range filter, Export and the column filter of the screen are not recreated.</p>` + App.actionsPanel(); };

  /* ---------- claim information pages (screens 87 to 92) ---------- */
  const fld = (l, v) => `<div class="field"><span class="note">${esc(l)}</span><div><b style="font-weight:600">${v === undefined || v === "" ? "--" : esc(v)}</b></div></div>`;
  const card = (title, pairs, wide) => `<section class="card"${wide ? ` style="grid-column:span ${wide}"` : ""}><div class="card-h">${esc(title)}</div><div class="card-b"><div class="form-grid">${pairs.map(([l, v]) => fld(l, v)).join("")}</div></div></section>`;
  const box = (l, v) => `<div><span class="note">${esc(l)}</span><div class="card" style="padding:8px 10px;min-height:54px;font-size:13px">${esc(v)}</div></div>`;
  const complaint = ["Vehicle reported to workshop with abnormal transmission noise and delayed gear engagement.", "As per the customer complaint, diagnostic scan and visual inspection completed. Transmission assembly wear observed.", "So as per diagnosis we have replaced the failed component and validated the repair on road test."];
  const sapNo = c => "5-19" + String(2484000000 + hs(c.id) % 999999).padStart(9, "0");
  const jcAt = c => c.jcDate + "T10:42";
  const base = c => ({ sap: sapNo(c), kms: money(5000 + hs(c.id) % 40000), engine: "1.5CRAILO1KRYW" + (41000 + hs(c.chassis) % 999), sell: "300B" + (100 + hs(c.dealer) % 899), sale: "30/09/2025", dealer: dname(c.dealer), dcode: c.dealer,
    reqNo: "AR-2026-" + String(90000 + hs(c.id) % 9999).padStart(7, "0"), reqSt: ["Approved", "Approved", "Pending"][hs(c.id) % 3], approved: Math.round(c.amount * 0.7), labour: c.amount - Math.round(c.amount * 0.7) });
  const jcCard = (c, b) => card("JC Details", [["Job Card No", c.jc], ["SR# No", "SR-" + c.jc], ["Service Type", "Paid Service"], ["JC Creation Date", dmyhm(jcAt(c))], ["Initial JC Closure Date", dmyhm(c.jcDate + "T17:42")], ["JC Closure Date", dmyhm(c.jcDate + "T17:42")],
    ["JC Status", "Closed"], ["SR Status", "Closed"], ["Complaint Report Date", dmyhm(jcAt(c))], ["Dealer Code", b.dcode], ["Vehicle Repair Date", dmyhm(c.jcDate + "T13:24")]]);
  const vehCard = (c, b, extra) => card("Vehicle Details", [["Chassis No.", c.chassis], ["Registration No.", c.reg], ["Current Kms", b.kms], ["Engine No.", b.engine], ["Selling Dealer Code", b.sell], ["Sale Date", b.sale], ...extra]);
  const authCard = (c, b, tail) => card("Authorization Request Details", [["Request No.", b.reqNo], ["Status", b.reqSt], ["Request Creation Date", dmyhm(jcAt(c))], ["Request Submission Date", dmyhm(jcAt(c))], ["Request Approval Date", dmyhm(c.jcDate + "T16:00")], ["Approved Job & Part Amt", money(b.approved)], ["Approved Spl Labour Charges", money(b.labour)], ...tail], 2);
  const commentCard = (n = 3) => `<section class="card" style="grid-column:span ${n === 3 ? 3 : 1}"><div class="card-h">Comments</div><div class="card-b"><div class="grid g3">${box(n === 3 ? "Complaint Description" : "Complaint Description", complaint[0])}${box("Investigation", complaint[1])}${box("Action Taken", complaint[2])}</div></div></section>`;
  const SHEETS = {
    claims_amc: { pre: "AMC", name: "AMC Claim Information", btns: ["Draft", "Validate", "Submit"], tabs: ["AMC Claims Details", "Attachments", "AMC Claim History", "THD History", "EQC History", "Audit Trail"], cards: (c, b) => [
      card("AMC Claim Information", [["AMC Claim No.", c.id], ["SAP Claim No.", b.sap], ["Status", c.status], ["No. of Line Items", two(c.lines)], ["Claim Raising Date", dmyhm(c.created)], ["Claim Submission Date", dmyhm(c.submitted)], ["Date of Approval/ Rejection", ["Accepted", "Settled", "Rejected"].includes(c.status) ? dmyhm(c.submitted) : "--"], ["SAP Comment", "Claim created with the number 2600181239"]]),
      card("AMC Details", [["AMC Policy No.", b.sap], ["AMC Type", "Silver"], ["AMC Status", "Active"], ["AMC Start Date", dmyhm(jcAt(c))], ["AMC End Date", dmyhm(jcAt(c))], ["AMC Start Kms", "8,375"], ["AMC End Kms", "23,775"], ["AMC Description", "Gold AMC for New Vehicles or ( Current Kms < 15000 KMS & Age < 396 Days )"]]),
      vehCard(c, b, []),
      card("JC/ Repair Details", [["SR NO", b.sap], ["JC No", c.jc], ["JC Creation Date", dmyhm(jcAt(c))], ["Initial Closure Date", dmyhm(jcAt(c))], ["JC Closure Date", dmyhm(jcAt(c))], ["Dealer Name", b.dealer]], 1),
      authCard(c, b, []), commentCard(1)] },
    claims_fsb: { pre: "FSB", name: "FSB Claim Information", btns: ["Draft", "Submit to SAP"], tabs: [], cards: (c, b) => [
      card("FSB Claim Information", [["VCM Login ID", "Select Option"], ["Serial Number", "e.g. 21"], ["Claim Status", c.status], ["Attachment", "Drag & Drop or browse a file (PDF/JPG/PNG Max 5MB, only 1 attachment allowed)"], ["SAP Comment", "Claim created with the number 2600181239"]], 3),
      card("Claim & Vehicle Information", [["Chassis No.", c.chassis], ["Chassis Type", "LPT 3118"], ["Vehicle Age", dmyhm(jcAt(c))], ["Mfg Date", "08/09/2026"], ["Chassis Serial", c.chassis.slice(-7)], ["KMS", b.kms + " KMS"], ["Selling Dealer", "TML-DLR-2290"], ["Sale Date", dmyhm(jcAt(c)).replace(/\d{4}/, "2024")],
        ["Service Dealer", "TML-DLR-4471"], ["Service Date", dmyhm(jcAt(c))], ["Service Type", "Paid Service"], ["JC Details", dmyhm(jcAt(c))], ["JC Status", "Open"], ["Job Card No.", c.jc]], 3)] },
    claims_gw: { pre: "GW", name: "Goodwill Claims Info Submission", btns: ["Submit"], tabs: ["GW Claims Details", "Attachments", "GW History", "THD History", "EQC History", "Audit Trail"], cards: (c, b) => [
      card("GW Claim Information", [["SAP Claim No", b.sap], ["VCM Login ID", b.sap], ["Status", c.status], ["Claim Created Date", dmyhm(c.created)], ["Claim Submitted Date", dmyhm(c.submitted)], ["Claim Rejected Date", c.status === "Rejected" ? dmyhm(c.submitted) : "--"], ["SAP Comment", "Goodwill claim created with the number 2600181239"]]),
      jcCard(c, b), vehCard(c, b, [["Warranty Start Date", "11/05/2016"], ["Warranty End Date", "11/05/2016"], ["Warranty Expiry Km", "60,000"]]),
      authCard(c, b, [["Status", b.reqSt]]), commentCard(1)] },
    claims_w: { pre: "W", name: "Warranty Claim Information", btns: ["Submit"], tabs: ["Warranty Claims Details", "Attachments", "Warranty History", "THD History", "EQC History", "Audit Trail"], cards: (c, b) => [
      card("Warranty Claim Information", [["SAP Claim No.", b.sap], ["VCM Login ID", b.sap], ["Status", c.status], ["Claim Created Date", dmyhm(c.created)], ["PCR Raising Date", dmyhm(c.created)], ["PCR Submission Date", dmyhm(c.submitted)], ["Original Claim Submitted Date", dmyhm(c.submitted)], ["SAP Comment", "Warranty claim created with the number 2600181239"]]),
      jcCard(c, b), vehCard(c, b, [["Warranty Start Date", "11/05/2026"], ["Warranty End Date", "11/05/2027"], ["Warranty Expiry Km", "60,000"]]),
      authCard(c, b, [["Status", b.reqSt], ["Approved Amount", money(b.approved + b.labour)]]), commentCard(1)] },
    claims_ew: { pre: "EW", name: "Extended Warranty Claim Information", btns: ["Submit"], tabs: ["EW Claims Details", "Attachments", "EW History", "THD History", "EQC History", "Audit Trail"], cards: (c, b) => [
      card("EW Claim Information", [["SAP Claim No.", b.sap], ["VCM Login ID", b.sap], ["Status", c.status], ["Claim Created Date", dmyhm(c.created)], ["PCR Raising Date", dmyhm(c.created)], ["PCR Submission Date", dmyhm(c.submitted)], ["Original Claim Submitted Date", dmyhm(c.submitted)], ["SAP Comment", "Warranty claim created with the number 2600181239"]]),
      jcCard(c, b), vehCard(c, b, [["EW Start Date", "11/05/2026"], ["EW End Date", "11/05/2027"], ["EW Expiry Km", "60,000"], ["Policy No.", "113123123"]]),
      authCard(c, b, [["Status", b.reqSt], ["Total Approved Amount", money(b.approved + b.labour)]]), commentCard(1)] },
    claims_pw: { pre: "PW", name: "Part Warranty Claim Submission", btns: ["Submit"], tabs: ["Warranty Claims Details", "Attachments", "Warranty History", "THD History", "EQC History", "Audit Trail"], cards: (c, b) => [
      card("Warranty Claim Information", [["SAP Claim No.", b.sap], ["VCM Login ID", b.sap], ["Status", c.status], ["Claim Created Date", dmyhm(c.created)], ["PCR Raising Date", dmyhm(c.created)], ["SAP Comment", "Warranty claim created with the number 2600181239"]]),
      jcCard(c, b), vehCard(c, b, [["Warranty Start Date", "11/05/2026"], ["Warranty Start Date", "11/05/2027"], ["Warranty Expiry Km", "60,000"]]), commentCard(3)] }
  };
  const detail = (tab, sheet) => { const f = S.filters, ty = TYPES.find(t => t.detail === tab), pool = CS.filter(c => inS(c) && c.type === ty.id).sort((a, b) => b.created.localeCompare(a.created));
    const c = pool.find(x => x.id === f.claimNo) || pool[0];
    const t = `<div class="title-row"><h1 style="font-size:20px;margin:0">${esc(sheet.name)}</h1><span class="badge observed">Observed · Claims screen ${M.screens.observed.find(s => s.tab === tab).id}</span></div>` + App.scopeBanner({ crumbs: false, bd: false });
    if (!c) return t + `<p class="note">No ${esc(ty.name)} claim in this scope.</p>` + App.actionsPanel();
    const b = base(c), pickOpts = pool.slice(0, 40).map(x => [x.id, x.id]);
    return t + `<div class="filters">${sel("f-claimNo", "Claim", pickOpts, c.id)}<span class="grow"></span></div>
      <section class="card"><div class="card-b" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap"><div><span class="note">Claim No.</span><div style="font-size:22px;font-weight:700"><span class="txt-red">●</span> ${esc(c.id)}</div></div>
      <div><span class="note">Jobcard No.</span><div style="font-weight:600;font-size:15px;margin-top:6px">${esc(c.jc)}</div></div><span class="grow" style="flex:1"></span>
      <button class="btn" disabled aria-disabled="true" title="Read-only for TML">Customer 360</button>${sheet.btns.map((x, i) => `<button class="btn${i === sheet.btns.length - 1 ? " primary" : ""}" disabled aria-disabled="true" title="Read-only for TML">${x}</button>`).join("")}</div>
      <div class="card-b" style="display:flex;gap:8px;flex-wrap:wrap"><span class="chip ${c.status === "Rejected" ? "red" : "green"}">Status: ${c.status}</span><span class="chip amber">Ageing: ${c.age} Days</span><span class="chip green">Revisit</span><span class="chip red">Critical Customer</span><span class="chip" style="color:#7b2cbf;border-color:#7b2cbf">VIP</span></div></section>
      ${sheet.tabs.length ? `<div class="icon-btns" role="tablist" aria-label="Claim sections" style="gap:18px;margin:10px 0;flex-wrap:wrap">${sheet.tabs.map((x, i) => `<span class="pillbtn${i ? "" : " on"}" role="tab" aria-selected="${i === 0}">${esc(x)}</span>`).join("")}</div>` : ""}
      <div class="grid g3" style="align-items:start">${sheet.cards(c, b).join("")}</div>
      <p class="note">Read-only reference of the claim information screen. Sandbox data; the claim number, job card, chassis, registration, dates and status come from the dealer's claim record, other values are the sandbox values of the screenshot. ${["claims_fsb"].includes(tab) ? "The screenshot is cut off below Job Card No." : "Line items, attachments, history and audit trail tabs are not recreated."}</p>` + App.actionsPanel(); };
  for (const tab of Object.keys(SHEETS)) views[tab] = () => detail(tab, SHEETS[tab]);


  /* ---------- TML actions and the link to the vehicle: claims on a vehicle's job card, escalate a claim to the Dealer GM ---------- */
  const stChip = c => `<span class="chip ${{ Created: "blue", Submitted: "amber", Accepted: "green", Settled: "green", Rejected: "red" }[c.status]}">${c.status}</span>`;
  const escBtn = c => (App.fu ? App.fu.btn({ module: "claims", visit: c.visit, ref: c.id }) : "") + (App.dec ? " " + App.dec.claimBtns(c) : "");
  App.claimsOfVisit = id => CS.filter(c => c.visit === id);
  App.claimsCard = id => { const L = CS.filter(c => c.visit === id); if (!L.length) return "";
    return `<section class="card" style="margin-top:14px"><div class="card-h">SERVICE CLAIMS ON THIS JOB CARD</div><div class="card-b" style="padding:0">${table([{ h: "Claim No", f: c => esc(c.id) }, { h: "Type", f: c => esc(c.type) }, { h: "Status", f: stChip }, { h: "Claim age", f: c => c.age + " days" + (aged(c) ? ' <span class="txt-red">● aged</span>' : "") }, { h: "VCM comment", f: c => esc(c.vcm || "--") }, { h: "Action", f: escBtn }], L, "Service claims on this job card")}</div></section>`; };

  /* ---------- P27: Service Claims for the TML positions ---------- */
  const SECTIONS = [["", "Overview"], ["all", "All claims"], ...TYPES.map(t => [t.id, t.name])];
  views.claims = tab => { const f = S.filters, sec = SECTIONS.some(x => x[0] === f.sec) ? f.sec : "", m = agg(S.unit);
    const seg = `<div class="icon-btns" role="group" aria-label="Claim type" style="gap:8px;flex-wrap:wrap;margin:10px 0">${SECTIONS.map(([k, l]) => `<button class="pillbtn${sec === k ? " on" : ""}" data-h="tmlset" data-k="sec" data-v="${k}" aria-pressed="${sec === k}">${l}</button>`).join("")}</div>`;
    const tile = (v, l, c = "#0b8f3a") => `<div class="spd-k"><b style="color:${c}">${two(v)}</b><span>${l}</span></div>`;
    const strip = mm => `<section class="card spd-strip" role="list">${tile(mm.total, "Claims", "#1a56db")}${tile(mm.Created, "Created", "#1a56db")}${tile(mm.Submitted, "Submitted", "#b86e00")}${tile(mm.Accepted, "Accepted")}${tile(mm.Settled, "Settled")}${tile(mm.Rejected, "Rejected", "#d93025")}${tile(mm.aged, `Created or submitted over ${CL.agedDays} days`, "#d93025")}</section>`;
    const cs = [["Claims", x => x.total], ...STAT.map(s => [s, x => x[s]]), [`Aged over ${CL.agedDays} days`, x => x.aged]];
    const intro = `The service claims of the dealerships in your scope, by claim type (FSB, Warranty, EW, AMC, Goodwill, Updation, Part Warranty, Assurant) and status (Created, Submitted, Accepted, Settled, Rejected), following the All Claims screen (86). TML follows the numbers and the claims that sit too long; the dealer's claim manager works each claim. Aged = still Created or Submitted after ${CL.agedDays} days (<span class="badge proposed">Proposed</span> limit).`;
    let body = "";
    if (!sec) {
      const typeRows = TYPES.map(t => ({ t, a: agg(S.unit, { type: t.id }) })), tot = m;
      const ok = KEYS.every(k => typeRows.reduce((s, r) => s + r.a[k], 0) === tot[k]);
      const rej = {}; for (const c of CS) if (inS(c) && c.status === "Rejected" && (S.bd === "All" || c.bd === S.bd)) rej[c.vcm] = (rej[c.vcm] || 0) + 1;
      body = strip(m) + `<section class="card" style="margin:16px 0"><div class="card-h">CLAIMS BY TYPE ${ok ? '<span class="check-ok link">✓ Rows add up to the total</span>' : '<span class="check-bad link">✗ Mismatch</span>'}</div><div class="card-b" style="padding:0">${table([{ h: "Claim type", f: r => esc(r.t.name) }, ...cs.map(([h, f]) => ({ h, num: 1, f: r => f(r.a) }))], typeRows, "Claims by type", `<tfoot><tr><td>Total</td>${cs.map(([h, f]) => `<td class="num">${f(tot)}</td>`).join("")}</tr></tfoot>`)}</div></section>` +
        `<section class="card" style="margin:16px 0"><div class="card-h">COMMENTS ON REJECTED CLAIMS <span class="badge proposed">Proposed list</span></div><div class="card-b">${Object.keys(rej).length ? barRows(Object.entries(rej).sort((a, b) => b[1] - a[1]), "#d93025") : '<p class="note">No rejected claims in this scope.</p>'}<p class="note">The VCM Comment column is on screen 86; its values are not shown, so the list of comments is proposed (ASSUMPTIONS AB).</p></div></section>` + breakdown("SERVICE CLAIMS", agg, cs, KEYS);
    } else {
      const q = App.norm(f.q || ""), rows = CS.filter(c => inS(c) && (sec === "all" || c.type === sec) && (S.bd === "All" || c.bd === S.bd) && (!f.st || c.status === f.st || (f.st === "Aged" && aged(c))) && (!q || [c.id, c.jc, c.chassis, c.reg].some(x => App.norm(x).includes(q)))).sort((a, b) => b.age - a.age);
      csvStore.claims = { cols: [["Dealer", r => dname(r.dealer)], ...cols.map(c => [c.h, r => (c.f(r) + "").replace(/<[^>]+>/g, "")])], rows };
      body = strip(agg(S.unit, sec === "all" ? {} : { type: sec })) + `<div class="filters" role="search">${inp("f-q", "Search claim, JC, chassis, reg. no.", f.q)}${sel("f-st", "Status", [...STAT.map(x => [x, x]), ["Aged", "Aged"]], f.st)}<span class="grow"></span>${filterBtns()}</div>` +
        breakdown((sec === "all" ? "ALL" : sec.toUpperCase()) + " CLAIMS", u => agg(u, sec === "all" ? {} : { type: sec }), cs, KEYS) + `<div class="list-meta">${showing(rows.length)}<span class="right">${csvBtn("claims")}</span></div>${table([{ h: "Dealership", f: r => esc(dname(r.dealer)) }, ...cols.map(c => ({ ...c, f: r => (c.f(r) + "").replace(/<a [^>]*>|<\/a>/g, "") })), { h: "Claim amount (₹)", num: 1, f: r => money(r.amount) }, { h: "Vehicle journey", f: r => `<button class="btn small" data-h="tmlvj" data-id="${esc(r.visit)}">Journey</button>` }, { h: "Action", f: escBtn }], pageRows(rows), sec + " claims")}${pager(rows.length)}`;
    }
    return head("SERVICE CLAIMS", tab, intro) + seg + body + App.actionsPanel(); };
})();
