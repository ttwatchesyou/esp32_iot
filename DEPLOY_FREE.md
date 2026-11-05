# Deploy ฟรีด้วย Vercel

ระบบหลักใช้ Vercel เพียงที่เดียว เฟิร์มแวร์ทั้ง 4 รุ่นอยู่ใน `public/firmware/` และถูกดาวน์โหลดเป็นไฟล์ static ตอนผู้ใช้กดติดตั้ง จึงไม่ต้องใช้ Render หรือ Docker ในเครื่องผู้ใช้

## ขั้นตอน

1. Push repository ขึ้น GitHub
2. Import repository ใน Vercel และเลือก Next.js
3. MQTT ใช้ HiveMQ Cloud ที่กำหนดไว้ในซอร์ส และสร้าง topic แยกจาก MAC ของแต่ละบอร์ด
4. Deploy แล้วเปิด URL ด้วย Chrome หรือ Edge
5. เสียบ ESP32 เลือกพอร์ต ตั้งค่าขา/Wi‑Fi และกด **อัปโหลดลงบอร์ด**

## ก่อน deploy หลังแก้เฟิร์มแวร์

```bash
./scripts/build-firmware.sh
npm run lint
npm run build
```

Commit ไฟล์ใน `public/firmware/` ไปพร้อม source เสมอ เพื่อให้ Vercel เสิร์ฟไฟล์ที่ผ่านการตรวจสอบแล้ว

## ความปลอดภัย

รหัส Wi‑Fi ถูกเก็บใน localStorage ของเบราว์เซอร์และส่งตรงผ่านสาย USB ไปยัง ESP32 หน้าเว็บไม่ส่งรหัสนี้ไป API สำหรับงานจริงควรใช้ MQTT broker ส่วนตัวพร้อม username/password
