/****************************************************
 * Lilly — script.js (Improved)
 * iPhone‑First, Arabic UI, Private Mode, Archive & Search
 * يعمل مع Backend عبر HTTP/HTTPS (محلي أو Render)
 ****************************************************/

/* ===================== عناصر الواجهة الأساسية ===================== */
const chat   = document.getElementById("chat");
const input  = document.getElementById("input");
const send   = document.getElementById("send");
const typing = document.getElementById("typing");

const hijriEl   = document.getElementById("hijri-date");
const weatherEl = document.getElementById("weather");

/* الإعدادات */
const settingsOverlay   = document.getElementById("settings-overlay");
const btnSettings       = document.getElementById("btn-settings");
const btnSettingsClose  = document.getElementById("btn-settings-close");
const settingsBackdrop  = document.getElementById("settings-backdrop");

/* تبويبات الإعدادات */
const tabs      = document.querySelectorAll(".tab");
const tabPanels = document.querySelectorAll(".tab-panel");

/* إعدادات الشخصية */
const personaStyleSel = document.getElementById("persona-style");
const personaToneSel  = document.getElementById("persona-tone");
const personaLangSel  = document.getElementById("persona-lang");
const tutorModeChk    = document.getElementById("tutor-mode");

/* الذاكرة والأرشيف */
const btnMemAdd   = document.getElementById("btn-memory-add");
const btnMemView  = document.getElementById("btn-memory-view");
const btnMemClear = document.getElementById("btn-memory-clear");

const privateToggle    = document.getElementById("private-mode-toggle");
const btnExportArchive = document.getElementById("btn-export-archive");
const btnImportArchive = document.getElementById("btn-import-archive");
const btnPurgeArchive  = document.getElementById("btn-purge-archive");
const importFileInput  = document.getElementById("import-file");

/* البحث */
const searchInput   = document.getElementById("search-input");
const btnSearch     = document.getElementById("btn-search");
const searchResults = document.getElementById("search-results");

/* أزرار شكلية */
const btnAttach = document.getElementById("btn-attach");

/* ===================== إعداد عنوان السيرفر ===================== */
/*
  أولوية اختيار رابط الباك-إند:
  1) window.LILLY_BACKEND داخل index.html (إن وُجد)
  2) localStorage['LILLY_BACKEND_URL']
  3) القيمة الافتراضية أدناه
*/
const BACKEND_URL_DEFAULT = "https://lilly-server-rns9.onrender.com";
function getBackendUrl() {
  try {
    if (typeof window !== "undefined" && window.LILLY_BACKEND) return window.LILLY_BACKEND;
    const fromLS = typeof window !== "undefined" ? localStorage.getItem("LILLY_BACKEND_URL") : null;
    return fromLS || BACKEND_URL_DEFAULT;
  } catch { return BACKEND_URL_DEFAULT; }
}
let BACKEND_URL = getBackendUrl();

function backendConfigured() {
  return typeof BACKEND_URL === "string" && BACKEND_URL.startsWith("http");
}

/* ===================== تهيئة iPhone ===================== */
function autoGrow() {
  if (!input) return;
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
  chat.style.scrollPaddingBottom = "150px";
  chat.scrollTop = chat.scrollHeight;
}
input?.addEventListener("input", autoGrow);
autoGrow();

(function setupViewportFix() {
  if (!window.visualViewport) return;
  const composer = document.querySelector(".composer");
  function fixKeyboard() {
    const vp = window.visualViewport;
    const offset = Math.max(0, window.innerHeight - vp.height);
    if (composer) composer.style.transform = `translateY(-${offset}px)`;
    chat.style.paddingBottom = offset + 150 + "px";
    chat.scrollTop = chat.scrollHeight;
  }
  visualViewport.addEventListener("resize", fixKeyboard);
  visualViewport.addEventListener("scroll", fixKeyboard);
})();

/* ===================== وظائف عامة ===================== */
function scrollToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

function formatTime12(date = new Date()) {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const isPM = hours >= 12;
  hours = hours % 12 || 12;
  const suffix = isPM ? "م" : "ص";
  return `${hours}:${minutes} ${suffix}`;
}

