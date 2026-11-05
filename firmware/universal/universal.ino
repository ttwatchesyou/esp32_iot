#include <Arduino.h>
#include <ArduinoJson.h>
#include <memory>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_mac.h>
#include <esp_partition.h>

// One firmware image serves every project. The browser provisions this image
// over USB serial after flashing; configuration is then kept in ESP32 NVS.
constexpr size_t MAX_CONFIG = 6000;
constexpr size_t MAX_PINS = 32;

// HiveMQ Cloud broker used by both the board and the web dashboard.
const char *mqtt_server = "0d495914d04845f5914e55fd3e65c6e4.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char *mqtt_user = "ttwatchesyou";
const char *mqtt_pass = "Greenpig001";
const char *mqtt_prefix = "esp32studio";

struct PinDef {
  int gpio;
  String type;
  int level;
  int pull;
  int last;
  bool output;
  bool pwm;
  bool analog;
};

const esp_partition_t *configPartition = nullptr;
WiFiClient plainNet;
WiFiClientSecure secureNet;
PubSubClient mqtt(plainNet);
String serialLine;
String savedConfig;
String wifiSsid, wifiPassword, uid;
PinDef pins[MAX_PINS];
size_t pinCount = 0;
unsigned long lastWifiTry = 0;
unsigned long lastMqttTry = 0;
unsigned long lastAnalogRead = 0;
unsigned long lastOnlineHeartbeat = 0;

String baseTopic() { return String(mqtt_prefix) + "/" + uid + "/"; }

String boardUid() {
  uint8_t mac[6];
  esp_efuse_mac_get_default(mac);
  char value[18];
  snprintf(value, sizeof(value), "esp32%02x%02x%02x%02x%02x%02x",
    mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(value);
}

void publishValue(const String &sub, int value) {
  if (mqtt.connected()) mqtt.publish((baseTopic() + sub).c_str(), String(value).c_str(), true);
}

PinDef *findPin(int gpio) {
  for (size_t i = 0; i < pinCount; i++) if (pins[i].gpio == gpio) return &pins[i];
  return nullptr;
}

void setOutput(PinDef &pin, int value) {
  if (!pin.output) return;
  if (pin.pwm) {
    value = constrain(value, 0, 255);
    analogWrite(pin.gpio, value);
  } else {
    value = value ? 1 : 0;
    digitalWrite(pin.gpio, value ? HIGH : LOW);
  }
  pin.last = value;
  publishValue("state/" + String(pin.gpio), value);
}

void onMessage(char *topic, byte *payload, unsigned int length) {
  String t(topic), value;
  for (unsigned int i = 0; i < length; i++) value += char(payload[i]);
  String prefix = baseTopic() + "out/";
  if (!t.startsWith(prefix)) return;
  PinDef *pin = findPin(t.substring(prefix.length()).toInt());
  if (pin) setOutput(*pin, value.toInt());
}

bool loadRuntimeConfig(const String &raw) {
  JsonDocument doc;
  if (deserializeJson(doc, raw)) return false;

  wifiSsid = doc["s"] | "";
  wifiPassword = doc["w"] | "";
  // Derive the topic identity from the chip so copied/stale browser data can
  // never make two physical boards publish to the same topic.
  uid = boardUid();
  pinCount = 0;

  for (JsonObject p : doc["c"]["p"].as<JsonArray>()) {
    if (pinCount >= MAX_PINS) break;
    PinDef &d = pins[pinCount++];
    d.gpio = p["g"] | -1;
    d.type = String((const char *)(p["t"] | "sensor"));
    d.level = p["l"] | 0;
    d.pull = p["u"] | 0;
    d.output = d.type == "switch" || d.type == "light" || d.type == "relay" || d.type == "motor" || d.type == "buzzer";
    d.pwm = d.type == "motor";
    d.analog = d.type == "analog";
    d.last = -1;
  }
  return true;
}

uint32_t configChecksum(const uint8_t *data, size_t length) {
  uint32_t hash = 2166136261u;
  for (size_t i = 0; i < length; i++) hash = (hash ^ data[i]) * 16777619u;
  return hash;
}

bool readStoredConfig(String &raw) {
  configPartition = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, (esp_partition_subtype_t)0x40, "config");
  if (!configPartition) return false;
  uint8_t header[16];
  if (esp_partition_read(configPartition, 0, header, sizeof(header)) != ESP_OK || memcmp(header, "IOTCFG1", 7) != 0) return false;
  uint32_t length = uint32_t(header[8]) | (uint32_t(header[9]) << 8) | (uint32_t(header[10]) << 16) | (uint32_t(header[11]) << 24);
  uint32_t checksum = uint32_t(header[12]) | (uint32_t(header[13]) << 8) | (uint32_t(header[14]) << 16) | (uint32_t(header[15]) << 24);
  if (!length || length > MAX_CONFIG) return false;
  std::unique_ptr<uint8_t[]> bytes(new uint8_t[length + 1]);
  if (esp_partition_read(configPartition, sizeof(header), bytes.get(), length) != ESP_OK) return false;
  if (configChecksum(bytes.get(), length) != checksum) return false;
  bytes[length] = 0;
  raw = String((char *)bytes.get());
  return true;
}

