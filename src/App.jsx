import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Users, ClipboardList, Plus, Trash2, CheckCircle2, Circle, Lock, ArrowRight, ExternalLink, Settings, User, Copy, Check, Link2, LayoutDashboard, TrendingUp, Award, Clock, GraduationCap, Menu, X, Video, FileText, PenLine, ListChecks, Upload, Loader2, Eye, EyeOff, Pencil, Ban, Unlock, Maximize, RotateCcw, CalendarClock, ClipboardCheck, History, Smartphone, Monitor, Globe2 } from "lucide-react";
import { uploadToCloudinary } from "./cloudinary";
import {
  subscribeToStudents,
  subscribeToLessons,
  subscribeToProgress,
  subscribeToSettings,
  subscribeToClasses,
  addStudent,
  updateStudent,
  deleteStudent,
  addLesson,
  updateLesson,
  deleteLesson,
  setProgressEntry,
  setAdminPassword,
  addClass,
  updateClass,
  deleteClass,
  subscribeToLoginLogs,
  addLoginLog,
} from "./firebase";

function sameData(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ---------- login tracking ---------- */
// Best-effort: device type comes from the user agent (always available), country
// comes from a free public IP-lookup API and may fail (offline, blocked, rate
// limited) — in that case we still log the login, just with country: null.

function detectLoginDevice() {
  if (typeof navigator === "undefined") return "web";
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "") ? "mobile" : "web";
}

async function detectLoginCountry() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const data = await res.json();
    return data.country_name || data.country || null;
  } catch (e) {
    return null;
  }
}

function recordLoginEvent(role, name) {
  const device = detectLoginDevice();
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  detectLoginCountry().then((country) => {
    addLoginLog({ role, name: name || "", device, country, userAgent });
  });
}

