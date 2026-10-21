/* Pickup & Drop (Admin) screens recreated from the screenshots (22 Trip List, 30 Driver Availability & Assignment with the
   Booking Detail popup, 25 Live Tracking, 28 Tracking Report, 31 Work Status Photos, 24 Service Appointment, 35 Service Booking
   (Walk-In)). They are the dealer's own screens: TML opens them read-only from "Dealer's Screens". Sandbox data. */
(function () {
  const App = window.App, M = App.M, D = App.D, S = App.state, esc = App.esc, U = D.units, H = App.handlers;
  const { table, pageRows, showing, sel, inp, filterBtns, dealerOf, addDays, pager } = App.ui;
  const views = App.modules.appointment.views, today = D.today, SB = M.sandbox.serviceBooking;
  const dealerCode = d => "MH4" + d.slice(-2);
  const trips = () => D.pickups.filter(p => App.inScope(p) && App.bdOk(p));
  const pdDealer = () => dealerOf();
  const SCLS = { "Driver Not Assigned": "red", Delayed: "amber", Cancelled: "blue", "Drop Started": "green", "Pickup Started": "green", "Pickup Done": "grey", "Drop Done": "grey", Assigned: "purple", NA: "blue" };
  const chip = t => App.chip(t, SCLS[t] || "grey");
  const fmtDmy = iso => iso.split("-").reverse().join("/");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ampm = hhmm => { const h = +hhmm.slice(0, 2); return `${String(h % 12 || 12).padStart(2, "0")}:${hhmm.slice(3)} ${h < 12 ? "AM" : "PM"}`; };
  const fmtLong = (iso, hhmm) => `${+iso.slice(8)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}, ${ampm(hhmm)}`;
  const minutes = t => +t.slice(0, 2) * 60 + +t.slice(3);
  const titleRow = (title, tab) => `<div class="title-row"><button class="icon-btn" data-h="back" aria-label="Back">←</button><h1 style="font-size:20px;margin:0">${esc(title)}</h1><span class="badge observed">Observed · screen ${tab.screen}</span></div>`;
  const seg = (label, key, opts, cur) => `<span class="seg" role="group" aria-label="${esc(label)}">${opts.map(([v, t]) => `<button data-h="pdseg" data-k="${key}" data-v="${v}" aria-pressed="${cur === v}">${esc(t)}</button>`).join("")}</span>`;
  H.pdseg = t => { S.filters[t.dataset.k] = t.dataset.v; S.page = 1; App.render(); };
  const tripSort = (a, b) => b.date.localeCompare(a.date) || a.apptTime.localeCompare(b.apptTime);
  const legDriver = (p, kind) => p[kind + "Driver"];

  /* ---------- Booking Detail popup (screens 29 / 30) ---------- */
  const bookingModal = p => {
    const leg = p.pickupStatus !== "NA" ? "pickup" : "drop", phone = p.mobile;
    App.modal("Pick & Drop - Booking Detail", `<div class="bd-box"><div class="note">Customer</div><b>${esc(p.customer)} · +91 ${esc(phone)}</b>
      <div class="note">Pickup Address (Entered)</div><b>${esc(p.address)}</b><div class="note">Scheduled Pickup</div><b>${fmtLong(p.date, p[leg + "Time"])}</b>
      <div class="note">Vehicle</div><b>${esc(p.model)} · ${esc(p.reg)}</b><div class="note">Status</div><b>${chip(p.pickupStatus)} ${chip(p.dropStatus)}</b></div>
      <div class="bd-sms">Sends a secure SMS to +91 ${esc(phone)} with a GPS location link. Link expires in 30 minutes.</div>
      <p style="margin:0">Customer location: ${App.chip(p.locVerified ? "Verified" : "Unverified", p.locVerified ? "green" : "grey")}</p>`,
      [{ label: "Close" }, { label: "Request Live location", primary: true, onClick: () => { if (S.ref) { App.toast(App.READONLY); return false; } p.locRequested = true; App.toast("SMS with a GPS location link sent (demo)"); } }]);
  };
  H.pdbooking = t => bookingModal(D.pickups.find(x => x.id === t.dataset.id));

  /* ---------- 22: Trip List ---------- */
  views.pdTrips = tab => {
    const f = S.filters, all = trips(), day = f.day || "all", vw = f.view || "total", kpi = f.kpi || "total", q = App.norm(f.q || "");
    const dayRows = all.filter(p => day === "all" || (day === "today" && p.date === today) || (day === "tomorrow" && p.date === addDays(today, 1)));
    let rows = dayRows;
    const n = k => dayRows.filter(p => App.tripBucket(p) === k).length;
    rows = rows.filter(p => (kpi === "total" || App.tripBucket(p) === kpi) && (vw === "total" || (vw === "unassigned" ? App.tripBucket(p) === "unassigned" : [p.pickupApplicability, p.dropApplicability].some(a => a === "Scheduled" || a === "Applicable")))
      && (!f.status || p.pickupStatus === f.status || p.dropStatus === f.status) && (!f.type || p.type === f.type) && (!q || [p.reg, p.customer, p.serviceAppNo].some(x => App.norm(x).includes(q)))).sort(tripSort);
    const k = (id, num, label, color, ico) => `<button class="kpi-tab" id="kpi-${id}" data-h="kpi" data-k="${id}" aria-pressed="${kpi === id}"><span aria-hidden="true">${ico}</span><b style="color:${color}">${num}</b>${label}</button>`;
    const cols = [{ h: "Action", f: p => `<span class="icon-btns"><button class="icon-btn" data-h="pdbooking" data-id="${p.id}" title="Booking detail" aria-label="Booking detail for ${esc(p.reg)}">📅</button>
        <button class="icon-btn" data-h="pdgoavail" data-id="${p.id}" title="Driver availability and assignment" aria-label="Driver availability for ${esc(p.reg)}">🧭</button>
        <button class="icon-btn" data-h="pdgolive" data-reg="${esc(p.reg)}" title="Live tracking" aria-label="Live tracking for ${esc(p.reg)}">📍</button></span>` },
      { h: "Vehicle Reg. No.", f: p => esc(p.reg) }, { h: "Appointment<br>Date &amp; Time ⇅", f: p => `${fmtDmy(p.date).replace(/\/(\d{4})$/, (m, y) => "-" + y.slice(2)).replace(/\//g, "-")}<br>${ampm(p.apptTime)}` },
      { h: "Type", f: p => p.type }, { h: "Pickup<br>Applicability", f: p => p.pickupApplicability }, { h: "Drop<br>Applicability", f: p => p.dropApplicability },
      { h: "Pickup Trip<br>Managed by", f: p => p.pickupManagedBy }, { h: "Drop Trip<br>Managed by", f: p => p.dropManagedBy },
      { h: "Pickup Status ⇅", f: p => chip(p.pickupStatus) }, { h: "Drop Status ⇅", f: p => chip(p.dropStatus) },
      { h: "Pickup Driver<br>Name", f: p => esc(p.pickupDriver) }, { h: "Pickup Driver<br>Phone", f: p => esc(p.pickupPhone) }, { h: "Drop Driver<br>Name", f: p => esc(p.dropDriver) }];
    const statuses = ["Driver Not Assigned", "Delayed", "Cancelled", "Assigned", "Pickup Started", "Pickup Done", "Drop Started", "Drop Done"];
    return titleRow("Pickup & Drop · Trip List", tab) + App.scopeBanner({ crumbs: false, bd: false }) +
      `<div class="kpi-tabs">${k("total", dayRows.length, "Total Vehicles", "var(--blue)", "🚘")}
        ${k("unassigned", n("unassigned"), "Driver not assigned", "var(--red)", "🧑‍✈️")}${k("cancelled", n("cancelled"), "Cancelled", "var(--red)", "✖")}${k("completed", n("completed"), "Completed", "var(--green)", "✔")}${k("delayed", n("delayed"), "Delayed", "var(--red)", "⏱")}</div>
      <div class="scope" style="gap:10px 16px">${seg("Day", "day", [["all", "All"], ["today", "Today"], ["tomorrow", "Tomorrow"]], day)}${seg("View", "view", [["total", "Total Vehicles"], ["applicable", "P&D Applicable"], ["unassigned", "Driver Not Assigned"]], vw)}<span class="right">${App.bdToggle("Vehicle (All / PV / EV)")}</span></div>
      <div class="filters" role="search"><b style="font-size:16px">🚘 Total Vehicles</b><span class="grow"></span>${sel("f-status", "Status", statuses, f.status)}${sel("f-type", "Types", ["Appt", "Walk-in"], f.type)}${inp("f-q", "Search here", f.q)}${filterBtns()}</div>
      <div class="list-meta">${showing(rows.length, ` (${all.length} trips in scope)`)}</div>${table(cols, pageRows(rows), "Pickup and drop trips")}${pager(rows.length)}
      <p class="note">Each trip is counted once in the tabs above: cancelled, then delayed, then driver not assigned, then completed (every requested leg done); other trips are in progress.</p>` + App.actionsPanel();
  };
  H.pdgoavail = t => { const p = D.pickups.find(x => x.id === t.dataset.id); App.go("pd_avail", { trip: p.id, date: p.date }); };
  H.pdgolive = t => App.go("pd_live", { reg: t.dataset.reg });

  /* ---------- 30: Driver Availability & Assignment ---------- */
  const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17], T0 = 480, SPAN = 600;
  const blocksFor = (dealer, date) => {
    const out = [], names = new Set(D.drivers[dealer].map(d => d.name));
    D.pickups.filter(p => p.dealer === dealer && p.date === date).forEach(p => ["pickup", "drop"].forEach(kind => {
      const st = p[kind + "Status"];
      if (["NA", "Driver Not Assigned", "Cancelled"].includes(st) || p[kind + "ManagedBy"] !== "Self" || !names.has(p[kind + "Driver"])) return;
      const start = minutes(p[kind + "Time"]), dur = kind === "pickup" ? 45 : 60;
      out.push({ trip: p, kind, driver: p[kind + "Driver"], start, end: start + dur, st });
    }));
    return out;
  };
  const timeOpts = cur => [...Array(21)].map((_, i) => { const m = 480 + i * 30, v = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; return `<option value="${v}" ${v === cur ? "selected" : ""}>${ampm(v)}</option>`; }).join("");
  views.pdAvail = tab => {
    const f = S.filters, dealer = pdDealer(), date = f.date || today, from = f.from || "08:30", to = f.to || "09:30", drivers = D.drivers[dealer];
    const blocks = blocksFor(dealer, date), dayTrips = D.pickups.filter(p => p.dealer === dealer && p.date === date);
    const fm = minutes(from), tm = minutes(to), isToday = date === today;
    const rows = drivers.map(d => { const mine = blocks.filter(b => b.driver === d.name), unav = isToday && d.unavailableToday, hit = mine.find(b => b.start < tm && b.end > fm);
      return { d, mine, unav, state: unav ? "Unavailable" : hit ? (hit.kind === "pickup" ? "Pickup" : "Drop") : "Available" }; });
    const cnt = k => rows.filter(r => k === "Busy" ? ["Pickup", "Drop"].includes(r.state) : r.state === k).length;
    const sel0 = dayTrips.find(p => p.id === f.trip) || dayTrips.find(p => p.pickupStatus !== "NA" && p.pickupDriver !== "-") || dayTrips[0];
    const ro = (l, v) => `<label class="field">${l}<input value="${esc(v ?? "")}" readonly></label>`;
    const left = sel0 ? `<section class="card"><div class="card-h">Appointment Details <span class="link"><button class="btn small" data-h="dummy" data-k="Edit">✎ Edit</button></span></div><div class="card-b">
        <div class="mini-h">Service Appointment</div><div class="form-grid" style="grid-template-columns:1fr 1fr">${ro("Customer Name", sel0.customer)}${ro("Mobile No", sel0.mobile)}${ro("Registration No.", sel0.reg)}${ro("Type", sel0.type)}
        ${ro("Appointment Slot Date & Time", fmtDmy(sel0.date).replace(/\//g, "-") + " " + ampm(sel0.apptTime))}${ro("SA Name", SB.saName)}</div>
        <div class="mini-h" style="margin-top:12px">Pickup & Drop Details</div><div class="seg" role="radiogroup" aria-label="Mode">${["Pickup and Drop", "Pickup Only", "Drop Only"].map(m => `<button role="radio" aria-checked="${sel0.mode === m}" aria-pressed="${sel0.mode === m}" disabled>${m.replace("Pickup", "Pick up")}</button>`).join("")}</div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr;margin-top:10px">${ro("Pick up Required", sel0.mode === "Drop Only" ? "No" : "Yes")}${ro("Pick up Status", sel0.pickupStatus)}${ro("Pick up Assigned Date & Time", sel0.pickupDriver === "-" ? "" : fmtDmy(sel0.date).replace(/\//g, "-") + " " + ampm(sel0.pickupTime))}
        ${ro("Drop Required", sel0.mode === "Pickup Only" ? "No" : "Yes")}${ro("Drop Status", sel0.dropStatus)}${ro("Drop Assigned Date & Time", sel0.dropDriver === "-" ? "" : fmtDmy(sel0.date).replace(/\//g, "-") + " " + ampm(sel0.dropTime))}</div></div></section>`
      : `<section class="card"><div class="card-b note">No pickup and drop trips on this date.</div></section>`;
    const grid = `<div class="tl" style="min-width:1100px"><div class="tl-h"><span></span><div class="tl-hours">${HOURS.map(h => `<span>${ampm(String(h).padStart(2, "0") + ":00")}</span>`).join("")}</div></div>
      ${rows.map(r => `<div class="tl-row"><div class="tl-drv"><b>${esc(r.d.name)}</b><span class="note">${esc(r.d.phone)}</span><span class="note"><u>Trip Assigned - ${r.mine.length}</u></span>
        <span class="tl-st">${r.state === "Available" ? "○" : r.state === "Pickup" ? "<i class='dotc' style='background:var(--blue)'></i>" : r.state === "Drop" ? "<i class='dotc' style='background:var(--amber)'></i>" : "<i class='dotc' style='background:#9aa3b2'></i>"} ${r.state}</span>
        <button class="btn small primary" data-h="pdassign" data-driver="${esc(r.d.name)}" ${r.unav ? "" : ""}>Assign Driver</button></div>
        <div class="tl-lane">${r.unav ? `<div class="tl-un">Unavailable</div>` : ""}${r.mine.map(b => `<button class="tl-blk ${b.kind}${b.st === "Delayed" ? " late" : ""}${sel0 && b.trip.id === sel0.id ? " sel" : ""}" style="left:${100 * (b.start - T0) / SPAN}%;width:${100 * (b.end - b.start) / SPAN}%" data-h="pdblock" data-id="${b.trip.id}"
          aria-label="${b.kind} ${esc(b.trip.reg)} ${esc(b.trip.customer)}"><b>${b.kind === "pickup" ? "Pickup" : "Drop"} - ${esc(b.trip.reg)}</b><span>${esc(b.trip.customer)}</span><small>${ampm(hm(b.start))} - ${ampm(hm(b.end))}</small>${b.st === "Delayed" ? "<em class=\"te\">Time Exceeded</em>" : ""}${chip(b.st)}</button>`).join("")}</div></div>`).join("")}</div>`;
    return titleRow("Driver Availability & Assignment", tab) + App.scopeBanner({ crumbs: false, bd: false }) +
      `<div class="kpi-tabs"><span class="kpi-tab"><b style="color:var(--blue)">${String(cnt("Available")).padStart(2, "0")}</b>Available</span><span class="kpi-tab"><b style="color:var(--blue)">${cnt("Busy")}</b>Busy</span><span class="kpi-tab"><b style="color:var(--blue)">${cnt("Unavailable")}</b>Unavailable</span></div>
      <div class="filters"><b>Driver Availability and Assignment</b><span class="note">○ Available &nbsp; <i class="dotc" style="background:var(--blue)"></i> Pickup &nbsp; <i class="dotc" style="background:var(--amber)"></i> Drop &nbsp; <i class="dotc" style="background:#9aa3b2"></i> Unavailable</span><span class="grow"></span>
        ${inp("f-date", "Date", date, "date")}<label for="f-from">From<select id="f-from" data-hc="filter" data-f="from">${timeOpts(from)}</select></label><label for="f-to">To<select id="f-to" data-hc="filter" data-f="to">${timeOpts(to)}</select></label></div>
      <div class="pd-split">${left}<section class="card"><div class="card-h">Driver Availability and Assignment <span class="link note">Select a booking on the timeline for its detail</span></div><div class="card-b" style="padding:0;overflow-x:auto">${grid}</div></section></div>
      <p class="note">Drivers shown are the dealership's own (trips managed by Self). Trips managed by Drive U are on the Trip List only.</p>` + App.actionsPanel();
  };
  const hm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  H.pdblock = t => { const p = D.pickups.find(x => x.id === t.dataset.id); S.filters.trip = p.id; App.render(); bookingModal(p); };
  H.pdassign = t => {
    const f = S.filters, dealer = pdDealer(), date = f.date || today, p = D.pickups.find(x => x.id === f.trip) || D.pickups.find(x => x.dealer === dealer && x.date === date && [x.pickupStatus, x.dropStatus].includes("Driver Not Assigned"));
    if (!p) return App.toast("No trip without a driver on this date");
    const kind = p.pickupStatus === "Driver Not Assigned" ? "pickup" : p.dropStatus === "Driver Not Assigned" ? "drop" : null;
    if (!kind) return App.toast("The selected trip already has its driver(s)");
    const d = D.drivers[dealer].find(x => x.name === t.dataset.driver);
    p[kind + "Driver"] = d.name; p[kind + "Phone"] = d.phone; p[kind + "ManagedBy"] = "Self"; p[kind + "Status"] = "Assigned"; p[kind + "Applicability"] = "Scheduled";
    App.render(); App.toast(`${d.name} assigned to ${kind} for ${p.reg}`);
  };
  H.dummy = H.dummy || (t => App.toast(`${t.dataset.k}: shown on the screen, not part of this demo`));

  /* ---------- 25: Live Tracking ---------- */
  const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  views.pdLive = tab => {
    const f = S.filters, q = (f.reg || "").toLowerCase();
    const active = trips().filter(p => [p.pickupStatus, p.dropStatus].some(x => x === "Pickup Started" || x === "Drop Started"))
      .map(p => { const kind = p.pickupStatus === "Pickup Started" ? "pickup" : "drop"; return { p, kind, driver: p[kind + "Driver"], status: p[kind + "Status"] }; })
      .filter(a => (!q || App.norm(a.p.reg).includes(q)) && (!f.driver || a.driver === f.driver));
    const cur = active.find(a => a.p.id === f.sel) || active[0];
    const drivers = [...new Set(trips().flatMap(p => [p.pickupDriver, p.dropDriver]).filter(x => x !== "-"))].sort();
    const list = active.map(a => `<label class="trip-item"><input type="radio" name="trip" data-h="pdsel" data-id="${a.p.id}" ${cur && cur.p.id === a.p.id ? "checked" : ""}>
      <span class="ti-main"><b>${esc(a.p.reg)}</b>${App.chip(a.status, "grey")}<br>${esc(a.driver)}<br><small class="note">${esc(a.p.model)}</small><br>📍 ${a.kind === "pickup" ? "Pickup" : "Drop"}
      ${a.p.eta != null && a.p.eta !== 0 || a.p.dist === 0 ? `<br><small class="note">ETA: ${a.p.eta} min &nbsp; Remaining Distance: ${Number(a.p.dist).toFixed(1)} Km</small>` : ""}</span></label>`).join("") || '<p class="note" style="padding:12px">No active trips for this filter.</p>';
    const pos = p => ({ x: 70 + hash(p.reg) % 760, y: 50 + hash(p.id) % 340 });
    const roads = [...Array(9)].map((_, i) => `<line x1="${60 + i * 100}" y1="0" x2="${i * 100 + 160 - (i % 3) * 40}" y2="440" stroke="#fff" stroke-width="${i % 3 ? 5 : 9}"/>`).join("") + [...Array(5)].map((_, i) => `<line x1="0" y1="${40 + i * 95}" x2="900" y2="${70 + i * 85}" stroke="#fff" stroke-width="${i % 2 ? 5 : 8}"/>`).join("");
    const cars = active.map(a => { const q2 = pos(a.p), on = cur && cur.p.id === a.p.id;
      return `<g transform="translate(${q2.x},${q2.y})"><circle r="${on ? 17 : 14}" fill="#111" stroke="${on ? "var(--blue)" : "#fff"}" stroke-width="3"/><text y="5" text-anchor="middle" font-size="14">🚗</text></g>`; }).join("");
    const dest = cur ? (() => { const q2 = pos(cur.p); return `<g transform="translate(${(q2.x + 230) % 600 + 40},${(q2.y + 140) % 330 + 50})"><path d="M0 0c-10-14-16-22-16-30a16 16 0 1 1 32 0c0 8-6 16-16 30z" fill="#d93025"/><circle cy="-30" r="6" fill="#fff"/><text x="22" y="-24" font-size="12" fill="#b3261e" font-weight="700">${esc(cur.p.customer)} (customer)</text></g>`; })() : "";
    return titleRow("Live Tracking Report", tab) + App.scopeBanner({ crumbs: false, bd: false }) +
      `<div class="filters" role="search">${inp("f-reg", "Registration Number", f.reg)}<label for="f-driver">Driver Name<select id="f-driver" data-hc="filter" data-f="driver"><option value="">Driver Name</option>${drivers.map(d => `<option ${f.driver === d ? "selected" : ""}>${esc(d)}</option>`).join("")}</select></label></div>
      <div class="pd-split" style="grid-template-columns:minmax(260px,1fr) 2.4fr"><section class="card"><div class="card-h">Active Trips</div><div class="card-b" style="padding:8px">${list}</div></section>
      <section class="card"><div class="card-h">Live Tracking</div><div class="card-b"><svg viewBox="0 0 900 440" role="img" aria-label="Schematic map with ${active.length} active vehicles" style="width:100%;height:auto;border-radius:10px;background:#e6edf4">
        <rect width="900" height="440" fill="#e9eef3"/><path d="M0 0h120c30 90 -20 200 30 300s10 110 0 140H0z" fill="#9fd3ec"/>${roads}${cars}${dest}</svg>
        <p class="note">Schematic map: the real app shows a street map with the vehicles' live positions.</p></div></section></div>` + App.actionsPanel();
  };
  H.pdsel = t => { S.filters.sel = t.dataset.id; App.render(); };

  /* ---------- 28: Pickup & Drop Tracking Report ---------- */
  const TRK = ["Pickup Process ...", "Fuel And Odom...", "Scratch And Dent...", "External Inventory"];
  views.pdReport = tab => {
    const f = S.filters, q = (f.reg || "").toLowerCase(), qa = (f.app || "").toLowerCase(), dealer = U[S.unit].level === "dealer" ? S.unit : null;
    const drivers = [...new Set(trips().map(p => p.pickupDriver).filter(x => x !== "-"))].sort();
    const rows = trips().filter(p => ["Pickup Started", "Pickup Done"].includes(p.pickupStatus) && (!f.date || p.date === f.date) && (!q || App.norm(p.reg).includes(q)) && (!f.driver || p.pickupDriver === f.driver)
      && (!qa || p.serviceAppNo.toLowerCase().includes(qa) || (p.apptId || "").toLowerCase().includes(qa))).sort(tripSort);
    const tick = ok => ok ? `<span class="trk" role="img" aria-label="done">✔</span>` : `<span class="sr-only">not done</span>`;
    const cols = [{ h: "Dealer No.", f: p => dealerCode(p.dealer) }, { h: "Registration No.", f: p => esc(p.reg) }, { h: "Customer", f: p => esc(p.customer) }, { h: "Type", f: p => p.mode === "Pickup and Drop" ? "Pick and Drop" : p.mode },
      { h: "Service App. No.", f: p => p.serviceAppNo }, { h: "Driver Name", f: p => esc(p.pickupDriver) }, { h: "Scheduled Pickup", f: p => `${fmtDmy(p.date)} ${p.pickupTime}` },
      ...TRK.map((l, i) => ({ h: `<span title="Pickup Tracking">${l}</span>`, f: p => tick(p.tracking[i]) }))];
    return titleRow("Pickup & Drop Tracking Report", tab) + App.scopeBanner({ crumbs: false, bd: false }) +
      `<div class="filters" role="search">${inp("f-date", "Date", f.date, "date")}${inp("f-reg", "Registration Number", f.reg)}<label for="f-driver">Driver Name<select id="f-driver" data-hc="filter" data-f="driver"><option value="">Driver Name</option>${drivers.map(d => `<option ${f.driver === d ? "selected" : ""}>${esc(d)}</option>`).join("")}</select></label>
        ${inp("f-app", "Appointment Number", f.app)}<span class="grow"></span>${filterBtns()}${App.ui.iconBtns()}</div>
      <div class="list-meta">${showing(rows.length)}</div>
      <p class="note" style="margin:0 0 6px">Pickup Tracking: the four steps the driver completes at pickup. Only the columns visible in the screenshot are shown.</p>${table(cols, pageRows(rows), "Pickup and drop tracking report")}${pager(rows.length)}` + App.actionsPanel();
  };

  /* ---------- 31: Work Status Photos ---------- */
  views.pdPhotos = tab => {
    const f = S.filters, q = (f.reg || "").toLowerCase(), drivers = [...new Set(trips().map(p => p.pickupDriver).filter(x => x !== "-"))].sort();
    const rows = trips().filter(p => p.photos > 0 && (!f.date || p.date === f.date) && (!q || App.norm(p.reg).includes(q)) && (!f.driver || p.pickupDriver === f.driver || p.dropDriver === f.driver)).sort(tripSort);
    const cols = [{ h: "Dealer Code", f: p => dealerCode(p.dealer) }, { h: "Service App No", f: p => p.serviceAppNo }, { h: "Driver Name", f: p => esc(p.pickupDriver !== "-" ? p.pickupDriver : p.dropDriver) }, { h: "Vehicle Reg. Number", f: p => esc(p.reg) },
      { h: "VIN", f: p => p.vin }, { h: "Customer Name", f: p => esc(p.customer) }, { h: "Pickup/Drop Date/ Time", f: p => `${fmtDmy(p.date)} ${p.pickupTime}` }, { h: "No. of Images Uploaded", num: 1, f: p => p.photos }];
    return titleRow("Work Status Photos", tab) + App.scopeBanner({ crumbs: false, bd: false }) +
      `<div class="filters" role="search">${inp("f-reg", "Registration Number", f.reg)}${inp("f-date", "Date", f.date, "date")}<label for="f-driver">Driver Name<select id="f-driver" data-hc="filter" data-f="driver"><option value="">Driver Name</option>${drivers.map(d => `<option ${f.driver === d ? "selected" : ""}>${esc(d)}</option>`).join("")}</select></label>
        <span class="grow"></span>${filterBtns()}</div><div class="list-meta">${showing(rows.length)}</div>
      ${table(cols, pageRows(rows), "Work status photos")}${pager(rows.length)}<p class="note">The screenshot shows the list before any search; here it lists the trips that have photos.</p>` + App.actionsPanel();
  };

  /* ---------- 24 Service Appointment and 35 Service Booking (Walk-In) ---------- */
  const serviceForm = (kind, tab) => {
    const appt = kind === "appt", f = S.filters, tabSel = f.ptab || "pd";
    const fld = (l, v, o = {}) => `<div class="erow" style="grid-template-columns:130px minmax(0,1fr)"><span>${o.req ? '<b style="color:var(--red)">*</b>' : ""}${l}</span>${o.select ? `<select disabled aria-label="${esc(l)}"><option>${esc(v || "")}</option></select>` : `<input value="${esc(v || "")}" readonly aria-label="${esc(l)}">`}</div>`;
    const dis = l => `<button class="btn small" disabled>${l}</button>`;
    return titleRow(appt ? "Service Appointment" : "Service Booking", tab) + App.scopeBanner({ crumbs: false, bd: false }) +
      `<p class="note" style="margin:-4px 0 8px">Product Name › ${appt ? "Service Appointment" : "Service Booking"} · read-only view</p>
      <section class="card"><div class="card-b" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b style="font-size:16px;margin-right:auto">${appt ? "Service Appointment" : "Service Booking"}</b>
        ${dis("Clear")}${dis("Modify")}${dis("Cancel")}<button class="btn primary small" data-h="pdsave">Save</button>${dis("Service History")}${dis("Audit Log")}${dis("Follow-Up History")}</div></section>
      <div class="filters" style="margin-top:12px"><label for="f-rt">Search by<select id="f-rt" disabled><option>Reg No.</option></select></label><label for="f-rv" class="grow">Reg No.<input id="f-rv" value="${esc(SB.reg)}" readonly></label>
        <button class="btn primary" data-h="dummy" data-k="Search">Search</button><span style="font-size:18px;letter-spacing:8px" aria-hidden="true">📞 💬 📍 ✉</span></div>
      <div class="grid g2"><section class="card"><div class="card-b"><div class="emp-col">
        ${fld(appt ? "Appointment Id" : "Visitor Id", appt ? SB.appointmentId : SB.visitorId)}${appt ? fld("Appointment Created Date", SB.created) : ""}${fld("VIN", SB.vin)}${fld("Registration No.", SB.reg)}${fld("Customer Name", SB.customer)}${fld("Mobile No", SB.mobile, { req: 1 })}
        ${fld("Car Usage Type", SB.carUsagePlaceholder, { select: 1 })}${fld("Office Phone", "")}${fld("Last Mileage", SB.lastMileage)}${fld("E-mail", SB.email)}${fld("Sales Date", SB.salesDate)}${fld("Last Service Date", SB.lastServiceDate)}${fld("Customer Address", SB.address)}</div></div></section>
      <section class="card"><div class="card-b"><div class="emp-col">${fld("Channel", appt ? "Outbound Call" : "Walk-In")}${fld("Service Type", SB.serviceType, { req: 1, select: 1 })}${fld("Express Service", SB.express, { req: 1, select: 1 })}${fld("Preferred Service Advisor", "", { select: 1 })}
        ${fld("Preferred Contact No", "")}${fld("CCE", "", { select: 1 })}${appt ? fld("Reschedule Count", "") : ""}${fld(appt ? "Appointment Slot Date & Time" : "Slot Date & Time", SB.slot, { req: 1 })}<span class="note" style="text-align:right"><u>Slot Availability</u></span>${fld("Customer Demand", "")}
        <div class="mini-h" style="background:var(--row);padding:6px 8px">Follow-up Details</div>${fld("Next Follow-up Date", "")}${fld("Contact Mode", "Select Mode", { select: 1 })}${fld("Remarks/Call Notes", "")}${fld("Follow up Action", "Select Action", { select: 1 })}</div></div></section></div>
      <div class="tab-strip" role="tablist">${[["pd", "Pick & Drop Detail"], ["hist", "Pickup Drop History"], ["fu", "Follow Up History"]].map(([k, l]) => `<button role="tab" aria-selected="${tabSel === k}" ${tabSel === k ? 'aria-current="true"' : ""} data-h="pdptab" data-v="${k}">${l}</button>`).join("")}</div>
      ${tabSel === "pd" ? `<section class="card"><div class="card-b"><div class="seg" role="radiogroup" aria-label="Mode">${["Pick up and Drop", "Pick Up Only", "Drop Only"].map((m, i) => `<button role="radio" aria-checked="${i === 0}" aria-pressed="${i === 0}" disabled>${m}</button>`).join("")}</div>
        <div class="grid g2" style="margin-top:12px"><div class="emp-col"><div class="mini-h">Pickup Details</div>${fld("Pick up Required", SB.pickupRequired, { select: 1 })}${fld("Pick up Status", SB.pickupStatus, { select: 1 })}${fld("Pick up Assigned Date & Time", SB.pickupAssigned)}</div>
        <div class="emp-col"><div class="mini-h">Drop Details</div>${fld("Drop Required", SB.dropRequired, { select: 1 })}${fld("Drop Status", SB.dropStatus, { select: 1 })}${fld("Preferred Drop Date & Time", SB.preferredDrop)}${fld("Drop Assigned Date & Time", SB.dropAssigned)}</div></div>
        <p style="display:flex;gap:8px;justify-content:flex-end;margin:8px 0 0"><button class="btn small" data-h="pdcancel" data-k="Cancel Pickup">Cancel Pickup</button><button class="btn small" data-h="pdcancel" data-k="Cancel Drop">Cancel Drop</button>${dis("Modify")}<button class="btn primary small" data-h="pdsave">Save</button></p></div></section>`
        : `<section class="card"><div class="card-b note">${tabSel === "hist" ? "Pickup Drop History: shown on the screen, no entries in the sample record." : "Follow Up History: shown on the screen, no entries in the sample record."}</div></section>`}
      <p class="note">The form shows the sample record of the screenshot (sandbox data).</p>` + App.actionsPanel();
  };
  views.pdAppt = tab => serviceForm("appt", tab);
  views.pdWalkin = tab => serviceForm("walkin", tab);
  H.pdptab = t => { S.filters.ptab = t.dataset.v; App.render(); };
  H.pdsave = () => App.toast("Save: shown on the screen, not part of this demo");
  H.pdcancel = t => App.toast(`${t.dataset.k}: shown on the screen, not part of this demo`);
})();