bool writeStoredConfig(const String &raw) {
  if (!configPartition) configPartition = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, (esp_partition_subtype_t)0x40, "config");
  if (!configPartition || !raw.length() || raw.length() > MAX_CONFIG) return false;
  uint8_t header[16] = {'I','O','T','C','F','G','1',0};
  uint32_t length = raw.length();
  uint32_t checksum = configChecksum((const uint8_t *)raw.c_str(), length);
  for (int i = 0; i < 4; i++) {
    header[8 + i] = (length >> (8 * i)) & 0xff;
    header[12 + i] = (checksum >> (8 * i)) & 0xff;
  }
  if (esp_partition_erase_range(configPartition, 0, configPartition->size) != ESP_OK) return false;
  return esp_partition_write(configPartition, 0, header, sizeof(header)) == ESP_OK
    && esp_partition_write(configPartition, sizeof(header), raw.c_str(), length) == ESP_OK;
}

void configurePins() {
  for (size_t i = 0; i < pinCount; i++) {
    PinDef &p = pins[i];
    if (p.output) {
      pinMode(p.gpio, OUTPUT);
      setOutput(p, p.pwm ? 0 : p.level);
    } else if (p.analog || p.pull == 0) {
      pinMode(p.gpio, INPUT);
    } else {
      pinMode(p.gpio, p.pull == 1 ? INPUT_PULLUP : INPUT_PULLDOWN);
    }
  }
}

void connectWifi() {
  if (!wifiSsid.length() || WiFi.status() == WL_CONNECTED || millis() - lastWifiTry < 10000) return;
  lastWifiTry = millis();
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
  Serial.println("ESP32IOT:WIFI_CONNECTING");
}

void connectMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqtt.connected() || millis() - lastMqttTry < 3000) return;
  lastMqttTry = millis();
  String clientId = uid;
  String willTopic = baseTopic() + "status";
  bool ok = mqtt.connect(clientId.c_str(), mqtt_user, mqtt_pass, willTopic.c_str(), 1, true, "offline");
  if (!ok) {
    Serial.printf("ESP32IOT:MQTT_RETRY:%d\n", mqtt.state());
    return;
  }
  mqtt.publish(willTopic.c_str(), "online", true);
  lastOnlineHeartbeat = millis();

  JsonDocument doc;
  if (!deserializeJson(doc, savedConfig)) {
    String compact;
    serializeJson(doc["c"], compact);
    mqtt.publish((baseTopic() + "config").c_str(), compact.c_str(), true);
  }
  mqtt.subscribe((baseTopic() + "out/+").c_str(), 1);
  for (size_t i = 0; i < pinCount; i++) if (pins[i].output) publishValue("state/" + String(pins[i].gpio), pins[i].last);
  Serial.println("ESP32IOT:ONLINE");
}

void acceptProvisioning(const String &raw) {
  if (raw.length() > MAX_CONFIG || !loadRuntimeConfig(raw)) {
    Serial.println("ESP32IOT:ERROR");
    return;
  }
  bool saved = writeStoredConfig(raw);
  if (!saved) {
    Serial.println("ESP32IOT:ERROR");
    return;
  }
  Serial.println("ESP32IOT:OK");
  Serial.flush();
  delay(300);
  ESP.restart();
}

void readProvisioning() {
  while (Serial.available()) {
    char c = char(Serial.read());
    if (c == '\n') {
      serialLine.trim();
      if (serialLine.startsWith("ESP32IOT:")) acceptProvisioning(serialLine.substring(9));
      serialLine = "";
    } else if (c != '\r' && serialLine.length() <= MAX_CONFIG + 16) {
      serialLine += c;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  readStoredConfig(savedConfig);

  if (savedConfig.length() && loadRuntimeConfig(savedConfig)) {
    configurePins();
    WiFi.mode(WIFI_STA);
    WiFi.persistent(false);
    WiFi.setAutoReconnect(true);
    WiFi.setSleep(false);
    secureNet.setInsecure();
    mqtt.setClient(secureNet);
    mqtt.setServer(mqtt_server, mqtt_port);
    mqtt.setBufferSize(2048);
    mqtt.setKeepAlive(20);
    mqtt.setSocketTimeout(10);
    mqtt.setCallback(onMessage);
    connectWifi();
    Serial.println("ESP32IOT:READY");
  } else {
    Serial.println("ESP32IOT:WAITING_CONFIG");
  }
}

void loop() {
  readProvisioning();
  connectWifi();
  if (WiFi.status() == WL_CONNECTED) {
    connectMqtt();
    if (mqtt.connected()) {
      mqtt.loop();
      if (millis() - lastOnlineHeartbeat > 30000) {
        mqtt.publish((baseTopic() + "status").c_str(), "online", true);
        lastOnlineHeartbeat = millis();
      }
    }
  } else if (mqtt.connected()) {
    mqtt.disconnect();
  }

  for (size_t i = 0; i < pinCount; i++) {
    PinDef &p = pins[i];
    if (p.output || p.analog) continue;
    int value = digitalRead(p.gpio);
    if (value != p.last) {
      p.last = value;
      publishValue("in/" + String(p.gpio), value);
    }
  }
  if (millis() - lastAnalogRead > 2000) {
    lastAnalogRead = millis();
    for (size_t i = 0; i < pinCount; i++) {
      PinDef &p = pins[i];
      if (!p.analog) continue;
      int value = analogRead(p.gpio);
      if (p.last < 0 || abs(value - p.last) > 20) {
        p.last = value;
        publishValue("in/" + String(p.gpio), value);
      }
    }
  }
  delay(20);
}