function createBubble(text, sender = "user", time = new Date()) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${sender}`;
  wrapper.setAttribute("dir", "auto");

  const msg = document.createElement("span");
  msg.className = "msg-text";
  msg.textContent = text;

  const tm = document.createElement("span");
  tm.className = "msg-time";
  tm.textContent = formatTime12(time);

  wrapper.appendChild(msg);
  wrapper.appendChild(document.createElement("br"));
  wrapper.appendChild(tm);
  return wrapper;
}

function addMsg(text, sender = "user", time = new Date()) {
  const bubble = createBubble(text, sender, time);
  chat.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

function showTyping() {
  typing?.classList.remove("hidden");
  scrollToBottom();
}
function hideTyping() {
  typing?.classList.add("hidden");
}

function takeInputText() {
  if (!input) return null;
  const txt = (input.value || "").trim();
  if (!txt) return null;
  input.value = "";
  autoGrow();
  return txt;
}

/* ===================== إدارة الإعدادات Overlay ===================== */
btnSettings?.addEventListener("click", () => {
  settingsOverlay?.classList.remove("hidden");
});
btnSettingsClose?.addEventListener("click", () => {
  settingsOverlay?.classList.add("hidden");
});
settingsBackdrop?.addEventListener("click", () => {
  settingsOverlay?.classList.add("hidden");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") settingsOverlay?.classList.add("hidden");
});

/* التبويبات */
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    tabPanels.forEach((panel) => panel.classList.remove("is-active"));
    document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add("is-active");
  });
});

/* ===================== تفضيلات مامي (محليًا) ===================== */
const PREFS_KEY   = "LILLY_PREFS";
const MEMOS_KEY   = "LILLY_MEMOS";
const SESSION_KEY = "LILLY_SESSION"; // اسم الجلسة الحالية (افتراضيًا: "عام")

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function savePrefs(p) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

const prefs = loadPrefs() || {
  persona: { style: "friendly", tone: "calm", lang: "fusha", tutor: false },
  privateMode: false,
  session: "عام"
};

personaStyleSel && (personaStyleSel.value = prefs.persona.style);
personaToneSel  && (personaToneSel.value  = prefs.persona.tone);
personaLangSel  && (personaLangSel.value  = prefs.persona.lang);
tutorModeChk    && (tutorModeChk.checked  = !!prefs.persona.tutor);
privateToggle   && (privateToggle.checked = !!prefs.privateMode);

[personaStyleSel, personaToneSel, personaLangSel, tutorModeChk].forEach(el => {
  el?.addEventListener("change", () => {
    prefs.persona = {
      style: personaStyleSel.value,
      tone:  personaToneSel.value,
      lang:  personaLangSel.value,
      tutor: !!tutorModeChk.checked
    };
    savePrefs(prefs);
  });
});
privateToggle?.addEventListener("change", () => {
  prefs.privateMode = !!privateToggle.checked;
  savePrefs(prefs);
  handlePrivateToggle();
});

/* ===================== Private Message ===================== */
function handlePrivateToggle() {
  if (prefs.privateMode) {
    chat.innerHTML = "";
    addMsg("تم تفعيل الوضع الخاص. لن تُحفَظ أي رسالة، وستُنسى هذه الصفحة عند الإغلاق.", "lilly");
  } else {
    chat.innerHTML = "";
    addMsg("تم إيقاف الوضع الخاص. عادت المحادثات إلى الوضع العادي مع الحفظ.", "lilly");
    loadRecentFromArchive();
  }
}

/* ===================== IndexedDB — أرشيف كامل محليًا ===================== */
const DB_NAME = "LILLY_DB";
const DB_VERSION = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("messages")) {
        const store = db.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
        store.createIndex("ts", "ts", { unique: false });
        store.createIndex("session", "session", { unique: false });
        store.createIndex("session_ts", "session_ts", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function ensureDB() {
  if (db) return db;
  db = await openDB();
  return db;
}

async function archiveSave({ session, sender, text, ts }) {
  if (prefs.privateMode) return;
  const database = await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    store.add({ session, sender, text, ts, session_ts: `${session}_${ts}` });
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  });
}

async function archiveLoadRecent(session, limit = 50) {
  const database = await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("messages", "readonly");
    const store = tx.objectStore("messages").index("ts");
    const req = store.openCursor(null, "prev");
    const items = [];
    req.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (cursor && items.length < 500) {
        const v = cursor.value;
        if (v.session === session) items.push(v);
        cursor.continue();
      } else {
        resolve(items.slice(0, limit).reverse());
      }
    };
    req.onerror = () => reject(req.error);
  });
}

async function archiveSearch(query, max = 100) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  const database = await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("messages", "readonly");
    const store = tx.objectStore("messages").index("ts");
    const req = store.openCursor(null, "prev");
    const results = [];
    req.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (!cursor) return resolve(results);
      const v = cursor.value;
      if (results.length < max) {
        if ((v.text || "").toLowerCase().includes(q)) results.push(v);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

async function loadRecentFromArchive() {
  if (prefs.privateMode) return;
  const session = prefs.session || "عام";
  const items = await archiveLoadRecent(session, 50);
  chat.innerHTML = "";
  for (const m of items) addMsg(m.text, m.sender, new Date(m.ts));
}

async function exportArchive() {
  const database = await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("messages", "readonly");
    const store = tx.objectStore("messages");
    const req = store.openCursor();
    const arr = [];
    req.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (cursor) { arr.push(cursor.value); cursor.continue(); }
      else {
        const blob = new Blob([JSON.stringify(arr, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `lilly-archive-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        resolve(true);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

