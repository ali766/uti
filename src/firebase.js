import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, addDoc, query, orderBy, limit } from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const studentsCol = collection(db, "students");
const lessonsCol = collection(db, "lessons");
const progressCol = collection(db, "progress");
const classesCol = collection(db, "classes");
const settingsDocRef = doc(db, "settings", "main");
const loginLogsCol = collection(db, "loginLogs");

const DEFAULT_ADMIN_PASS = "2580";

/* ---------- students ---------- */

export function subscribeToStudents(callback) {
  return onSnapshot(
    studentsCol,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error("students sync error:", err)
  );
}
export async function addStudent(student) {
  const { id, ...data } = student;
  try {
    await setDoc(doc(studentsCol, id), data);
  } catch (e) {
    console.error("addStudent error:", e);
  }
}
export async function updateStudent(id, patch) {
  try {
    await setDoc(doc(studentsCol, id), patch, { merge: true });
  } catch (e) {
    console.error("updateStudent error:", e);
  }
}
export async function deleteStudent(id) {
  try {
    await deleteDoc(doc(studentsCol, id));
  } catch (e) {
    console.error("deleteStudent error:", e);
  }
}

/* ---------- lessons ---------- */

export function subscribeToLessons(callback) {
  return onSnapshot(
    lessonsCol,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error("lessons sync error:", err)
  );
}
export async function addLesson(lesson) {
  const { id, ...data } = lesson;
  try {
    await setDoc(doc(lessonsCol, id), data);
  } catch (e) {
    console.error("addLesson error:", e);
  }
}
export async function updateLesson(id, patch) {
  try {
    await setDoc(doc(lessonsCol, id), patch, { merge: true });
  } catch (e) {
    console.error("updateLesson error:", e);
  }
}
export async function deleteLesson(id) {
  try {
    await deleteDoc(doc(lessonsCol, id));
  } catch (e) {
    console.error("deleteLesson error:", e);
  }
}

/* ---------- progress ---------- */
// One document per (studentId, lessonId) pair, id = `${studentId}__${lessonId}`.
// This lets a single lesson toggle write one small doc instead of rewriting
// the whole progress tree for every student.

export function subscribeToProgress(callback) {
  return onSnapshot(
    progressCol,
    (snap) => {
      const out = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const { studentId, lessonId } = data;
        if (!studentId || !lessonId) return;
        out[studentId] = out[studentId] || {};
        out[studentId][lessonId] = data;
      });
      callback(out);
    },
    (err) => console.error("progress sync error:", err)
  );
}
export async function setProgressEntry(studentId, lessonId, data) {
  const id = `${studentId}__${lessonId}`;
  try {
    await setDoc(doc(progressCol, id), { studentId, lessonId, ...data }, { merge: true });
  } catch (e) {
    console.error("setProgressEntry error:", e);
  }
}

/* ---------- classes ---------- */

export function subscribeToClasses(callback) {
  return onSnapshot(
    classesCol,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error("classes sync error:", err)
  );
}
export async function addClass(cls) {
  const { id, ...data } = cls;
  try {
    await setDoc(doc(classesCol, id), data);
  } catch (e) {
    console.error("addClass error:", e);
  }
}
export async function updateClass(id, patch) {
  try {
    await setDoc(doc(classesCol, id), patch, { merge: true });
  } catch (e) {
    console.error("updateClass error:", e);
  }
}
export async function deleteClass(id) {
  try {
    await deleteDoc(doc(classesCol, id));
  } catch (e) {
    console.error("deleteClass error:", e);
  }
}

/* ---------- settings ---------- */

export function subscribeToSettings(callback) {
  return onSnapshot(
    settingsDocRef,
    (snap) => {
      if (snap.exists()) {
        callback({ adminPass: DEFAULT_ADMIN_PASS, ...snap.data() });
      } else {
        setDoc(settingsDocRef, { adminPass: DEFAULT_ADMIN_PASS }).catch((e) => console.error(e));
        callback({ adminPass: DEFAULT_ADMIN_PASS });
      }
    },
    (err) => console.error("settings sync error:", err)
  );
}
export async function setAdminPassword(pass) {
  try {
    await setDoc(settingsDocRef, { adminPass: pass }, { merge: true });
  } catch (e) {
    console.error("setAdminPassword error:", e);
  }
}

/* ---------- login logs ---------- */
// One doc per login attempt (student or teacher), kept for the teacher's
// "who logged in, from where" screen. Newest 300 only, to keep the read light.

export function subscribeToLoginLogs(callback) {
  const q = query(loginLogsCol, orderBy("at", "desc"), limit(300));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error("loginLogs sync error:", err)
  );
}
export async function addLoginLog(entry) {
  try {
    await addDoc(loginLogsCol, { at: new Date().toISOString(), ...entry });
  } catch (e) {
    console.error("addLoginLog error:", e);
  }
}
