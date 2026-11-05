"use client";

/** บอร์ดที่เครื่องนี้เคยลงทะเบียนหรือเปิดดู — ไว้แสดงในหน้า "บอร์ดของฉัน" */
export interface LocalDevice {
  uid: string;
  name: string;
}

const KEY = "esp32-iot-studio:boards";

export function listLocalDevices(): LocalDevice[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalDevice[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalDevice(d: LocalDevice) {
  const list = listLocalDevices().filter((x) => x.uid !== d.uid);
  try {
    localStorage.setItem(KEY, JSON.stringify([...list, d]));
  } catch {}
}

export function removeLocalDevice(uid: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(listLocalDevices().filter((x) => x.uid !== uid)));
  } catch {}
}
