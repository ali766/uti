const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// بيولّد كود، يخزّنه مؤقتًا في Firestore (10 دقايق)، وبيبعته على إيميل الطالب عن طريق Brevo
exports.sendOtpEmail = onCall(async (request) => {
  const { studentId, email, name } = request.data || {};
  if (!studentId || !email) {
    throw new HttpsError("invalid-argument", "studentId and email are required");
  }

  const code = genCode();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  await db.collection("otps").doc(studentId).set({ code, expiresAt });

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: process.env.SENDER_EMAIL, name: "دروسي | Hamdi Baccar" },
      to: [{ email, name: name || "" }],
      subject: "كود تسجيل الدخول - دروسي",
      htmlContent: `<div style="font-family:sans-serif;text-align:center;padding:20px">
        <p style="font-size:16px">أهلاً ${name || ""}، كود الدخول بتاعك هو:</p>
        <h1 style="letter-spacing:6px;color:#1E362F">${code}</h1>
        <p style="color:#888;font-size:13px">الكود صالح لمدة 10 دقايق.</p>
      </div>`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Brevo error:", text);
    throw new HttpsError("internal", "Failed to send email");
  }

  return { ok: true };
});

// بيتحقق من الكود اللي الطالب دخله مقابل اللي اتخزن، وبيمسحه بعد الاستخدام
exports.verifyOtpCode = onCall(async (request) => {
  const { studentId, code } = request.data || {};
  if (!studentId || !code) {
    throw new HttpsError("invalid-argument", "studentId and code are required");
  }
  const snap = await db.collection("otps").doc(studentId).get();
  if (!snap.exists) return { valid: false };

  const data = snap.data();
  const valid = data.code === String(code).trim() && Date.now() < data.expiresAt;
  if (valid) await db.collection("otps").doc(studentId).delete();

  return { valid };
});