async function importArchive(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const database = await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    for (const m of data) {
      store.add({
        session: m.session || "عام",
        sender:  m.sender  || "lilly",
        text:    m.text    || "",
        ts:      m.ts      || Date.now(),
        session_ts: `${m.session || "عام"}_${m.ts || Date.now()}`
      });
    }
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  });
}

async function purgeArchive() {
  const database = await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror   = () => reject(req.error);
  });
}

/* أزرار الأرشيف */
btnExportArchive?.addEventListener("click", async () => {
  try { await exportArchive(); addMsg("تم تصدير الأرشيف بنجاح يا مامي.", "lilly"); }
  catch { addMsg("تعذر تصدير الأرشيف.", "lilly"); }
});
btnImportArchive?.addEventListener("click", () => {
  importFileInput?.click();
});
importFileInput?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    await importArchive(file);
    addMsg("تم استيراد الأرشيف بنجاح.", "lilly");
    if (!prefs.privateMode) await loadRecentFromArchive();
  } catch {
    addMsg("تعذر استيراد الأرشيف.", "lilly");
  } finally {
    importFileInput.value = "";
  }
});
btnPurgeArchive?.addEventListener("click", async () => {
  if (!confirm("هل تريدين بالتأكيد تفريغ الأرشيف؟")) return;
  try {
    await purgeArchive();
    addMsg("تم تفريغ الأرشيف.", "lilly");
    if (!prefs.privateMode) chat.innerHTML = "";
  } catch {
    addMsg("تعذر تفريغ الأرشيف.", "lilly");
  }
});

/* ===================== ذكريات مخصّصة (محليًا) ===================== */
function loadMemos() {
  try { return JSON.parse(localStorage.getItem(MEMOS_KEY) || "[]"); }
  catch { return []; }
}
function saveMemos(arr) {
  localStorage.setItem(MEMOS_KEY, JSON.stringify(arr));
}
btnMemAdd?.addEventListener("click", () => {
  const t = prompt("أدخلي ذكرى تريدين أن تتذكرها Lilly دائمًا:");
  if (!t) return;
  const arr = loadMemos();
  arr.push({ text: t, ts: Date.now() });
  saveMemos(arr);
  addMsg("تمت إضافة الذكرى.", "lilly");
});
btnMemView?.addEventListener("click", () => {
  const arr = loadMemos();
  if (arr.length === 0) return addMsg("لا توجد ذكريات محفوظة.", "lilly");
  const lines = arr.map((m, i) => `${i+1}. ${m.text}`);
  addMsg("ذكرياتك يا مامي:\n" + lines.join("\n"), "lilly");
});
btnMemClear?.addEventListener("click", () => {
  if (!confirm("هل تريدين مسح كل الذكريات؟")) return;
  saveMemos([]);
  addMsg("تم مسح الذكريات.", "lilly");
});

/* ===================== البحث داخل كل المحادثات ===================== */
btnSearch?.addEventListener("click", async () => {
  const q = (searchInput.value || "").trim();
  if (!q) return;
  const results = await archiveSearch(q, 100);
  renderSearchResults(q, results);
});

function renderSearchResults(q, items) {
  searchResults.innerHTML = "";
  if (!items || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "search-result";
    empty.textContent = `لا نتائج للبحث: ${q}`;
    searchResults.appendChild(empty);
    return;
  }
  for (const r of items) {
    const box = document.createElement("div");
    box.className = "search-result";
    const meta = document.createElement("div");
    meta.className = "meta";
    const dt = new Date(r.ts);
    meta.textContent = `${r.session} • ${dt.toLocaleDateString("ar-SA")} • ${formatTime12(dt)}`;
    const snip = document.createElement("div");
    snip.className = "snippet";
    snip.textContent = r.text;
    box.appendChild(meta);
    box.appendChild(snip);
    searchResults.appendChild(box);
  }
}

