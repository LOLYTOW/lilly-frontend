import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

/* ===================== الإعدادات العامة ===================== */
const app = express();

// حجم JSON معقول
app.use(express.json({ limit: "1mb" }));

// **CORS**: يُفضّل ضبط ALLOWED_ORIGINS بنطاق Vercel الخاص بك (مفصول بفواصل عند تعددها)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// إعداد CORS ديناميكي
app.use(
  cors({
    origin: (origin, callback) => {
      // السماح لطلبات الخوادم/الأدوات التي لا ترسل Origin
      if (!origin) return callback(null, true);
      // إن لم تُضبط قائمة السماح، نسمح للجميع (للتجربة فقط)
      if (ALLOWED_ORIGINS.length === 0) return callback(null, true);
      // السماح فقط للأصول المحددة
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("CORS: Origin not allowed"));
    },
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    optionsSuccessStatus: 204
  })
);

// تحويل أخطاء CORS إلى JSON ودّي
app.use((err, req, res, next) => {
  if (err && String(err.message || "").includes("CORS")) {
    return res.status(403).json({ error: "تم حظر الطلب عبر CORS" });
  }
  return next(err);
});

/* ===================== OpenAI Client ===================== */
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// الموديل الافتراضي — قابل للتعديل عبر .env
const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

/* ===================== أدوات مساعدة ===================== */

// توليد System Prompt ديناميكي وفق تفضيلات "الشخصية"
function buildSystemPrompt(persona = {}) {
  const style = persona.style || "friendly";   // formal | friendly | concise | colloquial
  const tone  = persona.tone  || "calm";       // calm | cheerful | pro
  const lang  = persona.lang  || "fusha";      // fusha | ammiyah | english | mixed
  const tutor = !!persona.tutor;

  // اللغة
  let langRule = "اكتبي دائمًا بالعربية الفصحى.";
  if (lang === "ammiyah") langRule = "اكتبي بالعربية العامية بلطف وبأسلوب خليجي خفيف دون مبالغة.";
  if (lang === "english") langRule = "Always respond in natural, clear English.";
  if (lang === "mixed")   langRule = "اكتبي بالعربية، ولا مانع من مزج الإنجليزية عند الحاجة بشكل طبيعي.";

  // الأسلوب
  let styleRule = "أسلوب مختصر، ودود، واضح.";
  if (style === "formal")    styleRule = "أسلوب رسمي راقٍ، مختصر وواضح.";
  if (style === "friendly")  styleRule = "أسلوب ودود جدًا، لطيف، مختصر وواضح.";
  if (style === "concise")   styleRule = "اختصري قدر الإمكان مع وضوح تام ونقاط مرتبة.";
  if (style === "colloquial")styleRule = "أسلوب محادثي قريب وسلس دون إسهاب.";

  // النبرة
  let toneRule = "نبرة هادئة مطمئنة.";
  if (tone === "cheerful") toneRule = "نبرة مرحة خفيفة دون مبالغة.";
  if (tone === "pro")      toneRule = "نبرة احترافية رزينة.";

  // وضع معلّمة الإنجليزية
  const tutorRule = tutor
    ? `عند كتابة المستخدم بالإنجليزية:
- قدّمي تصحيحًا لطيفًا في نهاية الرد بعنوان "تصحيح مقترح".
- أعطي مثالين بديلين مختصرين.
- وعند الطلب فقط، قدّمي تمرينًا قصيرًا من سطرين.`
    : "لا تقدّمي تصحيحًا تفصيليًا ما لم يُطلب ذلك.";

  // قواعد ثابتة
  const fixed =
`- نادي المستخدم دائمًا بـ "مامي".
- تجنّبي الإيموجي إلا نادرًا.
- احترمي الخصوصية ولا تطلبي بيانات حساسة.
- عند الكود: قدّمي الشفرة نظيفة ومباشرة مع شرح سطرين فقط عند اللزوم.`;

  // دمج
  return `
أنتِ Lilly — سكرتيرة شخصية لمامي لأعمالها العامة والبرمجية.
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
    const { message, persona, session } = req.body || {};
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "رسالة المستخدم مطلوبة." });
    }

    const systemContent = buildSystemPrompt(persona);

    // لا نطبع محتوى المستخدم في السجلات حفاظًا على الخصوصية
    console.log(`[Lilly] /api/chat — session: ${session || "عام"} — model: ${MODEL}`);

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
    return res.status(500).json({ error: "عذرًا مامي، حدث خطأ من المزود." });
  }
});

/* ===================== API: Weather (Proxy خفيف) ===================== */
/**
 * مزوّد: Open‑Meteo (لا يحتاج مفتاح)
 * GET /api/weather?city=Riyadh
 * يمكن لاحقًا توسيع المدن/الإحداثيات من .env أو قاعدة بيانات.
 */
const CITY_COORDS = {
  Riyadh:  { lat: 24.7136, lon: 46.6753 },
  Jeddah:  { lat: 21.4858, lon: 39.1925 },
  Dammam:  { lat: 26.4207, lon: 50.0888 },
  Mecca:   { lat: 21.3891, lon: 39.8579 },
  Medina:  { lat: 24.5247, lon: 39.5692 }
};

// وصف مبسّط لرمز الطقس
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
    return res.json({ text: "—" }); // فشل صامت ودي
  }
});

/* ===================== Health ===================== */
app.get("/health", (req, res) => {
  res.json({ ok: true, model: MODEL, time: new Date().toISOString() });
});

/* ===================== بدء الخادم ===================== */
// Render يمرّر المنفذ عبر متغيّر PORT، لذا يجب استخدامه
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Lilly] server running on port ${PORT}`);
});