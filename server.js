// server.js (محسّن ومترابط)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";

// لو كنتِ على Node < 18 واحتجتِ fetch:
// import fetch from "node-fetch";

dotenv.config();

/* ===================== متغيرات البيئة ===================== */
const PORT  = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const NODE_ENV = process.env.NODE_ENV || "development";

// origins المسموحة (مفصولة بفواصل)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// أثناء التطوير، سمحي تلقائيًا لصفحات Live Server
const DEV_ORIGINS = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

// تنبيه مبكر إن لم يوجد مفتاح
if (!OPENAI_API_KEY) {
  console.warn("[WARN] لا يوجد OPENAI_API_KEY في متغيرات البيئة. مسار /api/chat سيعيد خطأ 500 حتى تضيفيه.");
}

/* ===================== تهيئة التطبيق ===================== */
const app = express();

// أمن أساسي
app.use(helmet({
  // اسمحي للـ fetch من الواجهة عبر المتصفح (CORS يُدار أدناه)
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// قرينة JSON + حد مناسب
app.use(express.json({ limit: "1mb" }));

// CORS ديناميكي
const mergedAllowed = new Set([
  ...ALLOWED_ORIGINS,
  ...(NODE_ENV === "development" ? DEV_ORIGINS : [])
]);

app.use(cors({
  origin: (origin, cb) => {
    // طلبات أدوات/خوادم بدون Origin
    if (!origin) return cb(null, true);
    if (mergedAllowed.size === 0) return cb(null, true); // سماح للجميع إن لم يحدد شيء
    if (mergedAllowed.has(origin)) return cb(null, true);
    return cb(new Error("CORS: Origin not allowed"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  optionsSuccessStatus: 204
}));

// Rate Limit (خفيف)
const limiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة
  limit: 60,           // 60 طلبًا/دقيقة لكل IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تم تجاوز حد الطلبات. أعيدي المحاولة بعد قليل." }
});
app.use(limiter);

// تحويل أخطاء CORS إلى JSON ودّي
app.use((err, req, res, next) => {
  if (err && String(err.message || "").includes("CORS")) {
    return res.status(403).json({ error: "تم حظر الطلب عبر CORS" });
  }
  return next(err);
});

/* ===================== OpenAI Client ===================== */
const client = new OpenAI({
  apiKey: OPENAI_API_KEY
});

/* ===================== بناء System Prompt ===================== */
function buildSystemPrompt(persona = {}) {
  const style = persona.style || "friendly";   // formal | friendly | concise | colloquial
  const tone  = persona.tone  || "calm";       // calm | cheerful | pro
  const lang  = persona.lang  || "fusha";      // fusha | ammiyah | english | mixed
  const tutor = !!persona.tutor;

  let langRule = "اكتبي دائمًا بالعربية الفصحى.";
  if (lang === "ammiyah") langRule = "اكتبي بالعربية العامية بلطف وبأسلوب خليجي خفيف دون مبالغة.";
  if (lang === "english") langRule = "Always respond in natural, clear English.";
  if (lang === "mixed")   langRule = "اكتبي بالعربية، ولا مانع من مزج الإنجليزية عند الحاجة بشكل طبيعي.";

  let styleRule = "أسلوب مختصر، ودود، واضح.";
  if (style === "formal")     styleRule = "أسلوب رسمي راقٍ، مختصر وواضح.";
  if (style === "friendly")   styleRule = "أسلوب ودود جدًا، لطيف، مختصر وواضح.";
  if (style === "concise")    styleRule = "اختصري قدر الإمكان مع وضوح تام ونقاط مرتبة.";
  if (style === "colloquial") styleRule = "أسلوب محادثي قريب وسلس دون إسهاب.";

  let toneRule = "نبرة هادئة مطمئنة.";
  if (tone === "cheerful") toneRule = "نبرة مرِحة خفيفة دون مبالغة.";
  if (tone === "pro")      toneRule = "نبرة احترافية رزينة.";

  const tutorRule = tutor
    ? `عند كتابة المستخدم بالإنجليزية:
- قدّمي تصحيحًا لطيفًا بعنوان "تصحيح مقترح".
- أعطي مثالين بديلين مختصرين.
- وعند الطلب فقط، قدّمي تمرينًا قصيرًا من سطرين.`
    : "لا تقدّمي تصحيحًا تفصيليًا ما لم يُطلب ذلك.";

  const fixed =
`- نادي المستخدم دائمًا بـ "مامي".
- تجنّبي الإيموجي إلا نادرًا.
- احترمي الخصوصية ولا تطلبي بيانات حساسة.
- عند الكود: قدّمي الشفرة نظيفة ومباشرة مع شرح سطرين فقط عند اللزوم.`;

  return `
أنتِ Lilly — سكرتيرة شخصية لمامي.
هدفك إرضاؤها وتقديم أفضل مساعدة ممكنة.

${langRule}
${styleRule}
${toneRule}
${tutorRule}
${fixed}
`.trim();
}

/* ===================== API: Chat ===================== */
app.post("/api/chat", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "مفتاح OpenAI غير مضبوط في الخادم." });
    }

    const { message, persona, session } = req.body || {};
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "رسالة المستخدم مطلوبة." });
    }

    const systemContent = buildSystemPrompt(persona);

    console.log(`[Lilly] /api/chat — session=${session || "عام"} — model=${MODEL}`);

    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 800,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: message }
      ]
    });

    const reply = response?.choices?.[0]?.message?.content || "";
    return res.json({ reply });
  } catch (err) {
    console.error("[Lilly] Chat error:", err?.message || err);
    // رسائل مفيدة حسب نوع الخطأ الشائع
    const msg = /invalid api key/i.test(String(err))
      ? "مامي، مفتاح OpenAI غير صحيح لدى الخادم."
      : /rate limit/i.test(String(err))
        ? "مامي، تم بلوغ حد المزود مؤقتًا. أعيدي المحاولة بعد قليل."
        : "عذرًا مامي، حدث خطأ من المزود.";
    return res.status(500).json({ error: msg });
  }
});

