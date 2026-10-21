/* eQC / Washing screens recreated from the Figma screenshots (43 QI Pre Inspection, 46 QI Post Inspection, 42 Quality Inspection with the
   VCI diagnostic and the Guided Checks popup of screen 41, 49 Rework mode, 47 PDI, 48 Washing). The dealer's own screens: TML opens them
   read-only from "Dealer's Screens". Counts and lists come from the dealer's job cards; diagnostic values and checklist ticks are
   generated placeholders (sandbox data), repeatable for the same job card. */
(function () {
  const App = window.App, M = App.M, D = App.D, S = App.state, esc = App.esc, U = D.units, H = App.handlers;
  const { table, pageRows, showing, pager } = App.ui;
  const views = App.modules.appointment.views, today = D.today;
  const { hash, reg, hm, dmy, isOpen, jcs, STAGE, kpiStrip, titleRow, pill, NOTE, ptdRisk } = App.jcui;
  App.OPERATING.add("qiop");
  H.qiop = t => App.toast(t.dataset.msg || "Done (demo)");
  const btn = (label, msg, cls = "") => `<button class="btn small ${cls}" data-h="qiop" data-msg="${esc(msg)}">${esc(label)}</button>`;
  const stg = (list, ...s) => list.filter(v => s.includes(v.jc.stage));
  const norm = v => hash(v.id + "n") % 5 === 0 ? "BS4" : "BS6";
  const ccCount = v => 1 + hash(v.id + "c") % 4;
  const DEMO = { id: "VIS-DEMO", reg: "MH02CK7823", vin: "MAT614752JRH08243", model: "Nexon XZ", customer: "Demo Customer", sa: "Rajesh Kumar", source: "Appointment", vip: false, rv: false, date: today, eqc: null, jc: { id: "JC-Demo", stage: "qc_queue", ptd: today, waitMin: 45, ageDays: 1, reworkCycles: 0, critical: false } };
  const pick = pred => { const l = jcs(), f = S.filters; return (f.jc && l.find(v => v.id === f.jc)) || l.find(pred) || l[0] || DEMO; };
  const strip4 = all => kpiStrip([["📝", stg(all, "unassigned", "not_started").length, "Pre Inspection Pending", "#1a73e8"], ["🔧", stg(all, "qc_queue", "qc_in_progress").length, "Repair Inspection", "#e8910c"],
    ["⟲", stg(all, "rework").length, "Sent for Rework", "#d93025"], ["✔", all.filter(v => v.eqc === "passed").length, "QI Completed Today", "#1e8e3e"]]);
  const vehCard = (v, extra = "") => {
    const odo = 8000 + hash(v.id + "o") % 40000, remain = Math.max(0, 25 + (hash(v.id + "r") % 90));
    const box = (a, b, c, cls = "") => `<div class="vbox ${cls}"><small>${esc(a)}</small><b>${esc(b)}</b><small>${esc(c)}</small></div>`;
    return `<section class="card vehcard"><div class="veh-img" aria-hidden="true">🚙</div><div class="veh-id"><b>${esc(reg(v.reg).replace(/ /g, "-"))}</b><div class="note">${esc(v.model)} · Petrol · AT · ${norm(v)}</div><div class="note">${esc(v.vin)}</div></div>
      ${box("PTD Remaining", hm(remain), dmy(v.jc.ptd) + " 16:00", "red")}${box("Odometer", odo.toLocaleString("en-IN") + " Km", "Odometer", "blue")}${box("Sale Date", "31-Oct-2018", "Sale Date", "amber")}${box("Warranty End", "30-Oct-2021", "Warranty End", "red")}
      <div class="veh-info"><div><small>Service Type</small> Running Repairs</div><div><small>JC No.</small> ${esc(v.jc.id)}</div><div><small>SA Name</small> ${esc(v.sa)}</div><div><small>JC Created</small> ${dmy(v.date)}</div></div>${extra}</section>`;
  };
  const stepper = (labels, active) => `<ol class="stepper" aria-label="Quality inspection steps">${labels.map((l, i) => `<li class="${i < active ? "done" : i === active ? "on" : ""}"><span aria-hidden="true">${i < active ? "✓" : i + 1}</span>${esc(l)}</li>`).join("")}</ol>`;
  const STEPS = ["VOC & Road Test", "VCI Diagnostic", "VOC Action", "General Checklist", "Schedule Checklist", "Final Submission"];
  const topBtns = (extra = "") => `<span class="icon-btns" style="gap:8px;flex-wrap:wrap"><span class="chip blue">PTD · ${dmy(today)}, 04:00 PM</span>${btn("Cloud DTC", "Cloud DTC (demo)")}${btn("Previous QI", "Previous QI (demo)")}${btn("Customer 360", "Customer 360 (demo)")}${btn("Service History", "Service History (demo)")}${btn("Save as Draft", "Save as draft is done by the inspector")}${btn("Next", "Next step is done by the inspector", "primary")}${extra}</span>`;
  const tick = ok => ok ? '<span class="txt-green" aria-label="OK">✔</span>' : '<span class="txt-red" aria-label="Not OK">✖</span>';

  /* ---------- 43: QI Pre Inspection ---------- */
  views.qiPre = tab => {
    const all = jcs(), pre = stg(all, "unassigned", "not_started"), day = S.filters.qday || "today";
    return titleRow("QI Pre Inspection", tab) + App.scopeBanner({ crumbs: false }) + `<section class="card" style="padding:6px 8px">${strip4(all)}</section>
      <section class="card" style="margin-top:14px"><div class="card-h">PRE INSPECTION PENDING <span class="link"><span class="seg" role="group" aria-label="Day">${["today", "yesterday"].map(d => `<button data-h="qiday" data-d="${d}" aria-pressed="${day === d}">${d === "today" ? "Today" : "Yesterday"}</button>`).join("")}</span></span></div>
        <div class="card-b" style="padding:0">${table([{ h: "Vehicle Number", f: v => `<b>${esc(reg(v.reg).replace(/ /g, "-"))}</b>` }, { h: "Vehicle Model", f: v => esc(v.model) }, { h: "SA and JC Number", f: v => `${esc(v.sa)}<br><small class="note">${esc(v.jc.id)}</small>` },
          { h: "Waiting Since", f: v => `<span class="txt-red">${hm(v.jc.waitMin)}</span><br><small class="note">Assigned ${dmy(v.date)}</small>` }, { h: "Emission Norm", f: v => `<b class="${norm(v) === "BS6" ? "txt-blue" : "txt-amber"}">${norm(v)}</b>` }, { h: "PI CC Count", f: v => `<b class="txt-blue">${ccCount(v)}</b>` },
          { h: "", f: v => `${v.rv ? App.chip("Revisit", "amber") + " " : ""}${btn("Road Test", "Road test is done by the inspector", "primary")}` }], pre.filter(v => day === "today" || v.date !== today), "Pre inspection pending")}</div></section>${NOTE}`;
  };
  H.qiday = t => { S.filters = { ...S.filters, qday: t.dataset.d }; App.render(); };

  /* ---------- 46: QI Post Inspection ---------- */
  views.qiPost = tab => {
    const f = S.filters, all = jcs(), post = stg(all, "qc_queue", "qc_in_progress"), qt = f.qtab || "yet", vw = f.qview || "me";
    const rows = (qt === "yet" ? stg(post, "qc_queue") : stg(post, "qc_in_progress")).filter(v => !f.qflag || ({ ptd: v.jc.ptd <= today, revisit: v.rv, vci: hash(v.id + "v") % 2 === 0, nonvci: hash(v.id + "v") % 2 === 1, rework: v.jc.reworkCycles > 0 })[f.qflag]);
    const flags = [["ptd", "PTD Risk", post.filter(v => v.jc.ptd <= today).length, "#e8910c"], ["revisit", "Revisit", post.filter(v => v.rv).length, "#e8910c"], ["vci", "VCI Req", post.filter(v => hash(v.id + "v") % 2 === 0).length, "#1a73e8"],
      ["nonvci", "Non-VCI Req", post.filter(v => hash(v.id + "v") % 2 === 1).length, "#1e8e3e"], ["rework", "Rework", post.filter(v => v.jc.reworkCycles > 0).length, "#8e24aa"]];
    return titleRow("QI Post Inspection", tab) + App.scopeBanner({ crumbs: false }) + `<section class="card" style="padding:6px 8px">${strip4(all)}</section>
      <section class="card" style="margin-top:14px"><div class="card-h">POST REPAIR INSPECTION ${App.chip("Pending · " + post.length, "amber")}<span class="link"><span class="seg" role="group" aria-label="View">${[["me", "Assigned to Me"], ["division", "Division"]].map(([k, t]) => `<button data-h="qiset" data-k="qview" data-v="${k}" aria-pressed="${vw === k}">${t}</button>`).join("")}</span></span></div>
        <div class="card-b"><div class="icon-btns" style="gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="seg" role="group" aria-label="Stage">${[["yet", "Yet to Initiate"], ["prog", "In Progress"]].map(([k, t]) => `<button data-h="qiset" data-k="qtab" data-v="${k}" aria-pressed="${qt === k}">${t}</button>`).join("")}</span>
          ${flags.map(([k, l, c, col]) => `<button class="pillbtn${f.qflag === k ? " on" : ""}" style="border-color:${col};color:${col}" data-h="qiset" data-k="qflag" data-v="${f.qflag === k ? "" : k}" aria-pressed="${f.qflag === k}">${l} · ${c}</button>`).join("")}</div>
          ${table([{ h: "Vehicle Number", f: v => `<b>${esc(reg(v.reg).replace(/ /g, "-"))}</b>` }, { h: "Vehicle Model", f: v => esc(v.model) }, { h: "SA and JC Number", f: v => `${esc(v.sa)}<br><small class="note">${esc(v.jc.id)}</small>` },
            { h: "PTD Remaining", f: v => `<span class="${v.jc.ptd <= today ? "txt-red" : ""}">${hm(Math.max(0, 25 + hash(v.id + "r") % 90))}</span><br><small class="note">${dmy(v.jc.ptd)}, 04:30 PM</small>` }, { h: "Waiting Since", f: v => `<span class="txt-red">${hm(v.jc.waitMin)}</span>` },
            { h: "", f: v => `${v.rv ? App.chip("Revisit", "amber") + " " : ""}${v.jc.ptd <= today ? App.chip("PTD Risk", "amber") + " " : ""}${v.jc.critical ? App.chip("Critical", "red") + " " : ""}${hash(v.id + "v") % 2 === 0 ? App.chip("VCI", "blue") : ""}` }], pageRows(rows), "Post repair inspection")}
          ${pager(rows.length)}</div></section>${NOTE}`;
  };
  H.qiset = t => { S.filters = { ...S.filters, [t.dataset.k]: t.dataset.v }; S.page = 1; App.render(); };

  /* ---------- 42 (+41): Quality Inspection, VCI diagnostic and the Guided Checks popup ---------- */
  const guided = () => App.modal("Guided Checks Required", `<h3 style="color:var(--blue);margin:0 0 8px">Engine Noise</h3><div class="callout">Please complete the following checks as per the process before marking the final result.</div>
    <ol class="guided">${[["Verify Customer Concern", "Confirm the noise at idle and under the conditions described by the customer."], ["Visual & Physical Inspection", "Inspect engine mounting, belts, loose components, leakage and abnormal vibration."], ["VCI / DTC Verification", "Review applicable DTCs, DID parameters and routine execution results."],
      ["RPM-Based Functional Test", "Validate idle RPM and observe noise at the configured test RPM."], ["Road-Test Confirmation", "Confirm whether the concern persists during the applicable road test condition."]].map(([a, b]) => `<li><b>${esc(a)}</b><br><small class="note">${esc(b)}</small></li>`).join("")}</ol>
    <p class="callout" style="border-color:#e8910c"><b>NOTE:</b> All the above checks are mandatory for this demand code. Final OK / Not OK can be selected only after confirmation.</p>
    <label><input type="checkbox" checked disabled> I confirm that all the above guided checks have been performed.</label>`,
    [{ label: "Close" }, { label: "Confirm Guided Checks", primary: true, onClick: () => { if (S.ref) { App.toast(App.READONLY); return false; } App.toast("Guided checks confirmed (demo)"); } }]);
  H.qiguided = () => guided();
  views.qiVci = tab => {
    const v = pick(x => ["qc_queue", "qc_in_progress"].includes(x.jc.stage)), items = ["Connection", "DID Scan", "Routine Execution", "ECU Comparison", "Summary Overview"];
    return titleRow("Quality Inspection · VCI Diagnostic", tab) + App.scopeBanner({ crumbs: false }) + stepper(STEPS, 1) + `<div class="list-meta"><b>Quality Inspection</b><span class="right">${topBtns(`<button class="btn small" data-h="qiguided">Guided checks (Engine Noise)</button>`)}</span></div>${vehCard(v)}
      <div class="grid" style="grid-template-columns:1fr 3fr;align-items:start"><section class="card"><div class="card-h">VCI MODULE</div><div class="card-b"><ul class="list-plain vci-menu">${items.map((x, i) => `<li class="${i === 0 ? "on" : ""}"><span>${esc(x)}</span><span class="txt-green" aria-label="complete">✔</span></li>`).join("")}</ul></div></section>
        <section class="card"><div class="card-h">CONNECTION</div><div class="card-b" style="text-align:center;padding:60px 0"><div style="font-size:34px" aria-hidden="true">🔵</div><p style="margin:8px 0 2px"><b>OBD Device Connected</b></p><small class="note">OBD D-${123456 + hash(v.id) % 1000}A</small></div></section></div>${NOTE}`;
  };

  /* ---------- 49: Rework mode ---------- */
  const diag = v => { const total = 80 + hash(v.id + "t") % 40, bad = 3 + hash(v.id + "b") % 9; return { total, bad, ok: total - bad, did: 1 + hash(v.id + "1") % 4, rou: 1 + hash(v.id + "2") % 4, ecu: 1 + hash(v.id + "3") % 3, dtc: 1 + hash(v.id + "4") % 3 }; };
  views.qiRework = tab => {
    const v = pick(x => x.jc.reworkCycles > 0), d = diag(v);
    const list = (title, total, ok, bad, rows) => `<section class="card"><div class="card-h">${esc(title)} <span class="link note">${total} Total | ${ok} OK | ${bad} Not OK</span></div><div class="card-b"><ul class="list-plain">${rows.map(([n, val, okk, sub]) => `<li>${tick(okk)}<div>${esc(n)}${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div><span style="margin-left:auto">${val ? esc(val) + " " : ""}${App.chip(okk ? "OK" : "NOT OK", okk ? "green" : "red")}</span></li>`).join("")}</ul></div></section>`;
    return titleRow("Quality Inspection · Rework mode", tab) + App.scopeBanner({ crumbs: false }) + `<div class="callout" style="border-color:#e8910c">🔧 <b>REWORK MODE - Cycle ${1 + v.jc.reworkCycles}</b> &nbsp; Fresh VCI diagnostics required</div>
      <div class="list-meta"><b>Quality Inspection</b><span class="right">${topBtns()}</span></div>${vehCard(v)}
      <div class="grid" style="grid-template-columns:1fr 3.2fr;align-items:start"><div><button class="btn" style="width:100%" data-h="qiop" data-msg="Previous QI cycle (demo)">CHECK PREVIOUS QI CYCLE</button><section class="card" style="margin-top:10px"><div class="card-h">VCI MODULE</div><div class="card-b"><ul class="list-plain"><li><b>VCI Diagnostics</b></li><li>Rework Items</li><li>Final Submission</li></ul></div></section></div>
        <div><section class="card"><div class="card-b"><p style="margin:0"><b class="txt-amber">⚠ Diagnostic Completed With Issues</b></p><p class="note" style="margin:2px 0 8px">Review Not OK items below before proceeding.</p>
          <div class="icon-btns" style="gap:10px;flex-wrap:wrap"><span class="chip blue">TOTAL TESTS ${d.total}</span><span class="chip green">OK ${d.ok}</span><span class="chip red">NOT OK ${d.bad}</span></div>
          <div class="icon-btns" style="gap:6px;flex-wrap:wrap;margin-top:8px"><span class="chip green">DID Scan Complete</span><span class="chip green">Routines Complete</span><span class="chip red">Did Not OK · ${d.did}</span><span class="chip red">Routine Not OK · ${d.rou}</span><span class="chip red">ECU Not OK · ${d.ecu}</span><span class="chip purple">Confirmed DTCs · ${d.dtc}</span></div></div></section>
          <div class="grid g2" style="margin-top:12px">${list("DID SCAN", 42, 42 - d.did, d.did, [["O2 Sensor Voltage", "1.2 V", false, "Expected 0.1-0.9 V"], ["MAF Sensor Air Flow", "12.4 g/s", false, "Expected 3-8 g/s"], ["O5 Sensor Voltage", "1.2 V", true, ""]])}
            ${list("ROUTINE EXECUTION", 59, 59 - d.rou, d.rou, [["Driver Door Lock/Unlock", "", false, ""], ["Driver Door Lock/Unlock", "", true, ""]])}
            ${list("ECU SOFT. COMPARISON", 6, 6 - d.ecu, d.ecu, [["Engine Belt Condition", "", false, ""], ["Front Wheel Bearing Play", "", false, ""], ["Software Update", "", true, ""]])}
            ${list("DTC READINGS", 59, 59 - d.dtc, d.dtc, [["Engine and Fluids Sub-Group", "", false, "Oil Level, Coolant, Transmission, Leakage"], ["HVAC", "", false, "Coolant, Compressor, Condenser Assay"]])}</div></div></div>${NOTE}`;
  };

  /* ---------- 47: PDI ---------- */
  views.qiPdi = tab => {
    const v = pick(x => ["ready_delivery", "washing_queue", "washing_wip"].includes(x.jc.stage)), d = diag(v);
    const rows = [["CHECK MOVEMENT OF SUNVISOR High Speed", 1], ["CHECK WATER INGRESS IN DRIVER PASSENGER FRONT FOOT WELLS AND BOOT", 0], ["CHECK REAR VIEW MIRRORS INTERNAL AND EXTERNAL IN CONDITION AND OPERATION", 1], ["CHECK WINDOW WINDER ALL DOORS OPERATION", 0], ["CHECK DOOR LOCKING KNOB INTERNAL", 1], ["CHECK OPERATION OF CHILD LOCKS", 0]]
      .map(([a, ok], i) => [a, hash(v.id + "p" + i) % 4 === 0 ? 1 - ok : ok]);
    const warr = [["Warranty", "Inactive", "17 Jun 2021 - 16 Jun 2026", "10,000 KM - 60,000 KM"], ["Extd. Warranty", "Active", "17 Jun 2026 - 16 Jun 2028", "20,000 KM - 1,00,000 KM"], ["AMC", "Active", "-", "-"], ["RSA", "Inactive", "17 Jun 2025 - 12 Jun 2026", "10,000 KM - 40,000 KM"]];
    return titleRow("PDI · Step 1: Vehicle Information", tab) + App.scopeBanner({ crumbs: false }) + `<div class="list-meta"><b>Step 1: Vehicle Information</b><span class="right">${btn("Generate Complaint", "Done by the inspector")}${btn("Customer 360", "Customer 360 (demo)")}${btn("Service History", "Service History (demo)")}${btn("Next", "Next step is done by the inspector", "primary")}</span></div>
      <section class="card vehcard"><div class="veh-img" aria-hidden="true">🚙</div><div class="veh-id"><b>${esc(reg(v.reg).replace(/ /g, "-"))}</b><div class="note">${esc(v.model)} · Petrol · AT · ${norm(v)}</div></div>
        ${warr.map(([a, s, d1, k]) => `<div class="vbox ${s === "Active" ? "green" : "blue"}"><small>${a} ${App.chip(s, s === "Active" ? "green" : "grey")}</small><small>${d1}</small><small>${k}</small></div>`).join("")}<div class="veh-info"><div><small>Service Type</small> PDI</div><div><small>Odometer</small> ${8000 + hash(v.id + "o") % 40000} Kms</div></div></section>
      <div class="grid g2"><section class="card"><div class="card-h">VEHICLE DETAILS <span class="link note">Show More</span></div><div class="card-b"><ul class="list-plain"><li><small class="note">VIN</small> <b>${esc(v.vin)}</b></li><li><small class="note">Vehicle Color</small> <b>${["Black Metallic", "White", "Grey", "Blue"][hash(v.id) % 4]}</b></li><li><small class="note">Manufacturing Date</small> <b>24 Jun 2026</b></li><li><small class="note">VC Number</small> <b>VC-${87456000 + hash(v.id) % 1000}</b></li></ul></div></section>
        <section class="card"><div class="card-h">VCI DIAGNOSTIC DATA</div><div class="card-b"><ul class="list-plain"><li>No. of PDI Good Parameter<b style="margin-left:auto" class="txt-green">${d.total + 48}</b></li><li>No. of PDI Recheck Parameter<b style="margin-left:auto" class="txt-red">${d.dtc}</b></li><li>No. of PDI Not Applicable<b style="margin-left:auto">0</b></li><li>No. of OBD Readings<b style="margin-left:auto">10</b></li></ul>
          <div class="icon-btns" style="gap:6px;flex-wrap:wrap;margin-top:8px">${["DID Parameters", "Routine Execution", "ECU Data", "Road Test", "PDI Checksheet"].map(x => btn(x, x + " (demo)")).join("")}</div></div></section></div>
      <section class="card" style="margin-top:14px"><div class="card-h">PDI MANUAL CHECKLIST <span class="link note">Show All</span></div><div class="card-b" style="padding:0">${table([{ h: "Category", f: () => "04BODY (Inside Inspection)" }, { h: "Attribute", f: r => esc(r[0]) }, { h: "Value", f: r => tick(r[1]) }], rows, "PDI manual checklist")}</div></section>${NOTE}`;
  };

  /* ---------- 48: Washing ---------- */
  views.qiWash = tab => {
    const all = jcs(), q = stg(all, "washing_queue"), w = stg(all, "washing_wip"), ins = stg(all, "ready_delivery"), queue = [...q, ...w, ...ins].slice(0, 16), cur = pick(x => ["washing_queue", "washing_wip"].includes(x.jc.stage));
    const strip = kpiStrip([["🗂", q.length + w.length + ins.length, "All Queues", "#1e8e3e"], ["⏳", q.length, "Pending Wash", "#d93025"], ["🚿", w.length, "Wash in Progress", "#1e8e3e"], ["🔍", ins.length, "Inspection Pending", "#e8910c"],
      ["📅", q.filter(v => v.date === today).length + w.filter(v => v.date === today).length, "Pre Wash Today", "#1e8e3e"], ["↺", all.filter(v => v.jc.reworkCycles && ["washing_queue", "washing_wip"].includes(v.jc.stage)).length, "Rewash", "#1e8e3e"]]);
    const checks = ["Front View & Grill", "Right Side View & Wheels", "Rear View & Boot", "Left Side View & Wheels", "Interior Dashboard & Seats", "Underbody Cleanliness", "Engine Bay Surface", "Floor Mats & Vacuum"];
    return titleRow("Washing", tab) + App.scopeBanner({ crumbs: false }) + `<section class="card" style="padding:6px 8px">${strip}</section>
      <div class="grid" style="grid-template-columns:1fr 1.5fr;margin-top:14px;align-items:start"><section class="card"><div class="card-h">PRIORITY QUEUE <span class="link note">${queue.length} Jobs</span></div><div class="card-b">${queue.map(v => `<div class="un-job"><div class="icon-btns" style="justify-content:space-between"><b>${esc(reg(v.reg).replace(/ /g, "-"))}</b><span class="note">Customer Interaction ${["VC", "DW", "DC", "OP", "TP", "CS"].map(c => `<small class="chip grey" style="font-size:9px">${c}</small>`).join(" ")}</span></div>
          <div class="note">${esc(v.model)}</div><div class="note">PTD (Promise to Deliver) <span class="txt-red">${dmy(v.jc.ptd)} 04:00 PM</span></div><div class="icon-btns" style="justify-content:space-between"><span class="note">Assigned since ${hm(v.jc.waitMin)}</span>${btn("Start Wash", "Starting a wash is done by the washing staff", "primary")}</div></div>`).join("") || '<p class="note">No vehicles in the wash queue.</p>'}</div></section>
        <div><section class="card"><div class="card-h">EXTERIOR &amp; INTERIOR REVIEW <span class="link"><span class="chip grey">0/8 Completed</span></span></div><div class="card-b"><div class="callout" style="border-color:#e8910c"><b>Customer Washing Instructions</b><ul style="margin:6px 0 0"><li>Pay special attention to alloy wheels (heavy brake dust).</li><li>Avoid harsh chemicals on interior leather seats.</li><li>Ensure underbody wash is thoroughly completed.</li></ul></div>
          <p class="note">Vehicle: ${esc(reg(cur.reg).replace(/ /g, "-"))} · ${esc(cur.model)}</p><div class="grid g2"><div><b>Checkpoints</b><ul class="list-plain">${checks.map(c => `<li><input type="checkbox" disabled aria-label="${esc(c)}"> ${esc(c)}</li>`).join("")}</ul></div>
          <div><b>Wash Notes (Optional)</b><textarea disabled rows="5" style="width:100%" aria-label="Wash notes" placeholder="Add any specific remark here..."></textarea><b>Declaration</b><ul class="list-plain"><li><input type="checkbox" disabled aria-label="Wash instructions followed"> All requested wash instructions followed.</li><li><input type="checkbox" disabled aria-label="No damage"> No damage caused during washing process.</li></ul></div></div></div></section></div></div>${NOTE}`;
  };
  ["qiPre", "qiPost", "qiVci", "qiRework", "qiPdi", "qiWash"].forEach(k => { const f = views[k]; views[k] = tab => f(tab) + App.actionsPanel(); });
})();
