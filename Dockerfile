# Next.js + arduino-cli + ESP32 core สำหรับคอมไพล์บนเซิร์ฟเวอร์
FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates python3 \
 && rm -rf /var/lib/apt/lists/*

# ติดตั้ง arduino-cli
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=/usr/local/bin sh

# ติดตั้ง ESP32 core + ไลบรารีที่ตัวอย่างใช้
RUN arduino-cli config init \
 && arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json \
 && arduino-cli core update-index \
 && arduino-cli core install esp32:esp32 \
 && arduino-cli lib install "PubSubClient" "DHT sensor library" "Adafruit Unified Sensor" "ArduinoJson"

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["npm", "start"]
