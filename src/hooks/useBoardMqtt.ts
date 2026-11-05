"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MqttClient } from "mqtt";
import { MQTT, decodeConfig, encodeConfig, topics, type BoardConfig } from "@/lib/mqttConfig";

/** ค่าที่สั่งแล้วแต่บอร์ดยังไม่ยืนยัน */
const pendingRef: { at: Record<string, number> } = { at: {} };
function pendingOnly(desired: Record<string, number>, actual: Record<string, number>) {
  const now = Date.now();
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(desired)) {
    if (actual[k] !== v && now - (pendingRef.at[k] ?? 0) < 3000) out[k] = v;
  }
  return out;
}

export type BrokerStatus = "connecting" | "connected" | "error";

/** เชื่อม MQTT แล้วติดตามสถานะของบอร์ด 1 ตัว */
export function useBoardMqtt(uid: string | null) {
  const [broker, setBroker] = useState<BrokerStatus>("connecting");
  const [config, setConfig] = useState<BoardConfig | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [actual, setActual] = useState<Record<string, number>>({});
  const [desired, setDesired] = useState<Record<string, number>>({});
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [sharedText, setSharedText] = useState("");
  const [lastMessage, setLastMessage] = useState<number | null>(null);
  const clientRef = useRef<MqttClient | null>(null);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const t = topics(uid);
    setConfig(null);
    setOnline(null);
    setActual({});
    setDesired({});
    setInputs({});
    setSharedText("");

    (async () => {
      const mqtt = (await import("mqtt")).default;
      if (!alive) return;
      const client = mqtt.connect(MQTT.wsUrl, {
        clientId: `web-${uid}-${Math.random().toString(16).slice(2, 8)}`,
        username: MQTT.username || undefined,
        password: MQTT.password || undefined,
        reconnectPeriod: 3000,
        connectTimeout: 10_000,
        clean: true,
      });
      clientRef.current = client;
      client.on("connect", () => {
        setBroker("connected");
        client.subscribe(t.all, { qos: 1 });
      });
      client.on("reconnect", () => setBroker("connecting"));
      client.on("error", () => setBroker("error"));
      client.on("offline", () => setBroker("connecting"));
      client.on("message", (topic, payload) => {
        const msg = payload.toString();
        const rest = topic.slice(t.base.length);
        setLastMessage(Date.now());
        if (rest === "config") {
          const c = decodeConfig(msg);
          if (c) setConfig(c);
        } else if (rest === "status") {
          setOnline(msg === "online");
        } else if (rest === "text") {
          setSharedText(msg);
        } else if (rest.startsWith("state/")) {
          setActual((o) => ({ ...o, [rest.slice(6)]: Number(msg) }));
        } else if (rest.startsWith("out/")) {
          // ค่าที่สั่งไว้ล่าสุด (จากเครื่องไหนก็ได้)
          setDesired((o) => ({ ...o, [rest.slice(4)]: Number(msg) }));
        } else if (rest.startsWith("in/")) {
          setInputs((i) => ({ ...i, [rest.slice(3)]: Number(msg) }));
        }
      });
    })();

    return () => {
      alive = false;
      clientRef.current?.end(true);
      clientRef.current = null;
    };
  }, [uid]);

  /** สั่งขาออก (retained → บอร์ดที่เพิ่งต่อเน็ตจะได้รับค่าล่าสุด) */
  const setOutput = useCallback(
    (gpio: number, value: number) => {
      if (!uid || !clientRef.current) return false;
      setDesired((o) => ({ ...o, [gpio]: value }));
      pendingRef.at[String(gpio)] = Date.now();
      clientRef.current.publish(topics(uid).out(gpio), String(value), { qos: 1, retain: true });
      return true;
    },
    [uid],
  );

  /** ข้อความทดสอบ MQTT แบบ retained ทุกเครื่องที่เปิด UID เดียวกันจะเห็นค่าล่าสุด */
  const sendText = useCallback(
    (value: string) => {
      const client = clientRef.current;
      if (!uid || !client?.connected) return false;
      const text = value.trim().slice(0, 500);
      if (!text) return false;
      setSharedText(text);
      client.publish(topics(uid).text, text, { qos: 1, retain: true });
      return true;
    },
    [uid],
  );

  // บอร์ดออนไลน์: แสดงค่าจริงจากบอร์ด (แต่ค่าที่เพิ่งกดจะแสดงทันที) · ออฟไลน์: แสดงค่าที่สั่งไว้
  const outputs = online ? { ...actual, ...pendingOnly(desired, actual) } : { ...actual, ...desired };
  return { broker, config, online, outputs, inputs, sharedText, lastMessage, setOutput, sendText };
}

/** ส่งข้อมูลบอร์ดขึ้น broker แบบ retained (ใช้ตอนลงทะเบียน) */
export async function publishConfig(uid: string, config: BoardConfig, initialOutputs: Record<number, number>, initialText = "") {
  const mqtt = (await import("mqtt")).default;
  const t = topics(uid);
  return new Promise<void>((resolve, reject) => {
    const client = mqtt.connect(MQTT.wsUrl, {
      clientId: `reg-${uid}-${Math.random().toString(16).slice(2, 8)}`,
      username: MQTT.username || undefined,
      password: MQTT.password || undefined,
      connectTimeout: 10_000,
      reconnectPeriod: 0,
    });
    const timer = setTimeout(() => {
      client.end(true);
      reject(new Error("ต่อ MQTT broker ไม่ได้"));
    }, 12_000);
    client.on("error", (e) => {
      clearTimeout(timer);
      client.end(true);
      reject(e);
    });
    client.on("connect", async () => {
      try {
        await client.publishAsync(t.config, encodeConfig(config), { qos: 1, retain: true });
        for (const [g, v] of Object.entries(initialOutputs)) {
          await client.publishAsync(t.out(g), String(v), { qos: 1, retain: true });
        }
        if (initialText.trim()) {
          await client.publishAsync(t.text, initialText.trim().slice(0, 500), { qos: 1, retain: true });
        }
        clearTimeout(timer);
        client.end();
        resolve();
      } catch (e) {
        clearTimeout(timer);
        client.end(true);
        reject(e);
      }
    });
  });
}
