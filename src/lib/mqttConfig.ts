import { DEVICE_TYPES, type DeviceType, type PinConfig } from "./devices";

export const MQTT = {
  /** เบราว์เซอร์ต่อผ่าน WebSocket */
  wsUrl: "wss://0d495914d04845f5914e55fd3e65c6e4.s1.eu.hivemq.cloud:8884/mqtt",
  /** บอร์ดต่อผ่าน TCP */
  host: "0d495914d04845f5914e55fd3e65c6e4.s1.eu.hivemq.cloud",
  port: 8883,
  tls: true,
  username: "ttwatchesyou",
  password: "Greenpig001",
  prefix: "esp32studio",
} as const;

export const isPublicBroker = !MQTT.username;

/** หัวข้อ MQTT ของบอร์ด 1 ตัว */
export const topics = (uid: string) => {
  const base = `${MQTT.prefix}/${uid}/`;
  return {
    base,
    all: `${base}#`,
    status: `${base}status`,
    config: `${base}config`,
    text: `${base}text`,
    out: (gpio: number | string) => `${base}out/${gpio}`,
    state: (gpio: number | string) => `${base}state/${gpio}`,
    input: (gpio: number | string) => `${base}in/${gpio}`,
  };
};

/** UID สุ่ม 12 ตัว (a-z0-9) — เดายาก ใช้เป็นที่อยู่ Dashboard: /d/<uid> */
export function newUid(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** UID/topic ที่คงที่และไม่ซ้ำกันต่อบอร์ด จาก hardware MAC 48 บิต */
export function uidFromMac(mac: string): string {
  const hex = mac.toLowerCase().replace(/[^0-9a-f]/g, "");
  if (hex.length !== 12) throw new Error("อ่าน MAC address ของบอร์ดไม่ได้");
  return `esp32${hex}`;
}

export const isValidUid = (s: string) => /^[a-z0-9]{6,32}$/.test(s);

/** ข้อมูลบอร์ดที่เก็บแบบ retained บน broker — เปิดลิงก์จากเครื่องไหนก็เห็น */
export interface BoardConfig {
  v: 1;
  name: string;
  board: string;
  mac?: string;
  pins: PinConfig[];
}

/** แบบย่อเพื่อให้ฝังในเฟิร์มแวร์ได้ (ข้อความสั้น) */
export function encodeConfig(c: BoardConfig): string {
  return JSON.stringify({
    v: 1,
    n: c.name,
    b: c.board,
    m: c.mac,
    p: c.pins.map((p) => ({ g: p.gpio, t: p.type, n: p.name, l: p.level === "HIGH" ? 1 : 0, u: p.pull === "PULLUP" ? 1 : p.pull === "PULLDOWN" ? 2 : 0 })),
  });
}

export function decodeConfig(raw: string): BoardConfig | null {
  try {
    const j = JSON.parse(raw);
    if (!j || !Array.isArray(j.p)) return null;
    return {
      v: 1,
      name: String(j.n ?? "บอร์ด"),
      board: String(j.b ?? ""),
      mac: j.m ? String(j.m) : undefined,
      pins: j.p
        .filter((p: { t: string }) => p && p.t in DEVICE_TYPES)
        .map((p: { g: number; t: DeviceType; n?: string; l?: number; u?: number }) => ({
          id: String(p.g),
          gpio: Number(p.g),
          type: p.t,
          name: String(p.n ?? ""),
          level: p.l ? "HIGH" : "LOW",
          pull: p.u === 1 ? "PULLUP" : p.u === 2 ? "PULLDOWN" : "NONE",
        })),
    };
  } catch {
    return null;
  }
}
