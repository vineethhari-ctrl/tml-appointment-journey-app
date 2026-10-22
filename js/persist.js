/* Keeps everything a user does in the demo (follow-ups, comments, decisions on claims and helpdesk cases, watchlist, escalations, targets,
   exceptions, decision rights what-ifs ...) in this browser's local storage, so it is still there after a reload or a later visit.
   - Loaded right after the data and before the screens, so the saved records replace the generated ones before any screen reads them.
   - A saved list is used only while the generated data it was built on is unchanged (fingerprint); a new release that regenerates a list drops
     the old saved copy of that list, so an update cannot break on old saved data.
   - Stays on this browser and this device: nothing is sent anywhere. "Reset demo data" (bottom left) clears it.
   - Sharing one set of records between several people needs a shared database behind the page; this static demo has none. */
(function () {
  const D = window.DATA, SK = "tmlj:state:" + D.seed;
  const KEYS = ["targets", "creTargets", "exceptions", "sgEscalations", "followUps", "outbox", "decisions", "claims", "thdCases", "leads", "appointments", "visits", "pickups", "productLeads"];
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h + ":" + s.length; };
  const store = (() => { try { const t = window.localStorage; t.getItem("x"); return t; } catch (e) { return null; } })();
  const base = {}; for (const k of KEYS) base[k] = hash(JSON.stringify(D[k] === undefined ? null : D[k]));
  let restored = 0, ps = null, last = "", warned = false;
  if (store) { try { const snap = JSON.parse(store.getItem(SK) || "null");
    if (snap && snap.vals) { for (const k of KEYS) if (snap.vals[k] !== undefined && snap.base[k] === base[k]) { D[k] = snap.vals[k]; restored++; }
      if (snap.watch && snap.watch.length) { D.watchIds = snap.watch; restored++; } ps = snap.s || null; last = store.getItem(SK); } } catch (e) { /* unreadable: start clean */ } }
  window.TMLP = {
    restored: () => restored,
    attach: App => { const S = App.state;
      if (ps) { if (ps.escalations) S.escalations = ps.escalations; if (ps.permOver) S.permOver = ps.permOver; if (ps.limitOver) S.limitOver = ps.limitOver; }
      const save = () => { if (!store) return; try { const vals = {}, b = {};
          for (const k of KEYS) { const cur = JSON.stringify(D[k] === undefined ? null : D[k]); if (hash(cur) !== base[k]) { vals[k] = JSON.parse(cur); b[k] = base[k]; } }
          const watch = D.watch ? [...D.watch] : [], s = { escalations: S.escalations || [], permOver: S.permOver || {}, limitOver: S.limitOver || {} };
          const any = Object.keys(vals).length || watch.length || s.escalations.length || Object.keys(s.permOver).length || Object.keys(s.limitOver).length;
          if (!any) { if (last) { store.removeItem(SK); last = ""; } return; }
          const text = JSON.stringify({ vals, base: b, watch, s, saved: new Date().toISOString() }); if (text === last) return; store.setItem(SK, text); last = text;
        } catch (e) { if (!warned) { warned = true; App.toast("Could not save your work in this browser (storage full or blocked)"); } } };
      setInterval(save, 1500); window.addEventListener("pagehide", save); window.addEventListener("beforeunload", save);
      App.persist = { save, reset: () => { try { store && store.removeItem(SK); } catch (e) { /* ignore */ } last = ""; window.removeEventListener("beforeunload", save); window.removeEventListener("pagehide", save); location.reload(); }, available: !!store };
      const btn = document.getElementById("reset-demo"); if (btn) btn.addEventListener("click", () => { if (confirm("Reset demo data? Everything you added or changed in this browser (follow-ups, comments, decisions, watchlist, escalations, targets) is removed and the demo starts again.")) App.persist.reset(); });
      if (restored) setTimeout(() => App.toast("Your earlier work in this browser was restored. Use Reset demo data (bottom left) to start again."), 700);
      if (!store) setTimeout(() => App.toast("This browser blocks local storage: your work will not be kept after a reload"), 700); }
  };
})();
