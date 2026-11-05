/** ชนิดอุปกรณ์ที่ต่อกับขา — กำหนดทั้งโค้ดที่เจน และ UI บนหน้า Dashboard */
export type DeviceType = "switch" | "light" | "relay" | "motor" | "buzzer" | "button" | "sensor" | "analog";

export interface DeviceTypeInfo {
  label: string;
  desc: string;
  mode: "OUTPUT" | "INPUT";
  /** digital = 0/1, pwm = 0–255, analog = 0–4095 */
  signal: "digital" | "pwm" | "analog";
}

export const DEVICE_TYPES: Record<DeviceType, DeviceTypeInfo> = {
  switch: { label: "สวิตช์เปิด/ปิด", desc: "สั่งเปิดปิดจากหน้าเว็บ", mode: "OUTPUT", signal: "digital" },
  light: { label: "ไฟสถานะ / LED", desc: "หลอดไฟบนหน้าเว็บ กดเพื่อเปิดปิด", mode: "OUTPUT", signal: "digital" },
  relay: { label: "รีเลย์ / ปลั๊กไฟ", desc: "ควบคุมเครื่องใช้ไฟฟ้า", mode: "OUTPUT", signal: "digital" },
  motor: { label: "มอเตอร์ / พัดลม", desc: "ปรับความเร็ว 0–100%", mode: "OUTPUT", signal: "pwm" },
  buzzer: { label: "บัซเซอร์ / เสียง", desc: "สั่งให้ส่งเสียง", mode: "OUTPUT", signal: "digital" },
  button: { label: "ปุ่มกด", desc: "ดูว่าปุ่มถูกกดอยู่ไหม", mode: "INPUT", signal: "digital" },
  sensor: { label: "เซนเซอร์ (ตรวจจับ)", desc: "เช่น PIR, IR, ประตู — ตรวจพบ/ปกติ", mode: "INPUT", signal: "digital" },
  analog: { label: "เซนเซอร์ค่าต่อเนื่อง", desc: "เช่น ความชื้นดิน, แสง — อ่านค่า 0–4095", mode: "INPUT", signal: "analog" },
};

export const OUTPUT_TYPES = (Object.keys(DEVICE_TYPES) as DeviceType[]).filter((t) => DEVICE_TYPES[t].mode === "OUTPUT");
export const INPUT_TYPES = (Object.keys(DEVICE_TYPES) as DeviceType[]).filter((t) => DEVICE_TYPES[t].mode === "INPUT");

export type PinLevel = "HIGH" | "LOW";
export type PinPull = "NONE" | "PULLUP" | "PULLDOWN";

export interface PinConfig {
  id: string;
  gpio: number;
  name: string;
  type: DeviceType;
  /** ค่าเริ่มต้นของขาออกแบบ digital */
  level: PinLevel;
  /** ตัวต้านทานภายในของขาเข้าแบบ digital */
  pull: PinPull;
}

export const modeOf = (p: Pick<PinConfig, "type">) => DEVICE_TYPES[p.type]?.mode ?? "OUTPUT";

/** ค่าเริ่มต้นที่เซิร์ฟเวอร์ใช้สำหรับขาออก */
export const initialOutput = (p: PinConfig) => (DEVICE_TYPES[p.type].signal === "pwm" ? 0 : p.level === "HIGH" ? 1 : 0);

/** ปุ่ม/เซนเซอร์ที่ใช้ PULLUP จะ "ทำงาน" เมื่ออ่านได้ LOW */
export const isActive = (p: PinConfig, raw: number | undefined) =>
  raw === undefined ? false : p.pull === "PULLUP" ? raw === 0 : raw === 1;

export const displayName = (p: Pick<PinConfig, "name" | "type" | "gpio">) => p.name || `${DEVICE_TYPES[p.type].label} (GPIO ${p.gpio})`;
