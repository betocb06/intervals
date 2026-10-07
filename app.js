(function () {
  "use strict";

  // ---------- music theory ----------
  var LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  var LSEMI = [0, 2, 4, 5, 7, 9, 11];
  var MAJOR = [0, 2, 4, 5, 7, 9, 11];

  var ROOTS = [
    { n: "Cb", l: 0, a: -1 }, { n: "Gb", l: 4, a: -1 }, { n: "Db", l: 1, a: -1 },
    { n: "Ab", l: 5, a: -1 }, { n: "Eb", l: 2, a: -1 }, { n: "Bb", l: 6, a: -1 },
    { n: "F", l: 3, a: 0 }, { n: "C", l: 0, a: 0 }, { n: "G", l: 4, a: 0 },
    { n: "D", l: 1, a: 0 }, { n: "A", l: 5, a: 0 }, { n: "E", l: 2, a: 0 },
    { n: "B", l: 6, a: 0 }, { n: "F#", l: 3, a: 1 }, { n: "C#", l: 0, a: 1 }
  ];

  var INTERVALS = [
    ["b2", 2, -1], ["2", 2, 0],
    ["b3", 3, -1], ["3", 3, 0],
    ["b4", 4, -1], ["4", 4, 0], ["#4", 4, 1],
    ["b5", 5, -1], ["5", 5, 0], ["#5", 5, 1],
    ["b6", 6, -1], ["6", 6, 0],
    ["7", 7, -1], ["maj7", 7, 0],
    ["b9", 9, -1], ["9", 9, 0],
    ["b11", 11, -1], ["11", 11, 0], ["#11", 11, 1],
    ["b13", 13, -1], ["13", 13, 0]
  ];

  function mod(n, m) { return ((n % m) + m) % m; }
  function accStr(a) {
    if (a === 0) return "";
    if (a > 0) return a === 1 ? "#" : a === 2 ? "##" : "###";
    return a === -1 ? "b" : a === -2 ? "bb" : "bbb";
  }
  function name(l, a) { return LETTERS[l] + accStr(a); }
  function accFor(l, semis) { return mod(semis - LSEMI[l] + 6, 12) - 6; }
  function ivSemis(iv) {
    var d = iv[1];
    return MAJOR[(d - 1) % 7] + 12 * Math.floor((d - 1) / 7) + iv[2];
  }
  function up(root, iv) {
    var l = mod(root.l + iv[1] - 1, 7);
    return { l: l, a: accFor(l, LSEMI[root.l] + root.a + ivSemis(iv)) };
  }
  function down(note, iv) {
    var l = mod(note.l - (iv[1] - 1), 7);
    return { l: l, a: accFor(l, LSEMI[note.l] + note.a - ivSemis(iv)) };
  }

  // ---------- deck ----------
  var DECK = [], BYID = {};
  ROOTS.forEach(function (r) {
    INTERVALS.forEach(function (iv) {
      var ans = up(r, iv);
      if (Math.abs(ans.a) <= 2) {
        DECK.push({ id: "f:" + r.n + ":" + iv[0], dir: "fwd", root: r, iv: iv, q: [r.n, iv[0]], ans: name(ans.l, ans.a) });
      }
      var rt = down(r, iv);
      if (Math.abs(rt.a) <= 2) {
        DECK.push({ id: "b:" + iv[0] + ":" + r.n, dir: "back", root: r, iv: iv, q: [iv[0], r.n], ans: name(rt.l, rt.a) });
      }
    });
  });
  DECK.forEach(function (c) { BYID[c.id] = c; });

  // ---------- log ----------
  // row: {t: ms, id, sec, r, n}. Normal row: n = 1, r = 0/1.
  // Summary row (old entries collapsed): n = answers, r = right answers, sec = mean seconds of right ones.
  var DAY = 86400000;
  var rows = [];          // every row of the log, loaded + this session
  var byCard = {};        // id -> rows (sorted by time)
  var unsaved = 0;
  var loadedName = "";
  var medians = { fwd: 5, back: 5 };

  function iso(t) { return new Date(t).toISOString().slice(0, 19) + "Z"; }

  function parseLog(text) {
    var out = [], bad = 0, lines = 0, sample = "";
    String(text).replace(/^\uFEFF/, "").split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      lines++;
      if (!sample) sample = line.slice(0, 60);
      if (/^"?t"?\s*[,;\t]/i.test(line)) return;
      var p = line.replace(/"/g, "").split(/[,;\t]/);
      var t = /^\d{10,13}$/.test(p[0].trim()) ? parseInt(p[0], 10) : Date.parse(p[0]);
      if (/^\d{10}$/.test(p[0].trim())) t *= 1000;
      if (isNaN(t) || p.length < 5 || !p[1]) { bad++; return; }
      var n = parseInt(p[4], 10);
      out.push({ t: t, id: p[1].trim(), sec: parseFloat(p[2]) || 0, r: parseInt(p[3], 10) || 0, n: n > 0 ? n : 1 });
    });
    return { rows: out, bad: bad, lines: lines, sample: sample };
  }

  function indexRows() {
    byCard = {};
    rows.forEach(function (x) { (byCard[x.id] = byCard[x.id] || []).push(x); });
    Object.keys(byCard).forEach(function (k) { byCard[k].sort(function (a, b) { return a.t - b.t; }); });
    var f = [], b = [];
    rows.forEach(function (x) {
      if (x.n === 1 && x.r === 1 && x.sec > 0 && BYID[x.id]) (BYID[x.id].dir === "fwd" ? f : b).push(x.sec);
    });
    medians.fwd = med(f); medians.back = med(b);
  }
  function med(a) {
    if (a.length < 5) return 5;
    a.sort(function (x, y) { return x - y; });
    var m = a[Math.floor(a.length / 2)];
    return Math.max(2, Math.min(20, m));
  }

  function toCsv() {
    var cutoff = Date.now() - 30 * DAY, keep = [], old = {};
    rows.forEach(function (x) {
      if (x.t < cutoff) (old[x.id] = old[x.id] || []).push(x); else keep.push(x);
    });
    Object.keys(old).forEach(function (id) {
      var g = old[id];
      if (g.length === 1) { keep.push(g[0]); return; }
      var n = 0, r = 0, secSum = 0, t = 0;
      g.forEach(function (x) { n += x.n; r += x.r; secSum += x.sec * x.r; if (x.t > t) t = x.t; });
      keep.push({ t: t, id: id, sec: r ? secSum / r : 0, r: r, n: n });
    });
    keep.sort(function (a, b) { return a.t - b.t; });
    var lines = ["t,card,sec,right,total"];
    keep.forEach(function (x) { lines.push([iso(x.t), x.id, x.sec.toFixed(1), x.r, x.n].join(",")); });
    return lines.join("\n") + "\n";
  }

  // ---------- analysis ----------
  function score(x, dir) {
    if (x.n > 1) return x.r / x.n;
    if (!x.r) return 0;
    return x.sec > 1.5 * medians[dir] ? 0.5 : 1;
  }
  function info(c) {
    var list = byCard[c.id];
    if (!list || !list.length) return null;
    var last5 = list.slice(-5), sum = 0, wsum = 0, total = 0;
    last5.forEach(function (x, i) { sum += (i + 1) * score(x, c.dir); wsum += i + 1; });
    list.forEach(function (x) { total += x.n; });
    var strength = sum / wsum;
    var lastRow = list[list.length - 1];
    var days;
    if (lastRow.n === 1 && !lastRow.r) days = 10 / 1440;
    else if (strength < 0.5) days = 10 / 1440;
    else if (strength < 0.7) days = 1;
    else if (strength < 0.85) days = 3;
    else if (strength < 0.95) days = 7;
    else days = 21;
    var cap = total <= 1 ? 1 : total === 2 ? 3 : total === 3 ? 7 : 21;
    days = Math.min(days, cap);
    var interval = days * DAY;
    var due = lastRow.t + interval;
    return { strength: strength, interval: interval, last: lastRow.t, due: due, total: total };
  }

  // ---------- session state ----------
  var settings = { dir: "both", roots: "all" };
  var counter = 0, retry = [], current = null, lastId = null, revealed = false;
  var tStart = 0, hiddenAt = 0, hiddenSum = 0, shownSec = 0;

  function inPool(c) {
    if (settings.dir !== "both" && c.dir !== settings.dir) return false;
    if (settings.roots === "sharp" && c.root.a < 0) return false;
    if (settings.roots === "flat" && c.root.a > 0) return false;
    return true;
  }

  function buckets() {
    var now = Date.now(), b = { due: [], fresh: [], known: [] };
    DECK.forEach(function (c) {
      if (!inPool(c) || c.id === lastId) return;
      var i = info(c);
      if (!i) { b.fresh.push({ c: c, w: 1 }); return; }
      if (now >= i.due) {
        var over = Math.min(3, Math.max(0, (now - i.last) / i.interval - 1));
        b.due.push({ c: c, w: (1.1 - i.strength) * (1 + over) });
      } else b.known.push({ c: c, w: 1 });
    });
    return b;
  }
  function weighted(list) {
    var total = 0;
    list.forEach(function (x) { total += x.w; });
    var r = Math.random() * total;
    for (var i = 0; i < list.length; i++) { r -= list[i].w; if (r <= 0) return list[i].c; }
    return list[list.length - 1].c;
  }
  function pick() {
    for (var i = 0; i < retry.length; i++) {
      if (retry[i].at <= counter && retry[i].id !== lastId) {
        var id = retry[i].id;
        retry.splice(i, 1);
        if (BYID[id] && inPool(BYID[id])) return BYID[id];
      }
    }
    var b = buckets(), r = Math.random();
    var order = r < 0.6 ? ["due", "fresh", "known"] : r < 0.85 ? ["fresh", "due", "known"] : ["known", "due", "fresh"];
    for (var k = 0; k < order.length; k++) {
      if (b[order[k]].length) return weighted(b[order[k]]);
    }
    return DECK.filter(inPool)[0];
  }

  // ---------- UI ----------
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function render() {
    current = pick();
    revealed = false;
    var c = current;
    var arrow = c.dir === "fwd" ? "\u2192" : "\u2190";
    var L = c.dir === "fwd" ? esc(c.q[0]) : '<span class="iv">' + esc(c.q[0]) + "</span>";
    var R = c.dir === "fwd" ? '<span class="iv">' + esc(c.q[1]) + "</span>" : esc(c.q[1]);
    $("q").innerHTML = L + '<span class="arrow">' + arrow + "</span>" + R;
    $("a").hidden = true;
    $("hint").hidden = false;
    $("reveal").hidden = false;
    $("row").hidden = true;
    hiddenSum = 0; hiddenAt = document.hidden ? performance.now() : 0;
    tStart = performance.now();
    updateStats();
  }

  function reveal() {
    if (revealed || !current) return;
    var now = performance.now();
    if (hiddenAt) { hiddenSum += now - hiddenAt; hiddenAt = 0; }
    shownSec = Math.min(60, Math.max(0.1, (now - tStart - hiddenSum) / 1000));
    revealed = true;
    var c = current;
    var sub = c.dir === "fwd" ? c.q[1] + " above " + c.q[0] : c.q[1] + " is the " + c.q[0] + " of";
    $("a").innerHTML = esc(c.ans) + "<small>" + esc(sub) + "</small>";
    $("a").hidden = false;
    $("hint").hidden = true;
    $("reveal").hidden = true;
    $("row").hidden = false;
  }

  function grade(ok) {
    if (!revealed) return;
    var row = { t: Date.now(), id: current.id, sec: shownSec, r: ok ? 1 : 0, n: 1 };
    rows.push(row);
    (byCard[row.id] = byCard[row.id] || []).push(row);
    unsaved++;
    if (!ok) retry.push({ id: row.id, at: counter + 4 });
    counter++;
    lastId = row.id;
    persist();
    updateSave();
    render();
  }

  function updateSave() {
    var b = $("saveBtn");
    b.textContent = unsaved ? "Save log (" + unsaved + ")" : "Save log";
    b.classList.toggle("dirty", unsaved > 0);
  }

  function counts() {
    var now = Date.now(), d = 0, f = 0, k = 0;
    DECK.forEach(function (c) {
      if (!inPool(c)) return;
      var i = info(c);
      if (!i) f++; else if (now >= i.due) d++; else k++;
    });
    return { due: d, fresh: f, known: k };
  }
  function updateStats() {
    var c = counts();
    $("stats").textContent = c.due + " due \u00b7 " + c.fresh + " new \u00b7 " + c.known + " resting";
  }

  function toast(t) {
    $("toast").textContent = t;
    clearTimeout(toast.h);
    toast.h = setTimeout(function () { $("toast").textContent = ""; }, 4000);
  }
  function msg(t) { $("msg").textContent = t; }

  // ---------- program messages ----------
  var events = [];
  function note(text) {
    events.push(new Date().toISOString().slice(11, 19) + " " + text);
    if (events.length > 60) events.shift();
  }

  // ---------- device copy (beta) ----------
  var KEEP_KEY = "intervals.keep", LOG_KEY = "intervals.log";
  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function stored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var keepOn = stored(KEEP_KEY) !== "0";
  function persist() {
    if (keepOn && rows.length && !store(LOG_KEY, toCsv())) { note("ERROR could not write the device copy"); toast("Could not keep a copy on this device."); }
  }
  function showKeep() {
    $("keepBtn").textContent = keepOn ? "Keep log on this device: ON (beta)" : "Keep log on this device: OFF (beta)";
    $("keepBtn").classList.toggle("on", keepOn);
  }

  // ---------- load / save ----------
  function loadText(text, label) {
    var p = parseLog(text);
    rows = p.rows;
    unsaved = 0; retry = []; lastId = null; counter = 0;
    indexRows();
    loadedName = label || "";
    updateSave();
    return p;
  }
  function summary(p) {
    var seen = Object.keys(byCard).filter(function (id) { return BYID[id]; }).length;
    var answers = 0;
    rows.forEach(function (x) { answers += x.n; });
    var c = counts();
    return answers + " answers, " + seen + " of " + DECK.length + " cards seen. " + c.due + " due now, " +
      c.fresh + " new. Your median time: " + medians.fwd.toFixed(1) + " s (C \u2192 x), " + medians.back.toFixed(1) + " s (x \u2190 C)." +
      (p.bad ? " " + p.bad + " unreadable lines were skipped." : "");
  }

  function fail(text) {
    note("ERROR " + text);
    $("startMsg").textContent = "Error: " + text;
    $("msg").textContent = "Error: " + text;
  }
  function errText(e) { return e && (e.stack || e.message) ? String(e.stack || e.message).split("\n").slice(0, 3).join(" | ") : String(e); }
  window.addEventListener("error", function (e) { fail("Uncaught: " + e.message + " (line " + e.lineno + ")"); });
  window.addEventListener("unhandledrejection", function (e) { fail("Unhandled: " + errText(e.reason)); });

  function readFile(file, done) {
    var fr = new FileReader();
    fr.onload = function () { done(String(fr.result), null); };
    fr.onerror = function () { done(null, (fr.error && (fr.error.name + ": " + fr.error.message)) || "unknown read error"); };
    fr.onabort = function () { done(null, "read aborted"); };
    try { fr.readAsText(file); } catch (e) { done(null, errText(e)); }
  }

  // Shared by both pickers. Returns the parsed log or null.
  function handlePicked(input, where, onOk) {
    var f = input.files && input.files[0];
    if (!f) return;
    readFile(f, function (text, err) {
      try {
        if (text === null) { fail("could not read the file: " + err); return; }
        if (!text.length) { fail("the file is empty. If it is in iCloud, wait for it to download and pick it again."); return; }
        if ((where === "settings" || begun) && unsaved && !confirm("You have " + unsaved + " unsaved answers. Replace them by loading this file?")) return;
        var p = loadText(text, f.name);
        if (!p.rows.length) { fail("no answers found. First line: " + (p.sample || "(empty)")); return; }
        onOk(f, p);
        if (where !== "start") persist();
      } catch (e) {
        fail("failed while loading: " + errText(e));
      } finally {
        try { input.value = ""; } catch (e2) {}
      }
    });
  }

  $("fileStart").addEventListener("change", function () {
    $("startMsg").textContent = "";
    handlePicked(this, "start", function (file, p) {
      $("startSummary").textContent = file.name + ": " + summary(p);
      $("startInfo").hidden = false;
      $("deviceGo").disabled = true;
      $("deviceStatus").textContent = "Replaced by the file you loaded. Press Start below.";
    });
  });
  $("fresh").addEventListener("click", function () {
    if ((begun && unsaved) || stored(LOG_KEY)) {
      var warn = (begun && unsaved ? "You have " + unsaved + " answers not saved to a file. " : "") +
        (stored(LOG_KEY) ? "The log kept on this device will be replaced once you answer a card. " : "");
      if (!confirm("Start fresh? " + warn)) return;
    }
    loadText("", "new log");
    begin();
  });
  $("goBtn").addEventListener("click", begin);

  var begun = false;
  function begin() {
    begun = true;
    persist();
    $("start").classList.remove("open");
    render();
  }
  function goHome() {
    $("startMsg").textContent = "";
    $("startInfo").hidden = true;
    var p = { bad: 0 };
    $("deviceStatus").textContent = "Session in progress: " + summary(p) + (unsaved ? " " + unsaved + " answers not saved to a file." : "");
    $("deviceGo").textContent = "Back to cards";
    $("deviceGo").disabled = false;
    $("start").classList.add("open");
  }
  $("homeBtn").addEventListener("click", goHome);
  $("openSettingsHome").addEventListener("click", openSettings);

  $("fileSettings").addEventListener("change", function (e) {
    msg("");
    handlePicked(e.target, "settings", function (f, p) {
      msg("Loaded " + f.name + ". " + summary(p));
      refreshSettings();
      render();
    });
  });
  function diagnostics() {
    var cached = stored(LOG_KEY);
    return ["Intervals diagnostics", "version " + APP_VERSION, new Date().toISOString(), navigator.userAgent,
      "device copy: " + (keepOn ? "on" : "off") + ", stored " + (cached ? cached.length + " characters" : "none"),
      "rows in memory: " + rows.length + ", unsaved: " + unsaved + ", loaded from: " + (loadedName || "nothing"),
      "service worker: " + (navigator.serviceWorker && navigator.serviceWorker.controller ? "active" : "none"),
      "", events.length ? events.join("\n") : "(no messages)"].join("\n") + "\n";
  }
  $("copyBtn").addEventListener("click", function () {
    var text = diagnostics();
    function byHand() {
      var ta = $("diag");
      ta.value = text; ta.hidden = false;
      ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length);
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      msg(ok ? "Copied." : "Select the text and copy it by hand.");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { msg("Copied."); }, byHand);
    } else byHand();
  });

  function stamp() {
    var d = new Date(), z = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  }
  $("saveBtn").addEventListener("click", function () {
    if (!rows.length) { toast("Nothing to save yet."); return; }
    var csv = toCsv();
    try {
      var blob = new Blob([csv], { type: "text/csv" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "intervals-" + stamp() + ".csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      var m = unsaved; unsaved = 0; updateSave();
      toast("Download started for " + m + " new answers. If no file appears, tap Copy diagnostics in Settings.");
    } catch (e) {
      note("ERROR download failed: " + errText(e));
      toast("Could not start a download. Your answers are still here. Try again.");
    }
  });

  // ---------- settings ----------
  var PREF = "intervals-prefs";
  try {
    var pr = JSON.parse(localStorage.getItem(PREF) || "null");
    if (pr && pr.dir && pr.roots) settings = pr;
  } catch (e) {}
  function savePrefs() { try { localStorage.setItem(PREF, JSON.stringify(settings)); } catch (e) {} }

  function markSeg(segId, val) {
    var btns = $(segId).querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("on", btns[i].getAttribute("data-v") === val);
  }
  function pct(x) { return Math.round(x * 100) + "%"; }
  function avg(list) {
    if (!list.length) return null;
    var s = 0; list.forEach(function (x) { s += x; });
    return s / list.length;
  }
  function insights() {
    var byIv = {}, dirs = { fwd: [], back: [] }, acc = { flat: [], nat: [], sharp: [] };
    DECK.forEach(function (c) {
      var i = info(c);
      if (!i) return;
      (byIv[c.iv[0]] = byIv[c.iv[0]] || []).push(i.strength);
      dirs[c.dir].push(i.strength);
      acc[c.root.a < 0 ? "flat" : c.root.a > 0 ? "sharp" : "nat"].push(i.strength);
    });
    var html = "";
    if (!Object.keys(byIv).length) return "<p>No answers yet.</p>";
    var d1 = avg(dirs.fwd), d2 = avg(dirs.back);
    html += "<p>C \u2192 x: " + (d1 === null ? "-" : pct(d1)) + " &nbsp; x \u2190 C: " + (d2 === null ? "-" : pct(d2)) + "</p>";
    var a1 = avg(acc.flat), a2 = avg(acc.nat), a3 = avg(acc.sharp);
    html += "<p>Flat roots: " + (a1 === null ? "-" : pct(a1)) + " &nbsp; natural: " + (a2 === null ? "-" : pct(a2)) + " &nbsp; sharp: " + (a3 === null ? "-" : pct(a3)) + "</p>";
    var list = Object.keys(byIv).filter(function (k) { return byIv[k].length >= 3; })
      .map(function (k) { return { k: k, v: avg(byIv[k]) }; })
      .sort(function (a, b) { return a.v - b.v; }).slice(0, 5);
    if (list.length) html += "<p>Weakest intervals: " + list.map(function (x) { return esc(x.k) + " (" + pct(x.v) + ")"; }).join(", ") + "</p>";
    html += "<p>Strength is your recent score per card: wrong = 0, slow right = 50%, right = 100%.</p>";
    return html;
  }
  function refreshSettings() {
    markSeg("dirSeg", settings.dir);
    markSeg("rootSeg", settings.roots);
    $("insights").innerHTML = insights();
    $("logInfo").textContent = (loadedName ? "Loaded: " + loadedName + ". " : "") + unsaved + " unsaved answers.";
  }
  function bindSeg(segId, key) {
    $(segId).addEventListener("click", function (e) {
      var v = e.target.getAttribute && e.target.getAttribute("data-v");
      if (!v) return;
      settings[key] = v;
      savePrefs();
      refreshSettings();
      lastId = null; retry = [];
      render();
    });
  }
  bindSeg("dirSeg", "dir");
  bindSeg("rootSeg", "roots");
  function openSettings() { refreshSettings(); msg(""); $("panel").classList.add("open"); }
  $("openSettings").addEventListener("click", openSettings);
  $("closeSettings").addEventListener("click", function () { $("panel").classList.remove("open"); });

  // ---------- main controls ----------
  $("card").addEventListener("click", reveal);
  $("reveal").addEventListener("click", reveal);
  $("yes").addEventListener("click", function () { grade(true); });
  $("no").addEventListener("click", function () { grade(false); });
  document.addEventListener("keydown", function (e) {
    if ($("panel").classList.contains("open") || $("start").classList.contains("open")) return;
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); reveal(); }
    else if (e.key === "ArrowRight") grade(true);
    else if (e.key === "ArrowLeft") grade(false);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) hiddenAt = performance.now();
    else if (hiddenAt) { hiddenSum += performance.now() - hiddenAt; hiddenAt = 0; }
  });
  window.addEventListener("beforeunload", function (e) {
    if (unsaved) { e.preventDefault(); e.returnValue = ""; }
  });

  $("keepBtn").addEventListener("click", function () {
    keepOn = !keepOn;
    store(KEEP_KEY, keepOn ? "1" : "0");
    if (keepOn) { persist(); toast("Copy kept on this device. Still save the file now and then."); }
    else { store(LOG_KEY, null); toast("Device copy deleted."); }
    showKeep();
  });
  showKeep();
  Array.prototype.forEach.call(document.querySelectorAll(".vnum"), function (n) { n.textContent = APP_VERSION; });

  $("deviceGo").disabled = true;
  var saved = stored(LOG_KEY);
  if (saved) {
    var sp = loadText(saved, "device copy");
    if (sp.rows.length) {
      $("deviceStatus").textContent = "Found on this device: " + summary(sp);
      $("deviceGo").disabled = false;
    } else note("ERROR device copy was found but had no readable answers");
  } else {
    $("deviceStatus").textContent = keepOn ? "No log found on this device yet." : "Keeping the log on this device is off (see Settings).";
  }
  $("deviceGo").addEventListener("click", begin);

  updateSave();

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(function (e) { note("ERROR service worker: " + errText(e)); });
})();
