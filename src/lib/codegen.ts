import { DEVICE_TYPES, initialOutput, type PinConfig } from "./devices";

export type { PinConfig, PinLevel, PinPull, DeviceType } from "./devices";

export interface CloudConfig {
  ssid: string;
  password: string;
  uid: string;
  /** ข้อมูลบอร์ด (JSON) ที่บอร์ดจะประกาศทุกครั้งที่ต่อ broker */
  configJson: string;
  mqtt: { host: string; port: number; tls: boolean; username: string; password: string; prefix: string };
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/** ชื่อตัวแปรที่ใช้ได้ใน C++ */
function varName(p: PinConfig): string {
  const clean = p.name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_ ]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
  const base = clean && /^[A-Z_]/.test(clean) ? clean : `${p.type.toUpperCase()}_${p.gpio}`;
  return `PIN_${base.replace(/^PIN_/, "")}`;
}

const pinModeArg = (p: PinConfig) =>
  DEVICE_TYPES[p.type].mode === "OUTPUT" || DEVICE_TYPES[p.type].signal === "analog"
    ? DEVICE_TYPES[p.type].mode
    : p.pull === "PULLUP" ? "INPUT_PULLUP" : p.pull === "PULLDOWN" ? "INPUT_PULLDOWN" : "INPUT";

