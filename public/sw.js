// Service worker مبسّط: مش بيخزن أي حاجة (كل طلب بيروح للسيرفر مباشرة)،
// وبيمسح أي كاش قديم اترفع من نسخ سابقة عشان الموقع يفضل دايمًا محدّث.
const VERSION = "hamdi-baccar-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // متتدخلش خالص في أي طلب مش GET (زي رفع الملفات) أو رايح لموقع تاني
  // (زي Cloudinary أو Firebase) — سيبه يمشي عادي من غير ما الـ service worker يلمسه.
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request));
});
