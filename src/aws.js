import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import outputs from "../amplify_outputs.json";

// ملف بديل لـ firebase.js، بنفس الـ API بالظبط (subscribeToX / addX / updateX / deleteX)
// عشان App.jsx متتغيرش خالص — بس مصدر البيانات بقى AWS (AppSync + DynamoDB) بدل Firestore.
// amplify_outputs.json بيتولد تلقائي أول ما تشغّل `npx ampx sandbox` أو تعمل نشر على
// Amplify Hosting — لحد ما ده يحصل، الملف ده مش هيشتغل.

Amplify.configure(outputs);

const client = generateClient();

const DEFAULT_ADMIN_PASS = "2580";

/* ---------- students ---------- */

export function subscribeToStudents(callback) {
  const sub = client.models.Student.observeQuery().subscribe({
    next: ({ items }) => callback(items),
    error: (err) => console.error("students sync error:", err),
  });
  return () => sub.unsubscribe();
}
export async function addStudent(student) {
  const { id, ...data } = student;
  try {
    await client.models.Student.create({ id, ...data });
  } catch (e) {
    console.error("addStudent error:", e);
  }
}
export async function updateStudent(id, patch) {
  try {
    await client.models.Student.update({ id, ...patch });
  } catch (e) {
    console.error("updateStudent error:", e);
  }
}
export async function deleteStudent(id) {
  try {
    await client.models.Student.delete({ id });
  } catch (e) {
    console.error("deleteStudent error:", e);
  }
}

/* ---------- lessons ---------- */

export function subscribeToLessons(callback) {
  const sub = client.models.Lesson.observeQuery().subscribe({
    next: ({ items }) => callback(items),
    error: (err) => console.error("lessons sync error:", err),
  });
  return () => sub.unsubscribe();
}
export async function addLesson(lesson) {
  const { id, ...data } = lesson;
  try {
    await client.models.Lesson.create({ id, ...data });
  } catch (e) {
    console.error("addLesson error:", e);
  }
}
export async function updateLesson(id, patch) {
  try {
    await client.models.Lesson.update({ id, ...patch });
  } catch (e) {
    console.error("updateLesson error:", e);
  }
}
export async function deleteLesson(id) {
  try {
    await client.models.Lesson.delete({ id });
  } catch (e) {
    console.error("deleteLesson error:", e);
  }
}

/* ---------- progress ---------- */
// نفس فكرة Firestore: مستند واحد لكل (studentId, lessonId)، الـ id هو
// `${studentId}__${lessonId}` عشان زرار واحد يكتب مستند صغير واحد بس.

export function subscribeToProgress(callback) {
  const sub = client.models.Progress.observeQuery().subscribe({
    next: ({ items }) => {
      const out = {};
      items.forEach((data) => {
        const { studentId, lessonId } = data;
        if (!studentId || !lessonId) return;
        out[studentId] = out[studentId] || {};
        out[studentId][lessonId] = data;
      });
      callback(out);
    },
    error: (err) => console.error("progress sync error:", err),
  });
  return () => sub.unsubscribe();
}
export async function setProgressEntry(studentId, lessonId, data) {
  const id = `${studentId}__${lessonId}`;
  try {
    const { data: existing } = await client.models.Progress.get({ id });
    if (existing) {
      await client.models.Progress.update({ id, ...data });
    } else {
      await client.models.Progress.create({ id, studentId, lessonId, ...data });
    }
  } catch (e) {
    console.error("setProgressEntry error:", e);
  }
}

/* ---------- classes ---------- */

export function subscribeToClasses(callback) {
  const sub = client.models.ClassGroup.observeQuery().subscribe({
    next: ({ items }) => callback(items),
    error: (err) => console.error("classes sync error:", err),
  });
  return () => sub.unsubscribe();
}
export async function addClass(cls) {
  const { id, ...data } = cls;
  try {
    await client.models.ClassGroup.create({ id, ...data });
  } catch (e) {
    console.error("addClass error:", e);
  }
}
export async function updateClass(id, patch) {
  try {
    await client.models.ClassGroup.update({ id, ...patch });
  } catch (e) {
    console.error("updateClass error:", e);
  }
}
export async function deleteClass(id) {
  try {
    await client.models.ClassGroup.delete({ id });
  } catch (e) {
    console.error("deleteClass error:", e);
  }
}

/* ---------- settings ---------- */
// صف واحد بس، بنفس المعرف الثابت "main" زي ما كان في Firestore.

export function subscribeToSettings(callback) {
  const sub = client.models.Settings.observeQuery().subscribe({
    next: async ({ items }) => {
      const main = items.find((s) => s.id === "main");
      if (main) {
        callback({ adminPass: DEFAULT_ADMIN_PASS, ...main });
      } else {
        try {
          await client.models.Settings.create({ id: "main", adminPass: DEFAULT_ADMIN_PASS });
        } catch (e) {
          console.error(e);
        }
        callback({ adminPass: DEFAULT_ADMIN_PASS });
      }
    },
    error: (err) => console.error("settings sync error:", err),
  });
  return () => sub.unsubscribe();
}
export async function setAdminPassword(pass) {
  try {
    const { data: existing } = await client.models.Settings.get({ id: "main" });
    if (existing) {
      await client.models.Settings.update({ id: "main", adminPass: pass });
    } else {
      await client.models.Settings.create({ id: "main", adminPass: pass });
    }
  } catch (e) {
    console.error("setAdminPassword error:", e);
  }
}
