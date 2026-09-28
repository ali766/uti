import { uploadData, getUrl } from "aws-amplify/storage";

// بديل لـ uploadToCloudinary: بيرفع الملف على S3 (عن طريق Amplify Storage) وبيرجع
// رابط دائم للملف. onProgress(pct) بتتنادى بنسبة الرفع من 0 لـ 100.
export async function uploadToS3(file, onProgress) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `lessons/${Date.now()}_${safeName}`;

  const task = uploadData({
    path,
    data: file,
    options: {
      contentType: file.type || "application/octet-stream",
      onProgress: ({ transferredBytes, totalBytes }) => {
        if (totalBytes && onProgress) {
          onProgress(Math.round((transferredBytes / totalBytes) * 100));
        }
      },
    },
  });

  await task.result;
  const { url } = await getUrl({ path });
  return url.toString();
}
