# ESP32 IoT Studio

เว็บสำหรับทำโปรเจค IoT บน ESP32 — เขียนโค้ด Arduino, คอมไพล์, **อัปโหลดลงบอร์ดผ่าน USB จากเบราว์เซอร์โดยตรง** และดู Serial Monitor

**Stack:** Next.js 16 (App Router) · TypeScript · Ant Design 6 · styled-components 6 · esptool-js · Monaco Editor

## ฟีเจอร์

- เชื่อมต่อบอร์ดผ่าน **Web Serial API** และตรวจชนิดชิปอัตโนมัติ (ESP32 / S3 / C3 / C6)
- ตัวแก้ไขโค้ด Monaco (C++/Arduino) พร้อมตัวอย่าง: Blink, WiFi Web Server, DHT22 → MQTT, Analog Sensor
- **คอมไพล์บนเซิร์ฟเวอร์** (`/api/compile` เรียก `arduino-cli`) แล้วแฟลชด้วย `esptool-js` ในเบราว์เซอร์
- อัปโหลดไฟล์ `.bin` ที่คอมไพล์แล้วเอง (กำหนด address ได้)
- Erase flash, แสดง progress, Serial Monitor (เลือก baud, ส่งข้อความ, รีเซ็ตบอร์ด)
- บันทึกโปรเจคไว้ใน localStorage ของเบราว์เซอร์

## การทำงาน

```
เบราว์เซอร์ (Chrome/Edge)                 เซิร์ฟเวอร์ Next.js
 ┌──────────────┐  POST /api/compile     ┌───────────────────┐
 │ Monaco code  │ ─────────────────────▶ │ arduino-cli compile│
 │              │ ◀───── .bin (base64) ─ │  (esp32:esp32)     │
 │ esptool-js   │                        └───────────────────┘
 │ Web Serial ──┼──USB──▶ ESP32
 └──────────────┘
```

## เริ่มใช้งาน

### 1) ติดตั้ง arduino-cli + ESP32 core (เครื่องที่รันเซิร์ฟเวอร์)

```bash
# macOS: brew install arduino-cli   |  Linux: curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
arduino-cli config init
arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32
arduino-cli lib install "PubSubClient" "DHT sensor library" "Adafruit Unified Sensor"
```

ถ้า `arduino-cli` ไม่อยู่ใน PATH ให้ตั้งค่า `ARDUINO_CLI_PATH=/path/to/arduino-cli` ใน `.env.local`

### 2) รันเว็บ

```bash
npm install
npm run dev
# เปิด http://localhost:3000 ด้วย Chrome หรือ Edge
```

หรือใช้ Docker (มี arduino-cli + ESP32 core ในตัว):

```bash
docker build -t esp32-iot-studio .
docker run -p 3000:3000 esp32-iot-studio
```

### 3) อัปโค้ดลงบอร์ด

1. เสียบ ESP32 ผ่าน USB (ติดตั้งไดรเวอร์ CP210x / CH340 ถ้าจำเป็น)
2. กด **เชื่อมต่อบอร์ด** → เลือกพอร์ต
3. เขียนโค้ด → กด **คอมไพล์ & อัปโหลด**
4. เปิด **Serial Monitor** ดูผลลัพธ์

> ถ้าเชื่อมต่อไม่ได้ ให้กดปุ่ม **BOOT** ค้างไว้ตอนเริ่มเชื่อมต่อ แล้วปล่อยเมื่อเริ่มแฟลช


## Dashboard IoT (ผ่าน WiFi + MQTT)

- ในขั้น “ตั้งค่าขา” เลือกว่าแต่ละขา **ต่อกับอะไร**: สวิตช์, ไฟสถานะ/LED, รีเลย์, มอเตอร์/พัดลม, บัซเซอร์, ปุ่มกด, เซนเซอร์ตรวจจับ, เซนเซอร์ค่าต่อเนื่อง (ADC)
- เปิด “ควบคุมผ่าน Dashboard” → ใส่ชื่อบอร์ด + WiFi → ระบบ **ลงทะเบียนบอร์ดด้วย UID** (สุ่ม 12 ตัว ผูกกับ MAC ของบอร์ดถ้าเชื่อมต่อ USB ไว้)
- Dashboard ของบอร์ดแต่ละตัวอยู่ที่ **`/d/<UID>`** — เปิดจากคอม/มือถือเครื่องไหนก็ได้ มีปุ่มคัดลอกลิงก์และ QR Code
- `/dashboard` = รายการบอร์ดที่เครื่องนี้เคยเปิด + ช่องกรอก UID
- UI ตามชนิด: สวิตช์ = สวิตช์, ไฟ = หลอดไฟ, มอเตอร์ = พัดลมหมุน + สไลเดอร์, ปุ่ม/เซนเซอร์ = สถานะ, ADC = เกจ

### การสื่อสาร (MQTT)

