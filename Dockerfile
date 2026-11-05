FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates python3 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=/usr/local/bin sh \
    && arduino-cli config init \
    && arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json \
    && arduino-cli core update-index \
    && arduino-cli core install esp32:esp32 \
    && arduino-cli lib install "PubSubClient" "DHT sensor library" "Adafruit Unified Sensor" "ArduinoJson"

WORKDIR /app
COPY compile-server.mjs ./compile-server.mjs

ENV NODE_ENV=production \
    PORT=10000

EXPOSE 10000
CMD ["node", "compile-server.mjs"]
