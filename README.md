# ESP32 IoT Studio

เว็บสำหรับตั้งค่าและติดตั้งโปรเจกต์ IoT ลง ESP32 จาก Chrome/Edge โดยตรง ผู้ใช้เปิดเว็บ เสียบสาย USB เลือกขาและ Wi‑Fi แล้วกดปุ่มเดียวได้เลย ไม่ต้องติดตั้ง Arduino IDE, Docker หรือเปิดเซิร์ฟเวอร์คอมไพล์

**Stack:** Next.js 16 · TypeScript · Ant Design 6 · styled-components 6 · esptool-js · Arduino

## โฟลว์หลัก

```text
Vercel (ไฟล์เว็บ + เฟิร์มแวร์ที่สร้างไว้แล้ว)
            │ ดาวน์โหลด .bin
            ▼
Chrome/Edge บนเครื่องผู้ใช้ ── Web Serial/USB ──▶ ESP32
            │                                  │
            └──── ส่งค่าขา, Wi‑Fi, MQTT ──────┘
```

การแฟลชและส่งค่าตั้งเกิดบนเครื่องที่เปิดเว็บ รหัส Wi‑Fi ไม่ถูกส่งไป Vercel หรือ Render เฟิร์มแวร์บันทึกค่าไว้ในพื้นที่ config ของ flash และใช้ค่าเดิมหลังปิดเปิดเครื่อง

## ฟีเจอร์

- รองรับ ESP32, ESP32-S3, ESP32-C3 และ ESP32-C6
- เลือก GPIO สำหรับสวิตช์, LED, รีเลย์, มอเตอร์, บัซเซอร์, ปุ่ม และเซนเซอร์
- ติดตั้งเฟิร์มแวร์และตั้งค่าบอร์ดด้วยปุ่มเดียวผ่าน Web Serial
- Dashboard ผ่าน MQTT พร้อมสถานะและการควบคุมแบบเรียลไทม์
- Serial Monitor, ล้าง flash และอัปโหลด `.bin` เองในโหมดขั้นสูง
- สร้างและดาวน์โหลด `.ino` สำหรับผู้ที่ต้องการแก้โค้ด Arduino เอง

## ใช้งาน

1. เปิดเว็บด้วย Chrome หรือ Edge บนคอมพิวเตอร์
2. เลือกรุ่นบอร์ดและตั้งค่าขา
3. ใส่ Wi‑Fi หากต้องการ Dashboard
4. เสียบ ESP32 แล้วกด **เชื่อมต่อบอร์ด**
5. กด **อัปโหลดลงบอร์ด** เพียงครั้งเดียว

ถ้าเชื่อมต่อไม่ได้ ให้ปิด Arduino IDE หรือโปรแกรมอื่นที่ใช้พอร์ตอยู่ แล้วลองกดปุ่ม BOOT ค้างระหว่างเริ่มเชื่อมต่อ

## พัฒนาเว็บในเครื่อง

```bash
npm install
npm run dev
# เปิด http://localhost:3000
```

ไฟล์เฟิร์มแวร์ที่หน้าเว็บใช้อยู่ใน `public/firmware/` หากแก้ `firmware/universal/universal.ino` ให้ติดตั้ง Arduino CLI, ESP32 core, PubSubClient และ ArduinoJson แล้วรัน:

```bash
./scripts/build-firmware.sh
```

## Dashboard และ MQTT

บอร์ดคุยกับ Dashboard ผ่าน MQTT โดยตรง ค่าเริ่มต้นใช้ HiveMQ public broker ซึ่งเหมาะกับการเรียนและทดลอง สำหรับงานจริงควรตั้ง broker ส่วนตัวผ่าน environment variables:

- `NEXT_PUBLIC_MQTT_WS_URL`
- `NEXT_PUBLIC_MQTT_HOST`
- `NEXT_PUBLIC_MQTT_PORT`
- `NEXT_PUBLIC_MQTT_TLS`
- `NEXT_PUBLIC_MQTT_USERNAME`
- `NEXT_PUBLIC_MQTT_PASSWORD`
- `NEXT_PUBLIC_MQTT_PREFIX`

หัวข้ออยู่ใต้ `esp32studio/<UID>/` ได้แก่ `config`, `status`, `out/<gpio>`, `state/<gpio>` และ `in/<gpio>`

## Deploy บน Vercel

เชื่อม repository กับ Vercel แล้ว deploy แบบ Next.js ปกติ ไม่ต้องตั้ง `COMPILE_SERVER_URL` และไม่ต้องมี Render เพราะไฟล์ `.bin` ถูกเสิร์ฟเป็น static files จาก Vercel

## ข้อจำกัด

- Web Serial รองรับ Chrome, Edge และ Opera บนเดสก์ท็อป ผ่าน HTTPS หรือ localhost
- Safari และ Firefox ยังใช้โฟลว์เสียบ USB นี้ไม่ได้
- ปุ่มติดตั้งใช้พฤติกรรมจากหน้าตั้งค่าขา การแก้ข้อความใน Code Editor จะไม่เปลี่ยนเฟิร์มแวร์ที่ปุ่มนี้ติดตั้ง หากต้องการโค้ด Arduino อิสระให้ดาวน์โหลด `.ino` ไปคอมไพล์ด้วย Arduino IDE
- Dashboard ต้องใช้อินเทอร์เน็ตและ MQTT broker แต่การติดตั้งเฟิร์มแวร์ผ่าน USB ไม่ต้องมี compile server
