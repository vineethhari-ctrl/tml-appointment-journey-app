/* Shared records through a free hosted realtime database (Firebase Realtime Database, plain REST, no library, no sign-in).
   What is shared: follow-ups with their comment threads, messages to the dealer app, TML decisions, claims and helpdesk cases changed by TML,
   exceptions, gate escalations, targets and the watchlist. Each record is stored on its own, so two people changing different records never
   overwrite each other; for the same record the latest change wins, except the comment thread of a follow-up, which is merged.
   Off unless data/sync_config.js has a url (or the page is opened with ?sync=URL). Everything still works from the browser's own saved copy
   if the database cannot be reached. */
(function () {
  const cfg = window.TMLJ_SYNC || {}, qs = new URLSearchParams(location.search);
  const url = (qs.get("sync") || cfg.url || "").replace(/\/+$/, ""), room = (qs.get("room") || cfg.room || "tmlj-demo").replace(/[^A-Za-z0-9_-]/g, "") || "tmlj-demo";
  /* unique ids when several people create records at the same time */
  window.TMLUID = (prefix, n) => url ? `${prefix}-${n}-${Math.random().toString(36).slice(2, 6).toUpperCase()}` : `${prefix}-${n}`;
  const COLS = { followUps: { key: "id", thread: true }, claims: { key: "id" }, thdCases: { key: "id" }, exceptions: { key: "id" }, sgEscalations: { key: "id" },
    outbox: { key: "messageId", sort: (a, b) => (b.sentAt || "").localeCompare(a.sentAt || "") }, decisions: { key: "id", sort: (a, b) => (b.at || "").localeCompare(a.at || "") } };
  const norm = o => JSON.stringify(o, (k, v) => k === "_u" || v === null || v === undefined || (Array.isArray(v) && !v.length) ? undefined : v);
  window.TMLSYNC = { enabled: !!url, room, orig: {}, start: App => {
    if (!url) return;
    const D = App.D, S = App.state, base = `${url}/rooms/${encodeURIComponent(room)}`, enc = encodeURIComponent;
    const synced = {}, seen = {}; let pending = false, ok = true, last = "", busy = false;
    const badge = document.getElementById("sync-badge"), show = () => { if (badge) { badge.hidden = false; badge.textContent = ok ? `Shared records · room ${room} · synced ${last}` : `Shared records · room ${room} · offline, retrying`; badge.className = "sync-badge " + (ok ? "ok" : "bad"); } };
    for (const c of Object.keys(COLS)) { D[c] = D[c] || []; synced[c] = Object.assign({}, window.TMLSYNC.orig[c] || {}); seen[c] = {}; }
    synced.targets = {}; synced.creTargets = {}; synced.watch = {}; seen.targets = {}; seen.creTargets = {}; seen.watch = {};
    for (const d of Object.keys(D.targets || {})) synced.targets[d] = window.TMLSYNC.orig.targets ? window.TMLSYNC.orig.targets[d] : norm(D.targets[d]);
    for (const k of Object.keys(D.creTargets || {})) synced.creTargets[k] = window.TMLSYNC.orig.creTargets ? window.TMLSYNC.orig.creTargets[k] : norm({ v: D.creTargets[k] });
    const put = (path, body) => fetch(`${base}/records/${path}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => { if (!r.ok) throw new Error(r.status); });
    const threadKey = m => (m.at || "") + "|" + (m.by || "") + "|" + (m.text || "");
    const mergeThread = (a, b) => { const m = new Map(); for (const x of [...(a || []), ...(b || [])]) m.set(threadKey(x), x); return [...m.values()].sort((x, y) => (x.at || "").localeCompare(y.at || "")); };
    /* local changes -> database */
    const push = async () => { const jobs = [];
      for (const [c, spec] of Object.entries(COLS)) for (const rec of D[c]) { const id = rec[spec.key], j = norm(rec); if (id == null || synced[c][id] === j) continue;
        const u = Date.now(); rec._u = u; seen[c][id] = u; jobs.push(put(`${c}/${enc(id)}`, rec).then(() => { synced[c][id] = j; })); }
      for (const [d, v] of Object.entries(D.targets || {})) { const j = norm(v); if (synced.targets[d] === j) continue; const u = Date.now(); seen.targets[d] = u; jobs.push(put(`targets/${enc(d)}`, { ...v, _u: u }).then(() => { synced.targets[d] = j; })); }
      for (const [k, v] of Object.entries(D.creTargets || {})) { const j = norm({ v }); if (synced.creTargets[k] === j) continue; const u = Date.now(); seen.creTargets[k] = u; jobs.push(put(`creTargets/${enc(k)}`, { v, _u: u }).then(() => { synced.creTargets[k] = j; })); }
      const W = D.watch || new Set(); for (const id of W) if (synced.watch[id] !== "1") { const u = Date.now(); seen.watch[id] = u; jobs.push(put(`watch/${enc(id)}`, { on: true, _u: u }).then(() => { synced.watch[id] = "1"; })); }
      for (const id of Object.keys(synced.watch)) if (synced.watch[id] === "1" && !W.has(id)) { const u = Date.now(); seen.watch[id] = u; jobs.push(put(`watch/${enc(id)}`, { on: false, _u: u }).then(() => { synced.watch[id] = "0"; })); }
      await Promise.all(jobs); };
    /* database -> local */
    const pull = async () => { const r = await fetch(`${base}/records.json`); if (!r.ok) throw new Error(r.status); const all = (await r.json()) || {}; let changed = false;
      for (const [c, spec] of Object.entries(COLS)) { const recs = all[c] || {}, arr = D[c], idx = new Map(arr.map((x, i) => [x[spec.key], i])); let added = false;
        for (const [id, rec] of Object.entries(recs)) { if (!rec) continue; const ru = rec._u || 0; if (ru <= (seen[c][id] || 0)) continue; seen[c][id] = ru; const i = idx.get(id);
          if (i === undefined) { const n = { ...rec }; arr.push(n); synced[c][id] = norm(n); added = true; changed = true; continue; }
          const cur = arr[i]; if (norm(cur) === norm(rec) && synced[c][id] === norm(cur)) continue;
          const next = spec.thread ? { ...rec, thread: mergeThread(cur.thread, rec.thread) } : rec; for (const k of Object.keys(cur)) if (!(k in next) && k !== "_u") delete cur[k]; Object.assign(cur, next); synced[c][id] = norm(spec.thread && norm(cur) !== norm(rec) ? rec : cur); changed = true; }
        if (added && spec.sort) arr.sort(spec.sort); }
      for (const [d, v] of Object.entries(all.targets || {})) { if (!v || (v._u || 0) <= (seen.targets[d] || 0) || !D.targets[d]) continue; seen.targets[d] = v._u; const { _u, ...val } = v; Object.assign(D.targets[d], val); synced.targets[d] = norm(D.targets[d]); changed = true; }
      for (const [k, v] of Object.entries(all.creTargets || {})) { if (!v || (v._u || 0) <= (seen.creTargets[k] || 0)) continue; seen.creTargets[k] = v._u; D.creTargets[k] = v.v; synced.creTargets[k] = norm({ v: v.v }); changed = true; }
      D.watch = D.watch || new Set(); for (const [id, v] of Object.entries(all.watch || {})) { if (!v || (v._u || 0) <= (seen.watch[id] || 0)) continue; seen.watch[id] = v._u; if (v.on) D.watch.add(id); else D.watch.delete(id); synced.watch[id] = v.on ? "1" : "0"; changed = true; }
      if (changed) pending = true; };
    const tick = async (doPull) => { if (busy) return; busy = true; try { await push(); if (doPull) await pull(); ok = true; last = new Date().toLocaleTimeString("en-GB"); } catch (e) { ok = false; } busy = false; show();
      if (pending && !document.querySelector(".modal") && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) { pending = false; App.render(); } };
    show(); tick(true);
    setInterval(() => tick(false), (cfg.pushSeconds || 2) * 1000); setInterval(() => tick(true), (cfg.pullSeconds || 5) * 1000);
    App.sync = { room, url, tick, resetAll: async () => { await fetch(`${base}.json`, { method: "DELETE" }); } };
  } };
})();
