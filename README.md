# Hamdi Baccar

منصة دروس بسيطة: صفحة دخول للطالب (اسم مستخدم + كلمة سر، بيديهملها المدرّس)، ولوحة تحكم للمدرّس (طلاب، دروس، متابعة مذاكرة، تحديد مين يشوف إيه). البيانات متزامنة لحظيًا بين كل الأجهزة عن طريق Firebase Firestore — مجانية بالكامل، مش محتاجة أي خطة مدفوعة.

## الخطوة ١: اعمل مشروع Firebase (مجاني)

1. روح على https://console.firebase.google.com وسجّل دخول بحساب جوجل.
2. دوس "Add project" وسمّي المشروع أي اسم.
3. من القايمة الجانبية: **Build -> Firestore Database -> Create database**.
   - اختار **Start in production mode**.
   - اختار أقرب منطقة ليك.
4. من **Project settings** (أيقونة الترس فوق) -> نزّل لحد **"Your apps"** -> دوس أيقونة الويب `</>`.
5. سمّي التطبيق أي اسم، وهيديك object فيه `apiKey`, `authDomain`, `projectId`... إلخ.
6. انسخ القيم دي وحطها في `src/firebaseConfig.js` بدل القيم الوهمية.

## الخطوة ٢: ظبّط صلاحيات Firestore

في Firestore -> تبويب **Rules**، حط القاعدة دي:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /students/{studentId} {
      allow read, write: if true;
    }
    match /lessons/{lessonId} {
      allow read, write: if true;
    }
    match /classes/{classId} {
      allow read, write: if true;
    }
    match /progress/{progressId} {
      allow read, write: if true;
    }
    match /settings/{docId} {
      allow read, write: if true;
    }
  }
}
```

> ملحوظة: لو عندك مشروع قديم كان شغال بالطريقة القديمة (مستند واحد اسمه `lms/data`)، البيانات دي مش هتتنقل تلقائيًا — المنصة دلوقتي بتقرأ وتكتب في 4 مجموعات منفصلة (`students`, `lessons`, `progress`, `settings`) بدل مستند واحد، عشان كل تعديل بسيط (زي تحديد طالب شاف درس) يكتب مستند صغير واحد بدل ما يعيد كتابة كل الداتا بيز من الأول في كل مرة.

## الخطوة ٣: ارفع المشروع على GitHub وفعّل النشر

1. ارفع كل ملفات المشروع لريبو جديد على GitHub (drag & drop أو `git push`).
2. **Settings -> Pages** -> تحت "Build and deployment" اختار **Source: GitHub Actions**.
3. تبويب **Actions** هيشغّل الـ workflow لوحده (ملف `.github/workflows/deploy.yml`).
4. الرابط هيبان في نفس صفحة Pages، شكله: `https://USERNAME.github.io/REPO/`.

كل مرة ترفع تعديل على `main`، الموقع بيتحدّث لوحده.

## الدروس: فيديو وPDF من غير أي تكلفة

في تبويب "الدروس" فيه طريقتين لإضافة فيديو أو PDF:

1. **رفع حقيقي من الموقع** (زرار "ارفع فيديو أو PDF") — الملف بيترفع فعليًا على خدمة **Cloudinary** المجانية وبياخد رابط تلقائي. محتاج تظبط الحساب مرة واحدة (خطوة ٤ تحت).
2. **أو تلصق رابط** جاهز بدل الرفع:
   - **يوتيوب** (Unlisted) -> بيظهر كفيديو شغال جوه الصفحة.
   - **Google Drive** (مشاركة "Anyone with the link") -> بيظهر كمعاينة جوه الصفحة (فيديو أو PDF).
   - أي رابط تاني -> بيظهر كزرار "افتح الدرس".

## الخطوة ٤: ظبّط الرفع الحقيقي (Cloudinary - مجاني)

عشان زرار "ارفع فيديو أو PDF" يشتغل فعليًا، محتاج حساب Cloudinary مجاني (بياديك حوالي 25 جيجا مساحة مجانًا):

1. روح https://cloudinary.com واعمل حساب مجاني (Sign up).
2. بعد الدخول، هتلاقي في أول صفحة (Dashboard) اسم حسابك جنب "Cloud name" — انسخه.
3. من القايمة الجانبية أو الترس: **Settings -> Upload** -> نزّل لحد **Upload presets** -> **Add upload preset**.
   - غيّر **Signing Mode** من `Signed` لـ **`Unsigned`** (خطوة مهمة جدًا).
   - احفظ (Save)، وانسخ اسم البريست اللي هيتعمل (أو غيّره لاسم سهل تفتكره).
4. افتح `src/cloudinaryConfig.js` وحط القيمتين:
   ```js
   export const cloudinaryConfig = {
     cloudName: "اسم_الكلاود_بتاعك",
     uploadPreset: "اسم_البريست_بتاعك",
   };
   ```
5. ارفع التعديل على GitHub — الموقع هيتحدّث لوحده وزرار الرفع هيشتغل.

> لحد ما تظبط القيمتين دول، زرار الرفع هيديك رسالة "خدمة الرفع لسه مش متظبطة" وتقدر تكمل باستخدام رابط عادي في نفس الوقت.

## تسجيل دخول الطلاب

من تبويب "الطلاب"، تضيف اسم + اسم مستخدم + كلمة سر لكل طالب (أو تولّد كلمة سر عشوائية بزرار)، وتبعتلهم البيانات (فيه زرار نسخ سريع). الطالب بيدخل بيهم مباشرة، من غير أي كود تأكيد.

## تحويله لتطبيق أندرويد (APK)

المشروع مجهّز كـ PWA (فيه `manifest.json` وأيقونة). بعد ما الموقع يشتغل:
1. روح https://www.pwabuilder.com
2. حط رابط موقعك ودوس Start.
3. اختار Android -> APK.
4. حمّل الملف وابعته لأي طالب يثبته على تليفونه.

## كلمة سر المدرّس الافتراضية

`2580` — تقدر تغيّرها من تبويب "الإعدادات" جوه لوحة المدرّس.