/* ===================== API: Weather (Proxy) ===================== */
/**
 * Open‑Meteo (لا يحتاج مفتاح).
 * GET /api/weather?city=Riyadh
 */
const CITY_COORDS = {
  Riyadh:  { lat: 24.7136, lon: 46.6753 },
  Jeddah:  { lat: 21.4858, lon: 39.1925 },
  Dammam:  { lat: 26.4207, lon: 50.0888 },
  Mecca:   { lat: 21.3891, lon: 39.8579 },
  Medina:  { lat: 24.5247, lon: 39.5692 }
};

const WMO = {
  0: "صحو",
  1: "غائم جزئيًا",
  2: "غائم",
  3: "غائم كليًا",
  45: "ضباب",
  48: "ضباب متجمّد",
  51: "رذاذ خفيف",
  53: "رذاذ",
  55: "رذاذ كثيف",
  61: "أمطار خفيفة",
  63: "أمطار",
  65: "أمطار غزيرة",
  71: "ثلوج خفيفة",
  73: "ثلوج",
  75: "ثلوج كثيفة",
  80: "زخات خفيفة",
  81: "زخات",
  82: "زخات غزيرة",
  95: "عواصف رعدية",
  96: "عواصف مع برد",
  99: "عواصف شديدة مع برد"
};

app.get("/api/weather", async (req, res) => {
  try {
    const city = (req.query.city || "Riyadh").toString();
    const coords = CITY_COORDS[city] || CITY_COORDS["Riyadh"];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code&timezone=auto`;

    const r = await fetch(url);
    if (!r.ok) throw new Error("Weather HTTP " + r.status);
    const data = await r.json();

    const current = data?.current || {};
    const tempC = current.temperature_2m;
    const code = current.weather_code;
    const desc = WMO[Number(code)] || "طقس";

    return res.json({ city, tempC, desc });
  } catch (err) {
    console.error("[Lilly] Weather error:", err?.message || err);
    return res.json({ text: "—" }); // فشل صامت ودّي
  }
});

/* ===================== Health ===================== */
app.get("/health", (req, res) => {
  res.json({ ok: true, model: MODEL, env: NODE_ENV, time: new Date().toISOString() });
});

/* ===================== 404 & Error Handlers ===================== */
app.use((req, res) => {
  res.status(404).json({ error: "المسار غير موجود." });
});

app.use((err, req, res, next) => {
  console.error("[Unhandled]", err);
  res.status(500).json({ error: "حدث خطأ غير متوقَّع في الخادم." });
});

/* ===================== بدء الخادم ===================== */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Lilly] server running on http://localhost:${PORT} (env=${NODE_ENV})`);
});