บอร์ดกับหน้าเว็บคุยกันผ่าน MQTT broker โดยตรง (เรียลไทม์ ไม่ผ่าน API ของเว็บ จึงไม่กินโควต้า Vercel และไม่ต้องมีฐานข้อมูล)

| หัวข้อ | ใครส่ง | ค่า |
|---|---|---|
| `esp32studio/<UID>/config` | เว็บ (ตอนลงทะเบียน) + บอร์ด (ทุกครั้งที่ต่อ) | ข้อมูลขา (JSON, retained) |
| `esp32studio/<UID>/status` | บอร์ด (LWT) | `online` / `offline` |
| `esp32studio/<UID>/out/<ขา>` | Dashboard | ค่าที่สั่ง (retained) |
| `esp32studio/<UID>/state/<ขา>` | บอร์ด | ค่าจริงของขาออก |
| `esp32studio/<UID>/in/<ขา>` | บอร์ด | ค่าขาเข้า |

ค่าเริ่มต้นใช้ **HiveMQ public broker** (ฟรี ไม่ต้องสมัคร) — ใครรู้ UID ก็ดู/สั่งได้ เหมาะกับการเรียน/ทดลอง
ใช้งานจริงแนะนำสมัคร **HiveMQ Cloud** (มีแผนฟรี) แล้วตั้ง env ตามด้านล่าง

## Deploy บน Vercel

> ต้องการวิธีฟรีแบบทีละขั้นตอน: ดู [DEPLOY_FREE.md](./DEPLOY_FREE.md)

1. push โปรเจคขึ้น GitHub → Vercel → **Add New Project** → เลือก repo (Framework: Next.js ตรวจให้เอง)
2. (ไม่บังคับ) ตั้ง Environment Variables ดู `.env.example`:
   - `NEXT_PUBLIC_MQTT_WS_URL`, `NEXT_PUBLIC_MQTT_HOST`, `NEXT_PUBLIC_MQTT_PORT`, `NEXT_PUBLIC_MQTT_TLS`, `NEXT_PUBLIC_MQTT_USERNAME`, `NEXT_PUBLIC_MQTT_PASSWORD` — broker ส่วนตัว
   - `COMPILE_SERVER_URL` — เซิร์ฟเวอร์คอมไพล์ (ดูด้านล่าง)
3. Deploy → เปิด `https://<โปรเจค>.vercel.app` ด้วย Chrome/Edge (Web Serial ใช้ได้เพราะเป็น https)

**เรื่องคอมไพล์:** Vercel รัน `arduino-cli` + ตัวคอมไพล์ ESP32 ไม่ได้ (ใหญ่เกินขนาด function) ทางเลือก:

- **เซิร์ฟเวอร์คอมไพล์แยก:** deploy โปรเจคเดียวกันด้วย `Dockerfile` บน Render / Railway / Fly.io / VPS แล้วตั้ง `COMPILE_SERVER_URL=https://<เซิร์ฟเวอร์นั้น>` บน Vercel (ตั้ง `COMPILE_SERVER_TOKEN` ให้ตรงกันทั้งสองฝั่งเพื่อกันคนอื่นใช้)
- **ไม่มีเซิร์ฟเวอร์คอมไพล์:** ขั้น 3 มีปุ่ม “ดาวน์โหลด .ino” → เปิดด้วย Arduino IDE (ติดตั้งบอร์ด esp32 + ไลบรารี PubSubClient) แล้วอัปโหลด — Dashboard ยังใช้ได้ปกติ

## ข้อจำกัด

- Web Serial ใช้ได้เฉพาะ **Chrome / Edge / Opera บนเดสก์ท็อป** และต้องเปิดผ่าน `https://` หรือ `localhost`
- การคอมไพล์ต้องมี `arduino-cli` บนเซิร์ฟเวอร์ (Vercel แบบ serverless ใช้ไม่ได้ ต้องใช้ VPS/Docker)
- Monaco โหลดจาก CDN (jsDelivr) — ถ้าต้องใช้ออฟไลน์ ให้ติดตั้ง `monaco-editor` แล้วใช้ `loader.config({ monaco })`

## โครงสร้างไฟล์

```
src/
├─ app/
│  ├─ layout.tsx          # AntdRegistry + styled-components registry
│  ├─ providers.tsx       # ธีม antd (dark) + ThemeProvider + GlobalStyle
│  ├─ page.tsx            # หน้า Studio หลัก
│  └─ api/compile/route.ts# คอมไพล์ด้วย arduino-cli
├─ components/
│  ├─ CodeEditor.tsx      # Monaco editor
│  ├─ SerialMonitor.tsx   # Serial monitor
│  └─ BinUploader.tsx     # อัปโหลด .bin + กำหนด address
├─ hooks/useEsp32.ts      # Web Serial + esptool-js (connect / flash / erase / monitor)
└─ lib/
   ├─ boards.ts           # รายการบอร์ด + FQBN
   ├─ templates.ts        # โค้ดตัวอย่าง IoT
   └─ registry.tsx        # SSR registry ของ styled-components
```
