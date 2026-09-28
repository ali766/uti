import { cloudinaryConfig } from "./cloudinaryConfig";

// بيرفع ملف (فيديو أو PDF أو أي حاجة) على Cloudinary باستخدام الـ Upload Preset
// المفتوح (Unsigned) اللي عملته في حسابك، وبيرجع رابط الملف النهائي (secure_url).
// onProgress(pct) بتتنادى بنسبة الرفع من 0 لـ 100 عشان نعرض progress bar.
export function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (
      !cloudinaryConfig.cloudName ||
      cloudinaryConfig.cloudName.includes("ضع_") ||
      !cloudinaryConfig.uploadPreset ||
      cloudinaryConfig.uploadPreset.includes("ضع_")
    ) {
      reject(new Error("cloudinary-not-configured"));
      return;
    }

    const url = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", cloudinaryConfig.uploadPreset);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
          resolve(data.secure_url);
        } else {
          reject(new Error(data?.error?.message || "upload-failed"));
        }
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error("network-error"));

    xhr.send(formData);
  });
}