function toEmbedUrl(url, opts = {}) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (yt) return { type: "video", src: `https://www.youtube.com/embed/${yt[1]}` };
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return { type: "frame", src: `https://drive.google.com/file/d/${drive[1]}/preview` };
  // ملف فيديو مباشر (زي اللي بيترفع على Cloudinary): يتشغل جوه الصفحة بمشغّل فيديو حقيقي
  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url) || /\/video\/upload\//.test(url)) {
    return { type: "file-video", src: url };
  }
  // ملف PDF مباشر: بيتعرض عن طريق Google Docs Viewer بدل عارض المتصفح نفسه، لأن عارض
  // المتصفح (خصوصًا على الموبايل) بيفتح الصفحة بحجمها الطبيعي (100%) جوه الإطار الصغير
  // فيبان "مكبّر جدًا"، بينما Google Viewer بيتصرف كصفحة ويب عادية بتتظبط تلقائي مع عرض الشاشة.
  if (/\.pdf(\?.*)?$/i.test(url) || /\/(image|raw)\/upload\/[^]*\.pdf/i.test(url)) {
    return { type: "frame", src: `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(url)}` };
  }
  // PowerPoint / Word: تتعرض جوه الصفحة عن طريق Office Online Viewer (لازم الرابط يكون عام/متاح على النت)
  if (/\.(ppt|pptx|doc|docx)(\?.*)?$/i.test(url)) {
    return { type: "frame", src: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}` };
  }
  return null;
}

// عرض درس (فيديو/PDF/PPT/Word) جوه الصفحة، بيستخدم في شاشة المدرس (للتجربة) وشاشة الطالب
function LessonEmbed({ lesson, t }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable);
      if (typing) return;
      if ((e.key === "f" || e.key === "F") && !expanded) {
        e.preventDefault();
        setExpanded(true);
      } else if (e.key === "Escape" && expanded) {
        e.preventDefault();
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  const embed = toEmbedUrl(lesson.url, { allowDownload: lesson.allowDownload });
  if (!embed) return null;

  const media =
    embed.type === "file-video" ? (
      <video
        src={embed.src}
        controls
        controlsList={lesson.allowDownload ? "noremoteplayback" : "nodownload noremoteplayback"}
        disablePictureInPicture
        onContextMenu={(e) => !lesson.allowDownload && e.preventDefault()}
        style={expanded ? { width: "100%", height: "100%", background: "#000" } : { width: "100%", maxWidth: 900, borderRadius: 8, background: "#000" }}
      />
    ) : (
      <iframe
        src={embed.src}
        title={lesson.title}
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
        style={
          expanded
            ? { width: "100%", height: "100%", border: "none" }
            : { width: "100%", maxWidth: 900, aspectRatio: lesson.type === "video" ? "16/9" : "3/4", border: "none", borderRadius: 8 }
        }
      />
    );

  if (expanded) {
    return createPortal(
      <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#000", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: 10, background: "rgba(0,0,0,0.85)" }}>
          <button
            onClick={() => setExpanded(false)}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 10,
              padding: "8px 14px",
              cursor: "pointer",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "Cairo, sans-serif",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            <X size={16} /> {t ? t.closeFullscreen : "Close"}
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>{media}</div>
      </div>,
      document.body
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 900 }}>
      {media}
      <button
        onClick={() => setExpanded(true)}
        title={t ? t.viewFullscreen : "Fullscreen"}
        style={{
          position: "absolute",
          bottom: 10,
          insetInlineEnd: 10,
          background: "rgba(0,0,0,0.65)",
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: 8,
          padding: "6px 10px",
          cursor: "pointer",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12.5,
          fontFamily: "Cairo, sans-serif",
        }}
      >
        <Maximize size={14} /> {t ? t.viewFullscreen : "Fullscreen"}
      </button>
    </div>
  );
}

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap');`;

const COLORS = {
  board: "#0B0F14",
  boardDark: "#04060a",
  frame: "#C9A227",
  frameDark: "#8a6f1a",
  chalk: "#F5F0E6",
  chalkDim: "#9AA0A6",
  chalkYellow: "#E8B44B",
  chalkPink: "#E5534B",
  chalkBlue: "#4FD1C5",
  chalkGreen: "#8BC34A",
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function fmtDate(iso, lang) {
  if (!iso) return "—";
  const d = new Date(iso);
  const locale = lang === "ar" ? "ar-EG" : lang === "fr" ? "fr-FR" : "en-US";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" }) + " - " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
function genPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function genUsername(name, existing) {
  const base =
    (name || "student")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 10) || "student";
  const taken = new Set((existing || []).map((s) => (s.username || "").toLowerCase()));
  let candidate = base;
  let n = 0;
  while (!candidate || taken.has(candidate)) {
    n += 1;
    candidate = `${base}${Math.floor(100 + Math.random() * 900)}${n > 1 ? n : ""}`;
  }
  return candidate;
}

/* ---------- translations ---------- */

const BRAND = "Hamdi Baccar";

const T = {
  ar: {
    brand: BRAND,
    teacherLink: "المدرّس",
    studentSubtitle: "ادخل باسم المستخدم وكلمة السر اللي المدرّس ديهملك",
    username: "اسم المستخدم",
    password: "كلمة السر",
    wrongLogin: "اسم المستخدم أو كلمة السر غلط",
    login: "دخول",
    newStudentLink: "طالب جديد؟ سجّل هنا",
    registerSubtitle: "سجّل بياناتك وهيوافق عليك المدرّس قبل ما تقدر تدخل",
    registerSentSub: "تم إرسال طلبك! استنى موافقة المدرّس، وهيديك اسم المستخدم وكلمة السر.",
    familyName: "اسم العائلة",
    phone: "رقم التليفون",
    emailOptional: "الإيميل (اختياري)",
    chooseClassOpt: "اختار الفصل",
    sendRegistration: "إرسال",
    backToLogin: "رجوع لتسجيل الدخول",
    pendingApprovalTitle: (n) => `طلبات تسجيل محتاجة موافقة (${n})`,
    approve: "موافقة",
    myInfoTitle: "بياناتي",
    myInfoSaved: "اتحفظت بياناتك",
    changeMyPassword: "تغيير كلمة السر",
    newPasswordLabel: "كلمة السر الجديدة",
    newPasswordPh: "اكتب كلمة سر جديدة",
    back: "رجوع",
    logout: "خروج",
    teacherLogin: "دخول المدرّس",
    defaultPasswordNote: (p) => `كلمة السر الافتراضية: ${p}`,
    wrongPassword: "كلمة السر مش صح",
    teacherDashboard: "لوحة المدرّس",
    tabDashboard: "الرئيسية",
    dashTotalStudents: "إجمالي الطلاب",
    dashTotalLessons: "إجمالي الدروس",
    dashAvgProgress: "متوسط التقدم",
    dashTopStudents: "الأكتر مذاكرة",
    dashRecentLessons: "آخر الدروس المضافة",
    dashNoData: "لسه مفيش بيانات كفاية.",
    tabClasses: "الفصول",
    className: "اسم الفصل",
    classNamePh: "مثال: الصف الأول الثانوي",
    addClass: "إضافة فصل",
    noClasses: "لسه مفيش فصول. ضيف فصل من الفورم فوق.",
    studentsInClass: (n) => `${n} طالب`,
    classStudentsTitle: "الطلاب في الفصل",
    classLessonsTitle: "الدروس المضافة للفصل",
    classExamsTitle: "الامتحانات المضافة للفصل",
    noneAddedYet: "لسه مفيش حاجة مضافة.",
    assignClass: "الفصل",
    noClassOpt: "بدون فصل",
    deleteClassConfirm: "هتمسح الفصل ده؟ الطلاب فيه هيبقوا بدون فصل.",
    tabStudents: "الطلاب",
    tabLessons: "الدروس",
    tabExams: "الامتحانات",
    tabAssignments: "الواجبات",
    tabProgress: "متابعة المذاكرة",
    tabLoginLog: "سجل الدخول",
    loginLogTotal: "إجمالي مرات الدخول",
    loginLogEmpty: "لسه محدش دخل على المنصة.",
    loginLogUnknownCountry: "غير معروف",
    deviceMobile: "موبايل",
    deviceWeb: "ويب",
    tabSettings: "الإعدادات",
    changePassword: "غيّر كلمة سر المدرّس",
    backupTitle: "نسخة احتياطية من البيانات",
    backupHint: "تقدر تنزّل ملف فيه كل بيانات المنصة دلوقتي (الطلاب، الدروس، الامتحانات، الواجبات، الدرجات) كنسخة احتياطية على جهازك.",
    backupButton: "تحميل نسخة احتياطية",
    save: "حفظ",
    saved: "اتحفظت",
    studentName: "اسم الطالب",
    studentNamePh: "مثال: أحمد محمد",
    chooseUsername: "اسم المستخدم",
    usernamePh: "مثال: ahmed123",
    generatePass: "توليد كلمة سر",
    add: "إضافة",
    noStudents: "لسه مفيش طلاب. ضيف أول طالب من الفورم فوق.",
    copyCreds: "انسخ بيانات الدخول",
    copied: "اتنسخت!",
    editStudent: "تعديل بيانات الطالب",
    saveChanges: "حفظ التعديلات",
    blockStudent: "حظر الطالب",
    unblockStudent: "إلغاء الحظر",
    blockedLabel: "محظور",
    blockConfirm: "متأكد عايز تحظر الطالب ده؟ مش هيقدر يدخل تاني لحد ما تلغي الحظر.",
    editLesson: "تعديل",
    richFontFamily: "نوع الخط",
    richFontSize: "حجم الخط",
    richBold: "تخين",
    richUnderline: "تحته خط",
    richSizeSmall: "صغير",
    richSizeNormal: "عادي",
    richSizeMedium: "متوسط",
    richSizeLarge: "كبير",
    richSizeXLarge: "كبير جدًا",
    lessonTitle: "عنوان الدرس",
    lessonTitlePh: "مثال: الوحدة الأولى - المعادلات",
    category: "القسم / الوحدة",
    categoryPh: "مثال: الفصل الأول",
    lessonUrl: "رابط الدرس (يوتيوب، Google Drive، أو أي رابط)",
    lessonUrlPh: "https://youtube.com/... أو https://drive.google.com/...",
    lessonDesc: "وصف مختصر (اختياري)",
    lessonDescPh: "ملخص بسيط عن الدرس",
    addLesson: "إضافة الدرس",
    noLessons: "لسه مفيش دروس مضافة.",
    noCategory: "بدون قسم",
    typeVideo: "فيديو",
    typePdf: "PDF",
    typePpt: "بوربوينت",
    typeWord: "Word",
    typeText: "درس مكتوب",
    typeExam: "امتحان",
    typeAssignment: "واجب",
    addExam: "إضافة امتحان",
    noExams: "لسه مفيش امتحانات مضافة.",
    examFormatLabel: "شكل الامتحان",
    examFormatBuilder: "أسئلة تفاعلية",
    examFormatPdf: "ملف PDF",
    examFormatWord: "ملف Word",
    examTitle: "عنوان الامتحان",
    examTitlePh: "مثال: امتحان الوحدة الأولى",
    examFileUrl: "ملف الامتحان",
    examFileUrlPh: "https://...",
    examFileNote: "الطالب هيفتح الملف ده ويقدر يحمّله ويكتب إجابته فيه ويسلّمه للمدرس بره النظام.",
    lessonPdfUrl: "رابط الـ PDF (Google Drive)",
    lessonPdfUrlPh: "https://drive.google.com/...",
    lessonPptUrl: "ملف البوربوينت",
    lessonPptUrlPh: "https://...",
    lessonWordUrl: "ملف الـ Word",
    lessonWordUrlPh: "https://...",
    allowDownloadLabel: "السماح للطالب بتحميل الملف",
    downloadFile: "تحميل الملف",
    viewFullscreen: "تكبير على كامل الشاشة (F)",
    closeFullscreen: "إغلاق",
    tryIt: "جرّب الدرس",
    tryItPreviewNote: "معاينة — كده بالظبط الطالب هيشوف الدرس ده",
    lessonContent: "محتوى الدرس",
    lessonContentPh: "اكتب محتوى الدرس هنا...",
    examQuestions: "أسئلة الامتحان",
    addQuestion: "إضافة سؤال",
    questionText: "نص السؤال",
    questionTextPh: "اكتب السؤال هنا",
    optionText: (n) => `الاختيار ${n}`,
    addOption: "إضافة اختيار",
    markCorrect: "الإجابة الصح",
    removeQuestion: "احذف السؤال",
    difficultyLabel: "مستوى صعوبة السؤال:",
    difficultyStrong: "قوي",
    difficultyMedium: "متوسط",
    difficultyWeak: "ضعيف",
    needAtLeastOneQuestion: "ضيف سؤال واحد على الأقل قبل ما تحفظ الامتحان.",
    questionsCount: (n) => `${n} سؤال`,
    submitExam: "سلّم الامتحان",
    examAlreadySubmitted: "سلّمت الامتحان ده قبل كده",
    examYourScore: (correct, total) => `نتيجتك: ${correct} من ${total} صح`,
    examAwaitingGrading: "تم تسليم الامتحان، وهيظهرلك نتيجتك بعد ما المدرس يراجعه.",
    gradeExam: "تصحيح الامتحان",
    backToExam: "رجوع للامتحان",
    noSubmissionsYet: "لسه محدش سلّم الامتحان ده.",
    finalScoreLabel: (correct, total) => `الدرجة: ${correct} من ${total}`,
    releaseGrade: "اعتماد ونشر الدرجة",
    gradeReleased: "الدرجة اتنشرت للطالب",
    yourAnswerLabel: "إجابة الطالب:",
    markCorrectLabel: "صح",
    essaySubmittedLabel: "إجابة مقالية",
    resetExam: "إعادة تفعيل الامتحان",
    resetExamConfirm: "متأكد عايز تسمح للطالب بحل الامتحان تاني؟ إجابته الحالية هتتمسح.",
    examResetNote: "المدرس سمحلك تحل الامتحان تاني.",
    examPickAnswer: "اختار إجابة لكل سؤال قبل ما تسلّم.",
    examConfirmSubmit: "متأكد عايز تسلّم؟ مش هتقدر تغيّر إجاباتك بعد كده.",
    uploadFile: "ارفع فيديو أو PDF",
    uploading: (pct) => `بيترفع... ${pct}%`,
    uploadError: "حصل خطأ في الرفع، جرب تاني",
    uploadNotConfigured: "خدمة الرفع لسه مش متظبطة، استخدم رابط بدالها دلوقتي",
    fileUploaded: "اترفع بنجاح",
    orLink: "أو حط رابط بدل الرفع (يوتيوب، درايف، إلخ)",
    openPdf: "افتح الـ PDF",
    fileReady: (name) => `اترفع: ${name}`,
    visibleToAll: "متاح لكل الطلاب",
    visibleToSome: (n) => `متاح لـ ${n} طالب محدد`,
    whoCanSee: "مين يقدر يشوف الدرس ده؟",
    allStudentsOpt: "كل الطلاب",
    noStudentsToPick: "ضيف طلاب الأول عشان تقدر تحدد مين يشوف الدرس.",
    specificClasses: "فصول محددة",
    specificStudents: "طلاب محددين (زيادة عن الفصول)",
    noClassesYet: "لسه مفيش فصول. تقدر تحدد طلاب بالاسم بدل كده.",
    visibleToClasses: (n) => `${n} فصل`,
    showStudents: "عرض الطلاب",
    studentsWithoutClass: "طلاب بدون فصل",
    examDuration: "مدة الامتحان بالدقايق (اختياري، سيبها فاضية لو مفيش وقت محدد)",
    examDurationPh: "مثال: 30",
    examPublishAt: "تاريخ ووقت ظهور الامتحان (اختياري)",
    examAvailableDays: "متاح لمدة (بالأيام)",
    examAvailableDaysPh: "مثال: 1",
    examScheduleNote: "سيب الحقلين فاضيين لو عايز الامتحان يبقى متاح على طول من غير موعد نشر أو إغلاق.",
    examStatusUpcomingAt: (d) => `هيظهر للطلاب في: ${d}`,
    examStatusClosedAt: (d) => `اتقفل في: ${d}`,
    examStatusPublishedAt: (d) => `اتنشر في: ${d}`,
    examStatusClosesAt: (d) => `هيتقفل في: ${d}`,
    examWindowClosedMsg: "انتهى الوقت المتاح لحل هذا الامتحان.",
    examClosedBadge: "مقفول",
    examTimeLeft: (mmss) => `الوقت المتبقي: ${mmss}`,
    examTimeUp: "خلص الوقت! الامتحان اتقفل تلقائي وتم تسليمه.",
    qkMcq: "اختياري (a,b,c)",
    qkTrueFalse: "صح / غلط",
    qkEssay: "سؤال مقالي",
    qkFillBlank: "أكمل الفراغ",
    qkMatching: "توصيل",
    fillBlankTextHint: "اكتب القطعة أو الجمل، وحط ___ (ثلاث شرطات) في مكان كل فراغ. تقدر تكتب كل جملة في سطر لوحدها زي ورقة عمل عادية.",
    wordBankLabel: "الكلمات المتاحة",
    wordBankEmpty: "كل الكلمات اتحطت",
    fillBlankTextPh: "الشمس ___ من الشرق والسماء لونها ___",
    blanksAnswersLabel: "إجابات الفراغات بالترتيب",
    blankWordPh: "الكلمة الصح",
    addBlank: "إضافة فراغ",
    matchLeftPh: "العمود الأول",
    matchRightPh: "العمود التاني",
    addPair: "إضافة زوج",
    trueLabel: "صح",
    falseLabel: "غلط",
    essayHint: "الطالب هيكتب إجابته بحرية، ومش بيتحسب أوتوماتيك في الدرجة — لازم تراجعها بنفسك.",
    essayAnswerPh: "اكتب إجابتك هنا...",
    matchPick: "اختار...",
    fillBlankHint: "دوس على الكلمة تحت وبعدين دوس على مكان الفراغ عشان تحطها",
    examEssayNote: (n) => `فيه ${n} سؤال مقالي محتاج مراجعة المدرس، مش داخل في الدرجة دي.`,
    examAntiCheatNote: "لو غيّرت التبويب أو الشاشة أثناء الامتحان هيتقفل ويتسلّم تلقائي.",
    studyingWell: "بيذاكر كويس",
    needsFollowup: "محتاج متابعة",
    notStudied: "لسه ماذاكرش",
    ofLessons: (done, total, pct) => `${done} من ${total} درس (${pct}%)`,
    lastStudy: (date) => `آخر مذاكرة: ${date}`,
    addStudentsFirst: "ضيف طلاب الأول عشان تقدر تتابع مذاكرتهم.",
    welcome: (name) => `أهلاً يا ${name}`,
    completed: (done, total) => `${done} من ${total} خلّصتهم`,
    noLessonsYet: "لسه المدرّس ما ضافش دروس.",
    openLesson: "افتح الدرس",
    studiedOn: (date) => `ذاكرته يوم ${date}`,
    loading: "...بيتحمّل",
  },
  en: {
    brand: BRAND,
    teacherLink: "Teacher",
    studentSubtitle: "Enter the username and password your teacher gave you",
    username: "Username",
    password: "Password",
    wrongLogin: "Wrong username or password",
    newStudentLink: "New student? Register here",
    registerSubtitle: "Register your details — your teacher must approve you before you can log in",
    registerSentSub: "Your request was sent! Wait for your teacher's approval — they'll give you a username and password.",
    familyName: "Family name",
    phone: "Phone number",
    emailOptional: "Email (optional)",
    chooseClassOpt: "Choose a class",
    sendRegistration: "Send",
    backToLogin: "Back to login",
    pendingApprovalTitle: (n) => `Registration requests awaiting approval (${n})`,
    approve: "Approve",
    myInfoTitle: "My info",
    myInfoSaved: "Your info was saved",
    changeMyPassword: "Change password",
    newPasswordLabel: "New password",
    newPasswordPh: "Type a new password",
    login: "Log in",
    back: "Back",
    logout: "Log out",
    teacherLogin: "Teacher Login",
    defaultPasswordNote: (p) => `Default password: ${p}`,
    wrongPassword: "Wrong password",
    teacherDashboard: "Teacher Dashboard",
    tabDashboard: "Dashboard",
    dashTotalStudents: "Total Students",
    dashTotalLessons: "Total Lessons",
    dashAvgProgress: "Average Progress",
    dashTopStudents: "Top Students",
    dashRecentLessons: "Recently Added Lessons",
    dashNoData: "Not enough data yet.",
    tabClasses: "Classes",
    className: "Class name",
    classNamePh: "e.g. Grade 10",
    addClass: "Add class",
    noClasses: "No classes yet. Add one using the form above.",
    studentsInClass: (n) => `${n} student(s)`,
    classStudentsTitle: "Students in this class",
    classLessonsTitle: "Lessons assigned to this class",
    classExamsTitle: "Exams assigned to this class",
    noneAddedYet: "Nothing added yet.",
    assignClass: "Class",
    noClassOpt: "No class",
    deleteClassConfirm: "Delete this class? Its students will become unassigned.",
    tabStudents: "Students",
    tabLessons: "Lessons",
    tabExams: "Exams",
    tabAssignments: "Assignments",
    tabProgress: "Progress",
    tabLoginLog: "Login Log",
    loginLogTotal: "Total logins",
    loginLogEmpty: "No one has logged in yet.",
    loginLogUnknownCountry: "Unknown",
    deviceMobile: "Mobile",
    deviceWeb: "Web",
    tabSettings: "Settings",
    changePassword: "Change teacher password",
    backupTitle: "Data backup",
    backupHint: "Download a file with all of the platform's current data (students, lessons, exams, assignments, grades) as a backup on your computer.",
    backupButton: "Download backup",
    save: "Save",
    saved: "Saved",
    studentName: "Student name",
    studentNamePh: "e.g. Ahmed Mohamed",
    chooseUsername: "Username",
    usernamePh: "e.g. ahmed123",
    generatePass: "Generate password",
    add: "Add",
    noStudents: "No students yet. Add the first one using the form above.",
    copyCreds: "Copy login details",
    copied: "Copied!",
    editStudent: "Edit student",
    saveChanges: "Save changes",
    blockStudent: "Block student",
    unblockStudent: "Unblock",
    blockedLabel: "Blocked",
    blockConfirm: "Sure you want to block this student? They won't be able to log in until you unblock them.",
    editLesson: "Edit",
    richFontFamily: "Font",
    richFontSize: "Size",
    richBold: "Bold",
    richUnderline: "Underline",
    richSizeSmall: "Small",
    richSizeNormal: "Normal",
    richSizeMedium: "Medium",
    richSizeLarge: "Large",
    richSizeXLarge: "Extra large",
    lessonTitle: "Lesson title",
    lessonTitlePh: "e.g. Unit 1 - Equations",
    category: "Category / Unit",
    categoryPh: "e.g. Chapter 1",
    lessonUrl: "Lesson link (YouTube, Google Drive, or any link)",
    lessonUrlPh: "https://youtube.com/... or https://drive.google.com/...",
    lessonDesc: "Short description (optional)",
    lessonDescPh: "A brief summary of the lesson",
    addLesson: "Add lesson",
    noLessons: "No lessons added yet.",
    noCategory: "Uncategorized",
    typeVideo: "Video",
    typePdf: "PDF",
    typePpt: "PowerPoint",
    typeWord: "Word",
    typeText: "Written lesson",
    typeExam: "Exam",
    typeAssignment: "Assignment",
    addExam: "Add exam",
    noExams: "No exams added yet.",
    examFormatLabel: "Exam format",
    examFormatBuilder: "Interactive questions",
    examFormatPdf: "PDF file",
    examFormatWord: "Word file",
    examTitle: "Exam title",
    examTitlePh: "e.g. Unit 1 exam",
    examFileUrl: "Exam file",
    examFileUrlPh: "https://...",
    examFileNote: "The student will open this file, can download it, write their answers, and hand it back to you outside the system.",
    lessonPdfUrl: "PDF link (Google Drive)",
    lessonPdfUrlPh: "https://drive.google.com/...",
    lessonPptUrl: "PowerPoint file",
    lessonPptUrlPh: "https://...",
    lessonWordUrl: "Word file",
    lessonWordUrlPh: "https://...",
    allowDownloadLabel: "Allow the student to download this file",
    downloadFile: "Download file",
    viewFullscreen: "View fullscreen (F)",
    closeFullscreen: "Close",
    tryIt: "Try this lesson",
    tryItPreviewNote: "Preview — this is exactly what the student will see",
    lessonContent: "Lesson content",
    lessonContentPh: "Write the lesson content here...",
    examQuestions: "Exam questions",
    addQuestion: "Add question",
    questionText: "Question text",
    questionTextPh: "Type the question here",
    optionText: (n) => `Option ${n}`,
    addOption: "Add option",
    markCorrect: "Correct answer",
    removeQuestion: "Delete question",
    difficultyLabel: "Question difficulty:",
    difficultyStrong: "Strong",
    difficultyMedium: "Medium",
    difficultyWeak: "Weak",
    needAtLeastOneQuestion: "Add at least one question before saving the exam.",
    questionsCount: (n) => `${n} question(s)`,
    submitExam: "Submit exam",
    examAlreadySubmitted: "You already submitted this exam",
    examYourScore: (correct, total) => `Your score: ${correct} of ${total} correct`,
    examAwaitingGrading: "Exam submitted. Your score will show once the teacher reviews it.",
    gradeExam: "Grade exam",
    backToExam: "Back to exam",
    noSubmissionsYet: "No one has submitted this exam yet.",
    finalScoreLabel: (correct, total) => `Score: ${correct} of ${total}`,
    releaseGrade: "Approve & release grade",
    gradeReleased: "Grade released to the student",
    yourAnswerLabel: "Student's answer:",
    markCorrectLabel: "Correct",
    essaySubmittedLabel: "Essay answer",
    resetExam: "Allow retake",
    resetExamConfirm: "Allow this student to retake the exam? Their current answers will be cleared.",
    examResetNote: "Your teacher allowed you to retake this exam.",
    examPickAnswer: "Pick an answer for every question before submitting.",
    examConfirmSubmit: "Sure you want to submit? You won't be able to change your answers after this.",
    uploadFile: "Upload video or PDF",
    uploading: (pct) => `Uploading... ${pct}%`,
    uploadError: "Upload failed, try again",
    uploadNotConfigured: "Upload isn't set up yet, use a link for now",
    fileUploaded: "Uploaded successfully",
    orLink: "Or paste a link instead (YouTube, Drive, etc.)",
    openPdf: "Open PDF",
    fileReady: (name) => `Uploaded: ${name}`,
    visibleToAll: "Visible to all students",
    visibleToSome: (n) => `Visible to ${n} selected student(s)`,
    whoCanSee: "Who can see this lesson?",
    allStudentsOpt: "All students",
    noStudentsToPick: "Add students first so you can choose who sees this lesson.",
    specificClasses: "Specific classes",
    specificStudents: "Specific students (in addition to classes)",
    noClassesYet: "No classes yet. You can pick students by name instead.",
    visibleToClasses: (n) => `${n} class(es)`,
    showStudents: "Show students",
    studentsWithoutClass: "Students without a class",
    examDuration: "Exam duration in minutes (optional, leave blank for no time limit)",
    examDurationPh: "e.g. 30",
    examPublishAt: "Exam publish date & time (optional)",
    examAvailableDays: "Available for (days)",
    examAvailableDaysPh: "e.g. 1",
    examScheduleNote: "Leave both fields blank to keep the exam always available with no publish or close date.",
    examStatusUpcomingAt: (d) => `Will appear to students on: ${d}`,
    examStatusClosedAt: (d) => `Closed on: ${d}`,
    examStatusPublishedAt: (d) => `Published on: ${d}`,
    examStatusClosesAt: (d) => `Closes on: ${d}`,
    examWindowClosedMsg: "The time window to take this exam has ended.",
    examClosedBadge: "Closed",
    examTimeLeft: (mmss) => `Time left: ${mmss}`,
    examTimeUp: "Time's up! The exam was locked and submitted automatically.",
    qkMcq: "Multiple choice (a,b,c)",
    qkTrueFalse: "True / False",
    qkEssay: "Essay",
    qkFillBlank: "Fill in the blank",
    qkMatching: "Matching",
    fillBlankTextHint: "Write the passage or sentences, and put ___ (three underscores) where each blank goes. You can put each sentence on its own line, like a regular worksheet.",
    wordBankLabel: "Word bank",
    wordBankEmpty: "All words have been placed",
    fillBlankTextPh: "The sun ___ in the east and the sky is ___",
    blanksAnswersLabel: "Blank answers, in order",
    blankWordPh: "Correct word",
    addBlank: "Add blank",
    matchLeftPh: "Left column",
    matchRightPh: "Right column",
    addPair: "Add pair",
    trueLabel: "True",
    falseLabel: "False",
    essayHint: "The student writes freely; this isn't auto-graded — review it yourself.",
    essayAnswerPh: "Write your answer here...",
    matchPick: "Choose...",
    fillBlankHint: "Tap a word below, then tap the blank to place it",
    examEssayNote: (n) => `${n} essay question(s) need teacher review and aren't included in this score.`,
    examAntiCheatNote: "If you switch tabs or apps during the exam, it will lock and submit automatically.",
    studyingWell: "Studying well",
    needsFollowup: "Needs follow-up",
    notStudied: "Hasn't started",
    ofLessons: (done, total, pct) => `${done} of ${total} lessons (${pct}%)`,
    lastStudy: (date) => `Last studied: ${date}`,
    addStudentsFirst: "Add students first so you can track their progress.",
    welcome: (name) => `Welcome, ${name}`,
    completed: (done, total) => `${done} of ${total} completed`,
    noLessonsYet: "Your teacher hasn't added lessons yet.",
    openLesson: "Open lesson",
    studiedOn: (date) => `Studied on ${date}`,
    loading: "Loading...",
  },
  fr: {
    brand: BRAND,
    teacherLink: "Professeur",
    studentSubtitle: "Entrez le nom d'utilisateur et le mot de passe donnés par votre professeur",
    username: "Nom d'utilisateur",
    password: "Mot de passe",
    wrongLogin: "Nom d'utilisateur ou mot de passe incorrect",
    newStudentLink: "Nouvel étudiant ? Inscrivez-vous ici",
    registerSubtitle: "Inscrivez vos informations — votre professeur doit vous approuver avant de pouvoir vous connecter",
    registerSentSub: "Votre demande a été envoyée ! Attendez l'approbation de votre professeur — il vous donnera un nom d'utilisateur et un mot de passe.",
    familyName: "Nom de famille",
    phone: "Numéro de téléphone",
    emailOptional: "E-mail (optionnel)",
    chooseClassOpt: "Choisir une classe",
    sendRegistration: "Envoyer",
    backToLogin: "Retour à la connexion",
    pendingApprovalTitle: (n) => `Demandes d'inscription en attente (${n})`,
    approve: "Approuver",
    myInfoTitle: "Mes informations",
    myInfoSaved: "Vos informations ont été enregistrées",
    changeMyPassword: "Changer le mot de passe",
    newPasswordLabel: "Nouveau mot de passe",
    newPasswordPh: "Saisissez un nouveau mot de passe",
    login: "Connexion",
    back: "Retour",
    logout: "Déconnexion",
    teacherLogin: "Connexion Professeur",
    defaultPasswordNote: (p) => `Mot de passe par défaut : ${p}`,
    wrongPassword: "Mot de passe incorrect",
    teacherDashboard: "Tableau de bord",
    tabDashboard: "Accueil",
    dashTotalStudents: "Total des élèves",
    dashTotalLessons: "Total des cours",
    dashAvgProgress: "Progression moyenne",
    dashTopStudents: "Meilleurs élèves",
    dashRecentLessons: "Derniers cours ajoutés",
    dashNoData: "Pas encore assez de données.",
    tabClasses: "Classes",
    className: "Nom de la classe",
    classNamePh: "ex : 1ère année",
    addClass: "Ajouter une classe",
    noClasses: "Aucune classe pour l'instant. Ajoutez-en une ci-dessus.",
    studentsInClass: (n) => `${n} élève(s)`,
    classStudentsTitle: "Élèves de cette classe",
    classLessonsTitle: "Cours assignés à cette classe",
    classExamsTitle: "Examens assignés à cette classe",
    noneAddedYet: "Rien d'ajouté pour l'instant.",
    assignClass: "Classe",
    noClassOpt: "Aucune classe",
    deleteClassConfirm: "Supprimer cette classe ? Ses élèves n'auront plus de classe.",
    tabStudents: "Élèves",
    tabLessons: "Cours",
    tabExams: "Examens",
    tabAssignments: "Devoirs",
    tabProgress: "Suivi",
    tabLoginLog: "Journal des connexions",
    loginLogTotal: "Total des connexions",
    loginLogEmpty: "Personne ne s'est encore connecté.",
    loginLogUnknownCountry: "Inconnu",
    deviceMobile: "Mobile",
    deviceWeb: "Web",
    tabSettings: "Paramètres",
    changePassword: "Changer le mot de passe",
    backupTitle: "Sauvegarde des données",
    backupHint: "Téléchargez un fichier contenant toutes les données actuelles de la plateforme (élèves, cours, examens, devoirs, notes) comme sauvegarde sur votre ordinateur.",
    backupButton: "Télécharger la sauvegarde",
    save: "Enregistrer",
    saved: "Enregistré",
    studentName: "Nom de l'élève",
    studentNamePh: "ex : Ahmed Mohamed",
    chooseUsername: "Nom d'utilisateur",
    usernamePh: "ex : ahmed123",
    generatePass: "Générer un mot de passe",
    add: "Ajouter",
    noStudents: "Aucun élève pour l'instant. Ajoutez-en un ci-dessus.",
    copyCreds: "Copier les identifiants",
    copied: "Copié !",
    editStudent: "Modifier l'élève",
    saveChanges: "Enregistrer les modifications",
    blockStudent: "Bloquer l'élève",
    unblockStudent: "Débloquer",
    blockedLabel: "Bloqué",
    blockConfirm: "Bloquer cet élève ? Il ne pourra plus se connecter tant que vous ne le débloquez pas.",
    editLesson: "Modifier",
    richFontFamily: "Police",
    richFontSize: "Taille",
    richBold: "Gras",
    richUnderline: "Souligné",
    richSizeSmall: "Petit",
    richSizeNormal: "Normal",
    richSizeMedium: "Moyen",
    richSizeLarge: "Grand",
    richSizeXLarge: "Très grand",
    lessonTitle: "Titre du cours",
    lessonTitlePh: "ex : Unité 1 - Équations",
    category: "Catégorie / Unité",
    categoryPh: "ex : Chapitre 1",
    lessonUrl: "Lien du cours (YouTube, Google Drive, ou autre)",
    lessonUrlPh: "https://youtube.com/... ou https://drive.google.com/...",
    lessonDesc: "Description courte (optionnel)",
    lessonDescPh: "Résumé bref du cours",
    addLesson: "Ajouter le cours",
    noLessons: "Aucun cours ajouté pour l'instant.",
    noCategory: "Sans catégorie",
    typeVideo: "Vidéo",
    typePdf: "PDF",
    typePpt: "PowerPoint",
    typeWord: "Word",
    typeText: "Cours écrit",
    typeExam: "Examen",
    typeAssignment: "Devoir",
    addExam: "Ajouter un examen",
    noExams: "Aucun examen ajouté pour l'instant.",
    examFormatLabel: "Format de l'examen",
    examFormatBuilder: "Questions interactives",
    examFormatPdf: "Fichier PDF",
    examFormatWord: "Fichier Word",
    examTitle: "Titre de l'examen",
    examTitlePh: "ex : Examen de l'unité 1",
    examFileUrl: "Fichier de l'examen",
    examFileUrlPh: "https://...",
    examFileNote: "L'élève ouvrira ce fichier, pourra le télécharger, y écrire ses réponses et le remettre à l'enseignant en dehors du système.",
    lessonPdfUrl: "Lien du PDF (Google Drive)",
    lessonPdfUrlPh: "https://drive.google.com/...",
    lessonPptUrl: "Fichier PowerPoint",
    lessonPptUrlPh: "https://...",
    lessonWordUrl: "Fichier Word",
    lessonWordUrlPh: "https://...",
    allowDownloadLabel: "Autoriser l'étudiant à télécharger ce fichier",
    downloadFile: "Télécharger le fichier",
    viewFullscreen: "Plein écran (F)",
    closeFullscreen: "Fermer",
    tryIt: "Essayer ce cours",
    tryItPreviewNote: "Aperçu — c'est exactement ce que l'étudiant verra",
    lessonContent: "Contenu du cours",
    lessonContentPh: "Écrivez le contenu du cours ici...",
    examQuestions: "Questions de l'examen",
    addQuestion: "Ajouter une question",
    questionText: "Texte de la question",
    questionTextPh: "Écrivez la question ici",
    optionText: (n) => `Choix ${n}`,
    addOption: "Ajouter un choix",
    markCorrect: "Bonne réponse",
    removeQuestion: "Supprimer la question",
    difficultyLabel: "Niveau de difficulté :",
    difficultyStrong: "Fort",
    difficultyMedium: "Moyen",
    difficultyWeak: "Faible",
    needAtLeastOneQuestion: "Ajoutez au moins une question avant d'enregistrer l'examen.",
    questionsCount: (n) => `${n} question(s)`,
    submitExam: "Soumettre l'examen",
    examAlreadySubmitted: "Vous avez déjà soumis cet examen",
    examYourScore: (correct, total) => `Votre score : ${correct} sur ${total} correctes`,
    examAwaitingGrading: "Examen soumis. Votre score s'affichera après correction par l'enseignant.",
    gradeExam: "Corriger l'examen",
    backToExam: "Retour à l'examen",
    noSubmissionsYet: "Personne n'a encore soumis cet examen.",
    finalScoreLabel: (correct, total) => `Score : ${correct} sur ${total}`,
    releaseGrade: "Valider et publier la note",
    gradeReleased: "Note publiée pour l'élève",
    yourAnswerLabel: "Réponse de l'élève :",
    markCorrectLabel: "Correct",
    essaySubmittedLabel: "Réponse ouverte",
    resetExam: "Autoriser à repasser",
    resetExamConfirm: "Autoriser cet élève à repasser l'examen ? Ses réponses actuelles seront effacées.",
    examResetNote: "Votre enseignant vous a autorisé à repasser cet examen.",
    examPickAnswer: "Choisissez une réponse à chaque question avant de soumettre.",
    examConfirmSubmit: "Sûr de vouloir soumettre ? Vous ne pourrez plus modifier vos réponses après.",
    uploadFile: "Importer une vidéo ou un PDF",
    uploading: (pct) => `Envoi... ${pct}%`,
    uploadError: "Échec de l'envoi, réessayez",
    uploadNotConfigured: "L'envoi n'est pas encore configuré, utilisez un lien pour l'instant",
    fileUploaded: "Envoyé avec succès",
    orLink: "Ou collez un lien à la place (YouTube, Drive, etc.)",
    openPdf: "Ouvrir le PDF",
    fileReady: (name) => `Importé : ${name}`,
    visibleToAll: "Visible par tous les élèves",
    visibleToSome: (n) => `Visible par ${n} élève(s) sélectionné(s)`,
    whoCanSee: "Qui peut voir ce cours ?",
    allStudentsOpt: "Tous les élèves",
    noStudentsToPick: "Ajoutez des élèves d'abord pour choisir qui voit ce cours.",
    specificClasses: "Classes spécifiques",
    specificStudents: "Élèves spécifiques (en plus des classes)",
    noClassesYet: "Aucune classe pour l'instant. Choisissez des élèves par nom à la place.",
    visibleToClasses: (n) => `${n} classe(s)`,
    showStudents: "Voir les élèves",
    studentsWithoutClass: "Élèves sans classe",
    examDuration: "Durée de l'examen en minutes (optionnel, laissez vide pour aucune limite)",
    examDurationPh: "ex : 30",
    examPublishAt: "Date et heure de publication de l'examen (optionnel)",
    examAvailableDays: "Disponible pendant (jours)",
    examAvailableDaysPh: "ex : 1",
    examScheduleNote: "Laissez les deux champs vides pour que l'examen reste toujours disponible, sans date de publication ni de clôture.",
    examStatusUpcomingAt: (d) => `Apparaîtra aux élèves le : ${d}`,
    examStatusClosedAt: (d) => `Clôturé le : ${d}`,
    examStatusPublishedAt: (d) => `Publié le : ${d}`,
    examStatusClosesAt: (d) => `Se clôture le : ${d}`,
    examWindowClosedMsg: "La période disponible pour passer cet examen est terminée.",
    examClosedBadge: "Clôturé",
    examTimeLeft: (mmss) => `Temps restant : ${mmss}`,
    examTimeUp: "Temps écoulé ! L'examen a été verrouillé et soumis automatiquement.",
    qkMcq: "Choix multiple (a,b,c)",
    qkTrueFalse: "Vrai / Faux",
    qkEssay: "Question ouverte",
    qkFillBlank: "Texte à trous",
    qkMatching: "Association",
    fillBlankTextHint: "Écrivez le texte ou les phrases, et mettez ___ (trois tirets bas) à la place de chaque trou. Vous pouvez mettre chaque phrase sur sa propre ligne, comme une fiche d'exercice.",
    wordBankLabel: "Banque de mots",
    wordBankEmpty: "Tous les mots ont été placés",
    fillBlankTextPh: "Le soleil se lève à l'___ et le ciel est ___",
    blanksAnswersLabel: "Réponses des trous, dans l'ordre",
    blankWordPh: "Mot correct",
    addBlank: "Ajouter un trou",
    matchLeftPh: "Colonne gauche",
    matchRightPh: "Colonne droite",
    addPair: "Ajouter une paire",
    trueLabel: "Vrai",
    falseLabel: "Faux",
    essayHint: "L'étudiant répond librement ; non noté automatiquement — à corriger vous-même.",
    essayAnswerPh: "Écrivez votre réponse ici...",
    matchPick: "Choisir...",
    fillBlankHint: "Touchez un mot ci-dessous, puis touchez le trou pour le placer",
    examEssayNote: (n) => `${n} question(s) ouverte(s) à corriger par l'enseignant, non incluses dans cette note.`,
    examAntiCheatNote: "Si vous changez d'onglet ou d'application pendant l'examen, il se verrouille et se soumet automatiquement.",
    studyingWell: "Étudie bien",
    needsFollowup: "À suivre",
    notStudied: "Pas encore commencé",
    ofLessons: (done, total, pct) => `${done} sur ${total} cours (${pct}%)`,
    lastStudy: (date) => `Dernière étude : ${date}`,
    addStudentsFirst: "Ajoutez des élèves d'abord pour suivre leur progression.",
    welcome: (name) => `Bienvenue, ${name}`,
    completed: (done, total) => `${done} sur ${total} terminés`,
    noLessonsYet: "Votre professeur n'a pas encore ajouté de cours.",
    openLesson: "Ouvrir le cours",
    studiedOn: (date) => `Étudié le ${date}`,
    loading: "Chargement...",
  },
};

/* ---------- shared visual primitives (cinematic theme) ---------- */

function ChalkButton({ children, onClick, variant = "solid", color = COLORS.chalk, style = {}, type = "button", disabled }) {
  const [hover, setHover] = useState(false);
  const base = {
    fontFamily: "Cairo, sans-serif",
    fontWeight: 700,
    fontSize: 16,
    padding: "12px 24px",
    borderRadius: 999,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease",
    border: `1.5px solid ${color}`,
    background: variant === "solid" ? (hover ? color : `${color}14`) : hover ? `${color}22` : "transparent",
    color: variant === "solid" ? (hover ? "#0B0F14" : color) : color,
    opacity: disabled ? 0.5 : 1,
    transform: hover && !disabled ? "translateY(-1px)" : "translateY(0)",
    boxShadow: hover && !disabled ? `0 4px 20px ${color}55` : "none",
    ...style,
  };
  return (
    <button type={type} disabled={disabled} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={onClick} style={base}>
      {children}
    </button>
  );
}

function ChalkInput({ label, icon, dir, ...props }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "Cairo, sans-serif" }}>
      {label && <span style={{ color: COLORS.chalkDim, fontSize: 14.5, fontWeight: 600 }}>{label}</span>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid rgba(201,162,39,0.3)`, borderRadius: 14, padding: "12px 16px", background: "rgba(255,255,255,0.035)" }}>
        {icon}
        <input {...props} dir={dir} style={{ background: "transparent", border: "none", outline: "none", color: COLORS.chalk, fontFamily: "Cairo, sans-serif", fontSize: 16, width: "100%" }} />
      </div>
    </label>
  );
}

function Board({ lang, children }) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  return (
    <div
      dir={dir}
      style={{
        minHeight: "100vh",
        width: "100%",
        background: `
          radial-gradient(ellipse 900px 500px at 50% -10%, rgba(232,180,75,0.16), transparent 60%),
          radial-gradient(ellipse 1200px 800px at 50% 110%, rgba(79,209,197,0.08), transparent 60%),
          linear-gradient(180deg, ${COLORS.board} 0%, ${COLORS.boardDark} 100%)
        `,
        boxSizing: "border-box",
        padding: "clamp(14px,4vw,28px) clamp(8px,3vw,16px) 50px",
        fontFamily: "Cairo, sans-serif",
        position: "relative",
      }}
    >
      <style>{`${FONT_IMPORT}
        * { box-sizing: border-box; }
        input:focus { outline: none; }
        body { margin: 0; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-icon { animation: spin 0.9s linear infinite; }
        [data-placeholder]:empty:before { content: attr(data-placeholder); color: ${COLORS.chalkDim}; pointer-events: none; }
      `}</style>
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          border: `2px solid ${COLORS.frame}`,
          borderRadius: 24,
          boxShadow: `0 0 0 1px rgba(0,0,0,0.6), 0 0 50px rgba(201,162,39,0.16), 0 30px 60px rgba(0,0,0,0.6)`,
          padding: "clamp(24px,5vw,40px) clamp(20px,4vw,34px) clamp(30px,5vw,46px)",
          background: `linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.2))`,
          backdropFilter: "blur(2px)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function LangToggle({ lang, setLang }) {
  const langs = ["en", "ar", "fr"];
  return (
    <div style={{ display: "flex", border: `1px solid rgba(201,162,39,0.4)`, borderRadius: 20, overflow: "hidden" }}>
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={{
            background: lang === l ? COLORS.frame : "transparent",
            color: lang === l ? "#0B0F14" : COLORS.chalkDim,
            border: "none",
            padding: "5px 10px",
            fontFamily: "Cairo, sans-serif",
            fontSize: 12.5,
            fontWeight: 800,
            cursor: "pointer",
            letterSpacing: 0.5,
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Title({ lang, children, sub }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 26 }}>
      <h1
        style={{
          fontFamily: lang === "ar" ? "'Aref Ruqaa', serif" : "'Playfair Display', serif",
          color: COLORS.chalk,
          fontSize: "clamp(28px, 8vw, 44px)",
          margin: 0,
          fontWeight: 800,
          letterSpacing: lang === "ar" ? 0 : 1,
          textShadow: `0 0 24px rgba(232,180,75,0.35), 0 0 60px rgba(232,180,75,0.15)`,
        }}
      >
        {children}
      </h1>
      {sub && <p style={{ color: COLORS.chalkDim, marginTop: 10, fontSize: 16 }}>{sub}</p>}
    </div>
  );
}

function TopBar({ back, label, lang, setLang }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      {back ? (
        <button onClick={back} style={{ background: "none", border: "none", color: COLORS.chalkDim, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "Cairo, sans-serif", fontSize: 15 }}>
          <ArrowRight size={16} style={{ transform: lang === "en" || lang === "fr" ? "scaleX(-1)" : "none" }} /> {label}
        </button>
      ) : (
        <span />
      )}
      <LangToggle lang={lang} setLang={setLang} />
    </div>
  );
}

const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid rgba(201,162,39,0.2)`, borderRadius: 16, padding: "14px 16px", background: "rgba(255,255,255,0.025)", transition: "background 0.15s ease, border-color 0.15s ease" };
const iconBtnStyle = { background: "rgba(255,255,255,0.04)", border: "none", borderRadius: 10, cursor: "pointer", padding: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" };

function EmptyNote({ text, title, icon }) {
  return (
    <div style={{ textAlign: "center", color: COLORS.chalkDim, padding: "40px 16px", border: `1px solid rgba(201,162,39,0.18)`, borderRadius: 18, background: "rgba(255,255,255,0.015)" }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "rgba(232,180,75,0.1)",
          border: `1px solid rgba(201,162,39,0.3)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px",
          color: COLORS.chalkYellow,
        }}
      >
        {icon || <ClipboardList size={22} />}
      </div>
      {title && <div style={{ color: COLORS.chalk, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{title}</div>}
      <div style={{ fontSize: 14.5 }}>{text}</div>
    </div>
  );
}

/* ---------- admin ---------- */

function AdminLogin({ back, onSuccess, adminPass, lang, setLang }) {
  const t = T[lang];
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (pass === adminPass) { recordLoginEvent("teacher", ""); onSuccess(); }
    else setErr(t.wrongPassword);
  };
  return (
    <Board lang={lang}>
      <TopBar back={back} label={t.back} lang={lang} setLang={setLang} />
      <Title lang={lang}>
        {t.teacherLogin}
      </Title>
      <form onSubmit={submit} style={{ maxWidth: 320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <ChalkInput label={t.password} icon={<Lock size={16} color={COLORS.chalkDim} />} type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus />
        {err && <div style={{ color: COLORS.chalkPink, fontSize: 14 }}>{err}</div>}
        <ChalkButton type="submit" color={COLORS.chalkYellow} style={{ justifyContent: "center" }}>
          {t.login}
        </ChalkButton>
      </form>
    </Board>
  );
}

function MobileDrawer({ open, onClose, lang, children }) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const hiddenTransform = dir === "rtl" ? "translateX(100%)" : "translateX(-100%)";
  return createPortal(
    <div dir={dir} style={{ position: "fixed", inset: 0, zIndex: 9999, visibility: open ? "visible" : "hidden" }}>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          opacity: open ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          insetInlineStart: 0,
          width: "min(78vw, 300px)",
          background: `linear-gradient(180deg, ${COLORS.board} 0%, ${COLORS.boardDark} 100%)`,
          borderInlineEnd: `2px solid ${COLORS.frame}`,
          boxShadow: "0 0 40px rgba(0,0,0,0.6)",
          transform: open ? "translateX(0)" : hiddenTransform,
          transition: "transform 0.28s ease",
          padding: "22px 16px",
          overflowY: "auto",
          fontFamily: "Cairo, sans-serif",
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function AdminDashboard({ back, students, setStudents, lessons, setLessons, classes, setClasses, progress, setProgress, adminPass, setAdminPass, loginLogs, lang, setLang }) {
  const t = T[lang];
  const [tab, setTab] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [pendingEditLessonId, setPendingEditLessonId] = useState(null);
  const [pendingEditExamId, setPendingEditExamId] = useState(null);
  const [pendingEditAssignmentId, setPendingEditAssignmentId] = useState(null);
  const openLessonEditor = (id) => { setTab("lessons"); setPendingEditLessonId(id); };
  const openExamEditor = (id) => { setTab("exams"); setPendingEditExamId(id); };
  const openAssignmentEditor = (id) => { setTab("assignments"); setPendingEditAssignmentId(id); };

  // Pending-review counts, split by lesson type so the Exams and Assignments tabs get
  // their own badge instead of sharing one number.
  const pendingReviewCount = useMemo(() => {
    let count = 0;
    students.forEach((s) => {
      const mine = progress[s.id];
      if (!mine) return;
      Object.entries(mine).forEach(([lessonId, entry]) => {
        const lesson = lessons.find((l) => l.id === lessonId);
        if (lesson && lesson.type === "exam" && entry && entry.examScore && !entry.examReleased) count++;
      });
    });
    return count;
  }, [students, progress, lessons]);
  const pendingAssignmentReviewCount = useMemo(() => {
    let count = 0;
    students.forEach((s) => {
      const mine = progress[s.id];
      if (!mine) return;
      Object.entries(mine).forEach(([lessonId, entry]) => {
        const lesson = lessons.find((l) => l.id === lessonId);
        if (lesson && lesson.type === "assignment" && entry && entry.examScore && !entry.examReleased) count++;
      });
    });
    return count;
  }, [students, progress, lessons]);

  const tabs = [
    { id: "dashboard", label: t.tabDashboard, icon: <LayoutDashboard size={16} /> },
    { id: "classes", label: t.tabClasses, icon: <GraduationCap size={16} /> },
    { id: "students", label: t.tabStudents, icon: <Users size={16} /> },
    { id: "lessons", label: t.tabLessons, icon: <BookOpen size={16} /> },
    { id: "exams", label: t.tabExams, icon: <ListChecks size={16} />, badge: pendingReviewCount },
    { id: "assignments", label: t.tabAssignments, icon: <ClipboardCheck size={16} />, badge: pendingAssignmentReviewCount },
    { id: "progress", label: t.tabProgress, icon: <ClipboardList size={16} /> },
    { id: "loginLog", label: t.tabLoginLog, icon: <History size={16} /> },
    { id: "settings", label: t.tabSettings, icon: <Settings size={16} /> },
  ];
  const currentTab = tabs.find((tb) => tb.id === tab);

  const navButtonStyle = (id) => ({
    background: tab === id ? "rgba(232,180,75,0.14)" : "transparent",
    border: tab === id ? `1px solid rgba(201,162,39,0.4)` : "1px solid transparent",
    cursor: "pointer",
    color: tab === id ? COLORS.chalkYellow : COLORS.chalkDim,
    fontFamily: "Cairo, sans-serif",
    fontWeight: 700,
    fontSize: 15.5,
    padding: "11px 14px",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    textAlign: "start",
    justifyContent: "flex-start",
    transition: "background 0.15s ease, border-color 0.15s ease",
  });

  const renderNavButtons = (afterClick) =>
    tabs.map((tb) => (
      <button key={tb.id} onClick={() => { setTab(tb.id); afterClick && afterClick(); }} style={navButtonStyle(tb.id)}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: tab === tb.id ? "rgba(232,180,75,0.22)" : "rgba(255,255,255,0.04)",
            flex: "0 0 auto",
          }}
        >
          {tb.icon}
        </span>
        <span style={{ flex: 1 }}>{tb.label}</span>
        {!!tb.badge && (
          <span
            style={{
              background: COLORS.chalkPink,
              color: "#fff",
              borderRadius: 999,
              minWidth: 20,
              height: 20,
              padding: "0 6px",
              fontSize: 12,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 auto",
            }}
          >
            {tb.badge}
          </span>
        )}
      </button>
    ));

  return (
    <Board lang={lang}>
      <TopBar back={back} label={t.logout} lang={lang} setLang={setLang} />
      <Title lang={lang}>{t.teacherDashboard}</Title>
      <style>{`
        .admin-layout { display: flex; gap: 24px; align-items: flex-start; }
        .admin-sidebar { display: flex; flex-direction: column; gap: 4px; flex: 0 0 190px; min-width: 190px; }
        .admin-content { flex: 1; min-width: 0; }
        .admin-hamburger { display: none; }
        @media (max-width: 680px) {
          .admin-sidebar { display: none; }
          .admin-hamburger { display: flex; }
        }
      `}</style>
      <button
        className="admin-hamburger"
        onClick={() => setNavOpen(true)}
        style={{
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(255,255,255,0.03)",
          border: `1px solid rgba(201,162,39,0.35)`,
          borderRadius: 14,
          padding: "12px 16px",
          color: COLORS.chalkYellow,
          fontFamily: "Cairo, sans-serif",
          fontWeight: 700,
          fontSize: 16,
          cursor: "pointer",
          marginBottom: 14,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {currentTab?.icon} {currentTab?.label}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {pendingReviewCount + pendingAssignmentReviewCount > 0 && (
            <span
              style={{
                background: COLORS.chalkPink,
                color: "#fff",
                borderRadius: 999,
                minWidth: 20,
                height: 20,
                padding: "0 6px",
                fontSize: 12,
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {pendingReviewCount + pendingAssignmentReviewCount}
            </span>
          )}
          <Menu size={18} />
        </span>
      </button>
      <div className="admin-layout">
        <nav className="admin-sidebar">{renderNavButtons()}</nav>
        <div className="admin-content">
          {tab === "dashboard" && <DashboardTab t={t} lang={lang} students={students} lessons={lessons} progress={progress} pendingReviewCount={pendingReviewCount} pendingAssignmentReviewCount={pendingAssignmentReviewCount} goTo={setTab} />}
          {tab === "classes" && <ClassesTab t={t} lang={lang} classes={classes} setClasses={setClasses} students={students} lessons={lessons} onOpenLesson={openLessonEditor} onOpenExam={openExamEditor} />}
          {tab === "students" && <StudentsTab t={t} students={students} setStudents={setStudents} classes={classes} />}
          {tab === "lessons" && <LessonsTab t={t} lessons={lessons} setLessons={setLessons} students={students} classes={classes} externalEditId={pendingEditLessonId} onExternalEditHandled={() => setPendingEditLessonId(null)} />}
          {tab === "exams" && <ExamsTab kind="exam" t={t} lang={lang} lessons={lessons} setLessons={setLessons} students={students} classes={classes} progress={progress} setProgress={setProgress} externalEditId={pendingEditExamId} onExternalEditHandled={() => setPendingEditExamId(null)} />}
          {tab === "assignments" && <ExamsTab kind="assignment" t={withAssignmentLabels(t, lang)} lang={lang} lessons={lessons} setLessons={setLessons} students={students} classes={classes} progress={progress} setProgress={setProgress} externalEditId={pendingEditAssignmentId} onExternalEditHandled={() => setPendingEditAssignmentId(null)} />}
          {tab === "progress" && <ProgressTab t={t} lang={lang} students={students} lessons={lessons} progress={progress} />}
          {tab === "loginLog" && <LoginLogTab t={t} lang={lang} loginLogs={loginLogs} />}
          {tab === "settings" && <SettingsTab t={t} adminPass={adminPass} setAdminPass={setAdminPass} students={students} lessons={lessons} classes={classes} progress={progress} />}
        </div>
      </div>

      <MobileDrawer open={navOpen} onClose={() => setNavOpen(false)} lang={lang}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ color: COLORS.chalkYellow, fontWeight: 800, fontSize: 18, fontFamily: "'Playfair Display', serif" }}>{t.brand}</span>
          <button onClick={() => setNavOpen(false)} style={iconBtnStyle}>
            <X size={20} color={COLORS.chalkDim} />
          </button>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>{renderNavButtons(() => setNavOpen(false))}</nav>
      </MobileDrawer>
    </Board>
  );
}

function StatCard({ icon, value, label, color }) {
  return (
    <div
      style={{
        flex: "1 1 150px",
        border: `1px solid rgba(201,162,39,0.22)`,
        borderRadius: 18,
        padding: "18px 18px",
        background: "rgba(255,255,255,0.02)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 14,
          insetInlineEnd: 14,
          width: 38,
          height: 38,
          borderRadius: 11,
          background: `${color}1F`,
          border: `1px solid ${color}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
        }}
      >
        {icon}
      </div>
      <div style={{ color: COLORS.chalk, fontSize: 28, fontWeight: 800 }}>{value}</div>
      <div style={{ color: COLORS.chalkDim, fontSize: 14 }}>{label}</div>
    </div>
  );
}

