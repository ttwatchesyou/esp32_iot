export interface BoardDef {
  id: string;
  label: string;
  /** ชื่อสั้นที่แสดงบนการ์ด */
  short: string;
  /** ข้อความช่วยให้ผู้ใช้รู้ว่าเป็นรุ่นนี้ */
  hint: string;
  /** Fully Qualified Board Name สำหรับ arduino-cli */
  fqbn: string;
  /** address ของ bootloader เมื่อแฟลชแยกไฟล์ */
  bootloaderAddress: number;
  /** ขา GPIO ที่ใช้งานได้ทั้งหมดของชิป */
  pins: PinInfo[];
  /** รูปแบบบอร์ดที่รู้จัก (ใช้วาดรูป) — ถ้าไม่แน่ใจ ผู้ใช้เลือกจากเลข GPIO ได้เสมอ */
  layouts: BoardLayout[];
}

export interface BoardLayout {
  id: string;
  label: string;
  /** บนลงล่าง */
  left: HeaderPin[];
  right: HeaderPin[];
}

/** ขาบนหัวต่อของบอร์ด: gpio = ขาที่ตั้งค่าได้, ไม่มี gpio = ขาไฟ/ระบบ */
export interface HeaderPin {
  label: string;
  gpio?: number;
}

export interface PinInfo {
  gpio: number;
  /** ใช้เป็นขาเข้าได้อย่างเดียว */
  inputOnly?: boolean;
  /** หมายเหตุสั้น ๆ */
  note?: string;
}

/** ไม่รู้ว่าบอร์ดกี่ขา → เลือกจากเลข GPIO */
export const GENERIC_LAYOUT = "gpio";

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const mk = (gpios: number[], notes: Record<number, string> = {}, inputOnly: number[] = []): PinInfo[] =>
  gpios.map((g) => ({ gpio: g, note: notes[g], inputOnly: inputOnly.includes(g) || undefined }));

const ESP32_PINS = mk(
  [0, 2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39],
  { 0: "ปุ่ม BOOT", 2: "LED บนบอร์ด", 12: "ห้าม HIGH ตอนบูต", 21: "SDA", 22: "SCL", 34: "ขาเข้าเท่านั้น", 35: "ขาเข้าเท่านั้น", 36: "ขาเข้าเท่านั้น (VP)", 39: "ขาเข้าเท่านั้น (VN)" },
  [34, 35, 36, 39],
);
const S3_PINS = mk([0, ...range(1, 18), 21, ...range(38, 48)], { 0: "ปุ่ม BOOT", 48: "RGB LED (บางรุ่น)", 8: "SDA", 9: "SCL" });
const C3_PINS = mk([...range(0, 10), 20, 21], { 8: "LED บนบอร์ด (บางรุ่น)", 9: "ปุ่ม BOOT", 20: "RX", 21: "TX" });
const C6_PINS = mk([...range(0, 9), ...range(15, 23)], { 8: "RGB LED (บางรุ่น)", 9: "ปุ่ม BOOT" });

const g = (n: number, label = `D${n}`): HeaderPin => ({ label, gpio: n });
const fixed = (label: string): HeaderPin => ({ label });

/** ESP32 DevKit V1 — 30 ขา (15 ต่อข้าง) */
const ESP32_30: BoardLayout = {
  id: "esp32-30",
  label: "30 ขา",
  left: [fixed("EN"), g(36, "VP"), g(39, "VN"), g(34), g(35), g(32), g(33), g(25), g(26), g(27), g(14), g(12), g(13), fixed("GND"), fixed("VIN")],
  right: [g(23), g(22), fixed("TX0"), fixed("RX0"), g(21), g(19), g(18), g(5), g(17, "TX2"), g(16, "RX2"), g(4), g(0, "D0"), g(2), g(15), fixed("3V3")],
};

