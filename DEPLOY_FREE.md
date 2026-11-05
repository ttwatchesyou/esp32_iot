# Deploy ฟรีด้วย Vercel + Render

โครงสร้างนี้ใช้ Vercel รันหน้าเว็บและ Dashboard ส่วน Render รัน
`arduino-cli` สำหรับคอมไพล์ ESP32 จาก Dockerfile ที่มีอยู่ในโปรเจค

## 1. นำโปรเจคขึ้น GitHub

สร้าง repository ใหม่ แล้วอัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้นไป

## 2. สร้าง compile server บน Render

1. เข้า Render แล้วเลือก **New > Blueprint**
2. เชื่อม GitHub repository จากข้อ 1
3. Render จะอ่าน `render.yaml` และสร้างบริการ `esp32-iot-compiler`
4. เมื่อระบบถามค่า `COMPILE_SERVER_TOKEN` ให้ใส่ข้อความสุ่มยาวอย่างน้อย 32 ตัว
5. รอ Docker build เสร็จ แล้วจด URL เช่น
   `https://esp32-iot-compiler.onrender.com`

ทดสอบว่าเซิร์ฟเวอร์เปิดได้ด้วยการเข้า URL นั้นในเบราว์เซอร์ หน้าเว็บควรแสดงตามปกติ

## 3. Deploy หน้าเว็บบน Vercel

1. เข้า Vercel แล้วเลือก **Add New > Project**
2. Import GitHub repository เดียวกัน
3. ใน Environment Variables เพิ่ม:

```env
COMPILE_SERVER_URL=https://esp32-iot-compiler.onrender.com
COMPILE_SERVER_TOKEN=ค่าเดียวกับที่ตั้งบน Render
```

ถ้าใช้ MQTT broker เริ่มต้น ไม่ต้องเพิ่มตัวแปร MQTT หากใช้ broker ส่วนตัว
ให้เพิ่มค่าจาก `.env.example` ด้วย

4. กด Deploy หรือ Redeploy หลังเปลี่ยน Environment Variables

## 4. ทดสอบ

1. เปิดเว็บ Vercel ด้วย Chrome หรือ Edge บนคอมพิวเตอร์
2. เลือกบอร์ดและตั้งค่าขา
3. สร้างโค้ด แล้วกด **คอมไพล์ & อัปโหลด**
4. ครั้งแรกหลัง Render หลับอาจต้องรอประมาณหนึ่งนาทีให้เซิร์ฟเวอร์ตื่น

## ข้อจำกัดของแผนฟรี

- Render Free จะหลับเมื่อไม่มีการใช้งาน 15 นาที
- เครื่องฟรีมีทรัพยากรจำกัด การคอมไพล์ครั้งแรกอาจช้า
- เหมาะกับการทดลอง ห้องเรียน และจำนวนผู้ใช้ไม่มาก
- อย่าใส่ `COMPILE_SERVER_TOKEN` ไว้ในตัวแปรที่ขึ้นต้นด้วย `NEXT_PUBLIC_`