/* ===================== التاريخ الهجري + الطقس ===================== */
function updateHijri() {
  try {
    const s = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
      weekday: "short", month: "short", day: "numeric"
    }).format(new Date());
    hijriEl.textContent = s;
  } catch {
    hijriEl.textContent = new Date().toLocaleDateString("ar-SA", {
      weekday: "short", month: "short", day: "numeric"
    });
  }
}
updateHijri();

/** جلب الطقس عبر الباك‑إند (Open‑Meteo Proxy) */
async function updateWeather() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/weather?city=Riyadh`, { method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data.tempC != null && data.desc) {
      weatherEl.textContent = `${Math.round(data.tempC)}° ${data.desc}`;
    } else if (data.text) {
      weatherEl.textContent = data.text;
    } else {
      weatherEl.textContent = "طقس";
    }
  } catch {
    // نترك الشرطة "—"
  }
}
updateWeather();

/* ===================== الإرسال إلى Lilly (السيرفر) ===================== */
function withTimeout(ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(id) };
}

let sending = false;

async function sendToLilly(userText) {
  if (sending) return; // منع ضغطات مزدوجة
  sending = true;
  send?.setAttribute("disabled", "true");
  showTyping();

  const { signal, cancel } = withTimeout(25000);

  try {
    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userText,
        persona: {
          style: prefs.persona.style,
          tone:  prefs.persona.tone,
          lang:  prefs.persona.lang,
          tutor: !!prefs.persona.tutor
        },
        session: prefs.session || "عام"
      }),
      signal
    });

    let data = null;
    try { data = await res.json(); } catch { data = null; }

    if (res.ok && data && (data.reply || data.message || data.text)) {
      const reply = data.reply ?? data.message ?? data.text ?? "";
      addMsg(reply, "lilly");
      await archiveSave({ session: prefs.session || "عام", sender: "lilly", text: reply, ts: Date.now() });
    } else {
      const msg = data && data.error
        ? `مامي، حدث خطأ من الخادم: ${data.error}`
        : `مامي، لم أفهم رد الخادم. (HTTP ${res.status})`;
      addMsg(msg, "lilly");
      await archiveSave({ session: prefs.session || "عام", sender: "lilly", text: msg, ts: Date.now() });
    }
  } catch (err) {
    const msg = err?.name === "AbortError"
      ? "مامي، الخادم تأخر بالرد (انتهت مهلة الاتصال)."
      : "مامي، لا يوجد اتصال بالخادم الآن.";
    addMsg(msg, "lilly");
    console.error("Network error:", err);
    await archiveSave({ session: prefs.session || "عام", sender: "lilly", text: msg, ts: Date.now() });
  } finally {
    cancel();
    hideTyping();
    sending = false;
    send?.removeAttribute("disabled");
  }
}

/* ===================== ربط الإرسال ===================== */
send?.addEventListener("click", async () => {
  const txt = takeInputText();
  if (!txt) return;
  addMsg(txt, "user");
  await archiveSave({ session: prefs.session || "عام", sender: "user", text: txt, ts: Date.now() });
  sendToLilly(txt);
});

input?.addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const txt = takeInputText();
    if (!txt) return;
    addMsg(txt, "user");
    await archiveSave({ session: prefs.session || "عام", sender: "user", text: txt, ts: Date.now() });
    sendToLilly(txt);
  }
});

/* ===================== تهيئة أول تشغيل ===================== */
(async function boot() {
  if (!backendConfigured()) {
    addMsg(
      "مامي، رجاءً ضعي رابط السيرفر في window.LILLY_BACKEND أو LILLY_BACKEND_URL.",
      "lilly"
    );
  }

  await ensureDB();
  if (!prefs.privateMode) {
    await loadRecentFromArchive();
  } else {
    addMsg("الوضع الخاص مفعل. لن تُحفظ هذه الصفحة.", "lilly");
  }
})();

/* ===================== وظائف شكلية ===================== */
btnAttach?.addEventListener("click", () => {
  addMsg("زر المرفقات شكلي حالياً يا مامي.", "lilly");
});