/** ESP32-DevKitC — 38 ขา (19 ต่อข้าง) */
const ESP32_38: BoardLayout = {
  id: "esp32-38",
  label: "38 ขา",
  left: [fixed("3V3"), fixed("EN"), g(36, "VP"), g(39, "VN"), g(34, "IO34"), g(35, "IO35"), g(32, "IO32"), g(33, "IO33"), g(25, "IO25"), g(26, "IO26"), g(27, "IO27"), g(14, "IO14"), g(12, "IO12"), fixed("GND"), g(13, "IO13"), fixed("SD2"), fixed("SD3"), fixed("CMD"), fixed("5V")],
  right: [fixed("GND"), g(23, "IO23"), g(22, "IO22"), fixed("TX"), fixed("RX"), g(21, "IO21"), fixed("GND"), g(19, "IO19"), g(18, "IO18"), g(5, "IO5"), g(17, "IO17"), g(16, "IO16"), g(4, "IO4"), g(0, "IO0"), g(2, "IO2"), g(15, "IO15"), fixed("SD1"), fixed("SD0"), fixed("CLK")],
};

export const BOARDS: BoardDef[] = [
  {
    id: "esp32", label: "ESP32 Dev Module", short: "ESP32", hint: "บนกล่องโลหะเขียน ESP32-WROOM / ESP32-WROVER",
    fqbn: "esp32:esp32:esp32", bootloaderAddress: 0x1000, pins: ESP32_PINS, layouts: [ESP32_30, ESP32_38],
  },
  {
    id: "esp32s3", label: "ESP32-S3 Dev Module", short: "ESP32-S3", hint: "เขียน ESP32-S3 · มักมีพอร์ต USB 2 ช่อง",
    fqbn: "esp32:esp32:esp32s3", bootloaderAddress: 0x0, pins: S3_PINS, layouts: [],
  },
  {
    id: "esp32c3", label: "ESP32-C3 Dev Module", short: "ESP32-C3", hint: "เขียน ESP32-C3 · บอร์ดขนาดเล็ก",
    fqbn: "esp32:esp32:esp32c3", bootloaderAddress: 0x0, pins: C3_PINS, layouts: [],
  },
  {
    id: "esp32c6", label: "ESP32-C6 Dev Module", short: "ESP32-C6", hint: "เขียน ESP32-C6 · รองรับ WiFi 6",
    fqbn: "esp32:esp32:esp32c6", bootloaderAddress: 0x0, pins: C6_PINS, layouts: [],
  },
];

/** ชิปแปลง USB → Serial ที่พบบ่อย (ดูจาก USB Vendor ID) */
export interface UsbBridge {
  id: string;
  name: string;
  /** ตัวหนังสือบนชิปเล็ก ๆ ใกล้ช่อง USB */
  marking: string;
  vendorId?: number;
  driver: string;
  driverUrl?: string;
}

export const USB_BRIDGES: UsbBridge[] = [
  {
    id: "ch340", name: "CH340 / CH341", marking: "CH340G, CH340C, CH340K", vendorId: 0x1a86,
    driver: "ต้องลงไดรเวอร์ CH341SER บน Windows (บางเครื่อง Windows Update ลงให้เอง)",
    driverUrl: "https://www.wch-ic.com/downloads/CH341SER_EXE.html",
  },
  {
    id: "ch9102", name: "CH9102 / CH343", marking: "CH9102F, CH343P", vendorId: 0x1a86,
    driver: "ต้องลงไดรเวอร์ CH343SER บน Windows",
    driverUrl: "https://www.wch-ic.com/downloads/CH343SER_EXE.html",
  },
  {
    id: "cp210x", name: "CP2102 / CP2104", marking: "SILABS CP2102", vendorId: 0x10c4,
    driver: "ต้องลงไดรเวอร์ CP210x VCP ของ Silicon Labs",
    driverUrl: "https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers",
  },
  {
    id: "native", name: "USB ในตัวชิป (S3 / C3 / C6)", marking: "ไม่มีชิปแยก หรือเสียบช่องที่เขียน USB", vendorId: 0x303a,
    driver: "Windows 10/11 ไม่ต้องลงไดรเวอร์",
  },
];

/** เดาชิป USB จาก VID/PID ที่เบราว์เซอร์ให้มา */
export function detectBridge(vendorId?: number, productId?: number): UsbBridge | undefined {
  if (vendorId === 0x1a86) return USB_BRIDGES.find((b) => b.id === (productId === 0x55d4 || productId === 0x55d3 ? "ch9102" : "ch340"));
  return USB_BRIDGES.find((b) => b.vendorId === vendorId);
}

export const BAUD_RATES = [9600, 57600, 115200, 230400, 460800, 921600];

export interface FlashImage {
  address: number;
  name: string;
  data: Uint8Array;
}

export const hex = (n: number) => "0x" + n.toString(16).padStart(4, "0");
