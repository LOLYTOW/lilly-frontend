/************************************************************
 * Lilly - Frontend Script (Full, Safe, iPhone-First)
 * متوافق مع: index.html + styles.css الحالية
 * يعمل مع Backend على Render عبر HTTPS
 ************************************************************/

/* ========== إعداد عنوان السيرفر ========== */
/*
  ضعي رابط السيرفر هنا (من Render) بصيغة:
  https://lilly-server-xxxxx.onrender.com
*/
const BACKEND_URL_DEFAULT = "https://lilly-server-rns9.onrender.com";

/*
  مرونة إضافية بدون تعديل الملف لاحقًا:
  - إن وجِد window.LILLY_BACKEND في index.html سيُستخدم.
  - أو إن وجِد في localStorage بالمفتاح 'LILLY_BACKEND_URL' سيُستخدم.
  - وإلا يُستخدم BACKEND_URL_DEFAULT أعلاه.
*/
const BACKEND_URL =
  (typeof window !== "undefined" && window.LILLY_BACKEND) ||
  (typeof window !== "undefined" && localStorage.getItem("LILLY_BACKEND_URL")) ||
  BACKEND_URL_DEFAULT;

/* تحقّق ودّي: إن كان الرابط الافتراضي لم يُعدّل بعد، نبّه برسالة لطيفة */
function backendConfigured() {
  return !/xxxxx/.test(BACKEND_URL);
}


/* ========== عناصر الواجهة ========== */
const chat = document.getElementById("chat");
const input = document.getElementById("input");
const send = document.getElementById("send");
const typing = document.getElementById("typing");

/* تأكيد وجود العناصر */
if (!chat || !input || !send || !typing) {
  console.error("⚠️ عناصر الواجهة غير مكتملة. تأكدي من index.html.");
}


/* ========== أدوات مساعدة ========== */

/* تمرير لأسفل الدردشة بسلاسة */
function scrollToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

/* إنشاء فقاعة رسالة */
function addMsg(text, sender = "user") {
  const div = document.createElement("div");
  div.className = "message " + sender;
  div.setAttribute("dir", "auto"); // دعم العربية/الإنجليزية تلقائيًا
  div.textContent = text;
  chat.appendChild(div);
  scrollToBottom();
}

/* مؤشر الكتابة */
function showTyping() {
  typing.classList.remove("hidden");
  scrollToBottom();
}
function hideTyping() {
  typing.classList.add("hidden");
}

/* منع الإرسال الفارغ وإرجاع النص النظيف */
function takeInputText() {
  const txt = (input.value || "").trim();
  if (!txt) return null;
  input.value = "";
  autoGrow(); // يعيد الحجم بعد الإرسال
  return txt;
}


/* ========== إرسال الرسالة ========== */

async function sendToLilly(userText) {
  showTyping();

  try {
    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText })
    });

    // محاولة قراءة JSON بأمان
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    hideTyping();

    if (res.ok && data && data.reply) {
      addMsg(data.reply, "lilly");
    } else {
      const msg =
        data && data.error
          ? `مامي، حدث خطأ من الخادم: ${data.error}`
          : `مامي، لم أفهم رد الخادم. (HTTP ${res.status})`;
      addMsg(msg, "lilly");
    }
  } catch (err) {
    hideTyping();
    addMsg("مامي، لا يوجد اتصال بالخادم الآن.", "lilly");
    console.error("Network error:", err);
  }
}

/* حدث زر الإرسال */
send.onclick = () => {
  const txt = takeInputText();
  if (!txt) return;
  addMsg(txt, "user");
  sendToLilly(txt);
};

/* إرسال عند Enter + سطر جديد مع Shift+Enter */
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const txt = takeInputText();
    if (!txt) return;
    addMsg(txt, "user");
    sendToLilly(txt);
  }
});


/* ========== تحسين تجربة iPhone ========== */

/* منع تكبير iOS (الخط >= 16px تم ضبطه في CSS) */
/* Auto-grow للـ textarea حتى لا تغطي الشاشة */
function autoGrow() {
  input.style.height = "auto";
  const maxH = 140; // حد منطقي للطول
  input.style.height = Math.min(input.scrollHeight, maxH) + "px";
  // نزيد مسافة أسفل الدردشة لئلا تختفي آخر رسالة خلف الـ composer
  chat.style.scrollPaddingBottom = "150px";
  scrollToBottom();
}
["input", "change"].forEach((evt) => {
  input.addEventListener(evt, autoGrow);
});
autoGrow();

/* رفع الـ composer فوق الكيبورد باستخدام visualViewport */
if (window.visualViewport) {
  const composer = document.querySelector(".composer");
  function fixKeyboard() {
    const vp = window.visualViewport;
    const offset = Math.max(0, window.innerHeight - vp.height);
    composer.style.transform = `translateY(-${offset}px)`;
    chat.style.paddingBottom = offset + 150 + "px";
    scrollToBottom();
  }
  visualViewport.addEventListener("resize", fixKeyboard);
  visualViewport.addEventListener("scroll", fixKeyboard);
}


/* ========== التاريخ (سطر الهيدر) ========== */
const dateEl = document.getElementById("date");
if (dateEl) {
  try {
    dateEl.textContent = new Date().toLocaleDateString("ar-SA", {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  } catch {
    dateEl.textContent = new Date().toDateString();
  }
}


/* ========== رسالة ترحيب/تنبيه أول مرة ========== */
(function firstRunNotice() {
  if (!backendConfigured()) {
    addMsg(
      "مامي، رجاءً ضعي رابط السيرفر من Render في أعلى script.js بدل xxxxx، أو خزّنيه في localStorage بالمفتاح LILLY_BACKEND_URL.",
      "lilly"
    );
  } else {
    // تحية خفيفة جدًا (مرة واحدة عند التحديث)
    addMsg("مرحبًا مامي، أنا جاهزة لخدمتك. ارسلي ما تشائين.", "lilly");
  }
})();