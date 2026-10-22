/* TML follow-ups (P28, proposed): the actions a TML position takes on a vehicle in the journey. A follow-up asks the Dealer GM of the
   dealership for something on one vehicle (status update, committed date, expedite a part, submit a claim, review a reason, escalate),
   with a priority, a due date, the dealer's response and an outcome. Raised from the vehicle page and from the module lists (job cards,
   THD, SPD, claims); all follow-ups are on P28 with counts that roll up. Types, due days and rules: model.json followUps (Proposed). */
(function () {
  const App = window.App, M = App.M, D = App.D, S = App.state, esc = App.esc, U = D.units, H = App.handlers, today = D.today;
  const { table, pageRows, showing, pager, sel, inp, filterBtns } = App.ui;
  const views = App.modules.appointment.views, FU = M.followUps, T = App.tmlui;
  const { head, breakdown, csvStore, csvBtn, dname, reg } = T;
  const LIST = D.followUps = D.followUps || [], WATCH = D.watch = D.watch || new Set(D.watchIds || []);
  const OUT = D.outbox = D.outbox || [];   // messages sent from TML to the dealer application (simulated delivery)
  const thread = f => f.thread || (f.thread = [{ side: "tml", by: f.raisedBy, at: f.raised, text: (kindOf(f.kind) ? kindOf(f.kind).label : f.kind) + (f.note ? ": " + f.note : "") },
    ...(f.response ? [{ side: "dealer", by: "Dealer GM", at: f.raised, text: f.response }] : [])]);
  const send = (f, type, text) => { const v = findV(f.visit); OUT.unshift({ messageId: "MSG-" + (OUT.length + 1), followUpId: f.id, type, dealerCode: f.dealer, dealer: dname(f.dealer), to: "Dealer GM", from: S.role, text, priority: f.priority, dueDate: f.due,
    vehicle: { reg: f.reg, vin: v ? v.vin : "", jc: v && v.jc ? v.jc.id : "" }, sentAt: D.now, status: "Delivered to the dealer application (simulated)" }); };
  const RANK = { NSM: 0, RSM: 1, ZSM: 2, RCSM: 3 };
  const inS = (r, unit = S.unit) => App.inScope({ dealer: r.dealer }, unit) && (S.bd === "All" || r.bd === S.bd);
  const overdue = f => f.status !== "Closed" && f.due < today;
  const kindOf = id => FU.kinds.find(k => k.id === id);
  const findV = id => D.visits.find(v => v.id === id);
  const visitOfJc = jc => (D.visits.find(v => v.jc && v.jc.id === jc) || {}).id;
  const addDays = (iso, n) => { const d = new Date(iso + "T00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const dmy = iso => iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : "–";
  const canClose = f => App.can("close_follow_up") && RANK[S.role] !== undefined && RANK[S.role] <= (RANK[f.raisedBy] ?? 3);
  const stChip = f => overdue(f) ? App.chip("Overdue", "red") : App.chip(f.status, { Open: "amber", Responded: "blue", Closed: "green" }[f.status]);

  const notify = (rec, type, text) => { const v = findV(rec.visit); OUT.unshift({ messageId: "MSG-" + (OUT.length + 1), followUpId: rec.id || "", type, dealerCode: rec.dealer, dealer: dname(rec.dealer), to: "Dealer GM", from: S.role, text, priority: "", dueDate: "", vehicle: { reg: rec.reg, vin: v ? v.vin : "", jc: v && v.jc ? v.jc.id : "" }, sentAt: D.now, status: "Delivered to the dealer application (simulated)" }); };
  App.fu = {
    notify,
    /* "Take action" button for a record: ctx = { module, visit | jc, ref } */
    btn: ({ module, visit, jc, ref }) => { const vid = visit || visitOfJc(jc); if (!vid || !App.can("follow_up")) return "";
      const open = LIST.filter(f => f.visit === vid && f.ref === ref && f.status !== "Closed").length;
      return `<button class="btn small" data-h="fuNew" data-m="${esc(module || "")}" data-id="${esc(vid)}" data-ref="${esc(ref || "")}">Take action${open ? ` <span class="chip amber">${open} open</span>` : ""}</button>`; },
    add: f => { const x = { id: "FU-" + (3001 + LIST.length), status: "Open", response: "", outcome: "", raised: D.now, raisedBy: S.role, ...f }; LIST.unshift(x); thread(x); send(x, "follow_up", thread(x)[0].text); },
    /* card on the vehicle page */
    card: vid => { const L = LIST.filter(f => f.visit === vid), v = findV(vid), w = WATCH.has(vid);
      const watchBtn = App.can("watch_vehicle") ? `<button class="btn small" data-h="fuWatch" data-id="${esc(vid)}" aria-pressed="${w}">${w ? "★ On watchlist" : "☆ Add to watchlist"}</button>` : "";
      return `<section class="card" style="margin-top:14px"><div class="card-h">TML ACTIONS ON THIS VEHICLE <span class="badge proposed">Proposed</span></div><div class="card-b">
        <p style="margin:0 0 8px">${App.fu.btn({ visit: vid, ref: v.jc ? v.jc.id : vid })} ${watchBtn}</p>
        ${L.length ? fuTable(L, true) : '<p class="note">No follow-up on this vehicle yet.</p>'}</div></section>`; }
  };
  const fuCols = (onVehicle) => [{ h: "No.", f: f => esc(f.id) }, ...(onVehicle ? [] : [{ h: "Dealership", f: f => esc(dname(f.dealer)) }, { h: "Vehicle", f: f => `<b>${esc(reg(f.reg))}</b>` }]),
    { h: "Module", f: f => esc(FU.modules[f.module] || f.module) }, { h: "Record", f: f => esc(f.ref) }, { h: "Asked", f: f => esc(kindOf(f.kind).label) + (f.note ? `<br><small class="note">${esc(f.note)}</small>` : "") },
    { h: "Priority", f: f => App.chip(f.priority, { Normal: "grey", High: "amber", Critical: "red" }[f.priority]) }, { h: "Raised by", f: f => esc(f.raisedBy) }, { h: "Raised", f: f => dmy(f.raised.slice(0, 10)) },
    { h: "Due", f: f => `<span class="${overdue(f) ? "txt-red" : ""}">${dmy(f.due)}</span>` }, { h: "Status", f: stChip }, { h: "Dealer response / outcome", f: f => esc([f.response, f.outcome].filter(Boolean).join(" · ") || "–") },
    { h: "Thread", f: f => `<button class="btn small" data-h="fuThread" data-id="${esc(f.id)}">Comments (${thread(f).length})</button>` }, { h: "", f: f => (f.status !== "Closed" && canClose(f) ? `<button class="btn small" data-h="fuUpd" data-id="${esc(f.id)}">Update</button>` : "") + (onVehicle ? "" : ` <button class="btn small" data-h="tmlvj" data-id="${esc(f.visit)}">Journey</button>`) }];
  const fuTable = (rows, onVehicle) => table(fuCols(onVehicle), rows, "TML follow-ups");

  /* ---------- raise a follow-up ---------- */
  const modsOf = v => ["appointment", "pickup_drop", "security_guard", ...(v.jc ? ["jc"] : []), ...(v.eqc || (v.jc && v.jc.reworkCycles) ? ["eqc"] : []), ...(D.thdCases.some(c => c.visit === v.id) ? ["thd"] : []), ...(v.jc && D.spd && D.spd.mrs.some(r => r.jc === v.jc.id) ? ["spd"] : []), ...((D.claims || []).some(c => c.visit === v.id) ? ["claims"] : [])];
  H.fuNew = t => { if (!App.can("follow_up")) return App.toast(App.READONLY); const v = findV(t.dataset.id), csm = U[v.dealer].csm, mods = t.dataset.m ? [t.dataset.m] : modsOf(v);
    const kindOpts = m => FU.kinds.filter(k => k.modules.includes(m)).map(k => `<option value="${k.id}">${esc(k.label)}</option>`).join("");
    App.modal("Take action on " + reg(v.reg), `<div class="bd-box"><div class="note">Vehicle</div><b>${esc(reg(v.reg))} · ${esc(v.model)}${v.jc ? " · job card " + esc(v.jc.id) : ""}</b>
      <div class="note">Goes to</div><b>Dealer GM, ${esc(dname(v.dealer))}${csm ? " · copy TML territory CSM " + esc(csm.split(" (")[0]) : ""}</b></div>
      <label class="field" for="fu-m">Module<select id="fu-m">${mods.map(m => `<option value="${m}">${esc(FU.modules[m])}</option>`).join("")}</select></label>
      <label class="field" for="fu-k">What you ask<select id="fu-k">${kindOpts(mods[0])}</select></label>
      <fieldset class="field" style="border:0;padding:0;margin:10px 0"><legend class="note">Priority</legend>${FU.priorities.map((p, i) => `<label style="margin-right:14px"><input type="radio" name="fu-p" value="${p}" ${i ? "" : "checked"}> ${p}</label>`).join("")}</fieldset>
      <label class="field" for="fu-d">Due date<input id="fu-d" type="date" value="${addDays(today, FU.dueDays.Normal)}"></label>
      <label class="field" for="fu-n">Note for the Dealer GM<textarea id="fu-n" rows="2" placeholder="What you need and by when"></textarea></label>
      <p class="note">Proposed: types, priorities and default due days come from model.json (followUps), to confirm with TML.</p>`,
      [{ label: "Cancel" }, { label: "Send to Dealer GM", primary: true, onClick: r => { const m = r.querySelector("#fu-m").value, k = r.querySelector("#fu-k").value, pr = r.querySelector("input[name=fu-p]:checked").value;
        App.fu.add({ module: m, kind: k, visit: v.id, ref: t.dataset.ref || (v.jc ? v.jc.id : v.id), dealer: v.dealer, division: v.division, bd: v.bd, reg: v.reg, priority: pr, due: r.querySelector("#fu-d").value || today, note: r.querySelector("#fu-n").value.trim() });
        S.escalations.push({ from: S.role, to: "Dealer GM", topic: kindOf(k).label + " " + v.reg }); App.render(); App.toast(`Follow-up sent to the Dealer GM of ${dname(v.dealer)}`); } }]);
    const root = document.querySelector("#fu-m").closest("[role=dialog], .modal") || document;
    root.querySelector("#fu-m").addEventListener("change", e => { root.querySelector("#fu-k").innerHTML = kindOpts(e.target.value); });
    root.addEventListener("change", e => { if (e.target.name === "fu-p") root.querySelector("#fu-d").value = addDays(today, FU.dueDays[e.target.value]); }); };
  /* ---------- record the dealer's response / close ---------- */
  H.fuUpd = t => { const f = LIST.find(x => x.id === t.dataset.id); if (!f || !canClose(f)) return App.toast("Only the position that raised it, or one above, can close it");
    App.modal("Update follow-up " + f.id, `<div class="bd-box"><div class="note">Asked</div><b>${esc(kindOf(f.kind).label)} · ${esc(reg(f.reg))} · ${esc(dname(f.dealer))}</b><div class="note">Due</div><b>${dmy(f.due)}${overdue(f) ? " (overdue)" : ""}</b></div>
      <label class="field" for="fu-s">Status<select id="fu-s">${["Responded", "Closed"].map(s => `<option${s === (f.status === "Open" ? "Responded" : "Closed") ? " selected" : ""}>${s}</option>`).join("")}</select></label>
      <label class="field" for="fu-r">Dealer GM's response<textarea id="fu-r" rows="2">${esc(f.response)}</textarea></label>
      <label class="field" for="fu-o">Outcome (when closing)<input id="fu-o" value="${esc(f.outcome)}" placeholder="e.g. Resolved, Not resolved, Escalated further"></label>`,
      [{ label: "Cancel" }, { label: "Save", primary: true, onClick: r => { f.status = r.querySelector("#fu-s").value; const nr = r.querySelector("#fu-r").value.trim(); if (nr && nr !== f.response) thread(f).push({ side: "dealer", by: "Dealer GM (recorded by " + S.role + ")", at: D.now, text: nr }); f.response = nr; f.outcome = f.status === "Closed" ? (r.querySelector("#fu-o").value.trim() || "Resolved") : ""; if (f.status === "Closed") send(f, "closed", "Closed by " + S.role + ": " + f.outcome); App.render(); App.toast(`${f.id} ${f.status.toLowerCase()}`); } }]); };
  /* ---------- comments: TML replies or comments; each is sent to the Dealer GM in the dealer application and stays on the thread ---------- */
  const thHtml = f => thread(f).map(m => `<div class="card" style="padding:8px 12px;margin:6px 0;${m.side === "dealer" ? "background:#f3f8ff;margin-left:28px" : "margin-right:28px"}"><div class="note"><b>${esc(m.by)}</b> · ${m.side === "dealer" ? "Dealer" : "TML"} · ${esc(m.at.replace("T", " "))}${m.side === "tml" ? ' · <span class="chip green">Sent to dealer application</span>' : ""}</div><div>${esc(m.text)}</div></div>`).join("");
  H.fuThread = t => { const f = LIST.find(x => x.id === t.dataset.id); if (!f) return; const can = App.can("comment_follow_up") && f.status !== "Closed";
    App.modal(`${f.id} · ${reg(f.reg)} · ${dname(f.dealer)}`, `<p class="note" style="margin-top:0">${esc(kindOf(f.kind).label)} · due ${dmy(f.due)} · ${esc(f.status)}</p><div id="fu-th">${thHtml(f)}</div>
      ${can ? `<label class="field" for="fu-c">Reply or comment (goes to the Dealer GM in the dealer application)<textarea id="fu-c" rows="3"></textarea></label>` : `<p class="note">${f.status === "Closed" ? "Closed: the thread is read-only." : "Read-only for your position."}</p>`}`,
      can ? [{ label: "Close" }, { label: "Send to dealer", primary: true, onClick: r => { const x = r.querySelector("#fu-c").value.trim(); if (!x) return App.toast("Write a comment first"); thread(f).push({ side: "tml", by: S.role, at: D.now, text: x }); send(f, "comment", x); App.render(); App.toast(`Comment sent to the Dealer GM of ${dname(f.dealer)}`); } }] : [{ label: "Close" }]); };
  H.jgo = t => App.go(t.dataset.tab);
  H.fuWatch = t => { if (!App.can("watch_vehicle")) return; const id = t.dataset.id; WATCH.has(id) ? WATCH.delete(id) : WATCH.add(id); App.render(); App.toast(WATCH.has(id) ? "Added to your watchlist (P28)" : "Removed from your watchlist"); };

  /* ---------- P28: Actions & Follow-ups ---------- */
  const KEYS = ["total", "open", "overdue", "responded", "closed"];
  const agg = unit => { const m = Object.fromEntries(KEYS.map(k => [k, 0])); for (const f of LIST) { if (!inS(f, unit)) continue; m.total++; if (f.status === "Open") m.open++; else if (f.status === "Responded") m.responded++; else m.closed++; if (overdue(f)) m.overdue++; } return m; };
  App.fu.agg = agg;
  const SECTIONS = [["", "All"], ["open", "Open"], ["overdue", "Overdue"], ["responded", "Responded, to close"], ["closed", "Closed"], ["mine", "Raised by me"], ["watch", "Watchlist"], ["decisions", "TML decisions"], ["outbox", "Sent to dealer app"], ["rights", "Action rights"]];
  const FILT = { open: f => f.status === "Open", overdue, responded: f => f.status === "Responded", closed: f => f.status === "Closed", mine: f => f.raisedBy === S.role };
  views.followups = tab => { const f = S.filters, sec = SECTIONS.some(x => x[0] === f.sec) ? f.sec : "", m = agg(S.unit);
    const seg = `<div class="icon-btns" role="group" aria-label="Follow-up section" style="gap:8px;flex-wrap:wrap;margin:10px 0">${SECTIONS.map(([k, l]) => `<button class="pillbtn${sec === k ? " on" : ""}" data-h="tmlset" data-k="sec" data-v="${k}" aria-pressed="${sec === k}">${l}</button>`).join("")}</div>`;
    const tile = (v, l, c) => `<div class="spd-k"><b style="color:${c}">${String(v).padStart(2, "0")}</b><span>${l}</span></div>`;
    const strip = `<section class="card spd-strip" role="list">${tile(m.total, "Follow-ups", "#1a56db")}${tile(m.open, "Open, waiting for the dealer", "#b86e00")}${tile(m.overdue, "Overdue", "#d93025")}${tile(m.responded, "Responded, to close", "#1a56db")}${tile(m.closed, "Closed", "#0b8f3a")}${tile([...WATCH].filter(id => inS(findV(id))).length, "Vehicles on my watchlist", "#7b2cbf")}</section>`;
    const intro = "Every action TML takes on a vehicle in the journey: what was asked of which Dealer GM, by which position, by when, what the dealer answered and the outcome. Raise a follow-up with <b>Take action</b> on the vehicle page or on a row of Job Cards, THD, Spares or Claims. Types, priorities, due days and the closing rule are <span class=\"badge proposed\">Proposed</span> (model.json followUps).";
    let body;
    if (sec === "rights") {
      const pos = ["NSM", "RSM", "ZSM", "RCSM"], ids = ["follow_up", "comment_follow_up", "close_follow_up", "watch_vehicle", "escalate"];
      body = `<section class="card" style="margin:16px 0"><div class="card-h">ACTION RIGHTS BY TML POSITION</div><div class="card-b" style="padding:0">${table([{ h: "Action", f: a => esc(a.label) }, ...pos.map(p => ({ h: p, f: a => { const x = App.perm(p, a.id); return x.scope ? esc(M._meta.scopeValues[x.scope]) : "–"; } }))], ids.map(id => M.actions.find(a => a.id === id)), "Action rights")}</div></section>
        <section class="card"><div class="card-h">WHAT TML CAN ASK, BY MODULE</div><div class="card-b" style="padding:0">${table([{ h: "Module", f: x => esc(x[1]) }, { h: "Follow-up types", f: x => FU.kinds.filter(k => k.modules.includes(x[0])).map(k => esc(k.label)).join("<br>") }], Object.entries(FU.modules), "Follow-up types by module")}</div></section>
        <section class="card" style="margin-top:16px"><div class="card-h">RULES <span class="badge proposed">Proposed</span></div><div class="card-b"><ul>${FU.rules.map(x => `<li>${esc(x)}</li>`).join("")}</ul><b>To confirm with TML</b><ul>${FU.toConfirm.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></section>` + App.dec.rightsHtml();
    } else if (sec === "decisions") {
      body = App.dec.listHtml(App.dec.log().filter(x => inS(x))) + App.dec.rightsHtml();
    } else if (sec === "outbox") {
      const rows = OUT.filter(o => App.inScope({ dealer: o.dealerCode }, S.unit));
      body = `<p class="note">Everything TML sends to a Dealer GM (follow-ups, comments, closures) is listed here with the message that goes to the dealer application. Delivery is simulated: the dealer application is not part of this app. <span class="badge proposed">Proposed</span> message fields: ${esc(FU.message.fields.join(", "))}.</p>` +
        (rows.length ? table([{ h: "Message", f: o => esc(o.messageId) }, { h: "Type", f: o => esc(o.type) }, { h: "Follow-up", f: o => esc(o.followUpId) }, { h: "To", f: o => "Dealer GM, " + esc(o.dealer) }, { h: "From", f: o => esc(o.from) }, { h: "Text", f: o => esc(o.text) }, { h: "Sent", f: o => esc(o.sentAt.replace("T", " ")) }, { h: "Status", f: o => App.chip("Delivered (simulated)", "green") }], rows, "Messages to the dealer application") : '<p class="note">Nothing sent yet in this session. Raise a follow-up or send a comment and it appears here.</p>');
    } else if (sec === "watch") {
      const vs = [...WATCH].map(findV).filter(v => v && inS(v));
      body = vs.length ? table([{ h: "Vehicle", f: v => `<b>${esc(reg(v.reg))}</b><br><small class="note">${esc(v.model)}</small>` }, { h: "Dealership", f: v => esc(dname(v.dealer)) }, { h: "Job card", f: v => v.jc ? esc(v.jc.id) + " · " + esc(App.jcui.STAGE[v.jc.stage] || v.jc.stage) : "–" }, { h: "Open follow-ups", num: 1, f: v => LIST.filter(x => x.visit === v.id && x.status !== "Closed").length }, { h: "", f: v => `<button class="btn small" data-h="tmlvj" data-id="${v.id}">Journey</button> ${App.fu.btn({ visit: v.id, ref: v.jc ? v.jc.id : v.id })} <button class="btn small" data-h="fuWatch" data-id="${v.id}">Remove</button>` }], vs, "Watchlist")
        : '<p class="note">No vehicle on your watchlist yet. Find a vehicle below and add it.</p>';
      /* add a vehicle: search by registration, VIN, customer, model or job card; without a search, the vehicles that need attention */
      const wq = App.norm(f.wq || ""), pool = D.visits.filter(v => inS(v) && !v.delivered), txt = v => App.norm([v.reg, v.vin, v.customer, v.model, v.jc ? v.jc.id : "", dname(v.dealer)].join(" "));
      const needs = v => { const w = (App.vtl.waiting(v) || [])[0]; return w && w.over ? w.wait : -1; };
      const cand = (wq ? pool.filter(v => txt(v).includes(wq)) : pool.filter(v => needs(v) >= 0).sort((a, b) => needs(b) - needs(a))).slice(0, 12);
      const addBtn = v => `<button class="btn small${WATCH.has(v.id) ? "" : " primary"}" data-h="fuWatch" data-id="${esc(v.id)}" aria-pressed="${WATCH.has(v.id)}">${WATCH.has(v.id) ? "★ On watchlist (remove)" : "☆ Add to watchlist"}</button>`;
      body += `<section class="card" style="margin-top:14px"><div class="card-h">ADD A VEHICLE TO THE WATCHLIST</div><div class="card-b"><div class="filters" role="search">${inp("f-wq", "Registration, VIN, customer, model or job card", f.wq)}<span class="grow"></span>${filterBtns()}</div>
        <p class="note" style="margin:6px 0">${wq ? `${cand.length} vehicle${cand.length === 1 ? "" : "s"} found in ${esc(U[S.unit].name)} (vehicles inside the dealerships; delivered vehicles are not listed)` : "No search yet: showing the vehicles inside the dealerships that are past a limit or need attention, longest wait first. Type above to find any other vehicle."}</p>
        ${cand.length ? table([{ h: "Vehicle", f: v => `<b>${esc(reg(v.reg))}</b><br><small class="note">${esc(v.model)} · ${esc(v.customer)}</small>` }, { h: "Dealership", f: v => esc(dname(v.dealer)) }, { h: "Job card", f: v => v.jc ? esc(v.jc.id) + " · " + esc(App.jcui.STAGE[v.jc.stage] || v.jc.stage) : "–" }, { h: "Waiting for", f: v => { const w = (App.vtl.waiting(v) || [])[0]; return w ? `<span style="white-space:normal;display:inline-block;max-width:300px">${esc(w.item)}${w.over ? ' <span class="txt-red">●</span>' : ""}</span>` : "–"; } }, { h: "", f: v => addBtn(v) + ` <button class="btn small" data-h="tmlvj" data-id="${esc(v.id)}">Journey</button>` }], cand, "Vehicles to add") : '<p class="note">No vehicle matches. Check the registration, or the scope and PV / EV in the scope bar.</p>'}</div></section>`;
    } else {
      const q = App.norm(f.q || ""), rows = LIST.filter(x => inS(x) && (!sec || FILT[sec](x)) && (!f.mod || x.module === f.mod) && (!q || [x.id, x.reg, x.ref, dname(x.dealer)].some(y => App.norm(y).includes(q)))).sort((a, b) => (overdue(b) - overdue(a)) || a.due.localeCompare(b.due));
      csvStore.followups = { cols: fuCols(false).filter(c => c.h).map(c => [c.h, r => (c.f(r) + "").replace(/<[^>]+>/g, " ").trim()]), rows };
      body = breakdown("TML FOLLOW-UPS", agg, [["Follow-ups", x => x.total], ["Open", x => x.open], ["Overdue", x => x.overdue], ["Responded", x => x.responded], ["Closed", x => x.closed]], KEYS) +
        `<div class="filters" role="search">${inp("f-q", "Search vehicle, record, dealership", f.q)}${sel("f-mod", "Module", Object.entries(FU.modules), f.mod)}<span class="grow"></span>${filterBtns()}</div>
        <div class="list-meta">${showing(rows.length)}<span class="right">${csvBtn("followups")}</span></div>${fuTable(pageRows(rows), false)}${pager(rows.length)}`;
    }
    return head("ACTIONS & FOLLOW-UPS", tab, intro) + strip + seg + body + App.actionsPanel(); };
})();