function DashboardTab({ t, lang, students, lessons, progress, pendingReviewCount, pendingAssignmentReviewCount, goTo }) {
  const examsCount = useMemo(() => lessons.filter((l) => l.type === "exam").length, [lessons]);
  const assignmentsCount = useMemo(() => lessons.filter((l) => l.type === "assignment").length, [lessons]);
  const overallPct = useMemo(() => {
    if (students.length === 0 || lessons.length === 0) return 0;
    const total = students.reduce((sum, s) => {
      const visible = lessons.filter((l) => lessonVisibleToStudent(l, s));
      return sum + studentStats(s.id, visible, progress).pct;
    }, 0);
    return Math.round(total / students.length);
  }, [students, lessons, progress]);

  const topStudents = useMemo(() => {
    return students
      .map((s) => {
        const visible = lessons.filter((l) => lessonVisibleToStudent(l, s));
        return { ...s, stats: studentStats(s.id, visible, progress) };
      })
      .sort((a, b) => b.stats.pct - a.stats.pct)
      .slice(0, 3);
  }, [students, lessons, progress]);

  const recentLessons = useMemo(() => {
    return [...lessons].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 3);
  }, [lessons]);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 26 }}>
        <StatCard icon={<Users size={18} />} value={students.length} label={t.dashTotalStudents} color={COLORS.chalkBlue} />
        <StatCard icon={<BookOpen size={18} />} value={lessons.length} label={t.dashTotalLessons} color={COLORS.chalkYellow} />
        <div style={{ cursor: "pointer", position: "relative" }} onClick={() => goTo && goTo("exams")}>
          <StatCard icon={<ListChecks size={18} />} value={examsCount} label={t.tabExams} color={COLORS.chalkBlue} />
          {pendingReviewCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -6,
                insetInlineEnd: -6,
                background: COLORS.chalkPink,
                color: "#fff",
                borderRadius: 999,
                minWidth: 20,
                height: 20,
                padding: "0 6px",
                fontSize: 12,
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {pendingReviewCount}
            </span>
          )}
        </div>
        <div style={{ cursor: "pointer", position: "relative" }} onClick={() => goTo && goTo("assignments")}>
          <StatCard icon={<ClipboardCheck size={18} />} value={assignmentsCount} label={t.tabAssignments} color={COLORS.chalkGreen} />
          {pendingAssignmentReviewCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -6,
                insetInlineEnd: -6,
                background: COLORS.chalkPink,
                color: "#fff",
                borderRadius: 999,
                minWidth: 20,
                height: 20,
                padding: "0 6px",
                fontSize: 12,
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {pendingAssignmentReviewCount}
            </span>
          )}
        </div>
        <StatCard icon={<TrendingUp size={18} />} value={`${overallPct}%`} label={t.dashAvgProgress} color={COLORS.chalkPink} />
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.chalkBlue, fontWeight: 800, fontSize: 16, marginBottom: 10 }}>
            <Award size={16} /> {t.dashTopStudents}
          </div>
          {topStudents.length === 0 ? (
            <EmptyNote text={t.dashNoData} icon={<Award size={22} />} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topStudents.map((s, i) => (
                <div key={s.id} style={{ ...rowStyle, cursor: "pointer" }} onClick={() => goTo && goTo("progress")}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: COLORS.chalkYellow, fontWeight: 800, fontSize: 16 }}>#{i + 1}</span>
                    <span style={{ color: COLORS.chalk, fontWeight: 700 }}>{s.name}</span>
                  </div>
                  <span style={{ color: COLORS.chalkDim, fontSize: 15 }}>{s.stats.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: "1 1 260px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.chalkBlue, fontWeight: 800, fontSize: 16, marginBottom: 10 }}>
            <Clock size={16} /> {t.dashRecentLessons}
          </div>
          {recentLessons.length === 0 ? (
            <EmptyNote text={t.dashNoData} icon={<Clock size={22} />} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentLessons.map((l) => (
                <div key={l.id} style={{ ...rowStyle, cursor: "pointer" }} onClick={() => goTo && goTo("lessons")}>
                  <div>
                    <div style={{ color: COLORS.chalk, fontWeight: 700 }}>{l.title}</div>
                    <div style={{ color: COLORS.chalkDim, fontSize: 13.5 }}>{l.category}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginLogTab({ t, lang, loginLogs }) {
  const list = loginLogs || [];
  const studentCount = list.filter((l) => l.role === "student").length;
  const teacherCount = list.filter((l) => l.role === "teacher").length;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard icon={<History size={18} />} value={list.length} label={t.loginLogTotal} color={COLORS.chalkBlue} />
        <StatCard icon={<GraduationCap size={18} />} value={studentCount} label={t.tabStudents} color={COLORS.chalkYellow} />
        <StatCard icon={<Lock size={18} />} value={teacherCount} label={t.teacherLogin} color={COLORS.chalkPink} />
      </div>

      {list.length === 0 ? (
        <EmptyNote text={t.loginLogEmpty} icon={<History size={22} />} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((l) => (
            <div key={l.id} style={{ ...rowStyle, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: l.role === "teacher" ? "rgba(229,83,75,0.14)" : "rgba(232,180,75,0.14)",
                    color: l.role === "teacher" ? COLORS.chalkPink : COLORS.chalkYellow,
                    flex: "0 0 auto",
                  }}
                >
                  {l.role === "teacher" ? <Lock size={16} /> : <GraduationCap size={16} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: COLORS.chalk, fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {l.role === "teacher" ? t.teacherLogin : (l.name || "—")}
                  </div>
                  <div style={{ color: COLORS.chalkDim, fontSize: 12.5 }}>{fmtDate(l.at, lang)}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "0 0 auto" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, color: COLORS.chalkDim, fontSize: 13 }}>
                  {l.device === "mobile" ? <Smartphone size={14} /> : <Monitor size={14} />}
                  {l.device === "mobile" ? t.deviceMobile : t.deviceWeb}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, color: COLORS.chalkDim, fontSize: 13 }}>
                  <Globe2 size={14} /> {l.country || t.loginLogUnknownCountry}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab({ t, adminPass, setAdminPass, students, lessons, classes, progress }) {
  const [val, setVal] = useState(adminPass);
  const [saved, setSaved] = useState(false);

  const downloadBackup = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      students: students || [],
      lessons: lessons || [],
      classes: classes || [],
      progress: progress || {},
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hamdi-baccar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 320, margin: "0 auto" }}>
      <ChalkInput label={t.changePassword} icon={<Lock size={16} color={COLORS.chalkDim} />} value={val} onChange={(e) => { setVal(e.target.value); setSaved(false); }} />
      <div style={{ marginTop: 14 }}>
        <ChalkButton color={COLORS.chalkYellow} onClick={() => { if (val.trim()) { setAdminPass(val.trim()); setSaved(true); } }}>
          {t.save}
        </ChalkButton>
        {saved && <span style={{ color: COLORS.chalkBlue, marginRight: 12, marginLeft: 12, fontSize: 14 }}>{t.saved}</span>}
      </div>

      <div style={{ marginTop: 34, paddingTop: 24, borderTop: `1px dashed rgba(201,162,39,0.3)` }}>
        <div style={{ color: COLORS.chalkDim, fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>{t.backupTitle}</div>
        <div style={{ color: COLORS.chalkDim, fontSize: 13, marginBottom: 12 }}>{t.backupHint}</div>
        <ChalkButton variant="outline" color={COLORS.chalkBlue} onClick={downloadBackup}>
          <Upload size={15} style={{ transform: "rotate(180deg)" }} /> {t.backupButton}
        </ChalkButton>
      </div>
    </div>
  );
}

function ClassDetailView({ t, lang, cls, students, lessons, onOpenLesson, onOpenExam, onBack }) {
  const [tab, setTab] = useState("students");
  const classStudents = students.filter((s) => s.classId === cls.id && s.status !== "pending");
  const classLessons = (lessons || []).filter((l) => l.type !== "exam" && l.type !== "assignment" && lessonAssignedToClass(l, cls.id));
  const classExams = (lessons || []).filter((l) => l.type === "exam" && lessonAssignedToClass(l, cls.id));

  const subTabs = [
    { id: "students", label: t.classStudentsTitle, icon: <Users size={15} />, count: classStudents.length },
    { id: "lessons", label: t.classLessonsTitle, icon: <BookOpen size={15} />, count: classLessons.length },
    { id: "exams", label: t.classExamsTitle, icon: <ListChecks size={15} />, count: classExams.length },
  ];

  return (
    <div>
      <button
        onClick={onBack}
        style={{ background: "none", border: "none", color: COLORS.chalkDim, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "Cairo, sans-serif", fontSize: 15, marginBottom: 16, padding: 0 }}
      >
        <ArrowRight size={16} style={{ transform: lang === "en" || lang === "fr" ? "scaleX(-1)" : "none" }} /> {t.tabClasses}
      </button>

      <div
        style={{
          border: `1px solid rgba(201,162,39,0.3)`,
          borderRadius: 18,
          padding: "18px 20px",
          background: "linear-gradient(135deg, rgba(232,180,75,0.08), rgba(255,255,255,0.02))",
          marginBottom: 18,
        }}
      >
        <div style={{ width: 42, height: 4, borderRadius: 4, background: COLORS.chalkYellow, marginBottom: 12 }} />
        <div style={{ color: COLORS.chalk, fontWeight: 800, fontSize: 22 }}>{cls.name}</div>
        <div style={{ color: COLORS.chalkDim, fontSize: 14, marginTop: 4 }}>{t.studentsInClass(classStudents.length)}</div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard icon={<Users size={18} />} value={classStudents.length} label={t.classStudentsTitle} color={COLORS.chalkBlue} />
        <StatCard icon={<BookOpen size={18} />} value={classLessons.length} label={t.classLessonsTitle} color={COLORS.chalkYellow} />
        <StatCard icon={<ListChecks size={18} />} value={classExams.length} label={t.classExamsTitle} color={COLORS.chalkPink} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {subTabs.map((st) => (
          <button
            key={st.id}
            onClick={() => setTab(st.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: tab === st.id ? "rgba(232,180,75,0.16)" : "rgba(255,255,255,0.03)",
              border: tab === st.id ? `1px solid rgba(201,162,39,0.5)` : `1px solid rgba(201,162,39,0.15)`,
              color: tab === st.id ? COLORS.chalkYellow : COLORS.chalkDim,
              borderRadius: 999,
              padding: "9px 16px",
              fontFamily: "Cairo, sans-serif",
              fontWeight: 700,
              fontSize: 14.5,
              cursor: "pointer",
            }}
          >
            {st.icon} {st.label} <span style={{ opacity: 0.7 }}>({st.count})</span>
          </button>
        ))}
      </div>

      {tab === "students" &&
        (classStudents.length === 0 ? (
          <EmptyNote text={t.noneAddedYet} icon={<Users size={22} />} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {classStudents.map((s) => (
              <div key={s.id} style={rowStyle}>
                <span style={{ color: COLORS.chalk, fontWeight: 700 }}>{s.name}</span>
                {s.status === "blocked" && (
                  <span style={{ border: `1px solid ${COLORS.chalkPink}`, color: COLORS.chalkPink, borderRadius: 20, padding: "1px 10px", fontSize: 12, fontWeight: 700 }}>
                    {t.blockedLabel}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}

      {tab === "lessons" &&
        (classLessons.length === 0 ? (
          <EmptyNote text={t.noneAddedYet} icon={<BookOpen size={22} />} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {classLessons.map((l) => (
              <button
                key={l.id}
                onClick={() => onOpenLesson && onOpenLesson(l.id)}
                style={{ ...rowStyle, cursor: "pointer", border: "1px solid rgba(201,162,39,0.2)", width: "100%", textAlign: "start", fontFamily: "Cairo, sans-serif" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.chalk, fontWeight: 700 }}>
                  {lessonTypeIcon(l.type, 15)} {l.title}
                </span>
              </button>
            ))}
          </div>
        ))}

      {tab === "exams" &&
        (classExams.length === 0 ? (
          <EmptyNote text={t.noneAddedYet} icon={<ListChecks size={22} />} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {classExams.map((l) => (
              <button
                key={l.id}
                onClick={() => onOpenExam && onOpenExam(l.id)}
                style={{ ...rowStyle, cursor: "pointer", border: "1px solid rgba(201,162,39,0.2)", width: "100%", textAlign: "start", fontFamily: "Cairo, sans-serif" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.chalk, fontWeight: 700 }}>
                  {lessonTypeIcon("exam", 15)} {l.title}
                </span>
              </button>
            ))}
          </div>
        ))}
    </div>
  );
}

function ClassesTab({ t, lang, classes, setClasses, students, lessons, onOpenLesson, onOpenExam }) {
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setClasses([...classes, { id: uid(), name: name.trim(), createdAt: new Date().toISOString() }]);
    setName("");
  };
  const remove = (id) => {
    if (!window.confirm(t.deleteClassConfirm)) return;
    setClasses(classes.filter((c) => c.id !== id));
  };
  const countFor = (classId) => students.filter((s) => s.classId === classId).length;

  const selected = selectedId ? classes.find((c) => c.id === selectedId) : null;
  if (selected) {
    return (
      <ClassDetailView
        t={t}
        lang={lang}
        cls={selected}
        students={students}
        lessons={lessons}
        onOpenLesson={onOpenLesson}
        onOpenExam={onOpenExam}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div>
      <form onSubmit={add} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22, alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <ChalkInput label={t.className} icon={<GraduationCap size={16} color={COLORS.chalkDim} />} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.classNamePh} />
        </div>
        <ChalkButton type="submit" color={COLORS.chalkYellow}>
          <Plus size={16} /> {t.addClass}
        </ChalkButton>
      </form>

      {classes.length === 0 ? (
        <EmptyNote text={t.noClasses} icon={<GraduationCap size={22} />} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {classes.map((c) => (
            <div key={c.id} style={{ ...rowStyle, cursor: "pointer" }} onClick={() => setSelectedId(c.id)}>
              <div>
                <div style={{ color: COLORS.chalk, fontWeight: 700, fontSize: 16 }}>{c.name}</div>
                <div style={{ color: COLORS.chalkDim, fontSize: 14 }}>{t.studentsInClass(countFor(c.id))}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); remove(c.id); }} style={iconBtnStyle}>
                  <Trash2 size={16} color={COLORS.chalkPink} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PendingStudentRow({ t, s, classNameFor, onApprove, onReject, students }) {
  const [username, setUsername] = useState(() => genUsername(s.name, students));
  const [password, setPassword] = useState(genPassword());

  return (
    <div style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ color: COLORS.chalk, fontWeight: 700, fontSize: 16 }}>{s.name}</div>
          <div style={{ color: COLORS.chalkDim, fontSize: 14 }}>{s.phone} {s.email && `· ${s.email}`}</div>
          {classNameFor(s.classId) && (
            <div style={{ color: COLORS.chalkBlue, fontSize: 13.5, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
              <GraduationCap size={12} /> {classNameFor(s.classId)}
            </div>
          )}
        </div>
        <button onClick={() => onReject(s.id)} style={iconBtnStyle}>
          <Trash2 size={16} color={COLORS.chalkPink} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <ChalkInput label={t.chooseUsername} value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <ChalkInput label={t.password} icon={<Lock size={16} color={COLORS.chalkDim} />} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </div>
        <ChalkButton type="button" variant="outline" color={COLORS.chalkBlue} onClick={() => setPassword(genPassword())}>
          {t.generatePass}
        </ChalkButton>
        <ChalkButton
          type="button"
          color={COLORS.chalkYellow}
          onClick={() => {
            if (!username.trim() || !password.trim()) return;
            onApprove(s.id, username.trim().toLowerCase(), password.trim());
          }}
        >
          <CheckCircle2 size={16} /> {t.approve}
        </ChalkButton>
      </div>
    </div>
  );
}

function ApprovedStudentRow({ t, s, classes, classNameFor, onSave, onSetClass, onToggleBlock, onRemove, onCopy, copied }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(s.name);
  const [username, setUsername] = useState(s.username);
  const [password, setPassword] = useState(s.password);
  const [phone, setPhone] = useState(s.phone || "");
  const [email, setEmail] = useState(s.email || "");
  const blocked = s.status === "blocked";

  const startEdit = () => {
    setName(s.name);
    setUsername(s.username);
    setPassword(s.password);
    setPhone(s.phone || "");
    setEmail(s.email || "");
    setEditing(true);
  };

  const save = () => {
    if (!name.trim() || !username.trim() || !password.trim()) return;
    onSave(s.id, { name: name.trim(), username: username.trim().toLowerCase(), password: password.trim(), phone: phone.trim(), email: email.trim() });
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <ChalkInput label={t.studentName} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <ChalkInput label={t.chooseUsername} value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <ChalkInput label={t.password} icon={<Lock size={16} color={COLORS.chalkDim} />} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <ChalkInput label={t.phone} value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <ChalkInput label={t.emailOptional} value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <ChalkButton type="button" color={COLORS.chalkYellow} onClick={save}>
            <CheckCircle2 size={16} /> {t.saveChanges}
          </ChalkButton>
          <ChalkButton type="button" variant="outline" color={COLORS.chalkDim} onClick={() => setEditing(false)}>
            <X size={15} /> {t.back}
          </ChalkButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...rowStyle, flexWrap: "wrap", gap: 10, opacity: blocked ? 0.6 : 1 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ color: COLORS.chalk, fontWeight: 700, fontSize: 16 }}>{s.name}</div>
          {blocked && (
            <span style={{ border: `1px solid ${COLORS.chalkPink}`, color: COLORS.chalkPink, borderRadius: 20, padding: "1px 10px", fontSize: 12, fontWeight: 700 }}>
              {t.blockedLabel}
            </span>
          )}
        </div>
        <div style={{ color: COLORS.chalkDim, fontSize: 15, direction: "ltr", textAlign: "right" }}>
          {s.username} · {s.password}
        </div>
        {(s.phone || s.email) && (
          <div style={{ color: COLORS.chalkDim, fontSize: 13.5, marginTop: 2, direction: "ltr", textAlign: "right" }}>
            {s.phone} {s.phone && s.email && "·"} {s.email}
          </div>
        )}
        {classNameFor(s.classId) && (
          <div style={{ color: COLORS.chalkBlue, fontSize: 13.5, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            <GraduationCap size={12} /> {classNameFor(s.classId)}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <select
          value={s.classId || ""}
          onChange={(e) => onSetClass(s.id, e.target.value)}
          style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(201,162,39,0.3)`, borderRadius: 8, padding: "6px 8px", color: COLORS.chalkDim, fontFamily: "Cairo, sans-serif", fontSize: 13.5 }}
        >
          <option value="" style={{ color: "#000" }}>{t.noClassOpt}</option>
          {(classes || []).map((c) => (
            <option key={c.id} value={c.id} style={{ color: "#000" }}>{c.name}</option>
          ))}
        </select>
        <button onClick={() => onCopy(s)} style={iconBtnStyle} title={t.copyCreds}>
          {copied ? <Check size={16} color={COLORS.chalkBlue} /> : <Copy size={16} color={COLORS.chalkDim} />}
        </button>
        <button onClick={startEdit} style={iconBtnStyle} title={t.editStudent}>
          <Pencil size={16} color={COLORS.chalkBlue} />
        </button>
        <button onClick={() => onToggleBlock(s.id)} style={iconBtnStyle} title={blocked ? t.unblockStudent : t.blockStudent}>
          {blocked ? <Unlock size={16} color={COLORS.chalkBlue} /> : <Ban size={16} color={COLORS.chalkPink} />}
        </button>
        <button onClick={() => onRemove(s.id)} style={iconBtnStyle}>
          <Trash2 size={16} color={COLORS.chalkPink} />
        </button>
      </div>
    </div>
  );
}

function StudentsTab({ t, students, setStudents, classes }) {
  const [name, setName] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const pending = students.filter((s) => s.status === "pending");
  const approved = students.filter((s) => s.status !== "pending");

  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const username = genUsername(name.trim(), students);
    const password = genPassword();
    setStudents([...students, { id: uid(), name: name.trim(), username, password, phone: "", email: "", classId: null, status: "approved", createdAt: new Date().toISOString() }]);
    setName("");
  };
  const remove = (id) => setStudents(students.filter((s) => s.id !== id));
  const approvePending = (id, uname, pass) =>
    setStudents(students.map((s) => (s.id === id ? { ...s, username: uname, password: pass, status: "approved" } : s)));
  const setStudentClass = (id, cid) => setStudents(students.map((s) => (s.id === id ? { ...s, classId: cid || null } : s)));
  const saveStudent = (id, patch) => setStudents(students.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const toggleBlock = (id) => {
    const s = students.find((x) => x.id === id);
    if (!s) return;
    const nowBlocked = s.status !== "blocked";
    if (nowBlocked && !window.confirm(t.blockConfirm)) return;
    setStudents(students.map((x) => (x.id === id ? { ...x, status: nowBlocked ? "blocked" : "approved" } : x)));
  };
  const classNameFor = (cid) => (classes || []).find((c) => c.id === cid)?.name || null;

  const copyCreds = (s) => {
    const text = `${t.chooseUsername}: ${s.username}\n${t.password}: ${s.password}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(s.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div>
      {pending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: COLORS.chalkYellow, fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{t.pendingApprovalTitle(pending.length)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pending.map((s) => (
              <PendingStudentRow key={s.id} t={t} s={s} classNameFor={classNameFor} onApprove={approvePending} onReject={remove} students={students} />
            ))}
          </div>
        </div>
      )}
      <form onSubmit={add} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22, alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <ChalkInput label={t.studentName} icon={<User size={16} color={COLORS.chalkDim} />} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.studentNamePh} />
        </div>
        <ChalkButton type="submit" color={COLORS.chalkYellow}>
          <Plus size={16} /> {t.add}
        </ChalkButton>
      </form>

      {approved.length === 0 ? (
        <EmptyNote text={t.noStudents} icon={<Users size={22} />} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {approved.map((s) => (
            <ApprovedStudentRow
              key={s.id}
              t={t}
              s={s}
              classes={classes}
              classNameFor={classNameFor}
              onSave={saveStudent}
              onSetClass={setStudentClass}
              onToggleBlock={toggleBlock}
              onRemove={remove}
              onCopy={copyCreds}
              copied={copiedId === s.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonVisibilityPicker({ t, students, classes, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState({});
  const classIds = value?.classIds || [];
  const studentIds = value?.studentIds || [];
  const isAll = classIds.length === 0 && studentIds.length === 0;

  const emit = (nextClassIds, nextStudentIds) => {
    if (nextClassIds.length === 0 && nextStudentIds.length === 0) onChange(null);
    else onChange({ classIds: nextClassIds, studentIds: nextStudentIds });
  };
  const toggleClass = (id) => {
    const next = classIds.includes(id) ? classIds.filter((x) => x !== id) : [...classIds, id];
    // Once a whole class is selected, drop any individually-picked students of that class
    // (they're already covered) to keep the selection state simple and unambiguous.
    const classStudentIds = new Set(students.filter((s) => s.classId === id).map((s) => s.id));
    const nextStudents = next.includes(id) ? studentIds.filter((sid) => !classStudentIds.has(sid)) : studentIds;
    emit(next, nextStudents);
  };
  const toggleStudent = (id) => {
    const next = studentIds.includes(id) ? studentIds.filter((x) => x !== id) : [...studentIds, id];
    emit(classIds, next);
  };
  const toggleExpand = (id) => setExpanded({ ...expanded, [id]: !expanded[id] });

  const summary = isAll
    ? t.visibleToAll
    : [classIds.length ? t.visibleToClasses(classIds.length) : null, studentIds.length ? t.visibleToSome(studentIds.length) : null].filter(Boolean).join(" + ");

  const unassigned = students.filter((s) => !s.classId);

  return (
    <div style={{ border: `1px dashed rgba(201,162,39,0.35)`, borderRadius: 8, padding: 10 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ background: "none", border: "none", cursor: "pointer", color: isAll ? COLORS.chalkBlue : COLORS.chalkYellow, fontFamily: "Cairo, sans-serif", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "space-between" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Users size={14} /> {summary}
        </span>
        <span style={{ fontSize: 12, color: COLORS.chalkDim }}>{t.whoCanSee}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: COLORS.chalk, cursor: "pointer" }}>
            <input type="checkbox" checked={isAll} onChange={() => emit([], [])} />
            {t.allStudentsOpt}
          </label>

          {(classes || []).length === 0 ? (
            <div style={{ color: COLORS.chalkDim, fontSize: 13.5 }}>{t.noClassesYet}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(classes || []).map((c) => {
                const classStudents = students.filter((s) => s.classId === c.id);
                const wholeClassSelected = classIds.includes(c.id);
                const isOpen = !!expanded[c.id];
                return (
                  <div key={c.id} style={{ border: `1px solid rgba(201,162,39,0.2)`, borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, color: COLORS.chalk, fontWeight: 700, cursor: "pointer", flex: 1 }}>
                        <input type="checkbox" checked={wholeClassSelected} onChange={() => toggleClass(c.id)} />
                        <GraduationCap size={14} color={COLORS.chalkBlue} /> {c.name}
                      </label>
                      <button
                        type="button"
                        onClick={() => toggleExpand(c.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.chalkDim, display: "flex", alignItems: "center", padding: 2 }}
                        title={t.showStudents}
                      >
                        <ArrowRight size={14} style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
                      </button>
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: 8, paddingInlineStart: 22, display: "flex", flexDirection: "column", gap: 6 }}>
                        {classStudents.length === 0 ? (
                          <div style={{ color: COLORS.chalkDim, fontSize: 13 }}>{t.noStudentsToPick}</div>
                        ) : (
                          classStudents.map((s) => (
                            <label
                              key={s.id}
                              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: wholeClassSelected ? COLORS.chalkDim : COLORS.chalk, cursor: wholeClassSelected ? "default" : "pointer", opacity: wholeClassSelected ? 0.65 : 1 }}
                            >
                              <input
                                type="checkbox"
                                checked={wholeClassSelected || studentIds.includes(s.id)}
                                disabled={wholeClassSelected}
                                onChange={() => toggleStudent(s.id)}
                              />
                              {s.name}
                            </label>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {unassigned.length > 0 && (
            <div>
              <div style={{ color: COLORS.chalkDim, fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>{t.studentsWithoutClass}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {unassigned.map((s) => (
                  <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: COLORS.chalk, cursor: "pointer" }}>
                    <input type="checkbox" checked={studentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const LESSON_TYPES = [
  { id: "video", icon: <Video size={15} /> },
  { id: "pdf", icon: <FileText size={15} /> },
  { id: "ppt", icon: <FileText size={15} /> },
  { id: "word", icon: <FileText size={15} /> },
  { id: "text", icon: <PenLine size={15} /> },
];
const EXAM_FORMATS = [
  { id: "builder", icon: <ListChecks size={15} /> },
  { id: "pdf", icon: <FileText size={15} /> },
  { id: "word", icon: <FileText size={15} /> },
];
function examFormatLabel(t, format) {
  return { builder: t.examFormatBuilder, pdf: t.examFormatPdf, word: t.examFormatWord }[format || "builder"];
}
const DOWNLOADABLE_TYPES = ["video", "pdf", "ppt", "word"];
function lessonTypeLabel(t, type) {
  return { video: t.typeVideo, pdf: t.typePdf, ppt: t.typePpt, word: t.typeWord, text: t.typeText, exam: t.typeExam, assignment: t.typeAssignment }[type || "video"];
}
function lessonTypeIcon(type, size = 15) {
  const map = { video: <Video size={size} />, pdf: <FileText size={size} />, ppt: <FileText size={size} />, word: <FileText size={size} />, text: <PenLine size={size} />, exam: <ListChecks size={size} />, assignment: <ClipboardCheck size={size} /> };
  return map[type || "video"];
}

// Generic word-substitution so the exact same Exam UI/component can be relabeled as
// "Assignment" wherever it's reused, without hand-duplicating every translation key.
function relabelToAssignment(str, lang) {
  if (typeof str !== "string") return str;
  if (lang === "ar") return str.split("امتحان").join("واجب");
  if (lang === "fr") {
    return str
      .replace(/Examens\b/g, "Devoirs")
      .replace(/examens\b/g, "devoirs")
      .replace(/Examen\b/g, "Devoir")
      .replace(/examen\b/g, "devoir");
  }
  return str
    .replace(/Exams\b/g, "Assignments")
    .replace(/exams\b/g, "assignments")
    .replace(/Exam\b/g, "Assignment")
    .replace(/exam\b/g, "assignment");
}
function withAssignmentLabels(t, lang) {
  const out = {};
  Object.keys(t).forEach((k) => {
    const v = t[k];
    out[k] = typeof v === "function" ? (...args) => relabelToAssignment(v(...args), lang) : relabelToAssignment(v, lang);
  });
  return out;
}

const QUESTION_KINDS = ["mcq", "truefalse", "essay", "fillblank", "matching"];
function questionKindLabel(t, kind) {
  return { mcq: t.qkMcq, truefalse: t.qkTrueFalse, essay: t.qkEssay, fillblank: t.qkFillBlank, matching: t.qkMatching }[kind || "mcq"];
}

const DIFFICULTY_LEVELS = ["strong", "medium", "weak"];
function difficultyLabel(t, level) {
  return { strong: t.difficultyStrong, medium: t.difficultyMedium, weak: t.difficultyWeak }[level || "medium"];
}
function difficultyColor(level) {
  return { strong: COLORS.chalkPink, medium: COLORS.chalkYellow, weak: COLORS.chalkBlue }[level || "medium"];
}

function emptyQuestion(kind = "mcq") {
  const base = { id: uid(), kind, text: "", difficulty: "medium" };
  if (kind === "mcq") {
    return { ...base, options: [{ id: uid(), text: "" }, { id: uid(), text: "" }], correctOptionId: null };
  }
  if (kind === "truefalse") return { ...base, correctAnswer: true };
  if (kind === "essay") return base;
  if (kind === "fillblank") return { ...base, blanks: [""] };
  if (kind === "matching") return { ...base, pairs: [{ id: uid(), left: "", right: "" }, { id: uid(), left: "", right: "" }] };
  return base;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ExamBuilder({ t, questions, setQuestions }) {
  const addQuestion = (kind) => setQuestions([...questions, emptyQuestion(kind)]);
  const removeQuestion = (qid) => setQuestions(questions.filter((q) => q.id !== qid));
  const updateQuestion = (qid, patch) => setQuestions(questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
  const addOption = (qid) => updateQuestion(qid, { options: [...questions.find((q) => q.id === qid).options, { id: uid(), text: "" }] });
  const updateOption = (qid, oid, text) => {
    const q = questions.find((q) => q.id === qid);
    updateQuestion(qid, { options: q.options.map((o) => (o.id === oid ? { ...o, text } : o)) });
  };
  const removeOption = (qid, oid) => {
    const q = questions.find((q) => q.id === qid);
    updateQuestion(qid, {
      options: q.options.filter((o) => o.id !== oid),
      correctOptionId: q.correctOptionId === oid ? null : q.correctOptionId,
    });
  };
  const addBlank = (qid) => updateQuestion(qid, { blanks: [...questions.find((q) => q.id === qid).blanks, ""] });
  const updateBlank = (qid, bi, word) => {
    const q = questions.find((q) => q.id === qid);
    updateQuestion(qid, { blanks: q.blanks.map((b, i) => (i === bi ? word : b)) });
  };
  const removeBlank = (qid, bi) => {
    const q = questions.find((q) => q.id === qid);
    updateQuestion(qid, { blanks: q.blanks.filter((_, i) => i !== bi) });
  };
  const addPair = (qid) => updateQuestion(qid, { pairs: [...questions.find((q) => q.id === qid).pairs, { id: uid(), left: "", right: "" }] });
  const updatePair = (qid, pid, patch) => {
    const q = questions.find((q) => q.id === qid);
    updateQuestion(qid, { pairs: q.pairs.map((p) => (p.id === pid ? { ...p, ...patch } : p)) });
  };
  const removePair = (qid, pid) => {
    const q = questions.find((q) => q.id === qid);
    updateQuestion(qid, { pairs: q.pairs.filter((p) => p.id !== pid) });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ color: COLORS.chalkDim, fontSize: 15, fontWeight: 600 }}>{t.examQuestions}</div>
      {questions.map((q, qi) => {
        const kind = q.kind || "mcq";
        return (
          <div key={q.id} style={{ border: `1px dashed rgba(201,162,39,0.35)`, borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: COLORS.chalkBlue, fontSize: 13, fontWeight: 700 }}>#{qi + 1} · {questionKindLabel(t, kind)}</span>
              <button type="button" onClick={() => removeQuestion(q.id)} style={iconBtnStyle} title={t.removeQuestion}>
                <Trash2 size={16} color={COLORS.chalkPink} />
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: COLORS.chalkDim, fontSize: 13, fontWeight: 600 }}>{t.difficultyLabel}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {DIFFICULTY_LEVELS.map((lvl) => {
                  const active = (q.difficulty || "medium") === lvl;
                  const color = difficultyColor(lvl);
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => updateQuestion(q.id, { difficulty: lvl })}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 20,
                        border: `1.5px solid ${active ? color : "rgba(201,162,39,0.3)"}`,
                        background: active ? `${color}22` : "transparent",
                        color: active ? color : COLORS.chalkDim,
                        cursor: "pointer",
                        fontFamily: "Cairo, sans-serif",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {difficultyLabel(t, lvl)}
                    </button>
                  );
                })}
              </div>
            </div>

            {kind === "fillblank" ? (
              <div>
                <span style={{ color: COLORS.chalkDim, fontSize: 14, fontWeight: 600, display: "block", marginBottom: 4 }}>{t.fillBlankTextHint}</span>
                <textarea
                  value={q.text}
                  onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                  placeholder={t.fillBlankTextPh}
                  rows={3}
                  style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid rgba(201,162,39,0.35)`, borderRadius: 8, padding: "10px 12px", color: COLORS.chalk, fontFamily: "Cairo, sans-serif", fontSize: 15, resize: "vertical" }}
                />
              </div>
            ) : (
              <ChalkInput label={t.questionText} value={q.text} onChange={(e) => updateQuestion(q.id, { text: e.target.value })} placeholder={t.questionTextPh} />
            )}

            {kind === "mcq" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {q.options.map((o, oi) => (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="radio" name={`correct-${q.id}`} checked={q.correctOptionId === o.id} onChange={() => updateQuestion(q.id, { correctOptionId: o.id })} title={t.markCorrect} />
                    <input
                      value={o.text}
                      onChange={(e) => updateOption(q.id, o.id, e.target.value)}
                      placeholder={t.optionText(oi + 1)}
                      style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: `1px solid rgba(201,162,39,0.3)`, borderRadius: 6, padding: "7px 10px", color: COLORS.chalk, fontFamily: "Cairo, sans-serif", fontSize: 15 }}
                    />
                    {q.options.length > 2 && (
                      <button type="button" onClick={() => removeOption(q.id, o.id)} style={iconBtnStyle}>
                        <X size={14} color={COLORS.chalkDim} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addOption(q.id)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: COLORS.chalkBlue, cursor: "pointer", fontSize: 13.5, fontFamily: "Cairo, sans-serif", padding: "4px 0" }}>
                  + {t.addOption}
                </button>
              </div>
            )}

            {kind === "truefalse" && (
              <div style={{ display: "flex", gap: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.chalk, fontSize: 15, cursor: "pointer" }}>
                  <input type="radio" name={`tf-${q.id}`} checked={q.correctAnswer === true} onChange={() => updateQuestion(q.id, { correctAnswer: true })} /> {t.trueLabel}
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.chalk, fontSize: 15, cursor: "pointer" }}>
                  <input type="radio" name={`tf-${q.id}`} checked={q.correctAnswer === false} onChange={() => updateQuestion(q.id, { correctAnswer: false })} /> {t.falseLabel}
                </label>
              </div>
            )}

            {kind === "essay" && <div style={{ color: COLORS.chalkDim, fontSize: 13.5 }}>{t.essayHint}</div>}

            {kind === "fillblank" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ color: COLORS.chalkDim, fontSize: 14, fontWeight: 600 }}>{t.blanksAnswersLabel}</span>
                {q.blanks.map((b, bi) => (
                  <div key={bi} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: COLORS.chalkBlue, fontSize: 13.5, minWidth: 20 }}>{bi + 1}.</span>
                    <input
                      value={b}
                      onChange={(e) => updateBlank(q.id, bi, e.target.value)}
                      placeholder={t.blankWordPh}
                      style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: `1px solid rgba(201,162,39,0.3)`, borderRadius: 6, padding: "7px 10px", color: COLORS.chalk, fontFamily: "Cairo, sans-serif", fontSize: 15 }}
                    />
                    {q.blanks.length > 1 && (
                      <button type="button" onClick={() => removeBlank(q.id, bi)} style={iconBtnStyle}>
                        <X size={14} color={COLORS.chalkDim} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addBlank(q.id)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: COLORS.chalkBlue, cursor: "pointer", fontSize: 13.5, fontFamily: "Cairo, sans-serif", padding: "4px 0" }}>
                  + {t.addBlank}
                </button>
              </div>
            )}

            {kind === "matching" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {q.pairs.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      value={p.left}
                      onChange={(e) => updatePair(q.id, p.id, { left: e.target.value })}
                      placeholder={t.matchLeftPh}
                      style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: `1px solid rgba(201,162,39,0.3)`, borderRadius: 6, padding: "7px 10px", color: COLORS.chalk, fontFamily: "Cairo, sans-serif", fontSize: 15 }}
                    />
                    <ArrowRight size={14} color={COLORS.chalkDim} />
                    <input
                      value={p.right}
                      onChange={(e) => updatePair(q.id, p.id, { right: e.target.value })}
                      placeholder={t.matchRightPh}
                      style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: `1px solid rgba(201,162,39,0.3)`, borderRadius: 6, padding: "7px 10px", color: COLORS.chalk, fontFamily: "Cairo, sans-serif", fontSize: 15 }}
                    />
                    {q.pairs.length > 2 && (
                      <button type="button" onClick={() => removePair(q.id, p.id)} style={iconBtnStyle}>
                        <X size={14} color={COLORS.chalkDim} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addPair(q.id)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: COLORS.chalkBlue, cursor: "pointer", fontSize: 13.5, fontFamily: "Cairo, sans-serif", padding: "4px 0" }}>
                  + {t.addPair}
                </button>
              </div>
            )}
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {QUESTION_KINDS.map((k) => (
          <ChalkButton key={k} type="button" variant="outline" color={COLORS.chalkBlue} onClick={() => addQuestion(k)}>
            <Plus size={14} /> {questionKindLabel(t, k)}
          </ChalkButton>
        ))}
      </div>
    </div>
  );
}

function UploadField({ t, icon, value, onChange, accept, placeholder }) {
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    setPct(0);
    try {
      const url = await uploadToCloudinary(file, setPct);
      onChange(url);
    } catch (err) {
      setError(err.message === "cloudinary-not-configured" ? t.uploadNotConfigured : t.uploadError);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <ChalkButton type="button" variant="outline" color={COLORS.chalkYellow} onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 size={16} className="spin-icon" /> : <Upload size={16} />}
          {uploading ? t.uploading(pct) : t.uploadFile}
        </ChalkButton>
        <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
        {value && !uploading && !error && (
          <div style={{ color: COLORS.chalkBlue, fontSize: 13.5, display: "flex", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={14} /> {t.fileUploaded}
          </div>
        )}
      </div>
      {error && <div style={{ color: COLORS.chalkPink, fontSize: 14 }}>{error}</div>}
      <div style={{ color: COLORS.chalkDim, fontSize: 13 }}>{t.orLink}</div>
      <ChalkInput icon={icon} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir="ltr" />
    </div>
  );
}

const RICH_FONTS = [
  { value: "Cairo, sans-serif", label: "Cairo" },
  { value: "'Aref Ruqaa', serif", label: "Aref Ruqaa" },
  { value: "'Playfair Display', serif", label: "Playfair Display" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Courier New', monospace", label: "Courier New" },
];
// document.execCommand("fontSize", ...) only accepts the legacy 1-7 scale, not px —
// mapped here to friendly size labels for the toolbar dropdown.
const RICH_SIZES = [
  { value: "2", key: "richSizeSmall" },
  { value: "3", key: "richSizeNormal" },
  { value: "4", key: "richSizeMedium" },
  { value: "5", key: "richSizeLarge" },
  { value: "6", key: "richSizeXLarge" },
];

function RichTextEditor({ t, value, onChange, placeholder }) {
  const ref = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.innerHTML = value || "";
      initialized.current = true;
    }
  }, [value]);

  const exec = (cmd, val = null) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    onChange(ref.current.innerHTML);
  };

  const toolBtnStyle = {
    border: `1px solid rgba(201,162,39,0.35)`,
    background: "transparent",
    color: COLORS.chalk,
    borderRadius: 6,
    padding: "6px 12px",
    cursor: "pointer",
    fontFamily: "Cairo, sans-serif",
    fontSize: 13.5,
  };
  const selectStyle = {
    background: "rgba(255,255,255,0.03)",
    border: `1px solid rgba(201,162,39,0.35)`,
    borderRadius: 6,
    padding: "6px 8px",
    color: COLORS.chalk,
    fontFamily: "Cairo, sans-serif",
    fontSize: 13.5,
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <select defaultValue="" onChange={(e) => e.target.value && exec("fontName", e.target.value)} style={selectStyle}>
          <option value="" disabled style={{ color: "#000" }}>{t.richFontFamily}</option>
          {RICH_FONTS.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value, color: "#000" }}>{f.label}</option>
          ))}
        </select>
        <select defaultValue="" onChange={(e) => e.target.value && exec("fontSize", e.target.value)} style={selectStyle}>
          <option value="" disabled style={{ color: "#000" }}>{t.richFontSize}</option>
          {RICH_SIZES.map((s) => (
            <option key={s.value} value={s.value} style={{ color: "#000" }}>{t[s.key]}</option>
          ))}
        </select>
        <button type="button" onClick={() => exec("bold")} style={{ ...toolBtnStyle, fontWeight: 800 }} title={t.richBold}>B</button>
        <button type="button" onClick={() => exec("underline")} style={{ ...toolBtnStyle, textDecoration: "underline" }} title={t.richUnderline}>U</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => onChange(ref.current.innerHTML)}
        style={{
          minHeight: 140,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid rgba(201,162,39,0.35)`,
          borderRadius: 8,
          padding: "10px 12px",
          color: COLORS.chalk,
          fontFamily: "Cairo, sans-serif",
          fontSize: 16,
          lineHeight: 1.7,
        }}
      />
    </div>
  );
}

const EMPTY_LESSON_FORM = { title: "", category: "", desc: "", url: "", content: "", type: "video", visibleTo: null, allowDownload: false };

function LessonsTab({ t, lessons, setLessons, students, classes, externalEditId, onExternalEditHandled }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_LESSON_FORM);
  const [previewId, setPreviewId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const myLessons = useMemo(() => lessons.filter((l) => l.type !== "exam" && l.type !== "assignment"), [lessons]);

  const closeForm = () => { setShowForm(false); setForm(EMPTY_LESSON_FORM); setEditingId(null); };

  const startEdit = (l) => {
    setForm({
      title: l.title || "",
      category: l.category === t.noCategory ? "" : (l.category || ""),
      desc: l.desc || "",
      url: l.url || "",
      content: l.content || "",
      type: l.type || "video",
      visibleTo: l.visibleTo || null,
      allowDownload: !!l.allowDownload,
    });
    setEditingId(l.id);
    setPreviewId(null);
    setShowForm(true);
  };

  useEffect(() => {
    if (!externalEditId) return;
    const l = lessons.find((x) => x.id === externalEditId);
    if (l) startEdit(l);
    onExternalEditHandled && onExternalEditHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalEditId]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const base = { title: form.title, category: form.category.trim() || t.noCategory, desc: form.desc, type: form.type, visibleTo: form.visibleTo };
    if (DOWNLOADABLE_TYPES.includes(form.type)) {
      base.url = form.url;
      base.allowDownload = !!form.allowDownload;
    }
    if (form.type === "text") base.content = form.content;
    if (editingId) {
      setLessons(lessons.map((x) => (x.id === editingId ? { ...x, ...base } : x)));
    } else {
      setLessons([...lessons, { id: uid(), ...base, createdAt: new Date().toISOString() }]);
    }
    closeForm();
  };
  const remove = (id) => setLessons(lessons.filter((l) => l.id !== id));

  const grouped = useMemo(() => {
    const g = {};
    myLessons.forEach((l) => { g[l.category] = g[l.category] || []; g[l.category].push(l); });
    return g;
  }, [myLessons]);

  return (
    <div>
      {!showForm && (
        <ChalkButton type="button" color={COLORS.chalkYellow} onClick={() => setShowForm(true)} style={{ marginBottom: 20 }}>
          <Plus size={16} /> {t.addLesson}
        </ChalkButton>
      )}
      {showForm && (
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, border: `1px solid rgba(201,162,39,0.3)`, borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {LESSON_TYPES.map((lt) => (
            <button
              key={lt.id}
              type="button"
              onClick={() => setForm({ ...form, type: lt.id })}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 20,
                border: `1.5px solid ${form.type === lt.id ? COLORS.chalkYellow : "rgba(201,162,39,0.3)"}`,
                background: form.type === lt.id ? "rgba(201,162,39,0.14)" : "transparent",
                color: form.type === lt.id ? COLORS.chalkYellow : COLORS.chalkDim,
                cursor: "pointer",
                fontFamily: "Cairo, sans-serif",
                fontWeight: 700,
                fontSize: 14.5,
              }}
            >
              {lt.icon} {lessonTypeLabel(t, lt.id)}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <ChalkInput label={t.lessonTitle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t.lessonTitlePh} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <ChalkInput label={t.category} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={t.categoryPh} />
          </div>
        </div>

        {form.type === "video" && (
          <div>
            <span style={{ color: COLORS.chalkDim, fontSize: 15, fontWeight: 600, display: "block", marginBottom: 6 }}>{t.lessonUrl}</span>
            <UploadField t={t} icon={<Link2 size={16} color={COLORS.chalkDim} />} accept="video/*" value={form.url} onChange={(url) => setForm({ ...form, url })} placeholder={t.lessonUrlPh} />
          </div>
        )}
        {form.type === "pdf" && (
          <div>
            <span style={{ color: COLORS.chalkDim, fontSize: 15, fontWeight: 600, display: "block", marginBottom: 6 }}>{t.lessonPdfUrl}</span>
            <UploadField t={t} icon={<FileText size={16} color={COLORS.chalkDim} />} accept="application/pdf" value={form.url} onChange={(url) => setForm({ ...form, url })} placeholder={t.lessonPdfUrlPh} />
          </div>
        )}
        {form.type === "ppt" && (
          <div>
            <span style={{ color: COLORS.chalkDim, fontSize: 15, fontWeight: 600, display: "block", marginBottom: 6 }}>{t.lessonPptUrl}</span>
            <UploadField t={t} icon={<FileText size={16} color={COLORS.chalkDim} />} accept=".ppt,.pptx" value={form.url} onChange={(url) => setForm({ ...form, url })} placeholder={t.lessonPptUrlPh} />
          </div>
        )}
        {form.type === "word" && (
          <div>
            <span style={{ color: COLORS.chalkDim, fontSize: 15, fontWeight: 600, display: "block", marginBottom: 6 }}>{t.lessonWordUrl}</span>
            <UploadField t={t} icon={<FileText size={16} color={COLORS.chalkDim} />} accept=".doc,.docx" value={form.url} onChange={(url) => setForm({ ...form, url })} placeholder={t.lessonWordUrlPh} />
          </div>
        )}
        {DOWNLOADABLE_TYPES.includes(form.type) && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "Cairo, sans-serif" }}>
            <input type="checkbox" checked={!!form.allowDownload} onChange={(e) => setForm({ ...form, allowDownload: e.target.checked })} />
            <span style={{ color: COLORS.chalkDim, fontSize: 15 }}>{t.allowDownloadLabel}</span>
          </label>
        )}
        {form.type === "text" && (
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "Cairo, sans-serif" }}>
            <span style={{ color: COLORS.chalkDim, fontSize: 15, fontWeight: 600 }}>{t.lessonContent}</span>
            <RichTextEditor key={editingId || "new"} t={t} value={form.content} onChange={(html) => setForm({ ...form, content: html })} placeholder={t.lessonContentPh} />
          </label>
        )}
        <ChalkInput label={t.lessonDesc} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder={t.lessonDescPh} />
        <LessonVisibilityPicker t={t} students={students} classes={classes} value={form.visibleTo} onChange={(v) => setForm({ ...form, visibleTo: v })} />
        <div style={{ display: "flex", gap: 10 }}>
          <ChalkButton type="submit" color={COLORS.chalkYellow}>
            {editingId ? <CheckCircle2 size={16} /> : <Plus size={16} />} {editingId ? t.saveChanges : t.addLesson}
          </ChalkButton>
          <ChalkButton type="button" variant="outline" color={COLORS.chalkDim} onClick={closeForm}>
            <X size={15} /> {t.back}
          </ChalkButton>
        </div>
      </form>
      )}

      {myLessons.length === 0 ? (
        <EmptyNote text={t.noLessons} icon={<BookOpen size={22} />} />
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 20 }}>
            <div style={{ color: COLORS.chalkBlue, fontWeight: 800, fontSize: 17, marginBottom: 8 }}>{cat}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((l) => (
                <div key={l.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ color: COLORS.chalkBlue, fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                        {lessonTypeIcon(l.type, 12)} {lessonTypeLabel(t, l.type)}
                      </div>
                      <div style={{ color: COLORS.chalk, fontWeight: 700 }}>{l.title}</div>
                      {l.desc && <div style={{ color: COLORS.chalkDim, fontSize: 14 }}>{l.desc}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setPreviewId(previewId === l.id ? null : l.id)} style={iconBtnStyle} title={t.tryIt}>
                        {previewId === l.id ? <EyeOff size={16} color={COLORS.chalkBlue} /> : <Eye size={16} color={COLORS.chalkBlue} />}
                      </button>
                      <button onClick={() => startEdit(l)} style={iconBtnStyle} title={t.editLesson}>
                        <Pencil size={16} color={COLORS.chalkBlue} />
                      </button>
                      <button onClick={() => remove(l.id)} style={iconBtnStyle}>
                        <Trash2 size={16} color={COLORS.chalkPink} />
                      </button>
                    </div>
                  </div>
                  {DOWNLOADABLE_TYPES.includes(l.type) && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "Cairo, sans-serif" }}>
                      <input
                        type="checkbox"
                        checked={!!l.allowDownload}
                        onChange={(e) => setLessons(lessons.map((x) => (x.id === l.id ? { ...x, allowDownload: e.target.checked } : x)))}
                      />
                      <span style={{ color: COLORS.chalkDim, fontSize: 14 }}>{t.allowDownloadLabel}</span>
                    </label>
                  )}
                  <LessonVisibilityPicker
                    t={t}
                    students={students}
                    classes={classes}
                    value={l.visibleTo}
                    onChange={(v) => setLessons(lessons.map((x) => (x.id === l.id ? { ...x, visibleTo: v } : x)))}
                  />
                  {previewId === l.id && (
                    <div style={{ border: `1px dashed rgba(201,162,39,0.35)`, borderRadius: 8, padding: 12 }}>
                      <div style={{ color: COLORS.chalkYellow, fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>{t.tryItPreviewNote}</div>
                      {l.type === "text" && <div style={{ color: COLORS.chalk, fontSize: 15, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: l.content }} />}
                      {DOWNLOADABLE_TYPES.includes(l.type) && <LessonEmbed lesson={l} t={t} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const EMPTY_EXAM_FORM = { title: "", category: "", desc: "", format: "builder", url: "", allowDownload: true, durationMinutes: "", questions: [], visibleTo: null, publishAt: "", availableDays: "" };

function formatAnswerForDisplay(kind, q, ans, t) {
  if (ans == null || ans === "") return "—";
  if (kind === "mcq") {
    const opt = (q.options || []).find((o) => o.id === ans);
    return opt ? opt.text : "—";
  }
  if (kind === "truefalse") return ans === true ? t.trueLabel : ans === false ? t.falseLabel : "—";
  if (kind === "fillblank") return (ans || []).filter(Boolean).join(" / ") || "—";
  if (kind === "matching") return Object.values(ans || {}).filter(Boolean).join(" / ") || "—";
  if (kind === "essay") return ans;
  return String(ans);
}

function ExamSubmissionRow({ t, student, lesson, entry, expanded, onToggle, onRelease, onReset }) {
  const questions = lesson.questions || [];
  const answers = entry.examAnswers || {};

  const computeAuto = (q) => {
    const kind = q.kind || "mcq";
    const ans = answers[q.id];
    if (kind === "mcq") return !!ans && ans === q.correctOptionId;
    if (kind === "truefalse") return ans === q.correctAnswer;
    if (kind === "fillblank") {
      const blanks = q.blanks || [];
      const arr = ans || [];
      return blanks.length > 0 && blanks.every((b, i) => (arr[i] || "").trim().toLowerCase() === (b || "").trim().toLowerCase());
    }
    if (kind === "matching") {
      const pairs = q.pairs || [];
      const m = ans || {};
      return pairs.length > 0 && pairs.every((p) => m[p.id] === p.right);
    }
    return false;
  };

  const [marks, setMarks] = useState(() => {
    const init = {};
    questions.forEach((q) => { init[q.id] = computeAuto(q); });
    return init;
  });

  const correctCount = Object.values(marks).filter(Boolean).length;
  const total = questions.length;
  const released = !!entry.examReleased;
  const shownScore = released ? entry.examFinalScore || entry.examScore : entry.examScore;

  return (
    <div style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={onToggle}>
        <div>
          <div style={{ color: COLORS.chalk, fontWeight: 700 }}>{student.name}</div>
          <div style={{ color: COLORS.chalkDim, fontSize: 13.5 }}>{t.finalScoreLabel(shownScore.correct, shownScore.total)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {released && (
            <span style={{ border: `1px solid ${COLORS.chalkBlue}`, color: COLORS.chalkBlue, borderRadius: 20, padding: "1px 10px", fontSize: 12, fontWeight: 700 }}>
              {t.gradeReleased}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); if (window.confirm(t.resetExamConfirm)) onReset(); }}
            style={iconBtnStyle}
            title={t.resetExam}
          >
            <RotateCcw size={16} color={COLORS.chalkYellow} />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: `1px dashed rgba(201,162,39,0.3)`, paddingTop: 10 }}>
          {questions.map((q, qi) => {
            const kind = q.kind || "mcq";
            return (
              <div key={q.id} style={{ border: `1px solid rgba(201,162,39,0.2)`, borderRadius: 8, padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ color: COLORS.chalk, fontWeight: 700, fontSize: 14.5, flex: 1 }}>
                    {qi + 1}. {q.text || ""}
                  </div>
                  <span style={{ border: `1px solid ${difficultyColor(q.difficulty)}`, color: difficultyColor(q.difficulty), borderRadius: 20, padding: "1px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {difficultyLabel(t, q.difficulty)}
                  </span>
                </div>
                <div style={{ color: COLORS.chalkDim, fontSize: 13.5, marginBottom: 6 }}>
                  {kind === "essay" ? t.essaySubmittedLabel : t.yourAnswerLabel} {formatAnswerForDisplay(kind, q, answers[q.id], t)}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!marks[q.id]} onChange={(e) => setMarks({ ...marks, [q.id]: e.target.checked })} />
                  <span style={{ color: COLORS.chalkDim, fontSize: 14 }}>{t.markCorrectLabel}</span>
                </label>
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ color: COLORS.chalkYellow, fontWeight: 800 }}>{t.finalScoreLabel(correctCount, total)}</span>
            <ChalkButton type="button" color={COLORS.chalkYellow} onClick={() => onRelease({ correct: correctCount, total })}>
              {t.releaseGrade}
            </ChalkButton>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamGradingPanel({ t, lesson, students, progress, setProgress }) {
  const [expandedId, setExpandedId] = useState(null);
  const submissions = students
    .filter((s) => progress[s.id] && progress[s.id][lesson.id] && progress[s.id][lesson.id].examScore)
    .map((s) => ({ student: s, entry: progress[s.id][lesson.id] }));

  if (submissions.length === 0) {
    return <div style={{ color: COLORS.chalkDim, fontSize: 14, padding: "6px 0" }}>{t.noSubmissionsYet}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {submissions.map(({ student: s, entry }) => (
        <ExamSubmissionRow
          key={s.id}
          t={t}
          student={s}
          lesson={lesson}
          entry={entry}
          expanded={expandedId === s.id}
          onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
          onRelease={(finalScore) => {
            const mine = { ...(progress[s.id] || {}) };
            mine[lesson.id] = { ...(mine[lesson.id] || {}), examFinalScore: finalScore, examReleased: true };
            setProgress({ ...progress, [s.id]: mine });
          }}
          onReset={() => {
            const mine = { ...(progress[s.id] || {}) };
            mine[lesson.id] = { watched: false, examAnswers: null, examScore: null, examFinalScore: null, examReleased: null, examStartedAt: null };
            setProgress({ ...progress, [s.id]: mine });
            setExpandedId(null);
          }}
        />
      ))}
    </div>
  );
}

function ExamsTab({ t, lang, kind = "exam", lessons, setLessons, students, classes, progress, setProgress, externalEditId, onExternalEditHandled }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_EXAM_FORM);
  const [previewId, setPreviewId] = useState(null);
  const [gradingId, setGradingId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const myExams = useMemo(() => lessons.filter((l) => l.type === kind), [lessons, kind]);

  const closeForm = () => { setShowForm(false); setForm(EMPTY_EXAM_FORM); setEditingId(null); };

  const startEdit = (l) => {
    setForm({
      title: l.title || "",
      category: l.category === t.noCategory ? "" : (l.category || ""),
      desc: l.desc || "",
      format: l.examFormat || "builder",
      url: l.url || "",
      allowDownload: l.allowDownload !== undefined ? !!l.allowDownload : true,
      durationMinutes: l.durationMinutes != null ? String(l.durationMinutes) : "",
      questions: l.questions || [],
      visibleTo: l.visibleTo || null,
      publishAt: l.publishAt || "",
      availableDays: l.availableDays != null ? String(l.availableDays) : "",
    });
    setEditingId(l.id);
    setPreviewId(null);
    setShowForm(true);
  };

  useEffect(() => {
    if (!externalEditId) return;
    const l = lessons.find((x) => x.id === externalEditId);
    if (l) startEdit(l);
    onExternalEditHandled && onExternalEditHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalEditId]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (form.format === "builder" && form.questions.length === 0) {
      alert(t.needAtLeastOneQuestion);
      return;
    }
    if ((form.format === "pdf" || form.format === "word") && !form.url) return;
    const base = {
      title: form.title,
      category: form.category.trim() || t.noCategory,
      desc: form.desc,
      type: kind,
      examFormat: form.format,
      visibleTo: form.visibleTo,
      publishAt: form.publishAt || null,
      availableDays: form.availableDays ? Number(form.availableDays) : null,
    };
    if (form.format === "builder") {
      base.questions = form.questions;
      base.durationMinutes = form.durationMinutes ? Number(form.durationMinutes) : null;
    } else {
      base.url = form.url;
      base.allowDownload = !!form.allowDownload;
    }
    if (editingId) {
      setLessons(lessons.map((x) => (x.id === editingId ? { ...x, ...base } : x)));
    } else {
      setLessons([...lessons, { id: uid(), ...base, createdAt: new Date().toISOString() }]);
    }
    closeForm();
  };
  const remove = (id) => setLessons(lessons.filter((l) => l.id !== id));

  const grouped = useMemo(() => {
    const g = {};
    myExams.forEach((l) => { g[l.category] = g[l.category] || []; g[l.category].push(l); });
    return g;
  }, [myExams]);

  const isFileExam = (l) => l.examFormat === "pdf" || l.examFormat === "word";
  const pendingCountFor = (lessonId) =>
    students.reduce((n, s) => {
      const entry = progress[s.id] && progress[s.id][lessonId];
      return entry && entry.examScore && !entry.examReleased ? n + 1 : n;
    }, 0);

  return (
    <div>
      {!showForm && (
        <ChalkButton type="button" color={COLORS.chalkYellow} onClick={() => setShowForm(true)} style={{ marginBottom: 20 }}>
          <Plus size={16} /> {t.addExam}
        </ChalkButton>
      )}
      {showForm && (
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, border: `1px solid rgba(201,162,39,0.3)`, borderRadius: 10, padding: 16 }}>
        <div>
          <span style={{ color: COLORS.chalkDim, fontSize: 15, fontWeight: 600, display: "block", marginBottom: 6 }}>{t.examFormatLabel}</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {EXAM_FORMATS.map((ef) => (
              <button
                key={ef.id}
                type="button"
                onClick={() => setForm({ ...form, format: ef.id })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 20,
                  border: `1.5px solid ${form.format === ef.id ? COLORS.chalkYellow : "rgba(201,162,39,0.3)"}`,
                  background: form.format === ef.id ? "rgba(201,162,39,0.14)" : "transparent",
                  color: form.format === ef.id ? COLORS.chalkYellow : COLORS.chalkDim,
                  cursor: "pointer",
                  fontFamily: "Cairo, sans-serif",
                  fontWeight: 700,
                  fontSize: 14.5,
                }}
              >
                {ef.icon} {examFormatLabel(t, ef.id)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <ChalkInput label={t.examTitle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t.examTitlePh} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <ChalkInput label={t.category} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={t.categoryPh} />
          </div>
        </div>

        {form.format === "builder" && (
          <>
            <ChalkInput label={t.examDuration} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value.replace(/[^0-9]/g, "") })} placeholder={t.examDurationPh} dir="ltr" />
            <ExamBuilder t={t} questions={form.questions} setQuestions={(qs) => setForm({ ...form, questions: qs })} />
          </>
        )}

        {(form.format === "pdf" || form.format === "word") && (
          <div>
            <span style={{ color: COLORS.chalkDim, fontSize: 15, fontWeight: 600, display: "block", marginBottom: 6 }}>{t.examFileUrl}</span>
            <UploadField t={t} icon={<FileText size={16} color={COLORS.chalkDim} />} accept={form.format === "pdf" ? "application/pdf" : ".doc,.docx"} value={form.url} onChange={(url) => setForm({ ...form, url })} placeholder={t.examFileUrlPh} />
            <div style={{ color: COLORS.chalkDim, fontSize: 13, marginTop: 8 }}>{t.examFileNote}</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "Cairo, sans-serif", marginTop: 8 }}>
              <input type="checkbox" checked={!!form.allowDownload} onChange={(e) => setForm({ ...form, allowDownload: e.target.checked })} />
              <span style={{ color: COLORS.chalkDim, fontSize: 15 }}>{t.allowDownloadLabel}</span>
            </label>
          </div>
        )}

        <ChalkInput label={t.lessonDesc} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder={t.lessonDescPh} />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <ChalkInput
              type="datetime-local"
              label={t.examPublishAt}
              icon={<CalendarClock size={16} color={COLORS.chalkDim} />}
              value={form.publishAt}
              onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
              dir="ltr"
            />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <ChalkInput
              label={t.examAvailableDays}
              value={form.availableDays}
              onChange={(e) => setForm({ ...form, availableDays: e.target.value.replace(/[^0-9]/g, "") })}
              placeholder={t.examAvailableDaysPh}
              dir="ltr"
            />
          </div>
        </div>
        <div style={{ color: COLORS.chalkDim, fontSize: 13 }}>{t.examScheduleNote}</div>

        <LessonVisibilityPicker t={t} students={students} classes={classes} value={form.visibleTo} onChange={(v) => setForm({ ...form, visibleTo: v })} />
        <div style={{ display: "flex", gap: 10 }}>
          <ChalkButton type="submit" color={COLORS.chalkYellow}>
            {editingId ? <CheckCircle2 size={16} /> : <Plus size={16} />} {editingId ? t.saveChanges : t.addExam}
          </ChalkButton>
          <ChalkButton type="button" variant="outline" color={COLORS.chalkDim} onClick={closeForm}>
            <X size={15} /> {t.back}
          </ChalkButton>
        </div>
      </form>
      )}

      {myExams.length === 0 ? (
        <EmptyNote text={t.noExams} icon={<FileText size={22} />} />
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 20 }}>
            <div style={{ color: COLORS.chalkBlue, fontWeight: 800, fontSize: 17, marginBottom: 8 }}>{cat}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((l) => (
                <div key={l.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ color: COLORS.chalkBlue, fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                        {lessonTypeIcon(kind, 12)} {examFormatLabel(t, l.examFormat)}
                        {(!l.examFormat || l.examFormat === "builder") && ` · ${t.questionsCount((l.questions || []).length)}`}
                      </div>
                      <div style={{ color: COLORS.chalk, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                        {l.title}
                        {!isFileExam(l) && pendingCountFor(l.id) > 0 && (
                          <span
                            style={{
                              background: COLORS.chalkPink,
                              color: "#fff",
                              borderRadius: 999,
                              padding: "1px 9px",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {pendingCountFor(l.id)}
                          </span>
                        )}
                      </div>
                      {l.desc && <div style={{ color: COLORS.chalkDim, fontSize: 14 }}>{l.desc}</div>}
                      {(() => {
                        const status = examStatus(l);
                        const { publishAt, closeAt } = getExamWindow(l);
                        if (status === "upcoming") {
                          return (
                            <div style={{ color: COLORS.chalkYellow, fontSize: 12.5, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                              <CalendarClock size={12} /> {t.examStatusUpcomingAt(fmtDate(l.publishAt, lang))}
                            </div>
                          );
                        }
                        if (status === "closed") {
                          return (
                            <div style={{ color: COLORS.chalkPink, fontSize: 12.5, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                              <CalendarClock size={12} /> {t.examStatusClosedAt(fmtDate(closeAt.toISOString(), lang))}
                            </div>
                          );
                        }
                        if (publishAt || closeAt) {
                          return (
                            <div style={{ color: COLORS.chalkDim, fontSize: 12.5, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                              <CalendarClock size={12} />
                              {publishAt && t.examStatusPublishedAt(fmtDate(l.publishAt, lang))}
                              {publishAt && closeAt && " · "}
                              {closeAt && t.examStatusClosesAt(fmtDate(closeAt.toISOString(), lang))}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {!isFileExam(l) && (
                        <button onClick={() => setGradingId(gradingId === l.id ? null : l.id)} style={iconBtnStyle} title={t.gradeExam}>
                          <ClipboardList size={16} color={gradingId === l.id ? COLORS.chalkYellow : COLORS.chalkBlue} />
                        </button>
                      )}
                      <button onClick={() => setPreviewId(previewId === l.id ? null : l.id)} style={iconBtnStyle} title={t.tryIt}>
                        {previewId === l.id ? <EyeOff size={16} color={COLORS.chalkBlue} /> : <Eye size={16} color={COLORS.chalkBlue} />}
                      </button>
                      <button onClick={() => startEdit(l)} style={iconBtnStyle} title={t.editLesson}>
                        <Pencil size={16} color={COLORS.chalkBlue} />
                      </button>
                      <button onClick={() => remove(l.id)} style={iconBtnStyle}>
                        <Trash2 size={16} color={COLORS.chalkPink} />
                      </button>
                    </div>
                  </div>
                  {gradingId === l.id && (
                    <div style={{ border: `1px dashed rgba(201,162,39,0.35)`, borderRadius: 8, padding: 12 }}>
                      <div style={{ color: COLORS.chalkYellow, fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>{t.gradeExam}</div>
                      <ExamGradingPanel t={t} lesson={l} students={students} progress={progress} setProgress={setProgress} />
                    </div>
                  )}
                  {isFileExam(l) && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "Cairo, sans-serif" }}>
                      <input
                        type="checkbox"
                        checked={!!l.allowDownload}
                        onChange={(e) => setLessons(lessons.map((x) => (x.id === l.id ? { ...x, allowDownload: e.target.checked } : x)))}
                      />
                      <span style={{ color: COLORS.chalkDim, fontSize: 14 }}>{t.allowDownloadLabel}</span>
                    </label>
                  )}
                  <LessonVisibilityPicker
                    t={t}
                    students={students}
                    classes={classes}
                    value={l.visibleTo}
                    onChange={(v) => setLessons(lessons.map((x) => (x.id === l.id ? { ...x, visibleTo: v } : x)))}
                  />
                  {previewId === l.id && (
                    <div style={{ border: `1px dashed rgba(201,162,39,0.35)`, borderRadius: 8, padding: 12 }}>
                      <div style={{ color: COLORS.chalkYellow, fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>{t.tryItPreviewNote}</div>
                      {isFileExam(l) ? <LessonEmbed lesson={l} t={t} /> : <ExamTaker t={t} lesson={l} entry={null} onStart={() => {}} onSubmit={() => {}} preview />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function lessonVisibleToStudent(lesson, student) {
  if ((lesson.type === "exam" || lesson.type === "assignment") && examStatus(lesson) === "upcoming") return false;
  const v = lesson.visibleTo;
  if (!v) return true;
  const classIds = v.classIds || [];
  const studentIds = v.studentIds || [];
  if (classIds.length === 0 && studentIds.length === 0) return true;
  if (student.classId && classIds.includes(student.classId)) return true;
  if (studentIds.includes(student.id)) return true;
  return false;
}

// Whether a lesson/exam is assigned to a class: visible to all (no restriction), or its
// visibility explicitly lists this class. Used by the teacher's Classes tab to show what's
// assigned to a given class, regardless of which individual students are in it.
function lessonAssignedToClass(lesson, classId) {
  const v = lesson.visibleTo;
  if (!v) return true;
  const classIds = v.classIds || [];
  const studentIds = v.studentIds || [];
  if (classIds.length === 0 && studentIds.length === 0) return true;
  return classIds.includes(classId);
}

// Exam availability window: publishAt (when it becomes visible to students) + availableDays
// (how many days it stays open after that). If availableDays is set without publishAt, the
// exam's own createdAt is used as the anchor so the field still works.
function getExamWindow(lesson) {
  const publishAt = lesson.publishAt ? new Date(lesson.publishAt) : null;
  let closeAt = null;
  if (lesson.availableDays) {
    const anchor = publishAt || (lesson.createdAt ? new Date(lesson.createdAt) : null);
    if (anchor) closeAt = new Date(anchor.getTime() + Number(lesson.availableDays) * 24 * 60 * 60 * 1000);
  }
  return { publishAt, closeAt };
}

// "upcoming" (not published yet, hidden from students) | "closed" (window passed) | "open"
function examStatus(lesson) {
  if (lesson.type !== "exam" && lesson.type !== "assignment") return "open";
  const { publishAt, closeAt } = getExamWindow(lesson);
  const now = new Date();
  if (publishAt && now < publishAt) return "upcoming";
  if (closeAt && now > closeAt) return "closed";
  return "open";
}

function studentStats(studentId, lessons, progress) {
  const total = lessons.length;
  const done = lessons.filter((l) => progress[studentId] && progress[studentId][l.id] && progress[studentId][l.id].watched).length;
  let lastAt = null;
  if (progress[studentId]) {
    Object.values(progress[studentId]).forEach((p) => {
      if (p.watchedAt && (!lastAt || p.watchedAt > lastAt)) lastAt = p.watchedAt;
    });
  }
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0, lastAt };
}

function ProgressTab({ t, lang, students, lessons, progress }) {
  if (students.length === 0) return <EmptyNote text={t.addStudentsFirst} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {students.map((s) => {
        const visibleForStudent = lessons.filter((l) => lessonVisibleToStudent(l, s));
        const stats = studentStats(s.id, visibleForStudent, progress);
        let badgeColor = COLORS.chalkPink;
        let badgeText = t.notStudied;
        if (stats.total > 0) {
          if (stats.pct >= 70) { badgeColor = COLORS.chalkBlue; badgeText = t.studyingWell; }
          else if (stats.pct > 0) { badgeColor = COLORS.chalkYellow; badgeText = t.needsFollowup; }
        }
        return (
          <div key={s.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: COLORS.chalk, fontWeight: 800, fontSize: 16 }}>{s.name}</div>
                <div style={{ color: COLORS.chalkDim, fontSize: 14.5, direction: "ltr", textAlign: "right" }}>{s.username}</div>
              </div>
              <span style={{ border: `1px solid ${badgeColor}`, color: badgeColor, borderRadius: 20, padding: "4px 12px", fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap" }}>{badgeText}</span>
            </div>
            <div style={{ width: "100%", height: 8, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ width: `${stats.pct}%`, height: "100%", background: badgeColor, transition: "width 0.3s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, color: COLORS.chalkDim }}>
              <span>{t.ofLessons(stats.done, stats.total, stats.pct)}</span>
              <span>{t.lastStudy(fmtDate(stats.lastAt, lang))}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- student ---------- */

function StudentLogin({ students, onFound, onTeacher, onRegister, lang, setLang }) {
  const t = T[lang];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const match = students.find(
      (s) => s.status !== "pending" && s.status !== "blocked" && s.username && s.username.toLowerCase() === username.trim().toLowerCase() && s.password === password
    );
    if (!match) { setErr(t.wrongLogin); return; }
    setErr("");
    onFound(match);
  };

  return (
    <Board lang={lang}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <button onClick={onTeacher} style={{ background: "none", border: "none", color: COLORS.chalkDim, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "Cairo, sans-serif", fontSize: 14 }}>
          <Settings size={14} /> {t.teacherLink}
        </button>
        <LangToggle lang={lang} setLang={setLang} />
      </div>
      <Title lang={lang} sub={t.studentSubtitle}>{t.brand}</Title>
      <form onSubmit={submit} style={{ maxWidth: 340, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <ChalkInput label={t.username} icon={<User size={16} color={COLORS.chalkDim} />} value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" autoFocus />
        <ChalkInput label={t.password} icon={<Lock size={16} color={COLORS.chalkDim} />} type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        {err && <div style={{ color: COLORS.chalkPink, fontSize: 14 }}>{err}</div>}
        <ChalkButton type="submit" color={COLORS.chalkYellow} style={{ justifyContent: "center" }}>
          {t.login}
        </ChalkButton>
        <button type="button" onClick={onRegister} style={{ background: "none", border: "none", color: COLORS.chalkBlue, cursor: "pointer", fontFamily: "Cairo, sans-serif", fontSize: 14.5, textAlign: "center" }}>
          {t.newStudentLink}
        </button>
      </form>
    </Board>
  );
}

function StudentRegister({ classes, setStudents, students, back, lang, setLang }) {
  const t = T[lang];
  const [form, setForm] = useState({ name: "", familyName: "", phone: "", email: "", classId: "" });
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.familyName.trim() || !form.phone.trim() || !form.classId) return;
    setStudents([
      ...students,
      {
        id: uid(),
        name: `${form.name.trim()} ${form.familyName.trim()}`.trim(),
        familyName: form.familyName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        classId: form.classId,
        username: "",
        password: "",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    ]);
    setSent(true);
  };

  if (sent) {
    return (
      <Board lang={lang}>
        <Title lang={lang} sub={t.registerSentSub}>{t.brand}</Title>
        <div style={{ maxWidth: 340, margin: "0 auto", textAlign: "center" }}>
          <CheckCircle2 size={40} color={COLORS.chalkBlue} style={{ marginBottom: 10 }} />
          <ChalkButton type="button" color={COLORS.chalkYellow} onClick={back} style={{ justifyContent: "center", margin: "20px auto 0" }}>
            {t.backToLogin}
          </ChalkButton>
        </div>
      </Board>
    );
  }

  return (
    <Board lang={lang}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <button onClick={back} style={{ background: "none", border: "none", color: COLORS.chalkDim, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "Cairo, sans-serif", fontSize: 14 }}>
          <ArrowRight size={14} /> {t.backToLogin}
        </button>
        <LangToggle lang={lang} setLang={setLang} />
      </div>
      <Title lang={lang} sub={t.registerSubtitle}>{t.brand}</Title>
      <form onSubmit={submit} style={{ maxWidth: 340, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <ChalkInput label={t.studentName} icon={<User size={16} color={COLORS.chalkDim} />} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        <ChalkInput label={t.familyName} value={form.familyName} onChange={(e) => setForm({ ...form, familyName: e.target.value })} />
        <ChalkInput label={t.phone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
        <ChalkInput label={t.emailOptional} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "Cairo, sans-serif" }}>
          <span style={{ color: COLORS.chalkDim, fontSize: 15, fontWeight: 600 }}>{t.assignClass}</span>
          <select
            value={form.classId}
            onChange={(e) => setForm({ ...form, classId: e.target.value })}
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(201,162,39,0.35)`, borderRadius: 8, padding: "10px 12px", color: COLORS.chalk, fontFamily: "Cairo, sans-serif", fontSize: 16 }}
          >
            <option value="" style={{ color: "#000" }}>{t.chooseClassOpt}</option>
            {(classes || []).map((c) => (
              <option key={c.id} value={c.id} style={{ color: "#000" }}>{c.name}</option>
            ))}
          </select>
        </label>
        <ChalkButton type="submit" color={COLORS.chalkYellow} style={{ justifyContent: "center" }}>
          {t.sendRegistration}
        </ChalkButton>
      </form>
    </Board>
  );
}

function FillBlankQuestion({ t, q, value, onChange }) {
  const bankAll = useMemo(() => shuffle(q.blanks || []), [q.id]);
  const placed = value || [];
  const [picked, setPicked] = useState(null); // index inside bankAll currently selected
  const usedIdx = new Set(); // indices of bankAll already placed (best-effort by value match order)
  // نحسب مين لسه في الصندوق: بنشيل كلمة واحدة من bankAll مقابل كل كلمة اتحطت فعلاً
  const remaining = [...bankAll];
  placed.forEach((w) => {
    const idx = remaining.indexOf(w);
    if (idx !== -1) remaining.splice(idx, 1);
  });

  const parts = (q.text || "").split("___");
  const place = (blankIndex) => {
    if (picked == null) return;
    const next = [...placed];
    while (next.length <= blankIndex) next.push("");
    next[blankIndex] = picked;
    onChange(next);
    setPicked(null);
  };
  const clearBlank = (blankIndex) => {
    const next = [...placed];
    next[blankIndex] = "";
    onChange(next);
  };

  return (
    <div>
      <div style={{ border: `1.5px solid rgba(201,162,39,0.35)`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
        <div style={{ color: COLORS.chalkBlue, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{t.wordBankLabel}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {remaining.length === 0 ? (
            <span style={{ color: COLORS.chalkDim, fontSize: 13.5 }}>{t.wordBankEmpty}</span>
          ) : (
            remaining.map((w, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPicked(w)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 16,
                  border: `1.5px solid ${picked === w ? COLORS.chalkBlue : "rgba(201,162,39,0.35)"}`,
                  background: picked === w ? "rgba(79,209,197,0.15)" : "transparent",
                  color: picked === w ? COLORS.chalkBlue : COLORS.chalk,
                  fontFamily: "Cairo, sans-serif",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {w}
              </button>
            ))
          )}
        </div>
      </div>
      <div style={{ color: COLORS.chalk, fontSize: 15, lineHeight: 2.2, whiteSpace: "pre-wrap" }}>
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <button
                type="button"
                onClick={() => (placed[i] ? clearBlank(i) : place(i))}
                style={{
                  display: "inline-block",
                  minWidth: 60,
                  margin: "0 4px",
                  padding: "3px 10px",
                  borderRadius: 6,
                  border: `1.5px solid ${COLORS.chalkYellow}`,
                  background: placed[i] ? "rgba(232,180,75,0.15)" : "transparent",
                  color: COLORS.chalkYellow,
                  fontFamily: "Cairo, sans-serif",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {placed[i] || "____"}
              </button>
            )}
          </span>
        ))}
      </div>
      <div style={{ color: COLORS.chalkDim, fontSize: 12.5, marginTop: 8 }}>{t.fillBlankHint}</div>
    </div>
  );
}

function MatchingQuestion({ t, q, value, onChange }) {
  const rightOptions = useMemo(() => shuffle((q.pairs || []).map((p) => p.right)), [q.id]);
  const map = value || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(q.pairs || []).map((p) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, color: COLORS.chalk, fontSize: 14.5 }}>{p.left}</div>
          <ArrowRight size={14} color={COLORS.chalkDim} />
          <select
            value={map[p.id] || ""}
            onChange={(e) => onChange({ ...map, [p.id]: e.target.value })}
            style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: `1px solid rgba(201,162,39,0.35)`, borderRadius: 6, padding: "6px 8px", color: COLORS.chalk, fontFamily: "Cairo, sans-serif", fontSize: 14.5 }}
          >
            <option value="" style={{ color: "#000" }}>{t.matchPick}</option>
            {rightOptions.map((r, i) => (
              <option key={i} value={r} style={{ color: "#000" }}>{r}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function ExamTaker({ t, lesson, entry, onStart, onSubmit, preview }) {
  const questions = lesson.questions || [];
  const [answers, setAnswers] = useState(entry?.examAnswers || {});
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  const [startedAt] = useState(() => entry?.examStartedAt || new Date().toISOString());
  const [remaining, setRemaining] = useState(null);
  const submittedRef = useRef(false);
  const durationMs = lesson.durationMinutes ? lesson.durationMinutes * 60 * 1000 : null;

  useEffect(() => {
    if (!entry?.examStartedAt) onStart(startedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSubmit = (finalAnswers) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    let correct = 0;
    let total = 0;
    let essayCount = 0;
    questions.forEach((q) => {
      const kind = q.kind || "mcq";
      const ans = finalAnswers[q.id];
      if (kind === "essay") {
        essayCount++;
        return;
      }
      total++;
      if (kind === "mcq") {
        if (ans && ans === q.correctOptionId) correct++;
      } else if (kind === "truefalse") {
        if (ans === q.correctAnswer) correct++;
      } else if (kind === "fillblank") {
        const blanks = q.blanks || [];
        const arr = ans || [];
        if (blanks.length > 0 && blanks.every((b, i) => (arr[i] || "").trim().toLowerCase() === (b || "").trim().toLowerCase())) correct++;
      } else if (kind === "matching") {
        const pairs = q.pairs || [];
        const m = ans || {};
        if (pairs.length > 0 && pairs.every((p) => m[p.id] === p.right)) correct++;
      }
    });
    onSubmit(finalAnswers, { correct, total, essayCount });
  };

  // قفل تلقائي: لو الطالب غيّر التبويب أو الشاشة أثناء الامتحان، يتسلّم على طول
  useEffect(() => {
    if (preview || entry?.examScore) return;
    const onVisibility = () => {
      if (document.hidden) doSubmit(answersRef.current);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.examScore]);

  useEffect(() => {
    if (!durationMs || entry?.examScore) return;
    const tick = () => {
      const elapsed = Date.now() - new Date(startedAt).getTime();
      const left = Math.max(0, Math.round((durationMs - elapsed) / 1000));
      setRemaining(left);
      if (left <= 0) doSubmit(answersRef.current);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs, entry?.examScore]);

  if (entry?.examScore) {
    if (!entry.examReleased) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ color: COLORS.chalkBlue, fontWeight: 700, fontSize: 14.5 }}>{t.examAlreadySubmitted}</div>
          <div style={{ color: COLORS.chalkDim, fontSize: 14.5 }}>{t.examAwaitingGrading}</div>
        </div>
      );
    }
    const finalScore = entry.examFinalScore || entry.examScore;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ color: COLORS.chalkBlue, fontWeight: 700, fontSize: 14.5 }}>{t.examAlreadySubmitted}</div>
        <div style={{ color: COLORS.chalkYellow, fontWeight: 800, fontSize: 16 }}>{t.examYourScore(finalScore.correct, finalScore.total)}</div>
      </div>
    );
  }

  const handleSubmitClick = () => {
    if (Object.keys(answers).length < questions.length) {
      if (!window.confirm(t.examPickAnswer)) return;
    } else if (!window.confirm(t.examConfirmSubmit)) {
      return;
    }
    doSubmit(answers);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!preview && durationMs != null && remaining != null && (
        <div style={{ color: remaining < 60 ? COLORS.chalkPink : COLORS.chalkDim, fontSize: 14, fontWeight: 700 }}>
          {t.examTimeLeft(`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`)}
        </div>
      )}
      {!preview && <div style={{ color: COLORS.chalkDim, fontSize: 12.5 }}>{t.examAntiCheatNote}</div>}
      {questions.map((q, qi) => {
        const kind = q.kind || "mcq";
        return (
          <div key={q.id} style={{ border: `1px solid rgba(201,162,39,0.25)`, borderRadius: 8, padding: 10 }}>
            {kind !== "fillblank" && (
              <div style={{ color: COLORS.chalk, fontWeight: 700, marginBottom: 6, fontSize: 15 }}>
                {qi + 1}. {q.text}
              </div>
            )}
            {kind === "mcq" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {q.options.map((o) => (
                  <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, color: COLORS.chalkDim, cursor: "pointer" }}>
                    <input type="radio" name={`ans-${q.id}`} checked={answers[q.id] === o.id} onChange={() => setAnswers({ ...answers, [q.id]: o.id })} />
                    {o.text}
                  </label>
                ))}
              </div>
            )}
            {kind === "truefalse" && (
              <div style={{ display: "flex", gap: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.chalkDim, fontSize: 14.5, cursor: "pointer" }}>
                  <input type="radio" name={`ans-${q.id}`} checked={answers[q.id] === true} onChange={() => setAnswers({ ...answers, [q.id]: true })} /> {t.trueLabel}
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.chalkDim, fontSize: 14.5, cursor: "pointer" }}>
                  <input type="radio" name={`ans-${q.id}`} checked={answers[q.id] === false} onChange={() => setAnswers({ ...answers, [q.id]: false })} /> {t.falseLabel}
                </label>
              </div>
            )}
            {kind === "essay" && (
              <textarea
                value={answers[q.id] || ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                rows={4}
                placeholder={t.essayAnswerPh}
                style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid rgba(201,162,39,0.3)`, borderRadius: 6, padding: "8px 10px", color: COLORS.chalk, fontFamily: "Cairo, sans-serif", fontSize: 15, resize: "vertical" }}
              />
            )}
            {kind === "fillblank" && (
              <>
                <div style={{ color: COLORS.chalkBlue, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{qi + 1}.</div>
                <FillBlankQuestion t={t} q={q} value={answers[q.id]} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
              </>
            )}
            {kind === "matching" && <MatchingQuestion t={t} q={q} value={answers[q.id]} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />}
          </div>
        );
      })}
      <ChalkButton type="button" color={COLORS.chalkYellow} onClick={handleSubmitClick}>
        {t.submitExam}
      </ChalkButton>
    </div>
  );
}

function StudentSettingsTab({ t, student, students, setStudents }) {
  const [email, setEmail] = useState(student.email || "");
  const [phone, setPhone] = useState(student.phone || "");
  const [savedInfo, setSavedInfo] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savedPass, setSavedPass] = useState(false);

  const saveInfo = (e) => {
    e.preventDefault();
    setStudents(students.map((s) => (s.id === student.id ? { ...s, email: email.trim(), phone: phone.trim() } : s)));
    setSavedInfo(true);
    setTimeout(() => setSavedInfo(false), 2000);
  };

  const savePassword = (e) => {
    e.preventDefault();
    if (!newPassword.trim()) return;
    setStudents(students.map((s) => (s.id === student.id ? { ...s, password: newPassword.trim() } : s)));
    setNewPassword("");
    setSavedPass(true);
    setTimeout(() => setSavedPass(false), 2000);
  };

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      <form onSubmit={saveInfo} style={{ display: "flex", flexDirection: "column", gap: 12, border: `1px solid rgba(201,162,39,0.3)`, borderRadius: 10, padding: 16 }}>
        <div style={{ color: COLORS.chalkYellow, fontWeight: 800, fontSize: 16 }}>{t.myInfoTitle}</div>
        <ChalkInput label={t.phone} value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
        <ChalkInput label={t.emailOptional} value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChalkButton type="submit" color={COLORS.chalkYellow}>{t.save}</ChalkButton>
          {savedInfo && <span style={{ color: COLORS.chalkBlue, fontSize: 13.5 }}>{t.myInfoSaved}</span>}
        </div>
      </form>

      <form onSubmit={savePassword} style={{ display: "flex", flexDirection: "column", gap: 12, border: `1px solid rgba(201,162,39,0.3)`, borderRadius: 10, padding: 16 }}>
        <div style={{ color: COLORS.chalkYellow, fontWeight: 800, fontSize: 16 }}>{t.changeMyPassword}</div>
        <ChalkInput label={t.newPasswordLabel} icon={<Lock size={16} color={COLORS.chalkDim} />} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t.newPasswordPh} dir="ltr" />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChalkButton type="submit" color={COLORS.chalkYellow}>{t.save}</ChalkButton>
          {savedPass && <span style={{ color: COLORS.chalkBlue, fontSize: 13.5 }}>{t.myInfoSaved}</span>}
        </div>
      </form>
    </div>
  );
}

function QuickTile({ icon, label, count, color, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 16,
        padding: "22px 20px",
        borderRadius: 18,
        border: `1px solid ${color}55`,
        background: hover ? `${color}22` : `${color}12`,
        cursor: "pointer",
        textAlign: "start",
        fontFamily: "Cairo, sans-serif",
        transition: "background 0.15s ease, transform 0.15s ease",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        flex: "1 1 200px",
        minWidth: 180,
      }}
    >
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `${color}25`,
          border: `1px solid ${color}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
        }}
      >
        {icon}
      </span>
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <span style={{ color: COLORS.chalk, fontWeight: 800, fontSize: 17 }}>{label}</span>
        {count != null && <span style={{ color, fontWeight: 800, fontSize: 20 }}>{count}</span>}
      </span>
    </button>
  );
}

function BackRow({ onBack, label, lang }) {
  return (
    <button
      onClick={onBack}
      style={{ background: "none", border: "none", color: COLORS.chalkDim, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "Cairo, sans-serif", fontSize: 15, marginBottom: 18, padding: 0 }}
    >
      <ArrowRight size={16} style={{ transform: lang === "en" || lang === "fr" ? "scaleX(-1)" : "none" }} /> {label}
    </button>
  );
}

function StudentDashboard({ back, student, students, setStudents, lessons, progress, setProgress, lang, setLang }) {
  const t = T[lang];
  const [view, setView] = useState("home");
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [activeExamId, setActiveExamId] = useState(null);
  const [activeAssignmentId, setActiveAssignmentId] = useState(null);
  const visibleLessons = useMemo(
    () => lessons.filter((l) => lessonVisibleToStudent(l, student)),
    [lessons, student.id]
  );
  const stats = studentStats(student.id, visibleLessons, progress);
  const lessonItems = useMemo(() => visibleLessons.filter((l) => l.type !== "exam" && l.type !== "assignment"), [visibleLessons]);
  const examItems = useMemo(() => visibleLessons.filter((l) => l.type === "exam"), [visibleLessons]);
  const assignmentItems = useMemo(() => visibleLessons.filter((l) => l.type === "assignment"), [visibleLessons]);
  const groupByCategory = (items) => {
    const g = {};
    items.forEach((l) => { g[l.category] = g[l.category] || []; g[l.category].push(l); });
    return g;
  };
  const groupedLessons = useMemo(() => groupByCategory(lessonItems), [lessonItems]);
  const groupedExams = useMemo(() => groupByCategory(examItems), [examItems]);
  const groupedAssignments = useMemo(() => groupByCategory(assignmentItems), [assignmentItems]);

  const toggleWatched = (lessonId) => {
    const mine = { ...(progress[student.id] || {}) };
    const isWatched = mine[lessonId] && mine[lessonId].watched;
    mine[lessonId] = isWatched ? { watched: false } : { watched: true, watchedAt: new Date().toISOString() };
    setProgress({ ...progress, [student.id]: mine });
  };

  const startExam = (lessonId, startedAt) => {
    const mine = { ...(progress[student.id] || {}) };
    mine[lessonId] = { ...(mine[lessonId] || {}), examStartedAt: startedAt };
    setProgress({ ...progress, [student.id]: mine });
  };

  const submitExam = (lessonId, answers, score) => {
    const mine = { ...(progress[student.id] || {}) };
    mine[lessonId] = { ...(mine[lessonId] || {}), watched: true, watchedAt: new Date().toISOString(), examAnswers: answers, examScore: score, examReleased: false };
    setProgress({ ...progress, [student.id]: mine });
  };

  const renderItem = (l) => {
    const type = l.type || "video";
    const isExamLike = type === "exam" || type === "assignment";
    const entry = (progress[student.id] && progress[student.id][l.id]) || null;
    const watched = entry && entry.watched;
    const status = isExamLike ? examStatus(l) : "open";
    const t2 = type === "assignment" ? withAssignmentLabels(t, lang) : t;

    if (isExamLike && (!l.examFormat || l.examFormat === "builder")) {
      const alreadyHasResult = entry && entry.examScore;
      return (
        <div key={l.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {lessonTypeIcon(type, 16)}
            <div style={{ color: COLORS.chalk, fontWeight: 700 }}>{l.title}</div>
          </div>
          {l.desc && <div style={{ color: COLORS.chalkDim, fontSize: 14 }}>{l.desc}</div>}
          {status === "closed" && !alreadyHasResult ? (
            <div style={{ color: COLORS.chalkPink, fontWeight: 700, fontSize: 14.5 }}>{t2.examWindowClosedMsg}</div>
          ) : (
            <ExamTaker t={t2} lesson={l} entry={entry} onStart={(startedAt) => startExam(l.id, startedAt)} onSubmit={(answers, score) => submitExam(l.id, answers, score)} />
          )}
        </div>
      );
    }
    // exam/assignment as a PDF/Word file falls through to the generic downloadable-file
    // rendering below, same as a video/PDF/Word lesson — unless its window has closed.
    if (isExamLike && status === "closed") {
      return (
        <div key={l.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {lessonTypeIcon(type, 16)}
            <div style={{ color: COLORS.chalk, fontWeight: 700 }}>{l.title}</div>
          </div>
          {l.desc && <div style={{ color: COLORS.chalkDim, fontSize: 14 }}>{l.desc}</div>}
          <div style={{ color: COLORS.chalkPink, fontWeight: 700, fontSize: 14.5 }}>{t2.examWindowClosedMsg}</div>
        </div>
      );
    }

    if (type === "text") {
      return (
        <div key={l.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <button onClick={() => toggleWatched(l.id)} style={iconBtnStyle}>
              {watched ? <CheckCircle2 size={20} color={COLORS.chalkBlue} /> : <Circle size={20} color={COLORS.chalkDim} />}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ color: COLORS.chalk, fontWeight: 700, textDecoration: watched ? "line-through" : "none", opacity: watched ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                {lessonTypeIcon("text", 14)} {l.title}
              </div>
              {l.desc && <div style={{ color: COLORS.chalkDim, fontSize: 14 }}>{l.desc}</div>}
              {watched && entry.watchedAt && (
                <div style={{ color: COLORS.chalkDim, fontSize: 12.5, marginTop: 2 }}>{t.studiedOn(fmtDate(entry.watchedAt, lang))}</div>
              )}
              <div style={{ color: COLORS.chalk, fontSize: 15, marginTop: 8, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: l.content }} />
            </div>
          </div>
        </div>
      );
    }

    // video / pdf
    const embed = toEmbedUrl(l.url);
    return (
      <div key={l.id} style={{ ...rowStyle, flexWrap: "wrap", gap: 10, flexDirection: "column", alignItems: "stretch" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 200 }}>
            <button onClick={() => toggleWatched(l.id)} style={iconBtnStyle}>
              {watched ? <CheckCircle2 size={20} color={COLORS.chalkBlue} /> : <Circle size={20} color={COLORS.chalkDim} />}
            </button>
            <div>
              <div style={{ color: COLORS.chalk, fontWeight: 700, textDecoration: watched ? "line-through" : "none", opacity: watched ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                {lessonTypeIcon(type, 14)} {l.title}
              </div>
              {l.desc && <div style={{ color: COLORS.chalkDim, fontSize: 14 }}>{l.desc}</div>}
              {watched && entry.watchedAt && (
                <div style={{ color: COLORS.chalkDim, fontSize: 12.5, marginTop: 2 }}>{t.studiedOn(fmtDate(entry.watchedAt, lang))}</div>
              )}
            </div>
          </div>
          {l.url && !embed && (
            <a href={l.url} target="_blank" rel="noreferrer" style={{ color: COLORS.chalkYellow, display: "flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
              {type === "pdf" ? t.openPdf : t.openLesson} <ExternalLink size={14} />
            </a>
          )}
          {l.url && embed && l.allowDownload && (
            <a href={l.url} download target="_blank" rel="noreferrer" style={{ color: COLORS.chalkBlue, display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              {t.downloadFile} <Upload size={13} style={{ transform: "rotate(180deg)" }} />
            </a>
          )}
        </div>
        <div style={{ marginRight: 34 }}>
          <LessonEmbed lesson={l} t={t} />
        </div>
      </div>
    );
  };

  const renderTitleRow = (l, onOpen) => {
    const entry = (progress[student.id] && progress[student.id][l.id]) || null;
    const watched = entry && entry.watched;
    const isExamLike = l.type === "exam" || l.type === "assignment";
    const closed = isExamLike && examStatus(l) === "closed" && !(entry && entry.examScore);
    const t2 = l.type === "assignment" ? withAssignmentLabels(t, lang) : t;
    return (
      <button
        key={l.id}
        onClick={() => onOpen(l.id)}
        style={{ ...rowStyle, cursor: "pointer", width: "100%", textAlign: "start", fontFamily: "Cairo, sans-serif" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {watched ? <CheckCircle2 size={18} color={COLORS.chalkBlue} /> : <Circle size={18} color={COLORS.chalkDim} />}
          {lessonTypeIcon(l.type, 16)}
          <span style={{ color: COLORS.chalk, fontWeight: 700, textDecoration: watched ? "line-through" : "none", opacity: watched ? 0.75 : 1 }}>{l.title}</span>
          {closed && (
            <span style={{ color: COLORS.chalkPink, fontSize: 12, fontWeight: 700, border: `1px solid ${COLORS.chalkPink}`, borderRadius: 999, padding: "1px 8px" }}>
              {t2.examClosedBadge}
            </span>
          )}
        </span>
        <ArrowRight size={16} color={COLORS.chalkDim} style={{ transform: lang === "ar" ? "scaleX(-1)" : "none" }} />
      </button>
    );
  };

  const renderGroupedTitles = (grouped, emptyText, onOpen, emptyIcon) => {
    if (Object.keys(grouped).length === 0) return <EmptyNote text={emptyText} icon={emptyIcon} />;
    return Object.entries(grouped).map(([cat, items]) => (
      <div key={cat} style={{ marginBottom: 22 }}>
        <div style={{ color: COLORS.chalkBlue, fontWeight: 800, fontSize: 17, marginBottom: 8 }}>{cat}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{items.map((l) => renderTitleRow(l, onOpen))}</div>
      </div>
    ));
  };

  const openLesson = (id) => { setActiveLessonId(id); setView("lessonDetail"); };
  const openExam = (id) => { setActiveExamId(id); setView("examDetail"); };
  const openAssignment = (id) => { setActiveAssignmentId(id); setView("assignmentDetail"); };
  const activeLesson = activeLessonId ? lessonItems.find((l) => l.id === activeLessonId) : null;
  const activeExam = activeExamId ? examItems.find((l) => l.id === activeExamId) : null;
  const activeAssignment = activeAssignmentId ? assignmentItems.find((l) => l.id === activeAssignmentId) : null;

  return (
    <Board lang={lang}>
      <TopBar back={back} label={t.logout} lang={lang} setLang={setLang} />
      <Title lang={lang} sub={t.welcome(student.name)}>{t.brand}</Title>

      {view === "home" && (
        <div>
          <div style={{ maxWidth: 560, margin: "0 auto 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: COLORS.chalkDim, marginBottom: 6 }}>
              <span>{t.completed(stats.done, stats.total)}</span>
              <span>{stats.pct}%</span>
            </div>
            <div style={{ width: "100%", height: 8, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ width: `${stats.pct}%`, height: "100%", background: COLORS.chalkYellow, transition: "width 0.3s ease" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 26, justifyContent: "center" }}>
            <StatCard icon={<BookOpen size={18} />} value={lessonItems.length} label={t.tabLessons} color={COLORS.chalkYellow} />
            <StatCard icon={<ListChecks size={18} />} value={examItems.length} label={t.tabExams} color={COLORS.chalkBlue} />
            <StatCard icon={<ClipboardCheck size={18} />} value={assignmentItems.length} label={t.tabAssignments} color={COLORS.chalkGreen} />
            <StatCard icon={<TrendingUp size={18} />} value={`${stats.pct}%`} label={t.dashAvgProgress} color={COLORS.chalkPink} />
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <QuickTile icon={<BookOpen size={20} />} label={t.tabLessons} count={lessonItems.length} color={COLORS.chalkYellow} onClick={() => setView("lessons")} />
            <QuickTile icon={<ListChecks size={20} />} label={t.tabExams} count={examItems.length} color={COLORS.chalkBlue} onClick={() => setView("exams")} />
            <QuickTile icon={<ClipboardCheck size={20} />} label={t.tabAssignments} count={assignmentItems.length} color={COLORS.chalkGreen} onClick={() => setView("assignments")} />
            <QuickTile icon={<Settings size={20} />} label={t.tabSettings} color={COLORS.chalkPink} onClick={() => setView("settings")} />
          </div>
        </div>
      )}

      {view === "lessons" && (
        <div>
          <BackRow onBack={() => setView("home")} label={t.tabLessons} lang={lang} />
          {renderGroupedTitles(groupedLessons, t.noLessonsYet, openLesson, <BookOpen size={22} />)}
        </div>
      )}

      {view === "lessonDetail" && activeLesson && (
        <div>
          <BackRow onBack={() => setView("lessons")} label={t.tabLessons} lang={lang} />
          {renderItem(activeLesson)}
        </div>
      )}

      {view === "exams" && (
        <div>
          <BackRow onBack={() => setView("home")} label={t.tabExams} lang={lang} />
          {renderGroupedTitles(groupedExams, t.noExams, openExam, <ListChecks size={22} />)}
        </div>
      )}

      {view === "examDetail" && activeExam && (
        <div>
          <BackRow onBack={() => setView("exams")} label={t.tabExams} lang={lang} />
          {renderItem(activeExam)}
        </div>
      )}

      {view === "assignments" && (
        <div>
          <BackRow onBack={() => setView("home")} label={t.tabAssignments} lang={lang} />
          {renderGroupedTitles(groupedAssignments, withAssignmentLabels(t, lang).noExams, openAssignment, <ClipboardCheck size={22} />)}
        </div>
      )}

      {view === "assignmentDetail" && activeAssignment && (
        <div>
          <BackRow onBack={() => setView("assignments")} label={t.tabAssignments} lang={lang} />
          {renderItem(activeAssignment)}
        </div>
      )}

      {view === "settings" && (
        <div>
          <BackRow onBack={() => setView("home")} label={t.tabSettings} lang={lang} />
          <StudentSettingsTab t={t} student={student} students={students} setStudents={setStudents} />
        </div>
      )}
    </Board>
  );
}

/* ---------- root ---------- */

export default function App() {
  const [screen, setScreen] = useState("studentLogin");
  const [loaded, setLoaded] = useState(false);
  const [connError, setConnError] = useState(false);
  const [lang, setLang] = useState("en");
  const [students, setStudentsState] = useState([]);
  const [lessons, setLessonsState] = useState([]);
  const [classes, setClassesState] = useState([]);
  const [progress, setProgressState] = useState({});
  const [adminPass, setAdminPassState] = useState("2580");
  const [currentStudent, setCurrentStudent] = useState(null);
  const [loginLogs, setLoginLogs] = useState([]);

  useEffect(() => {
    const got = { students: false, lessons: false, classes: false, progress: false, settings: false };
    const checkLoaded = () => {
      if (got.students && got.lessons && got.classes && got.progress && got.settings) {
        setLoaded(true);
        setConnError(false);
      }
    };
    const unsub1 = subscribeToStudents((list) => { setStudentsState(list); got.students = true; checkLoaded(); });
    const unsub2 = subscribeToLessons((list) => { setLessonsState(list); got.lessons = true; checkLoaded(); });
    const unsub3 = subscribeToProgress((obj) => { setProgressState(obj); got.progress = true; checkLoaded(); });
    const unsub4 = subscribeToSettings((s) => { setAdminPassState(s.adminPass || "2580"); got.settings = true; checkLoaded(); });
    const unsub5 = subscribeToClasses((list) => { setClassesState(list); got.classes = true; checkLoaded(); });
    const unsub6 = subscribeToLoginLogs((list) => setLoginLogs(list));
    const timeout = setTimeout(() => {
      if (!loaded) setConnError(true);
    }, 8000);
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
      unsub6();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each setter below still takes the *whole* next array/object, exactly like the
  // old single-document version — every tab component (StudentsTab, LessonsTab,
  // StudentDashboard...) calls it the same way it always did. Under the hood it
  // now diffs against the previous value and writes only the documents that
  // actually changed, instead of rewriting one giant Firestore document.

  const setStudents = useCallback((next) => {
    setStudentsState((prev) => {
      const nextIds = new Set(next.map((s) => s.id));
      prev.forEach((s) => { if (!nextIds.has(s.id)) deleteStudent(s.id); });
      next.forEach((s) => {
        const old = prev.find((p) => p.id === s.id);
        if (!old) addStudent(s);
        else if (!sameData(old, s)) updateStudent(s.id, s);
      });
      return next;
    });
  }, []);

  const setLessons = useCallback((next) => {
    setLessonsState((prev) => {
      const nextIds = new Set(next.map((l) => l.id));
      prev.forEach((l) => { if (!nextIds.has(l.id)) deleteLesson(l.id); });
      next.forEach((l) => {
        const old = prev.find((p) => p.id === l.id);
        if (!old) addLesson(l);
        else if (!sameData(old, l)) updateLesson(l.id, l);
      });
      return next;
    });
  }, []);

  const setProgress = useCallback((next) => {
    setProgressState((prev) => {
      Object.entries(next).forEach(([studentId, lessonsMap]) => {
        const prevLessonsMap = prev[studentId] || {};
        Object.entries(lessonsMap).forEach(([lessonId, data]) => {
          if (!sameData(prevLessonsMap[lessonId], data)) setProgressEntry(studentId, lessonId, data);
        });
      });
      return next;
    });
  }, []);

  const setClasses = useCallback((next) => {
    setClassesState((prev) => {
      const nextIds = new Set(next.map((c) => c.id));
      prev.forEach((c) => { if (!nextIds.has(c.id)) deleteClass(c.id); });
      next.forEach((c) => {
        const old = prev.find((p) => p.id === c.id);
        if (!old) addClass(c);
        else if (!sameData(old, c)) updateClass(c.id, c);
      });
      return next;
    });
  }, []);

  const setAdminPass = useCallback((v) => { setAdminPassState(v); setAdminPassword(v); }, []);

  if (!loaded) {
    return (
      <Board lang={lang}>
        <Title lang={lang}>{T[lang].brand}</Title>
        <div style={{ textAlign: "center", color: connError ? COLORS.chalkPink : COLORS.chalkDim, fontSize: 15, lineHeight: 1.8 }}>
          {connError ? "Connection problem — check firebaseConfig.js" : T[lang].loading}
        </div>
      </Board>
    );
  }

  if (screen === "studentLogin")
    return (
      <StudentLogin
        students={students}
        lang={lang}
        setLang={setLang}
        onTeacher={() => setScreen("adminLogin")}
        onRegister={() => setScreen("studentRegister")}
        onFound={(s) => { recordLoginEvent("student", s.name); setCurrentStudent(s); setScreen("studentDashboard"); }}
      />
    );

  if (screen === "studentRegister")
    return (
      <StudentRegister
        classes={classes}
        students={students}
        setStudents={setStudents}
        back={() => setScreen("studentLogin")}
        lang={lang}
        setLang={setLang}
      />
    );

  if (screen === "adminLogin")
    return <AdminLogin back={() => setScreen("studentLogin")} onSuccess={() => setScreen("adminDashboard")} adminPass={adminPass} lang={lang} setLang={setLang} />;

  if (screen === "adminDashboard")
    return (
      <AdminDashboard
        back={() => setScreen("studentLogin")}
        students={students}
        setStudents={setStudents}
        lessons={lessons}
        setLessons={setLessons}
        classes={classes}
        setClasses={setClasses}
        progress={progress}
        setProgress={setProgress}
        adminPass={adminPass}
        setAdminPass={setAdminPass}
        loginLogs={loginLogs}
        lang={lang}
        setLang={setLang}
      />
    );

  if (screen === "studentDashboard") {
    const liveStudent = students.find((s) => s.id === currentStudent.id) || currentStudent;
    return (
      <StudentDashboard
        back={() => { setCurrentStudent(null); setScreen("studentLogin"); }}
        student={liveStudent}
        students={students}
        setStudents={setStudents}
        lessons={lessons}
        progress={progress}
        setProgress={setProgress}
        lang={lang}
        setLang={setLang}
      />
    );
  }

  return null;
}
