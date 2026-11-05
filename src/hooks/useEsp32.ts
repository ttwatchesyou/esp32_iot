"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ESPLoader, Transport, IEspLoaderTerminal } from "esptool-js";
import type { FlashImage } from "@/lib/boards";

export type DeviceStatus = "idle" | "connecting" | "ready" | "flashing" | "monitoring" | "error";

interface UseEsp32Options {
  /** baud ตอนแฟลช */
  flashBaud?: number;
  onLog?: (line: string) => void;
}

/**
 * จัดการการเชื่อมต่อ ESP32 ผ่าน Web Serial:
 * - เลือกพอร์ต + ตรวจชิป
 * - แฟลชไฟล์ .bin ด้วย esptool-js
 * - Serial Monitor (อ่าน/ส่งข้อมูล)
 */
export function useEsp32({ flashBaud = 921600, onLog }: UseEsp32Options = {}) {
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState<DeviceStatus>("idle");
  const [chip, setChip] = useState<string | null>(null);
  const [mac, setMac] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [hasPort, setHasPort] = useState(false);
  const [usbInfo, setUsbInfo] = useState<SerialPortInfo | null>(null);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const monitorActive = useRef(false);
  const monitorDone = useRef<Promise<void> | null>(null);
  const logRef = useRef(onLog);
  logRef.current = onLog;

  const log = useCallback((s: string) => logRef.current?.(s), []);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "serial" in navigator);
  }, []);

  const terminal: IEspLoaderTerminal = {
    clean: () => {},
    writeLine: (d) => log(d),
    write: (d) => log(d),
  };

  /** สร้าง loader ใหม่ทุกครั้ง (esptool จะ reset บอร์ดเข้าสู่ bootloader) */
  const withLoader = useCallback(
    async <T,>(fn: (loader: ESPLoader, transport: Transport) => Promise<T>): Promise<T> => {
      const port = portRef.current;
      if (!port) throw new Error("ยังไม่ได้เลือกพอร์ต");
      const { ESPLoader, Transport } = await import("esptool-js");
      const transport = new Transport(port, false);
      const loader = new ESPLoader({ transport, baudrate: flashBaud, terminal, debugLogging: false });
      try {
        const chipName = await loader.main();
        setChip(chipName);
        try {
          setMac((await loader.chip.readMac(loader)).toUpperCase());
        } catch {}
        return await fn(loader, transport);
      } finally {
        await transport.disconnect().catch(() => {});
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flashBaud],
  );

  const stopMonitor = useCallback(async () => {
    if (!monitorActive.current) return;
    monitorActive.current = false;
    try {
      await readerRef.current?.cancel();
    } catch {}
    await monitorDone.current;
    try {
      await portRef.current?.close();
    } catch {}
    setStatus((s) => (s === "monitoring" ? "ready" : s));
  }, []);

  /** เลือกพอร์ตและตรวจสอบชนิดชิป */
  const connect = useCallback(async () => {
    if (!("serial" in navigator)) throw new Error("เบราว์เซอร์นี้ไม่รองรับ Web Serial (ใช้ Chrome/Edge)");
    setStatus("connecting");
    try {
      await stopMonitor();
      portRef.current = await navigator.serial.requestPort();
      setHasPort(true);
      setUsbInfo(portRef.current.getInfo());
      await withLoader(async () => {});
      setStatus("ready");
      log("✔ เชื่อมต่อบอร์ดสำเร็จ");
    } catch (e) {
      setStatus(portRef.current ? "ready" : "error");
      throw e;
    }
  }, [log, stopMonitor, withLoader]);

  const disconnect = useCallback(async () => {
    await stopMonitor();
    try {
      await portRef.current?.forget?.();
    } catch {}
    portRef.current = null;
    setHasPort(false);
    setUsbInfo(null);
    setChip(null);
    setMac(null);
    setStatus("idle");
  }, [stopMonitor]);

  /** แฟลชไฟล์ลงบอร์ดแล้ว hard reset */
  const flash = useCallback(
    async (images: FlashImage[], opts: { eraseAll?: boolean } = {}) => {
      if (!portRef.current) throw new Error("กรุณาเชื่อมต่อบอร์ดก่อน");
      await stopMonitor();
      setStatus("flashing");
      setProgress(0);
      const totalBytes = images.reduce((a, b) => a + b.data.length, 0);
      const doneBefore = images.map((_, i) => images.slice(0, i).reduce((a, b) => a + b.data.length, 0));
      try {
        await withLoader(async (loader) => {
          await loader.writeFlash({
            fileArray: images.map((img) => ({ data: img.data, address: img.address })),
            flashMode: "keep",
            flashFreq: "keep",
            flashSize: "keep",
            eraseAll: !!opts.eraseAll,
            compress: true,
            reportProgress: (idx, written, total) => {
              const ratio = (doneBefore[idx] + (written / total) * images[idx].data.length) / totalBytes;
              setProgress(Math.round(ratio * 100));
            },
          });
          await loader.after("hard_reset");
        });
        setProgress(100);
        setStatus("ready");
        log("✔ อัปโหลดเสร็จ บอร์ดรีเซ็ตแล้ว");
      } catch (e) {
        setStatus("error");
        throw e;
      }
    },
    [log, stopMonitor, withLoader],
  );

  const eraseFlash = useCallback(async () => {
    if (!portRef.current) throw new Error("กรุณาเชื่อมต่อบอร์ดก่อน");
    await stopMonitor();
    setStatus("flashing");
    try {
      await withLoader(async (loader) => {
        log("กำลังลบแฟลชทั้งหมด...");
        await loader.eraseFlash();
        await loader.after("hard_reset");
      });
      setStatus("ready");
      log("✔ ลบแฟลชเรียบร้อย");
    } catch (e) {
      setStatus("error");
      throw e;
    }
  }, [log, stopMonitor, withLoader]);

  /** เปิด Serial Monitor */
  const startMonitor = useCallback(
    async (baudRate: number, onData: (text: string) => void) => {
      const port = portRef.current;
      if (!port) throw new Error("กรุณาเชื่อมต่อบอร์ดก่อน");
      await stopMonitor();
      if (!port.readable) await port.open({ baudRate });
      monitorActive.current = true;
      setStatus("monitoring");
      const decoder = new TextDecoder();

      monitorDone.current = (async () => {
        while (monitorActive.current && port.readable) {
          const reader = port.readable.getReader();
          readerRef.current = reader;
          try {
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) onData(decoder.decode(value, { stream: true }));
            }
          } catch (e) {
            if (monitorActive.current) onData(`\n[serial error] ${(e as Error).message}\n`);
          } finally {
            reader.releaseLock();
          }
        }
      })();
    },
    [stopMonitor],
  );

  const sendSerial = useCallback(async (text: string) => {
    const port = portRef.current;
    if (!port?.writable) throw new Error("Serial Monitor ยังไม่เปิด");
    const writer = port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(text));
    } finally {
      writer.releaseLock();
    }
  }, []);

  /** กด EN (reset) ผ่านสาย DTR/RTS */
  const resetBoard = useCallback(async () => {
    const port = portRef.current;
    if (!port?.readable) throw new Error("เปิด Serial Monitor ก่อนจึงจะรีเซ็ตได้");
    await port.setSignals({ dataTerminalReady: false, requestToSend: true });
    await new Promise((r) => setTimeout(r, 120));
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  }, []);

  useEffect(() => () => void stopMonitor(), [stopMonitor]);

  return {
    supported,
    status,
    chip,
    mac,
    progress,
    hasPort,
    usbInfo,
    connect,
    disconnect,
    flash,
    eraseFlash,
    startMonitor,
    stopMonitor,
    sendSerial,
    resetBoard,
  };
}
