export interface SketchTemplate {
  id: string;
  name: string;
  description: string;
  libraries?: string[];
  code: string;
}

export const TEMPLATES: SketchTemplate[] = [
  {
    id: "blink",
    name: "Blink LED",
    description: "กระพริบ LED บนบอร์ด (GPIO 2) ทุก 1 วินาที",
    code: `#define LED_PIN 2

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("ESP32 Blink started");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON");
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  delay(1000);
}
`,
  },
  {
    id: "wifi-web",
    name: "WiFi Web Server",
    description: "เชื่อม WiFi แล้วเปิดเว็บสั่งเปิด/ปิด LED",
    code: `#include <WiFi.h>
#include <WebServer.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_PASSWORD";
const int LED_PIN = 2;

WebServer server(80);

void handleRoot() {
  String html = "<h1>ESP32 IoT</h1>"
                "<p><a href='/on'>ON</a> | <a href='/off'>OFF</a></p>";
  server.send(200, "text/html", html);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println();
  Serial.print("IP: "); Serial.println(WiFi.localIP());

  server.on("/", handleRoot);
  server.on("/on",  [] { digitalWrite(LED_PIN, HIGH); handleRoot(); });
  server.on("/off", [] { digitalWrite(LED_PIN, LOW);  handleRoot(); });
  server.begin();
}

void loop() {
  server.handleClient();
}
`,
  },
  {
    id: "mqtt-dht",
    name: "DHT22 → MQTT",
    description: "อ่านอุณหภูมิ/ความชื้นจาก DHT22 แล้วส่งขึ้น MQTT broker",
    libraries: ["PubSubClient", "DHT sensor library"],
    code: `#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

const char* WIFI_SSID   = "YOUR_WIFI";
const char* WIFI_PASS   = "YOUR_PASSWORD";
const char* MQTT_HOST   = "broker.hivemq.com";
const int   MQTT_PORT   = 1883;
const char* MQTT_TOPIC  = "nextspheres/esp32/env";

#define DHT_PIN  4
#define DHT_TYPE DHT22

DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient net;
PubSubClient mqtt(net);

void connectMqtt() {
  while (!mqtt.connected()) {
    String id = "esp32-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    if (mqtt.connect(id.c_str())) Serial.println("MQTT connected");
    else { Serial.println("MQTT retry..."); delay(2000); }
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\nWiFi OK");
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
}

void loop() {
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  static unsigned long last = 0;
  if (millis() - last > 5000) {
    last = millis();
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (isnan(t) || isnan(h)) { Serial.println("DHT read failed"); return; }
    char payload[64];
    snprintf(payload, sizeof(payload), "{\\"temp\\":%.1f,\\"hum\\":%.1f}", t, h);
    mqtt.publish(MQTT_TOPIC, payload);
    Serial.println(payload);
  }
}
`,
  },
  {
    id: "analog",
    name: "Analog Sensor",
    description: "อ่านค่า ADC จาก GPIO 34 แล้วพิมพ์ออก Serial",
    code: `const int SENSOR_PIN = 34;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
}

void loop() {
  int raw = analogRead(SENSOR_PIN);
  float volt = raw * 3.3 / 4095.0;
  Serial.printf("raw=%d volt=%.2fV\\n", raw, volt);
  delay(500);
}
`,
  },
];
