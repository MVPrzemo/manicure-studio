/* Manicure Studio – aplikacja na telefon (PWA). Dane: Kalendarz Google + Arkusz przez Apps Script. */
(function () {
  "use strict";

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const hm = d => pad(d.getHours()) + ":" + pad(d.getMinutes());
  const dm = d => pad(d.getDate()) + "." + pad(d.getMonth() + 1);
  const parse = s => { const [a, b = "00:00"] = s.split("T"); const [y, m, d] = a.split("-").map(Number); const [h, mi] = b.split(":").map(Number); return new Date(y, m - 1, d, h, mi); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const todayD = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const WD = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
  const WDL = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  const MON = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
  const CATS = ["Dłonie", "Stopy", "Dodatki"];
  const plural = (n, one, few, many) => n === 1 ? one : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? few : many;
  const dur = m => m < 60 ? m + " min" : Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "");
  const zl = n => Number(n).toLocaleString("pl-PL") + " zł";
  const digits = p => String(p || "").replace(/\D/g, "").replace(/^48(?=\d{9}$)/, "");
  const phoneFmt = p => { const d = digits(p); return d.length === 9 ? d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6) : String(p || ""); };
  const initials = n => String(n).split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const minsOf = v => Math.max(0, Math.round((parse(v.end) - parse(v.start)) / 60000));

  // ---------- storage ----------
  const LS = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  let cfg = LS.get("ms-cfg");

  // link konfiguracyjny: ...#cfg=<base64url {"u": url, "k": key}>
  function readHashConfig() {
    const m = location.hash.match(/cfg=([A-Za-z0-9_\-=]+)/);
    if (!m) return false;
    const o = decodeCfg(m[1]);
    if (o) { cfg = o; LS.set("ms-cfg", cfg); }
    history.replaceState(null, "", location.pathname + location.search);
    return !!o;
  }
  readHashConfig();

  function decodeCfg(code) {
    try {
      let b = String(code).trim().replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
      b += "===".slice(0, (4 - b.length % 4) % 4);
      const o = JSON.parse(atob(b));
      return o && o.u && o.k ? { u: String(o.u), k: String(o.k) } : null;
    } catch (e) { return null; }
  }

  // ---------- kolor aplikacji ----------
  const DEFAULT_THEME = "#6E3A52";
  const PRESETS = [
    ["Śliwka", "#6E3A52"], ["Pudrowy róż", "#B5677D"], ["Bordo", "#7A2335"], ["Brzoskwinia", "#B9663F"],
    ["Szałwia", "#5F7A61"], ["Lawenda", "#6B5B95"], ["Morski", "#2F6F78"], ["Grafit", "#3D3D45"]
  ];
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hex = c => "#" + c.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((x, i) => x + (B[i] - x) * t)); };
  const lum = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };

  function themeCss(a) {
    if (!/^#[0-9a-fA-F]{6}$/.test(a) || a.toUpperCase() === DEFAULT_THEME) return "";
    let acc = a;
    while (lum(acc) > .2) acc = mix(acc, "#000000", .12);          // akcent musi być czytelny na jasnym tle
    const light = {
      "--bg": mix(acc, "#FFFFFF", .955), "--surface": "#FFFFFF", "--ink": mix(acc, "#141414", .78),
      "--muted": mix(acc, "#7A7A7A", .62), "--line": mix(acc, "#FFFFFF", .86),
      "--plum": acc, "--plum-ink": "#FFFFFF", "--rose": mix(acc, "#FFFFFF", .38), "--rose-soft": mix(acc, "#FFFFFF", .89)
    };
    let accD = mix(a, "#FFFFFF", .42);
    while (lum(accD) < .35) accD = mix(accD, "#FFFFFF", .15);       // jasny akcent na ciemnym tle
    const dark = {
      "--bg": mix(a, "#100E10", .88), "--surface": mix(a, "#1B181B", .84), "--ink": mix(a, "#FFFFFF", .9),
      "--muted": mix(a, "#B8B8B8", .68), "--line": mix(a, "#2B272A", .78),
      "--plum": accD, "--plum-ink": mix(a, "#000000", .78), "--rose": mix(a, "#FFFFFF", .55), "--rose-soft": mix(a, "#1B181B", .72)
    };
    const decl = o => Object.entries(o).map(([k, v]) => k + ":" + v).join(";");
    return ":root{" + decl(light) + "}@media (prefers-color-scheme: dark){:root:not([data-mode=light]){" + decl(dark) + "}}:root[data-mode=dark]{" + decl(dark) + "}";
  }

  let themeColor = LS.get("ms-theme") || DEFAULT_THEME;
  function applyTheme(color, remember) {
    themeColor = color;
    const css = themeCss(color);
    let el = document.getElementById("theme");
    if (!el) { el = document.createElement("style"); el.id = "theme"; document.head.appendChild(el); }
    el.textContent = css;
    if (typeof syncBarColor === "function" && remember !== false) syncBarColor();
    if (remember !== false) {
      LS.set("ms-theme", color);
      try { if (css) localStorage.setItem("ms-theme-css", css); else localStorage.removeItem("ms-theme-css"); } catch (e) {}
    }
  }
  applyTheme(themeColor, false);

  // tło: "auto" (jak w telefonie), "light", "dark" – ustawienie tego urządzenia
  let mode = LS.get("ms-mode") || "auto";
  function applyMode(m) {
    mode = m;
    if (m === "light" || m === "dark") document.documentElement.setAttribute("data-mode", m);
    else document.documentElement.removeAttribute("data-mode");
    LS.set("ms-mode", m);
    syncBarColor();
  }
  // kolor paska systemowego dopasowany do tła aplikacji
  function syncBarColor() {
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach(el => {
      if (!el.dataset.orig) el.dataset.orig = el.getAttribute("content");
      el.setAttribute("content", mode === "auto" && !document.getElementById("theme").textContent ? el.dataset.orig : bg);
    });
  }
  applyMode(mode);
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", syncBarColor);
  }

  const cache = LS.get("ms-cache") || {};
  let db = { clients: cache.clients || [], services: cache.services || [], visits: cache.visits || [] };
  let config = cache.config || {};
  const loaded = new Set();
  const persist = () => LS.set("ms-cache", { clients: db.clients, services: db.services, visits: db.visits, config });

  // ---------- API ----------
  async function api(action, payload) {
    if (!cfg) { const e = new Error("Aplikacja nie jest połączona. Otwórz Ustawienia."); e.code = "nocfg"; throw e; }
    let res;
    try {
      res = await fetch(cfg.u, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.assign({ key: cfg.k, action }, payload || {})),
        redirect: "follow"
      });
    } catch (e) {
      const er = new Error("Brak połączenia z internetem. Pokazuję ostatnio pobrane dane."); er.code = "offline"; throw er;
    }
    const txt = await res.text();
    let data;
    try { data = JSON.parse(txt); } catch (e) {
      throw new Error("Serwer odpowiedział czymś innym niż dane. Sprawdź adres w Ustawieniach i czy wdrożenie ma dostęp „Każdy”.");
    }
    if (!data.ok) { const er = new Error(data.error || "Błąd serwera."); er.code = data.code; throw er; }
    return data;
  }

  let syncing = 0;
  function setSync(on) {
    syncing = Math.max(0, syncing + (on ? 1 : -1));
    $("#refresh").classList.toggle("spin", syncing > 0);
  }

  function handleErr(e) {
    if (e.code === "auth") { toast("Klucz dostępu nie pasuje. Sprawdź Ustawienia."); return; }
    if (e.code === "nocfg") return;
    toast(e.message || String(e));
  }

  function mergeVisits(from, to, list) {
    db.visits = db.visits.filter(v => { const d = v.start.slice(0, 10); return d < from || d > to; }).concat(list);
    for (let d = parse(from); ymd(d) <= to; d = addDays(d, 1)) loaded.add(ymd(d));
  }

  async function loadRange(from, to, withLists) {
    if (!cfg) return false;
    setSync(true);
    try {
      const r = await api(withLists ? "bootstrap" : "visits", { from, to });
      if (withLists) {
        db.clients = r.clients; db.services = r.services; config = r.config || {};
        if (config.theme && config.theme !== themeColor) applyTheme(config.theme);
      }
      mergeVisits(from, to, r.visits);
      persist();
      return true;
    } catch (e) { handleErr(e); return false; }
    finally { setSync(false); render(); }
  }

  let lastSync = 0;
  function refreshAll() {
    lastSync = Date.now();
    const t = todayD();
    const from = ymd(addDays(t, -14)), to = ymd(addDays(t, 60));
    return loadRange(from, to, true).then(ok => {
      if (ok && !loaded.has(selDay)) ensureDay(selDay);
      return ok;
    });
  }

  function ensureDay(d) {
    if (!cfg || loaded.has(d)) return;
    const base = parse(d);
    loadRange(ymd(addDays(base, -7)), ymd(addDays(base, 30)), false);
  }

  function upsertVisit(v) {
    const i = db.visits.findIndex(x => x.id === v.id);
    if (i >= 0) db.visits[i] = v; else db.visits.push(v);
  }

  // ---------- lookups ----------
  const svcById = id => db.services.find(s => s.id === id) || null;
  const cliById = id => db.clients.find(c => c.id === id) || null;
  function clientOf(v) {
    return cliById(v.clientId) ||
      (v.phone && db.clients.find(c => c.phone === digits(v.phone))) ||
      db.clients.find(c => c.name === v.clientName) || null;
  }
  function priceOf(v) { const s = svcById(v.serviceId); return s ? s.price : null; }

  function statusOf(v) {
    const now = new Date(), s = parse(v.start);
    if (v.status === "no") return { k: "no", t: "Odwołana" };
    if (parse(v.end) < now) return { k: "done", t: "Zakończona" };
    if (v.status === "ok") return { k: "ok", t: "Potwierdzona" };
    if (v.smsSent) return { k: "sent", t: "SMS wysłany, czeka na odpowiedź" };
    if (!v.phone) return { k: "wait", t: "Brak numeru, SMS nie wyjdzie" };
    if (v.recurring) return { k: "wait", t: "Wydarzenie cykliczne, bez SMS" };
    const remindH = config.remindHours || 24;
    const smsAt = new Date(s.getTime() - remindH * 3600000);
    if (smsAt <= now) {
      if (s - now < 3600000) return { k: "wait", t: "Bez przypomnienia" };
      return { k: "wait", t: config.dryRun ? "Tryb testowy, SMS nie wychodzi" : "SMS w kolejce" };
    }
    return { k: "wait", t: "Przypomnienie " + dm(smsAt) + ", " + hm(smsAt) };
  }

  // ta sama logika co fitMessage_ w skrypcie: najdłuższa wersja mieszcząca się w 1 SMS-ie
  const smsLen = s => { const n = String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[łŁ]/g, "l"); return n.length + (n.match(/[\^{}\\\[\]~|€]/g) || []).length; };
  function smsText(clientName, serviceName, start) {
    const first = String(clientName || "").trim().split(/\s+/)[0];
    const salon = config.salonName || config.salon || "Manicure Studio";
    const link = (config.linkBase || "https://mvprzemo.github.io/manicure-studio/p/?") + "k3x9a2";
    const day = dm(start), time = hm(start);
    const hi = "Dzień dobry" + (first ? " " + first : "") + "! ";
    const svc = serviceName ? " (" + serviceName + ")" : "";
    const variants = [
      hi + "Przypominamy o wizycie" + svc + " " + day + " o " + time + ". Potwierdź lub odwołaj: " + link + " " + salon,
      hi + "Przypominamy o wizycie" + svc + " " + day + " o " + time + ". Potwierdź lub odwołaj: " + link,
      hi + "Przypominamy o wizycie " + day + " o " + time + ". Potwierdź lub odwołaj: " + link,
      salon + ": wizyta " + day + " o " + time + ". Potwierdź lub odwołaj: " + link,
      "Wizyta " + day + " o " + time + ". Potwierdź lub odwołaj: " + link
    ];
    const text = variants.find(v => smsLen(v) <= 160) || variants[variants.length - 1];
    return { text, len: smsLen(text) };
  }

  // ---------- state ----------
  let tab = "wizyty";
  let selDay = ymd(todayD());

  // ---------- toast ----------
  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2800);
  }

  // ---------- tabs ----------
  function setTab(t) {
    tab = t;
    document.querySelectorAll(".nav button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    render();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll(".nav button").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
  $("#fab").addEventListener("click", () => tab === "klientki" ? openClient(null) : openVisitForm(null, { day: selDay }));
  $("#refresh").addEventListener("click", () => { if (cfg) refreshAll(); else openSettings(); });
  $("#settings").addEventListener("click", openSettings);

  // ---------- render: visits ----------
  function visitsOn(day) {
    return db.visits.filter(v => v.start.slice(0, 10) === day).sort((a, b) => a.start.localeCompare(b.start));
  }

  function dayLabel(dStr) {
    const today = todayD();
    const d = parse(dStr);
    const diff = Math.round((d - today) / 86400000);
    const base = WDL[d.getDay()] + ", " + d.getDate() + " " + MON[d.getMonth()] + (d.getFullYear() !== today.getFullYear() ? " " + d.getFullYear() : "");
    if (diff === 0) return "Dziś <small>" + base + "</small>";
    if (diff === 1) return "Jutro <small>" + base + "</small>";
    if (diff === -1) return "Wczoraj <small>" + base + "</small>";
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  function renderVisits() {
    const el = $("#tab-wizyty");
    const today = todayD();
    const sel = parse(selDay);
    const inWindow = sel >= addDays(today, -3) && sel <= addDays(today, 13);
    const first = inWindow ? addDays(today, -3) : addDays(sel, -3);

    let strip = "";
    for (let i = 0; i < 17; i++) {
      const d = addDays(first, i), key = ymd(d);
      const n = visitsOn(key).filter(v => v.status !== "no").length;
      const dots = Array.from({ length: Math.min(n, 4) }, () => "<i></i>").join("");
      strip += '<button type="button" class="day' + (key === ymd(today) ? " today" : "") + (key === selDay ? " sel" : "") +
        '" data-day="' + key + '" aria-label="' + esc(WDL[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()] + ", " + n + " " + plural(n, "wizyta", "wizyty", "wizyt")) + '">' +
        '<span class="wd">' + WD[d.getDay()] + '</span><span class="dn">' + d.getDate() + '</span><span class="dots">' + dots + '</span></button>';
    }

    const list = visitsOn(selDay);
    const active = list.filter(v => v.status !== "no");
    const total = active.reduce((a, v) => a + (priceOf(v) || 0), 0);
    const mins = active.reduce((a, v) => a + minsOf(v), 0);
    const conf = active.filter(v => v.status === "ok").length;

    let body;
    if (!list.length) {
      const loading = cfg && !loaded.has(selDay) && syncing > 0;
      body = '<div class="empty"><strong>' + (loading ? "Wczytuję…" : "Wolny dzień") + '</strong>' +
        (loading ? "Pobieram wizyty z kalendarza." : "Brak umówionych wizyt.") +
        (loading ? "" : '<div style="margin-top:12px"><button type="button" class="btn small" id="emptyAdd">Umów wizytę</button></div>') + '</div>';
    } else {
      body = '<div class="list">' + list.map(v => {
        const st = statusOf(v), start = parse(v.start), price = priceOf(v);
        return '<button type="button" class="visit is-' + st.k + '" data-visit="' + esc(v.id) + '">' +
          '<div class="t"><b>' + hm(start) + '</b><span>' + hm(parse(v.end)) + '</span></div>' +
          '<div class="card"><div class="who"><strong>' + esc(v.clientName || v.title) + '</strong>' +
          (price != null ? '<span class="price">' + zl(price) + '</span>' : "") + '</div>' +
          '<div class="svc">' + esc(v.serviceName || "Wydarzenie z kalendarza") + ' · ' + dur(minsOf(v)) + '</div>' +
          '<span class="pill ' + st.k + '">' + esc(st.t) + '</span></div></button>';
      }).join("") + "</div>";
    }

    el.innerHTML =
      '<div class="strip" id="strip">' + strip + '</div>' +
      '<div class="dayhead"><h2>' + dayLabel(selDay) + '</h2>' +
      '<label class="jump">Inny dzień<input type="date" id="jump" value="' + selDay + '" aria-label="Wybierz dzień"></label></div>' +
      (active.length ? '<div class="summary">' +
        '<div><b>' + active.length + '</b><span>' + plural(active.length, "wizyta", "wizyty", "wizyt") + '</span></div>' +
        '<div><b>' + dur(mins) + '</b><span>pracy</span></div>' +
        '<div><b>' + zl(total) + '</b><span>' + conf + ' potw.</span></div></div>' : "") +
      body;

    el.querySelectorAll(".day").forEach(b => b.addEventListener("click", () => selectDay(b.dataset.day)));
    el.querySelectorAll(".visit").forEach(b => b.addEventListener("click", () => openVisit(b.dataset.visit)));
    $("#jump").addEventListener("change", e => { if (e.target.value) selectDay(e.target.value); });
    const ea = $("#emptyAdd"); if (ea) ea.addEventListener("click", () => openVisitForm(null, { day: selDay }));
    const selEl = el.querySelector(".day.sel"), stripEl = $("#strip");
    if (selEl && stripEl) stripEl.scrollLeft = selEl.offsetLeft - stripEl.clientWidth / 2 + selEl.offsetWidth / 2;
  }

  function selectDay(d) {
    selDay = d;
    ensureDay(d);
    renderVisits();
  }

  // ---------- render: clients ----------
  let clientQuery = "";
  function renderClients() {
    const el = $("#tab-klientki");
    const q = clientQuery.trim().toLowerCase(), qd = q.replace(/\D/g, "");
    const list = db.clients.filter(c => !q || c.name.toLowerCase().includes(q) || (qd && c.phone.includes(qd)))
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
    const now = new Date();
    el.innerHTML =
      '<div class="sectionhead"><h2>Klientki</h2><span style="color:var(--muted)">' + db.clients.length + '</span></div>' +
      '<input class="search" id="cq" type="search" placeholder="Szukaj po imieniu lub numerze" value="' + esc(clientQuery) + '" aria-label="Szukaj klientki">' +
      (list.length ? '<div class="rows">' + list.map(c => {
        const next = db.visits.filter(v => clientOf(v) === c && v.status !== "no" && parse(v.start) > now).sort((a, b) => a.start.localeCompare(b.start))[0];
        return '<button type="button" class="row" data-client="' + esc(c.id) + '"><span class="avatar">' + esc(initials(c.name)) + '</span>' +
          '<span class="main"><b>' + esc(c.name) + '</b><span>' + esc(phoneFmt(c.phone)) + '</span></span>' +
          '<span class="side">' + (next ? dm(parse(next.start)) + "<small>najbliższa</small>" : '<small>brak wizyt</small>') + '</span></button>';
      }).join("") + '</div>'
        : '<div class="empty"><strong>' + (db.clients.length ? "Nikogo nie znaleziono" : "Brak klientek") + '</strong>' +
          (db.clients.length ? "Zmień wyszukiwanie albo dodaj nową klientkę." : "Dodaj pierwszą klientkę przyciskiem na dole.") + '</div>');
    const cq = $("#cq");
    cq.addEventListener("input", () => {
      clientQuery = cq.value; const pos = cq.selectionStart; renderClients();
      const n = $("#cq"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {}
    });
    el.querySelectorAll("[data-client]").forEach(b => b.addEventListener("click", () => openClient(b.dataset.client)));
  }

  // ---------- render: services ----------
  function renderServices() {
    const el = $("#tab-uslugi");
    el.innerHTML =
      '<div class="sectionhead"><h2>Usługi</h2><button type="button" class="btn small" id="addSvc">Dodaj usługę</button></div>' +
      CATS.map(cat => {
        const items = db.services.filter(s => s.cat === cat);
        if (!items.length) return "";
        return '<p class="cat">' + cat + '</p><div class="rows">' + items.map(s =>
          '<button type="button" class="row" data-svc="' + esc(s.id) + '"><span class="main"><b>' + esc(s.name) + '</b><span>' + dur(s.min) + '</span></span>' +
          '<span class="side">' + zl(s.price) + '</span></button>').join("") + '</div>';
      }).join("") +
      (db.services.length ? "" : '<div class="empty"><strong>Brak usług</strong>Dodaj usługi, żeby umawiać wizyty.</div>') +
      '<p class="foot">Czas trwania usługi ustawia koniec wizyty w kalendarzu. Usługi i klientki możesz też edytować w Arkuszu Google „Manicure Studio – dane”.</p>';
    $("#addSvc").addEventListener("click", () => openService(null));
    el.querySelectorAll("[data-svc]").forEach(b => b.addEventListener("click", () => openService(b.dataset.svc)));
  }

  // ---------- render: welcome ----------
  function renderWelcome() {
    $("#welcome").innerHTML =
      '<div class="welcome"><img src="icons/logo-full.jpg" alt="Manicure Studio">' +
      '<p>Połącz aplikację z Kalendarzem Google. Otwórz link z maila „Manicure Studio – połączenie aplikacji” albo wklej kod konfiguracji.</p>' +
      '<button type="button" class="btn" id="welcomeGo">Połącz z kalendarzem</button></div>';
    $("#welcomeGo").addEventListener("click", openSettings);
  }

  function render() {
    const ready = !!cfg;
    $("#welcome").hidden = ready;
    $("#nav").hidden = !ready;
    ["wizyty", "klientki", "uslugi"].forEach(n => { $("#tab-" + n).hidden = !ready || n !== tab; });
    $("#fabwrap").hidden = !ready || tab === "uslugi";
    $("#fabLabel").textContent = tab === "klientki" ? "Klientka" : "Wizyta";

    const banner = $("#banner");
    if (ready && config.dryRun) { banner.textContent = "Tryb testowy: przypomnienia SMS nie wychodzą (DRY_RUN w skrypcie)."; banner.hidden = false; }
    else if (ready && config.smsReady === false) { banner.textContent = "Brak tokenu SMSAPI w skrypcie, SMS-y nie wyjdą."; banner.hidden = false; }
    else banner.hidden = true;

    if (!ready) { renderWelcome(); return; }
    if (tab === "wizyty") renderVisits();
    else if (tab === "klientki") renderClients();
    else renderServices();
  }

  // ---------- sheet ----------
  const overlay = $("#overlay");
  function openSheet(html, after) {
    overlay.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div>';
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    if (after) after(overlay.firstChild);
  }
  function closeSheet() { overlay.hidden = true; overlay.innerHTML = ""; document.body.style.overflow = ""; }
  overlay.addEventListener("click", e => { if (e.target === overlay) closeSheet(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !overlay.hidden) closeSheet(); });

  // przycisk z blokadą na czas zapisu
  async function busy(btn, label, fn) {
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = label;
    try { return await fn(); }
    finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = old; } }
  }

  // ---------- visit details ----------
  function openVisit(id) {
    const v = db.visits.find(x => x.id === id); if (!v) return;
    const c = clientOf(v), st = statusOf(v), start = parse(v.start), price = priceOf(v);
    let delArmed = false;
    openSheet(
      '<h3>' + esc(v.clientName || v.title) + '</h3>' +
      '<p class="sub">' + WDL[start.getDay()] + ', ' + start.getDate() + ' ' + MON[start.getMonth()] + ' · ' + hm(start) + '–' + hm(parse(v.end)) + '</p>' +
      '<span class="pill ' + st.k + '">' + esc(st.t) + '</span>' +
      '<dl class="dl"><dt>Usługa</dt><dd>' + esc(v.serviceName || "–") + '</dd>' +
      (price != null ? '<dt>Cena</dt><dd>' + zl(price) + '</dd>' : "") +
      '<dt>Telefon</dt><dd class="phone">' + esc(v.phone ? phoneFmt(v.phone) : "brak") + '</dd>' +
      (c && c.note ? '<dt>O klientce</dt><dd>' + esc(c.note) + '</dd>' : "") +
      (v.note ? '<dt>Notatka</dt><dd>' + esc(v.note) + '</dd>' : "") + '</dl>' +
      '<div class="actions">' +
      (v.status !== "ok" ? '<button type="button" class="btn okb" id="vOk">Potwierdzona</button>' : "") +
      (v.status !== "no" ? '<button type="button" class="btn nob" id="vNo">Odwołana</button>' : "") +
      (v.status ? '<button type="button" class="btn ghost" id="vClr">Wyczyść status</button>' : "") +
      '</div>' +
      (v.recurring ? '<p class="note">To wydarzenie cykliczne z kalendarza. Edytuj je w Kalendarzu Google.</p>'
        : '<div class="actions"><button type="button" class="btn" id="vEdit">Edytuj</button>' +
          '<button type="button" class="btn danger" id="vDel">Usuń wizytę</button></div>') +
      '<p class="err" id="vErr" hidden></p>' +
      '<p class="note">Status zmienia się sam, gdy klientka kliknie link w SMS-ie. Przyciski wyżej służą do ręcznej zmiany, np. po telefonie.</p>',
      sh => {
        const err = $("#vErr", sh);
        const fail = e => { err.textContent = e.message; err.hidden = false; };
        const setS = (btn, val, msg) => busy(btn, "Zapisywanie…", async () => {
          try {
            const r = await api("setStatus", { id: v.id, status: val });
            upsertVisit(r.visit); persist(); closeSheet(); render(); toast(msg);
          } catch (e) { fail(e); }
        });
        const b1 = $("#vOk", sh); if (b1) b1.onclick = () => setS(b1, "ok", "Oznaczono jako potwierdzoną");
        const b2 = $("#vNo", sh); if (b2) b2.onclick = () => setS(b2, "no", "Oznaczono jako odwołaną");
        const b3 = $("#vClr", sh); if (b3) b3.onclick = () => setS(b3, null, "Status wyczyszczony");
        const be = $("#vEdit", sh); if (be) be.onclick = () => openVisitForm(v.id);
        const bd = $("#vDel", sh);
        if (bd) bd.onclick = () => {
          if (!delArmed) { delArmed = true; bd.textContent = "Dotknij ponownie, żeby usunąć"; return; }
          busy(bd, "Usuwanie…", async () => {
            try {
              await api("deleteVisit", { id: v.id });
              db.visits = db.visits.filter(x => x.id !== v.id); persist(); closeSheet(); render(); toast("Wizyta usunięta z kalendarza");
            } catch (e) { fail(e); }
          });
        };
      });
  }

  // ---------- visit form ----------
  function nextFreeTime(day) {
    const list = visitsOn(day).filter(v => v.status !== "no");
    if (!list.length) return "10:00";
    const last = parse(list[list.length - 1].end);
    let m = Math.ceil((last.getHours() * 60 + last.getMinutes()) / 15) * 15;
    if (m > 20 * 60) return "10:00";
    return pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  }

  function openVisitForm(id, opts) {
    opts = opts || {};
    if (!db.services.length) { toast("Najpierw dodaj usługi."); setTab("uslugi"); return; }
    const v = id ? db.visits.find(x => x.id === id) : null;
    const day = v ? v.start.slice(0, 10) : (opts.day || ymd(todayD()));
    const time = v ? v.start.slice(11, 16) : nextFreeTime(day);
    const clientsSorted = db.clients.slice().sort((a, b) => a.name.localeCompare(b.name, "pl"));
    const pre = v ? clientOf(v) : null;
    const preClient = pre ? pre.id : (opts.clientId || "");
    const preSvc = v ? (v.serviceId || (db.services.find(s => s.name === v.serviceName) || {}).id) : null;
    let createdClientId = null;

    openSheet(
      '<h3>' + (v ? "Edytuj wizytę" : "Nowa wizyta") + '</h3><p class="sub">Zapisze się w Kalendarzu Google, a klientka dostanie SMS ' + (config.remindHours || 24) + ' h wcześniej.</p>' +
      '<form class="form" id="vf" novalidate>' +
      '<div class="f"><label for="vfClient">Klientka</label><select id="vfClient">' +
      '<option value="">Wybierz klientkę</option>' +
      clientsSorted.map(c => '<option value="' + esc(c.id) + '"' + (c.id === preClient ? " selected" : "") + '>' + esc(c.name) + '</option>').join("") +
      '<option value="__new">+ Nowa klientka</option></select></div>' +
      '<div id="newClient" class="form" hidden>' +
      '<div class="f"><label for="vfName">Imię i nazwisko</label><input id="vfName" autocomplete="off"></div>' +
      '<div class="f"><label for="vfPhone">Telefon</label><input id="vfPhone" type="tel" inputmode="tel" placeholder="600 000 000"></div></div>' +
      '<div class="f"><label for="vfSvc">Usługa</label><select id="vfSvc">' +
      CATS.map(cat => {
        const items = db.services.filter(s => s.cat === cat);
        return items.length ? '<optgroup label="' + cat + '">' + items.map(s =>
          '<option value="' + esc(s.id) + '"' + (preSvc === s.id ? " selected" : "") + '>' + esc(s.name) + ' · ' + dur(s.min) + ' · ' + zl(s.price) + '</option>').join("") + '</optgroup>' : "";
      }).join("") +
      '</select></div>' +
      '<div class="two"><div class="f"><label for="vfDate">Dzień</label><input id="vfDate" type="date" value="' + day + '"></div>' +
      '<div class="f"><label for="vfTime">Godzina</label><input id="vfTime" type="time" step="900" value="' + time + '"></div></div>' +
      '<div class="f"><label for="vfNote">Notatka do wizyty</label><textarea id="vfNote" placeholder="np. kolor, wzór, zdobienia">' + esc(v ? v.note : "") + '</textarea></div>' +
      '<div class="calc" id="calc"></div>' +
      '<p class="err" id="vfErr" hidden></p>' +
      '<div class="actions"><button type="submit" class="btn" id="vfSave">' + (v ? "Zapisz zmiany" : "Zapisz wizytę") + '</button><button type="button" class="btn ghost" id="vfCancel">Anuluj</button></div>' +
      '</form>',
      sh => {
        const f = i => $("#" + i, sh);
        const err = f("vfErr");
        const showErr = (m, focus) => { err.textContent = m; err.hidden = false; if (focus) focus.focus(); };

        const update = () => {
          const isNew = f("vfClient").value === "__new";
          f("newClient").hidden = !isNew;
          const s = svcById(f("vfSvc").value);
          const dv = f("vfDate").value, tv = f("vfTime").value;
          if (!s || !dv || !tv) { f("calc").innerHTML = '<div class="line"><span>Wybierz usługę, dzień i godzinę</span></div>'; return; }
          const start = parse(dv + "T" + tv), end = new Date(start.getTime() + s.min * 60000);
          const c = cliById(f("vfClient").value);
          const name = isNew ? f("vfName").value : (c ? c.name : "");
          const clash = db.visits.filter(x => (!v || x.id !== v.id) && x.status !== "no" && x.start.slice(0, 10) === dv && parse(x.start) < end && parse(x.end) > start);
          const smsAt = new Date(start.getTime() - (config.remindHours || 24) * 3600000);
          const now = new Date();
          const when = start < now ? "Termin już minął, SMS nie wyjdzie." :
            start - now < 3600000 ? "Mniej niż godzina do wizyty, SMS nie wyjdzie." :
            config.dryRun ? "Tryb testowy: SMS trafi tylko do dziennika skryptu." :
            smsAt <= now ? "SMS wyjdzie od razu po zapisaniu." :
            "SMS wyjdzie " + dm(smsAt) + " ok. " + hm(smsAt) + ".";
          f("calc").innerHTML =
            '<div class="line"><span>' + hm(start) + ' – ' + hm(end) + ' (' + dur(s.min) + ')</span><b>' + zl(s.price) + '</b></div>' +
            (end.getDate() !== start.getDate() || end.getHours() * 60 + end.getMinutes() > 21 * 60 ? '<div class="warn">Wizyta kończy się po 21:00.</div>' : "") +
            clash.map(x => '<div class="warn">Nakłada się na: ' + esc(x.clientName || x.title) + ', ' + hm(parse(x.start)) + '–' + hm(parse(x.end)) + '</div>').join("") +
            (sms => '<div class="sms">' + esc(sms.text) + '</div><div class="sms-meta">' + when + ' ' + sms.len + '/160 znaków, 1 SMS.</div>')(smsText(name, s.name, start));
        };
        ["vfClient", "vfSvc", "vfDate", "vfTime", "vfName"].forEach(i => f(i).addEventListener("input", update));
        f("vfClient").addEventListener("change", () => { update(); if (f("vfClient").value === "__new") f("vfName").focus(); });
        f("vfCancel").onclick = closeSheet;
        update();

        f("vf").addEventListener("submit", e => {
          e.preventDefault();
          err.hidden = true;
          let clientId = f("vfClient").value;
          if (!clientId) return showErr("Wybierz klientkę albo dodaj nową.", f("vfClient"));
          let newClient = null;
          if (clientId === "__new") {
            if (createdClientId) clientId = createdClientId;
            else {
              const nm = f("vfName").value.trim(), ph = digits(f("vfPhone").value);
              if (!nm) return showErr("Wpisz imię nowej klientki.", f("vfName"));
              if (ph.length !== 9) return showErr("Numer telefonu musi mieć 9 cyfr.", f("vfPhone"));
              newClient = { name: nm, phone: ph, note: "" };
            }
          }
          if (!f("vfSvc").value) return showErr("Wybierz usługę.", f("vfSvc"));
          if (!f("vfDate").value || !f("vfTime").value) return showErr("Ustaw dzień i godzinę.", f("vfDate"));

          busy(f("vfSave"), "Zapisywanie…", async () => {
            try {
              if (newClient) {
                const rc = await api("saveClient", { client: newClient });
                db.clients.push(rc.client); createdClientId = clientId = rc.client.id; persist();
              }
              const r = await api("saveVisit", { visit: {
                id: v ? v.id : null, clientId, serviceId: f("vfSvc").value,
                start: f("vfDate").value + "T" + f("vfTime").value, note: f("vfNote").value.trim()
              } });
              if (v && v.id !== r.visit.id) db.visits = db.visits.filter(x => x.id !== v.id);
              upsertVisit(r.visit); persist(); closeSheet();
              selDay = r.visit.start.slice(0, 10);
              if (tab !== "wizyty") setTab("wizyty"); else render();
              toast((v ? "Zapisano zmiany" : "Wizyta zapisana w kalendarzu") + (r.smsNow ? ", SMS wysłany" : ""));
            } catch (e) { showErr(e.message); }
          });
        });
      });
  }

  // ---------- client sheet ----------
  const WDS = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
  function fullDate(d) { return WDS[d.getDay()] + ", " + dm(d) + "." + d.getFullYear() + " · " + hm(d); }

  function histHtml(list, showAll) {
    const now = new Date();
    const done = list.filter(v => v.status !== "no" && parse(v.end) < now);
    const next = list.filter(v => v.status !== "no" && parse(v.end) >= now).sort((a, b) => a.start.localeCompare(b.start));
    const past = list.filter(v => !next.includes(v)).sort((a, b) => b.start.localeCompare(a.start));
    const cancelled = list.filter(v => v.status === "no").length;
    if (!list.length) return '<div class="empty" style="margin-top:4px"><strong>Brak wizyt</strong>Nie ma jej wizyt w kalendarzu z ostatnich 3 lat.</div>';

    const spent = done.reduce((a, v) => a + (priceOf(v) || 0), 0);
    const doneAsc = done.map(v => parse(v.start)).sort((a, b) => a - b);
    const last = doneAsc[doneAsc.length - 1];

    const counts = {};
    done.forEach(v => { const n = v.serviceName || v.title; counts[n] = (counts[n] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    const facts = [];
    if (top) facts.push("Najczęściej: <b>" + esc(top[0]) + "</b> (" + top[1] + "×)");
    if (doneAsc.length >= 2) {
      const days = (doneAsc[doneAsc.length - 1] - doneAsc[0]) / 864e5 / (doneAsc.length - 1);
      facts.push("Przychodzi średnio co <b>" + (days < 10 ? Math.round(days) + " dni" : "ok. " + Math.round(days / 7) + " tyg.") + "</b>");
    }
    if (last && !next.length) {
      const ago = Math.floor((now - last) / 864e5);
      facts.push("Od ostatniej wizyty: <b>" + (ago < 14 ? ago + " " + plural(ago, "dzień", "dni", "dni") : Math.floor(ago / 7) + " tyg.") + "</b>, bez kolejnego terminu");
    }
    if (cancelled) facts.push("Odwołane: <b>" + cancelled + "</b>");

    const row = v => {
      const d = parse(v.start), st = statusOf(v), price = priceOf(v);
      const side = st.k === "no" || st.k === "ok" || st.k === "sent" || st.k === "wait" && next.includes(v)
        ? '<span class="pill ' + st.k + '">' + esc(st.k === "wait" ? "Zaplanowana" : st.k === "sent" ? "SMS wysłany" : st.t) + '</span>'
        : (price != null ? zl(price) : "");
      return '<button type="button" class="row" data-hv="' + esc(v.id) + '"><span class="main"><b>' + esc(v.serviceName || v.title) + '</b><span>' + fullDate(d) + '</span></span><span class="side">' + side + '</span></button>';
    };
    const LIMIT = 15;
    const pastShown = showAll ? past : past.slice(0, LIMIT);

    return '<div class="summary">' +
      '<div><b>' + done.length + '</b><span>' + plural(done.length, "wizyta", "wizyty", "wizyt") + '</span></div>' +
      '<div><b>' + zl(spent) + '</b><span>wydane</span></div>' +
      '<div><b>' + (last ? dm(last) + "." + String(last.getFullYear()).slice(2) : "–") + '</b><span>ostatnio</span></div></div>' +
      (facts.length ? '<div class="facts">' + facts.map(f => "<span>" + f + "</span>").join("") + '</div>' : "") +
      (next.length ? '<p class="cat">Zaplanowane</p><div class="rows">' + next.map(row).join("") + '</div>' : "") +
      (past.length ? '<p class="cat">Historia</p><div class="rows">' + pastShown.map(row).join("") + '</div>' : "") +
      (past.length > pastShown.length ? '<div class="actions"><button type="button" class="btn ghost small" id="histAll">Pokaż wszystkie (' + past.length + ')</button></div>' : "");
  }

  function loadHistory(c, el) {
    const draw = (list, note) => {
      let showAll = false;
      const paint = () => {
        el.innerHTML = (note ? '<p class="note" style="margin-top:0">' + note + '</p>' : "") + histHtml(list, showAll);
        el.querySelectorAll("[data-hv]").forEach(b => b.addEventListener("click", () => openVisit(b.dataset.hv)));
        const all = $("#histAll", el); if (all) all.onclick = () => { showAll = true; paint(); };
        const retry = $("#histRetry", el); if (retry) retry.onclick = () => loadHistory(c, el);
      };
      paint();
    };
    const local = () => db.visits.filter(v => clientOf(v) === c);
    draw(local(), "Wczytuję pełną historię z kalendarza…");
    api("clientHistory", { clientId: c.id }).then(r => {
      r.visits.forEach(upsertVisit); persist();
      if (el.isConnected) draw(r.visits);
    }).catch(e => {
      if (el.isConnected) draw(local(), esc(e.message) + ' Pokazuję tylko ostatnio pobrane wizyty. <button type="button" class="btn ghost small" id="histRetry">Spróbuj ponownie</button>');
    });
  }

  function openClient(id) {
    const c = id ? cliById(id) : null;
    const form =
      '<form class="form" id="cf" novalidate' + (c ? " hidden" : "") + '>' +
      '<div class="f"><label for="cfName">Imię i nazwisko</label><input id="cfName" value="' + esc(c ? c.name : "") + '" autocomplete="off"></div>' +
      '<div class="f"><label for="cfPhone">Telefon</label><input id="cfPhone" type="tel" inputmode="tel" value="' + esc(c ? phoneFmt(c.phone) : "") + '" placeholder="600 000 000"></div>' +
      '<div class="f"><label for="cfNote">Notatki</label><textarea id="cfNote" placeholder="np. ulubiony kształt, wrażliwa skóra">' + esc(c ? c.note : "") + '</textarea></div>' +
      '<p class="err" id="cfErr" hidden></p>' +
      '<div class="actions"><button type="submit" class="btn" id="cfSave">' + (c ? "Zapisz" : "Dodaj klientkę") + '</button>' +
      '<button type="button" class="btn ghost" id="cfCancel">Anuluj</button></div>' +
      (c ? '<p class="note">Zmiana imienia lub numeru zaktualizuje też jej przyszłe wizyty w kalendarzu.</p>' : "") + '</form>';

    openSheet(
      '<h3>' + (c ? esc(c.name) : "Nowa klientka") + '</h3>' +
      (c ? '<p class="sub"><span class="phone">' + esc(phoneFmt(c.phone)) + '</span>' + (c.note ? " · " + esc(c.note) : "") + '</p>' +
           '<div id="cView"><div class="actions"><button type="button" class="btn" id="cfBook">Umów wizytę</button>' +
           '<button type="button" class="btn ghost" id="cfEdit">Edytuj dane</button></div>' +
           '<div id="hist" class="hist"></div></div>'
         : '<p class="sub">Numer jest potrzebny do przypomnień SMS.</p>') + form,
      sh => {
        const formEl = $("#cf", sh), view = $("#cView", sh);
        $("#cfCancel", sh).onclick = () => { if (c) { formEl.hidden = true; view.hidden = false; } else closeSheet(); };
        if (c) {
          $("#cfBook", sh).onclick = () => openVisitForm(null, { clientId: c.id, day: selDay });
          $("#cfEdit", sh).onclick = () => { view.hidden = true; formEl.hidden = false; $("#cfName", sh).focus(); };
          loadHistory(c, $("#hist", sh));
        }
        formEl.addEventListener("submit", e => {
          e.preventDefault();
          const nm = $("#cfName", sh).value.trim(), ph = digits($("#cfPhone", sh).value), er = $("#cfErr", sh);
          er.hidden = true;
          if (!nm) { er.textContent = "Wpisz imię i nazwisko."; er.hidden = false; return; }
          if (ph.length !== 9) { er.textContent = "Numer telefonu musi mieć 9 cyfr."; er.hidden = false; return; }
          busy($("#cfSave", sh), "Zapisywanie…", async () => {
            try {
              const r = await api("saveClient", { client: { id: c ? c.id : null, name: nm, phone: ph, note: $("#cfNote", sh).value.trim() } });
              const i = db.clients.findIndex(x => x.id === r.client.id);
              if (i >= 0) db.clients[i] = r.client; else db.clients.push(r.client);
              (r.visits || []).forEach(upsertVisit);
              persist(); closeSheet(); render(); toast(c ? "Zapisano" : "Dodano klientkę");
            } catch (e2) { er.textContent = e2.message; er.hidden = false; }
          });
        });
      });
  }

  // ---------- service sheet ----------
  function openService(id) {
    const s = id ? svcById(id) : null;
    const used = s ? db.visits.some(v => v.serviceId === s.id && parse(v.start) > new Date()) : false;
    let delArmed = false;
    openSheet(
      '<h3>' + (s ? "Edytuj usługę" : "Nowa usługa") + '</h3><p class="sub">Czas trwania wyznacza koniec wizyty.</p>' +
      '<form class="form" id="sf" novalidate>' +
      '<div class="f"><label for="sfName">Nazwa</label><input id="sfName" value="' + esc(s ? s.name : "") + '"></div>' +
      '<div class="f"><label for="sfCat">Kategoria</label><select id="sfCat">' + CATS.map(c => '<option' + (s && s.cat === c ? " selected" : "") + '>' + c + '</option>').join("") + '</select></div>' +
      '<div class="two"><div class="f"><label for="sfMin">Czas (min)</label><input id="sfMin" type="number" inputmode="numeric" min="5" step="5" value="' + (s ? s.min : 60) + '"></div>' +
      '<div class="f"><label for="sfPrice">Cena (zł)</label><input id="sfPrice" type="number" inputmode="numeric" min="0" step="5" value="' + (s ? s.price : 100) + '"></div></div>' +
      '<p class="err" id="sfErr" hidden></p>' +
      '<div class="actions"><button type="submit" class="btn" id="sfSave">Zapisz</button>' +
      (s && !used ? '<button type="button" class="btn danger" id="sfDel">Usuń</button>' : '<button type="button" class="btn ghost" id="sfCancel">Anuluj</button>') + '</div>' +
      (s && used ? '<p class="note">Tej usługi nie można usunąć, bo są na nią umówione wizyty.</p>' : "") +
      (s ? '<p class="note">Zmiana czasu działa dla nowych i edytowanych wizyt.</p>' : "") + '</form>',
      sh => {
        const er = $("#sfErr", sh);
        const fail = e => { er.textContent = e.message; er.hidden = false; };
        const cancel = $("#sfCancel", sh); if (cancel) cancel.onclick = closeSheet;
        const del = $("#sfDel", sh);
        if (del) del.onclick = () => {
          if (!delArmed) { delArmed = true; del.textContent = "Dotknij ponownie"; return; }
          busy(del, "Usuwanie…", async () => {
            try { await api("deleteService", { id: s.id }); db.services = db.services.filter(x => x.id !== s.id); persist(); closeSheet(); render(); toast("Usługa usunięta"); }
            catch (e) { fail(e); }
          });
        };
        $("#sf", sh).addEventListener("submit", e => {
          e.preventDefault();
          er.hidden = true;
          const nm = $("#sfName", sh).value.trim(), mn = parseInt($("#sfMin", sh).value, 10), pr = parseInt($("#sfPrice", sh).value, 10);
          if (!nm) return fail(new Error("Wpisz nazwę usługi."));
          if (!(mn >= 5)) return fail(new Error("Czas trwania to co najmniej 5 minut."));
          if (!(pr >= 0)) return fail(new Error("Podaj cenę (może być 0)."));
          busy($("#sfSave", sh), "Zapisywanie…", async () => {
            try {
              const r = await api("saveService", { service: { id: s ? s.id : null, name: nm, cat: $("#sfCat", sh).value, min: mn, price: pr } });
              const i = db.services.findIndex(x => x.id === r.service.id);
              if (i >= 0) db.services[i] = r.service; else db.services.push(r.service);
              persist(); closeSheet(); render(); toast("Zapisano usługę");
            } catch (e2) { fail(e2); }
          });
        });
      });
  }

  // ---------- settings ----------
  function openSettings() {
    openSheet(
      '<h3>Ustawienia</h3>' +
      (cfg ? '<div class="f"><label>Kolor aplikacji</label><div class="swatches" id="swatches">' +
        PRESETS.map(([n, c]) => '<button type="button" class="sw" data-c="' + c + '" style="background:' + c + '" aria-label="' + n + '" title="' + n + '"></button>').join("") +
        '<label class="sw custom" title="Własny kolor" aria-label="Własny kolor"><input type="color" id="swCustom" value="' + themeColor + '"></label>' +
        '</div><p class="note" id="swNote" style="margin-top:6px">Kolor zobaczysz też na stronie potwierdzenia wizyty dla klientek.</p></div>' : "") +
      '<div class="f" style="margin-top:14px"><label>Tło</label><div class="seg" id="modeSeg">' +
        [["auto", "Jak w telefonie"], ["light", "Jasne"], ["dark", "Ciemne"]].map(([m, n]) =>
          '<button type="button" data-m="' + m + '" aria-pressed="' + (mode === m) + '">' + n + '</button>').join("") +
      '</div></div><hr class="sep">' +
      '<p class="sub">Połączenie z Kalendarzem Google i bramką SMS.</p>' +
      '<form class="form" id="setf" novalidate>' +
      '<div class="f"><label for="setCode">Kod konfiguracji</label><textarea id="setCode" placeholder="Wklej kod z maila (opcjonalnie)" style="min-height:56px"></textarea></div>' +
      '<div class="f"><label for="setUrl">Adres skryptu (kończy się na /exec)</label><input id="setUrl" type="url" value="' + esc(cfg ? cfg.u : "") + '" placeholder="https://script.google.com/macros/s/…/exec"></div>' +
      '<div class="f"><label for="setKey">Klucz dostępu</label><input id="setKey" value="' + esc(cfg ? cfg.k : "") + '" autocomplete="off"></div>' +
      '<p class="err" id="setErr" hidden></p><p class="okmsg" id="setOk" hidden></p>' +
      '<div class="actions"><button type="submit" class="btn" id="setSave">Zapisz i połącz</button></div></form>' +
      (cfg ? '<hr class="sep"><form class="form" id="smsf" novalidate>' +
        '<div class="f"><label for="smsPhone">Testowy SMS na numer</label><input id="smsPhone" type="tel" inputmode="tel" placeholder="Twój numer"></div>' +
        '<p class="err" id="smsErr" hidden></p><p class="okmsg" id="smsOk" hidden></p>' +
        '<div class="actions"><button type="submit" class="btn ghost" id="smsSend">Wyślij testowy SMS</button></div>' +
        '<p class="note">Test wysyła prawdziwy SMS przez SMSAPI, także w trybie testowym. Kosztuje tyle co jeden SMS.</p></form>' : "") +
      '<p class="note">' + (config.dryRun ? "Skrypt działa w trybie testowym (DRY_RUN)." : cfg ? "Przypomnienia SMS są włączone." : "") + '</p>',
      sh => {
        sh.querySelectorAll("#modeSeg button").forEach(b => b.addEventListener("click", () => {
          applyMode(b.dataset.m);
          sh.querySelectorAll("#modeSeg button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        }));
        const sws = $("#swatches", sh);
        if (sws) {
          const note = $("#swNote", sh);
          const mark = () => sws.querySelectorAll(".sw[data-c]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.c.toUpperCase() === themeColor.toUpperCase())));
          let saveT, prev = themeColor;
          const pick = c => {
            applyTheme(c.toUpperCase()); mark();
            clearTimeout(saveT);
            saveT = setTimeout(async () => {
              try { await api("saveTheme", { color: themeColor }); prev = themeColor; config.theme = themeColor; persist(); note.textContent = "Zapisano. Kolor obowiązuje na wszystkich urządzeniach."; }
              catch (e) { note.textContent = "Nie udało się zapisać koloru: " + e.message; applyTheme(prev); mark(); }
            }, 600);
          };
          mark();
          sws.querySelectorAll(".sw[data-c]").forEach(b => b.addEventListener("click", () => pick(b.dataset.c)));
          $("#swCustom", sh).addEventListener("input", e => pick(e.target.value));
        }
        const code = $("#setCode", sh);
        code.addEventListener("input", () => {
          const o = decodeCfg(code.value);
          if (o) { $("#setUrl", sh).value = o.u; $("#setKey", sh).value = o.k; }
        });
        $("#setf", sh).addEventListener("submit", e => {
          e.preventDefault();
          const er = $("#setErr", sh), ok = $("#setOk", sh);
          er.hidden = ok.hidden = true;
          const u = $("#setUrl", sh).value.trim(), k = $("#setKey", sh).value.trim();
          if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(u)) { er.textContent = "Adres powinien zaczynać się od https://script.google.com/ i kończyć na /exec."; er.hidden = false; return; }
          if (!k) { er.textContent = "Wpisz klucz dostępu."; er.hidden = false; return; }
          const prev = cfg;
          cfg = { u, k };
          busy($("#setSave", sh), "Łączenie…", async () => {
            try {
              const t = todayD();
              const from = ymd(addDays(t, -14)), to = ymd(addDays(t, 60));
              const r = await api("bootstrap", { from, to });
              LS.set("ms-cfg", cfg);
              db = { clients: r.clients, services: r.services, visits: [] }; loaded.clear();
              config = r.config || {}; mergeVisits(from, to, r.visits); persist();
              if (config.theme) applyTheme(config.theme);
              closeSheet(); render(); toast("Połączono z kalendarzem");
            } catch (e2) { cfg = prev; er.textContent = e2.message; er.hidden = false; }
          });
        });
        const smsf = $("#smsf", sh);
        if (smsf) smsf.addEventListener("submit", e => {
          e.preventDefault();
          const er = $("#smsErr", sh), ok = $("#smsOk", sh), ph = digits($("#smsPhone", sh).value);
          er.hidden = ok.hidden = true;
          if (ph.length !== 9) { er.textContent = "Numer telefonu musi mieć 9 cyfr."; er.hidden = false; return; }
          busy($("#smsSend", sh), "Wysyłanie…", async () => {
            try { await api("testSms", { phone: ph }); ok.textContent = "Wysłano. SMS powinien dojść w ciągu minuty."; ok.hidden = false; }
            catch (e2) { er.textContent = e2.message; er.hidden = false; }
          });
        });
      });
  }

  // ---------- start ----------
  render();
  if (cfg) refreshAll();

  // link konfiguracyjny otwarty, gdy aplikacja już działa
  window.addEventListener("hashchange", () => {
    if (readHashConfig()) { db = { clients: [], services: [], visits: [] }; loaded.clear(); render(); refreshAll().then(ok => { if (ok) toast("Połączono z kalendarzem"); }); }
  });

  // odśwież po powrocie do aplikacji i co 2 minuty, gdy jest otwarta
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && cfg && Date.now() - lastSync > 30000) refreshAll();
  });
  setInterval(() => {
    if (document.visibilityState === "visible" && cfg && overlay.hidden && Date.now() - lastSync > 110000) refreshAll();
  }, 30000);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }
})();