/** สร้างโค้ด Arduino จากการตั้งค่าขา (ถ้ามี cloud จะต่อ WiFi + MQTT ให้ Dashboard) */
export function generateCode(pins: PinConfig[], boardLabel: string, cloud?: CloudConfig): string {
  const used = new Set<string>();
  const named = pins.map((p) => {
    let v = varName(p);
    while (used.has(v)) v += "_";
    used.add(v);
    return { ...p, v, info: DEVICE_TYPES[p.type] };
  });
  const outputs = named.filter((p) => p.info.mode === "OUTPUT");
  const inputs = named.filter((p) => p.info.mode === "INPUT");
  const digitalInputs = inputs.filter((p) => p.info.signal === "digital");
  const analogInputs = inputs.filter((p) => p.info.signal === "analog");

  const L: string[] = [];
  L.push(`// สร้างโดย ESP32 IoT Studio — บอร์ด ${boardLabel}`);
  if (cloud) L.push(`// Dashboard: /d/${cloud.uid}`);
  named.forEach((p) => {
    const extra = p.info.mode === "OUTPUT"
      ? p.info.signal === "pwm" ? "ปรับความเร็ว 0–255" : `เริ่มต้น ${p.level}`
      : p.info.signal === "analog" ? "อ่านค่า 0–4095" : p.pull !== "NONE" ? p.pull : "";
    L.push(`//   GPIO ${String(p.gpio).padEnd(2)} → ${p.info.label}${p.name ? ` "${p.name}"` : ""}${extra ? ` · ${extra}` : ""}`);
  });
  if (cloud) L.push("// ต้องติดตั้งไลบรารี: PubSubClient (Nick O'Leary)");
  L.push("");

  if (cloud) {
    L.push("#include <WiFi.h>");
    if (cloud.mqtt.tls) L.push("#include <WiFiClientSecure.h>");
    L.push("#include <PubSubClient.h>");
    L.push("");
    L.push("// ----- WiFi -----");
    L.push(`const char* WIFI_SSID = "${esc(cloud.ssid)}";`);
    L.push(`const char* WIFI_PASS = "${esc(cloud.password)}";`);
    L.push("");
    L.push("// ----- MQTT (Dashboard) -----");
    L.push(`const char* MQTT_HOST = "${esc(cloud.mqtt.host)}";`);
    L.push(`const int   MQTT_PORT = ${cloud.mqtt.port};`);
    L.push(`const char* MQTT_USER = "${esc(cloud.mqtt.username)}";`);
    L.push(`const char* MQTT_PASS = "${esc(cloud.mqtt.password)}";`);
    L.push(`const String BASE = "${esc(cloud.mqtt.prefix)}/${cloud.uid}/";  // UID ของบอร์ดนี้`);
    L.push(`const char* CONFIG_JSON = "${esc(cloud.configJson)}";`);
    L.push("");
    L.push(cloud.mqtt.tls ? "WiFiClientSecure net;" : "WiFiClient net;");
    L.push("PubSubClient mqtt(net);");
    L.push("");
  }

  L.push("// ----- ขาที่ใช้ -----");
  named.forEach((p) => L.push(`const int ${p.v} = ${p.gpio};`));
  if (cloud) outputs.forEach((p) => L.push(`int state_${p.v} = ${initialOutput(p)};`));
  inputs.forEach((p) => L.push(`int last_${p.v} = -1;`));
  L.push("");

  if (cloud) {
    L.push("void publishValue(const String& sub, int value) {");
    L.push("  if (mqtt.connected()) mqtt.publish((BASE + sub).c_str(), String(value).c_str(), true);");
    L.push("}");
    L.push("");
  }

  if (outputs.length) {
    L.push("// สั่งขาออก");
    L.push("void setOutput(int pin, int value) {");
    L.push("  switch (pin) {");
    outputs.forEach((p) => {
      const write = p.info.signal === "pwm"
        ? `value = constrain(value, 0, 255); analogWrite(${p.v}, value);`
        : `value = value ? 1 : 0; digitalWrite(${p.v}, value ? HIGH : LOW);`;
      L.push(`    case ${p.gpio}: ${write}${cloud ? ` state_${p.v} = value; publishValue("state/${p.gpio}", value);` : ""} break;`);
    });
    L.push("  }");
    L.push("}");
    L.push("");
  }

  if (cloud) {
    L.push("// รับคำสั่งจาก Dashboard: หัวข้อ .../out/<ขา>  ค่า = ตัวเลข");
    L.push("void onMessage(char* topic, byte* payload, unsigned int length) {");
    L.push("  String t = String(topic);");
    L.push("  String msg;");
    L.push("  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];");
    L.push('  String prefix = BASE + "out/";');
    if (outputs.length) L.push("  if (t.startsWith(prefix)) setOutput(t.substring(prefix.length()).toInt(), msg.toInt());");
    L.push("}");
    L.push("");
    L.push("void connectMqtt() {");
    L.push("  static unsigned long lastTry = 0;");
    L.push("  if (mqtt.connected() || millis() - lastTry < 3000) return;");
    L.push("  lastTry = millis();");
    L.push('  String clientId = "esp32-" + String((uint32_t)ESP.getEfuseMac(), HEX);');
    L.push('  String willTopic = BASE + "status";');
    L.push("  bool ok = strlen(MQTT_USER) > 0");
    L.push('    ? mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, willTopic.c_str(), 1, true, "offline")');
    L.push('    : mqtt.connect(clientId.c_str(), willTopic.c_str(), 1, true, "offline");');
    L.push("  if (!ok) { Serial.printf(\"MQTT ต่อไม่ได้ (rc=%d)\\n\", mqtt.state()); return; }");
    L.push('  Serial.println("MQTT เชื่อมต่อแล้ว");');
    L.push('  mqtt.publish(willTopic.c_str(), "online", true);');
    L.push('  mqtt.publish((BASE + "config").c_str(), CONFIG_JSON, true);');
    outputs.forEach((p) => L.push(`  publishValue("state/${p.gpio}", state_${p.v});`));
    inputs.forEach((p) => L.push(`  last_${p.v} = -1;  // ส่งค่าขาเข้าใหม่`));
    L.push('  mqtt.subscribe((BASE + "out/+").c_str(), 1);');
    L.push("}");
    L.push("");
  }

  L.push("void setup() {");
  L.push("  Serial.begin(115200);");
  L.push("");
  named.forEach((p) => L.push(`  pinMode(${p.v}, ${pinModeArg(p)});`));
  if (outputs.length) {
    L.push("");
    outputs.forEach((p) =>
      L.push(p.info.signal === "pwm" ? `  analogWrite(${p.v}, 0);` : `  digitalWrite(${p.v}, ${p.level});`),
    );
  }
  if (cloud) {
    L.push("");
    L.push("  WiFi.mode(WIFI_STA);");
    L.push("  WiFi.begin(WIFI_SSID, WIFI_PASS);");
    L.push('  Serial.print("กำลังต่อ WiFi");');
    L.push('  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) { delay(500); Serial.print("."); }');
    L.push("  Serial.println();");
    L.push('  if (WiFi.status() == WL_CONNECTED) { Serial.print("WiFi OK, IP: "); Serial.println(WiFi.localIP()); }');
    L.push('  else Serial.println("ต่อ WiFi ไม่ได้ จะลองใหม่อัตโนมัติ");');
    if (cloud.mqtt.tls) L.push("  net.setInsecure();");
    L.push("  mqtt.setServer(MQTT_HOST, MQTT_PORT);");
    L.push("  mqtt.setBufferSize(1024);");
    L.push("  mqtt.setCallback(onMessage);");
  }
  L.push("");
  L.push('  Serial.println("พร้อมทำงาน!");');
  L.push("}");
  L.push("");
  L.push("void loop() {");
  if (cloud) {
    L.push("  if (WiFi.status() != WL_CONNECTED) {");
    L.push("    static unsigned long lastRetry = 0;");
    L.push("    if (millis() - lastRetry > 10000) { lastRetry = millis(); WiFi.reconnect(); }");
    L.push("  } else {");
    L.push("    connectMqtt();");
    L.push("    mqtt.loop();");
    L.push("  }");
    L.push("");
  }
  if (digitalInputs.length) {
    L.push("  // ขาเข้าแบบ digital: ส่งเมื่อค่าเปลี่ยน");
    digitalInputs.forEach((p) => {
      L.push(`  int v_${p.v} = digitalRead(${p.v});`);
      L.push(`  if (v_${p.v} != last_${p.v}) {`);
      L.push(`    last_${p.v} = v_${p.v};`);
      L.push(`    Serial.printf("GPIO ${p.gpio} = %s\\n", v_${p.v} ? "HIGH" : "LOW");`);
      if (cloud) L.push(`    publishValue("in/${p.gpio}", v_${p.v});`);
      L.push("  }");
    });
    L.push("");
  }
  if (analogInputs.length) {
    L.push("  // ขาเข้าแบบ analog: ส่งทุก 2 วินาทีเมื่อค่าเปลี่ยนพอสมควร");
    L.push("  static unsigned long lastAnalog = 0;");
    L.push("  if (millis() - lastAnalog > 2000) {");
    L.push("    lastAnalog = millis();");
    analogInputs.forEach((p) => {
      L.push(`    int a_${p.v} = analogRead(${p.v});`);
      L.push(`    if (last_${p.v} < 0 || abs(a_${p.v} - last_${p.v}) > 20) {`);
      L.push(`      last_${p.v} = a_${p.v};`);
      L.push(`      Serial.printf("GPIO ${p.gpio} = %d\\n", a_${p.v});`);
      if (cloud) L.push(`      publishValue("in/${p.gpio}", a_${p.v});`);
      L.push("    }");
    });
    L.push("  }");
    L.push("");
  }
  L.push("  delay(20);");
  L.push("}");
  L.push("");
  return L.join("\n");
}
