"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Collapse, Checkbox, Input, Popconfirm, Progress, Select, Switch } from "antd";
import {
  ArrowLeftOutlined, ArrowRightOutlined, CheckOutlined, CloudUploadOutlined, CopyOutlined, UsbOutlined,
} from "@ant-design/icons";
import styled, { css } from "styled-components";
import CodeEditor from "@/components/CodeEditor";
import SerialMonitor from "@/components/SerialMonitor";
import BinUploader from "@/components/BinUploader";
import PinForm, { migrateRow, newRow, type PinRow } from "@/components/PinForm";
import NavBar from "@/components/NavBar";
import Link from "next/link";
import { saveLocalDevice } from "@/lib/localDevices";
import { publishConfig } from "@/hooks/useBoardMqtt";
import { MQTT, encodeConfig, newUid, type BoardConfig } from "@/lib/mqttConfig";
import { DEVICE_TYPES, initialOutput } from "@/lib/devices";
import { useEsp32 } from "@/hooks/useEsp32";
import { BOARDS, hex, type BoardDef, type FlashImage } from "@/lib/boards";
import { generateCode, type CloudConfig, type PinConfig } from "@/lib/codegen";
import { DownloadOutlined } from "@ant-design/icons";

/* ================= styled ================= */

const Shell = styled.div`
  min-height: 100vh;
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 24px 40px;
  display: flex;
  flex-direction: column;
  @media (max-width: 640px) { padding: 0 16px 28px; }
`;




const ConnPill = styled.span<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 14px;
  background: ${({ theme, $on }) => ($on ? theme.successSoft : theme.panelAlt)};
  color: ${({ $on }) => ($on ? "#44552F" : "#5B4B3E")};
  &::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ theme, $on }) => ($on ? theme.success : "#B3A08A")};
  }
`;

const Stepper = styled.ol`
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
`;

const StepItem = styled.li<{ $state: "done" | "now" | "next" }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  button {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 10px;
    padding: 2px;
    &:focus-visible { outline: 2px solid ${({ theme }) => theme.accent}; }
    &:disabled { cursor: default; }
  }
  &::before {
    content: "";
    height: 5px;
    border-radius: 3px;
    background: ${({ theme, $state }) => ($state === "next" ? theme.border : $state === "done" ? theme.success : theme.accent)};
  }
`;

const Dot = styled.span<{ $state: "done" | "now" | "next" }>`
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font: 600 13px 'Prompt', sans-serif;
  ${({ $state, theme }) =>
    $state === "done"
      ? css`background: ${theme.success}; color: #fff;`
      : $state === "now"
        ? css`background: ${theme.accent}; color: #fff;`
        : css`background: ${theme.panelAlt}; color: ${theme.muted};`}
`;

const StepLabel = styled.span<{ $state: "done" | "now" | "next" }>`
  font: 500 14px 'Prompt', sans-serif;
  color: ${({ theme, $state }) => ($state === "next" ? theme.muted : theme.text)};
  @media (max-width: 640px) { display: none; }
`;

const Stage = styled.main`
  min-height: 480px;
  background: ${({ theme }) => theme.panel};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 22px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  @media (max-width: 640px) { padding: 20px; border-radius: 18px; }
`;

const Title = styled.div`
  h2 { margin: 0; font: 600 26px/1.3 'Prompt', sans-serif; }
  p { margin: 6px 0 0; font-size: 16px; color: ${({ theme }) => theme.muted}; }
`;

const Footer = styled.footer`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-top: 20px;
`;

const BigBtn = styled(Button)`
  && { height: 52px; padding: 0 28px; font-size: 17px; border-radius: 14px; }
`;

/* ----- step 1 ----- */

const Setup = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 24px;
  @media (max-width: 860px) { grid-template-columns: 1fr; }
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const SecHead = styled.h3`
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  font: 600 18px 'Prompt', sans-serif;
  span {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 14px;
    background: ${({ theme }) => theme.accentSoft};
    color: ${({ theme }) => theme.accent};
  }
`;

const BoardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
`;

const Choice = styled.button<{ $on: boolean }>`
  all: unset;
  cursor: pointer;
  position: relative;
  padding: 16px;
  border-radius: 18px;
  border: 2px solid ${({ theme, $on }) => ($on ? theme.accent : theme.border)};
  background: ${({ theme, $on }) => ($on ? theme.accentSoft : theme.panel)};
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.15s, transform 0.15s;
  &:hover { border-color: ${({ theme }) => theme.accent}; transform: translateY(-1px); }
  .art { height: 84px; display: grid; place-items: center; border-radius: 12px; background: ${({ theme }) => theme.consoleBg}; margin-bottom: 4px; }
  strong { font: 600 17px 'Prompt', sans-serif; }
  span { font-size: 13px; line-height: 1.5; color: ${({ theme }) => theme.muted}; }
  .tick {
    position: absolute; top: 10px; right: 10px; width: 24px; height: 24px; border-radius: 50%;
    display: grid; place-items: center; background: ${({ theme }) => theme.accent}; color: #fff; font-size: 12px;
  }
  &:focus-visible { outline: 3px solid ${({ theme }) => theme.accent}; outline-offset: 2px; }
`;

const ConnectCard = styled.div<{ $on: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
  padding: 24px 20px;
  border-radius: 18px;
  background: ${({ theme, $on }) => ($on ? theme.successSoft : theme.consoleBg)};
  border: 1px solid ${({ theme, $on }) => ($on ? "#CBD4B6" : theme.border)};
  h4 { margin: 0; font: 600 18px 'Prompt', sans-serif; }
  p { margin: 0; color: ${({ theme }) => theme.muted}; font-size: 14px; line-height: 1.6; }
  dl { margin: 0; width: 100%; display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; text-align: left; font-size: 14px; }
  dt { color: ${({ theme }) => theme.muted}; }
  dd { margin: 0; font-weight: 500; }
`;

/** รูปบอร์ดย่อสำหรับการ์ด */
function MiniBoard({ board }: { board: BoardDef }) {
  const perSide = board.id === "esp32" ? 15 : board.id === "esp32s3" ? 20 : board.id === "esp32c3" ? 8 : 12;
  const h = Math.min(70, perSide * 4 + 12);
  const w = board.id === "esp32c3" ? 34 : 46;
  const pinsY = Array.from({ length: perSide }, (_, i) => 8 + (i * (h - 14)) / (perSide - 1));
  return (
    <svg width={h + 40} height={w + 24} viewBox={`0 0 ${h + 40} ${w + 24}`} aria-hidden="true">
      <g transform={`translate(20 12)`}>
        <rect x="0" y="0" width={h} height={w} rx="5" fill="#4A3A2E" />
        {pinsY.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy="4" r="1.6" fill="#D9C7A8" />
            <circle cx={x} cy={w - 4} r="1.6" fill="#D9C7A8" />
          </g>
        ))}
        <rect x={h - 26} y="10" width="22" height={w - 20} rx="2" fill="#CDBDA6" />
        <rect x={h - 6} y="10" width="6" height={w - 20} fill="#3E3027" />
        <rect x="-6" y={w / 2 - 6} width="10" height="12" rx="2" fill="#A6998A" />
      </g>
    </svg>
  );
}

function UsbArt({ on }: { on: boolean }) {
  const c = on ? "#5E7344" : "#8B5E3C";
  return (
    <svg width="220" height="80" viewBox="0 0 220 80" aria-hidden="true">
      <rect x="4" y="10" width="84" height="54" rx="6" fill="none" stroke="#B9A58A" strokeWidth="3" />
      <rect x="0" y="64" width="92" height="8" rx="3" fill="#B9A58A" />
      <rect x="14" y="20" width="64" height="34" rx="3" fill={on ? "#E7EBDA" : "#F1E3D3"} />
      <path d="M92 50 C120 50 120 40 150 40" fill="none" stroke={c} strokeWidth="4" strokeDasharray={on ? "0" : "6 6"} />
      <rect x="150" y="18" width="66" height="44" rx="6" fill="#4A3A2E" />
      <rect x="186" y="26" width="24" height="28" rx="2" fill="#CDBDA6" />
      <rect x="144" y="33" width="10" height="14" rx="2" fill="#A6998A" />
      {on && <circle cx="160" cy="26" r="3" fill="#9BC46A" />}
    </svg>
  );
}

const WifiCard = styled.section`
  margin-top: 8px;
  padding: 20px;
  border-radius: 18px;
  background: ${({ theme }) => theme.consoleBg};
  border: 1px solid ${({ theme }) => theme.border};
  display: flex;
  flex-direction: column;
  gap: 14px;
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  h3 { margin: 0; font: 600 18px 'Prompt', sans-serif; }
  p { margin: 2px 0 0; font-size: 14px; color: ${({ theme }) => theme.muted}; }
  .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
  label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: ${({ theme }) => theme.muted}; }
  .warn { font-size: 13px; color: #8A4B2A; background: #F6E3D3; padding: 8px 12px; border-radius: 10px; }
  .uid {
    display: flex; flex-wrap: wrap; align-items: center; gap: 12px 28px;
    padding: 14px 16px; border-radius: 14px; background: ${({ theme }) => theme.panel}; border: 1px dashed ${({ theme }) => theme.border};
    span { display: block; font-size: 12px; color: ${({ theme }) => theme.muted}; }
    code { font: 600 15px ${({ theme }) => theme.mono}; word-break: break-all; }
    small { display: block; font-size: 12px; color: #44552F; }
    button { margin-left: auto; }
  }
`;

/* ----- step 4 ----- */

const UploadHero = styled.div<{ $done: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
  padding: 32px 20px;
  border-radius: 20px;
  background: ${({ theme, $done }) => ($done ? theme.successSoft : theme.consoleBg)};
  border: 1px solid ${({ theme, $done }) => ($done ? "#CBD4B6" : theme.border)};
  h3 { margin: 0; font: 600 22px 'Prompt', sans-serif; }
  p { margin: 0; color: ${({ theme }) => theme.muted}; font-size: 15px; }
`;

const LogBox = styled.pre`
  margin: 0;
  max-height: 220px;
  overflow: auto;
  padding: 12px;
  background: ${({ theme }) => theme.consoleBg};
  border-radius: 10px;
  font: 12px/1.6 ${({ theme }) => theme.mono};
  color: ${({ theme }) => theme.muted};
  white-space: pre-wrap;
`;

/* ================= state & storage ================= */

interface Saved {
  boardId: string;
  rows?: PinRow[];
  code: string;
  projectName?: string;
  cloudOn?: boolean;
  ssid?: string;
  wifiPass?: string;
  uid?: string;
}
const STORAGE_KEY = "esp32-iot-studio:wizard";

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { boardId: "esp32", rows: [newRow()], code: "" };
}

function friendly(msg: string): string | null {
  if (/No port selected/i.test(msg)) return null;
  if (/open|busy|in use/i.test(msg)) return "พอร์ตถูกโปรแกรมอื่นใช้อยู่ ลองปิด Arduino IDE หรือแท็บอื่นก่อน";
  if (/timeout|sync|connect|chip/i.test(msg)) return "บอร์ดไม่ตอบสนอง ลองกดปุ่ม BOOT บนบอร์ดค้างไว้ แล้วลองใหม่";
  return msg;
}

function configImage(json: string): FlashImage {
  const body = new TextEncoder().encode(json);
  if (body.length > 6000) throw new Error("ค่าตั้งมีขนาดใหญ่เกิน 6 KB กรุณาย่อชื่อบอร์ดหรือชื่ออุปกรณ์");
  const data = new Uint8Array(16 + body.length);
  data.set(new TextEncoder().encode("IOTCFG1"));
  const view = new DataView(data.buffer);
  view.setUint32(8, body.length, true);
  let checksum = 2166136261;
  body.forEach((byte) => { checksum = Math.imul(checksum ^ byte, 16777619) >>> 0; });
  view.setUint32(12, checksum, true);
  data.set(body, 16);
  return { name: "project-config.bin", address: 0x1f0000, data };
}

const STEPS = ["เลือกบอร์ด", "ตั้งค่าขา", "ดูโค้ด", "อัปโหลด"];

/* ================= page ================= */

export default function WizardPage() {
  const { message } = App.useApp();
  const [step, setStep] = useState(0);
  const [boardId, setBoardId] = useState("esp32");
    const [rows, setRows] = useState<PinRow[]>([]);
  const [projectName, setProjectName] = useState("บอร์ดของฉัน");
  const [cloudOn, setCloudOn] = useState(true);
  const [ssid, setSsid] = useState("");
  const [wifiPass, setWifiPass] = useState("");
  const [uid, setUid] = useState("");
  const [origin, setOrigin] = useState("");
  const [registering, setRegistering] = useState(false);
  const [code, setCode] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [logs, setLogs] = useState("");
  const [compiling, setCompiling] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [eraseAll, setEraseAll] = useState(false);
  const [binImages, setBinImages] = useState<FlashImage[]>([]);

  const appendLog = useCallback((s: string) => setLogs((l) => (l + s + "\n").slice(-100_000)), []);
  const esp = useEsp32({ onLog: appendLog });

  useEffect(() => {
    const s = load();
    setBoardId(s.boardId);
    setRows(s.rows?.length ? s.rows.map(migrateRow) : [newRow()]);
    setProjectName(s.projectName ?? "บอร์ดของฉัน");
    setCloudOn(s.cloudOn ?? true);
    setSsid(s.ssid ?? "");
    setWifiPass(s.wifiPass ?? "");
    setUid(s.uid || newUid());
    setOrigin(window.location.origin);
    setCode(s.code ?? "");
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      const data: Saved = { boardId, rows, code, projectName, cloudOn, ssid, wifiPass, uid };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [loaded, boardId, rows, code, projectName, cloudOn, ssid, wifiPass, uid]);

  const board = useMemo(() => BOARDS.find((b) => b.id === boardId) ?? BOARDS[0], [boardId]);
  const pins: PinConfig[] = rows.filter((r): r is PinRow & { gpio: number } => r.gpio !== null);
  const dupCount = new Set(pins.map((p) => p.gpio)).size !== pins.length;
  const connected = esp.hasPort;
  const flashing = esp.status === "flashing";
  const busy = compiling || flashing || esp.status === "connecting";

  const changeBoard = (id: string) => {
    setBoardId(id);
    setUploaded(false);
  };


  /* ----- actions ----- */

  const handleConnect = async () => {
    try {
      const chipName = await esp.connect();
      const normalized = chipName.toUpperCase();
      const detectedId = normalized.includes("ESP32-S3") ? "esp32s3"
        : normalized.includes("ESP32-C3") ? "esp32c3"
          : normalized.includes("ESP32-C6") ? "esp32c6"
            : "esp32";
      if (detectedId !== boardId) {
        setBoardId(detectedId);
        setUploaded(false);
        message.info(`ตรวจพบบอร์ด ${BOARDS.find((b) => b.id === detectedId)?.label} และเลือกให้แล้ว`);
      } else {
        message.success("เชื่อมต่อบอร์ดแล้ว");
      }
    } catch (e) {
      const m = friendly((e as Error).message);
      if (m) message.error(m);
    }
  };

  /** ลงทะเบียนบอร์ด: ผูก UID กับข้อมูลบอร์ด แล้วประกาศขึ้น MQTT broker (เปิด /d/<uid> จากที่ไหนก็เห็น) */
  const boardConfig = (): BoardConfig => ({ v: 1, name: projectName || "บอร์ดของฉัน", board: board.label, mac: esp.mac ?? undefined, pins });
  const registerBoard = async () => {
    const outs: Record<number, number> = {};
    pins.forEach((p) => { if (DEVICE_TYPES[p.type].mode === "OUTPUT") outs[p.gpio] = initialOutput(p); });
    await publishConfig(uid, boardConfig(), outs);
    saveLocalDevice({ uid, name: projectName || "บอร์ดของฉัน" });
  };

  const genAndNext = async () => {
    if (rows.some((r) => r.gpio === null)) return message.warning("ใส่เลขขาให้ครบทุกแถว หรือลบแถวที่ไม่ใช้");
    if (dupCount) return message.warning("มีเลขขาซ้ำกัน ใช้ได้แถวละ 1 ขา");
    let cloud: CloudConfig | undefined;
    if (cloudOn) {
      if (!ssid.trim()) return message.warning("ใส่ชื่อ WiFi เพื่อใช้ Dashboard หรือปิดตัวเลือก Dashboard");
      setRegistering(true);
      try {
        await registerBoard();
        const { encodeConfig } = await import("@/lib/mqttConfig");
        cloud = {
          ssid, password: wifiPass, uid, configJson: encodeConfig(boardConfig()),
          mqtt: { host: MQTT.host, port: MQTT.port, tls: MQTT.tls, username: MQTT.username, password: MQTT.password, prefix: MQTT.prefix },
        };
      } catch (e) {
        return message.error(`ลงทะเบียนบอร์ดไม่สำเร็จ: ${(e as Error).message}`);
      } finally {
        setRegistering(false);
      }
    }
    setCode(generateCode(pins, board.label, cloud));
    setUploaded(false);
    setStep(2);
  };

  const downloadIno = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(projectName || "esp32").replace(/[^\p{L}\p{N}_-]+/gu, "_")}.ino`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); message.success("คัดลอกโค้ดแล้ว"); }
    catch { message.error("คัดลอกไม่ได้"); }
  };

  const flash = async (imgs: FlashImage[]) => {
    appendLog(`\n▶ อัปโหลดลงบอร์ด...`);
    try {
      await esp.flash(imgs, { eraseAll });
      setUploaded(true);
      message.success("อัปโหลดสำเร็จ!");
    } catch (e) {
      appendLog(`✖ ${(e as Error).message}`);
      message.error(friendly((e as Error).message) ?? "อัปโหลดไม่สำเร็จ");
    }
  };

  const uploadAll = async () => {
    setUploaded(false);
    setCompiling(true);
    appendLog(`\n▶ เตรียมเฟิร์มแวร์สำเร็จรูปสำหรับ ${board.label}...`);
    try {
      const response = await fetch(`/firmware/${board.id}.merged.bin`, { cache: "no-cache" });
      if (!response.ok) throw new Error(`ไม่พบเฟิร์มแวร์สำหรับ ${board.label} (${response.status})`);
      const image: FlashImage = {
        name: `${board.id}.merged.bin`,
        address: 0,
        data: new Uint8Array(await response.arrayBuffer()),
      };
      appendLog(`  • ${image.name} @ ${hex(image.address)} (${Math.ceil(image.data.length / 1024)} KB)`);
      setCompiling(false);

      const compactBoard = JSON.parse(encodeConfig(boardConfig()));
      const provisioning = JSON.stringify({
        s: cloudOn ? ssid : "",
        w: cloudOn ? wifiPass : "",
        u: uid,
        h: MQTT.host,
        o: MQTT.port,
        x: MQTT.tls,
        a: MQTT.username,
        k: MQTT.password,
        r: MQTT.prefix,
        c: compactBoard,
      });
      const settings = configImage(provisioning);
      appendLog("▶ เขียนเฟิร์มแวร์และค่าตั้งลงบอร์ด...");
      await esp.flash([image, settings], { eraseAll });
      appendLog("✔ บอร์ดได้รับเฟิร์มแวร์และค่าตั้งแล้ว");
      setUploaded(true);
      message.success("ติดตั้งและตั้งค่าบอร์ดสำเร็จ!");
    } catch (e) {
      const detail = friendly((e as Error).message) ?? (e as Error).message;
      appendLog(`✖ ${detail}`);
      message.error(detail);
    } finally {
      setCompiling(false);
    }
  };

  /* ----- step render ----- */

  const stateOf = (i: number): "done" | "now" | "next" => (i < step ? "done" : i === step ? "now" : "next");
  const canGo = (i: number) => i <= step || i === 1 || (i >= 2 && pins.length > 0 && !!code);


  return (
    <Shell>
      <NavBar right={<ConnPill $on={connected}>{connected ? `เชื่อมต่อแล้ว · ${esp.chip ?? "ESP32"}` : "ยังไม่เชื่อมต่อบอร์ด"}</ConnPill>} />

      <Stepper aria-label="ขั้นตอน">
        {STEPS.map((label, i) => (
          <StepItem key={label} $state={stateOf(i)} aria-current={i === step ? "step" : undefined}>
            <button type="button" onClick={() => setStep(i)} disabled={!canGo(i) || busy}>
              <Dot $state={stateOf(i)}>{i < step ? <CheckOutlined /> : i + 1}</Dot>
              <StepLabel $state={stateOf(i)}>{label}</StepLabel>
            </button>
          </StepItem>
        ))}
      </Stepper>

      <Stage>
        {/* ---------- STEP 1 ---------- */}
        {step === 0 && (
          <>
            <Title>
              <h2>มาเตรียมบอร์ดกัน</h2>
              <p>เลือกชิปบนบอร์ดของคุณ แล้วเสียบสาย USB เข้าคอมพิวเตอร์</p>
            </Title>

            <Setup>
              <Section>
                <SecHead><span>1</span>ชิปบนบอร์ดของคุณ</SecHead>
                <BoardGrid>
                  {BOARDS.map((b) => (
                    <Choice key={b.id} type="button" $on={b.id === boardId} onClick={() => changeBoard(b.id)} aria-pressed={b.id === boardId}>
                      {b.id === boardId && <i className="tick" aria-hidden="true"><CheckOutlined /></i>}
                      <div className="art"><MiniBoard board={b} /></div>
                      <strong>{b.short}</strong>
                      <span>{b.hint}</span>
                    </Choice>
                  ))}
                </BoardGrid>
                <span style={{ fontSize: 13, color: "#75655A" }}>ไม่แน่ใจ? ส่วนใหญ่เป็น ESP32 ธรรมดา</span>
              </Section>

              <Section>
                <SecHead><span>2</span>เสียบสายแล้วเชื่อมต่อ</SecHead>
                <ConnectCard $on={connected}>
                  <UsbArt on={connected} />
                  {connected ? (
                    <>
                      <h4>เชื่อมต่อแล้ว พร้อมใช้งาน</h4>
                      <dl>
                        <dt>ชิปบอร์ด</dt><dd>{esp.chip ?? "ESP32"}</dd>
                        <dt>พอร์ต</dt><dd>พร้อมอัปโหลด</dd>
                      </dl>
                      <Button onClick={esp.disconnect} disabled={busy}>ตัดการเชื่อมต่อ</Button>
                    </>
                  ) : (
                    <>
                      <h4>เสียบสาย USB แล้วกดปุ่ม</h4>
                      <p>จะมีหน้าต่างให้เลือกพอร์ต เช่น <b>COM3</b> หรือ <b>USB Serial</b></p>
                      <BigBtn type="primary" icon={<UsbOutlined />} onClick={handleConnect}
                        loading={esp.status === "connecting"} disabled={!esp.supported}>
                        เชื่อมต่อบอร์ด
                      </BigBtn>
                      <span style={{ fontSize: 13, color: "#75655A" }}>ข้ามไปตั้งค่าขาก่อน แล้วค่อยเชื่อมต่อทีหลังก็ได้</span>
                    </>
                  )}
                </ConnectCard>
                {!esp.supported && (
                  <p style={{ margin: 0, color: "#8A4B2A" }}>เบราว์เซอร์นี้เชื่อมต่อบอร์ดไม่ได้ กรุณาใช้ Chrome หรือ Edge บนคอมพิวเตอร์</p>
                )}
              </Section>
            </Setup>

          </>
        )}

        {/* ---------- STEP 2 ---------- */}
        {step === 1 && (
          <>
            <Title>
              <h2>กรอกขาที่ต้องการใช้</h2>
              <p>พิมพ์เลขขา (ดูเลขที่พิมพ์ข้างขาบนบอร์ด เช่น D2 หรือ IO2 ให้ใส่ 2) เลือกขาออก/ขาเข้า แล้วกดเจนโค้ด</p>
            </Title>
            <PinForm rows={rows} onChange={(r) => { setRows(r); setUploaded(false); }} />

            <WifiCard>
              <header>
                <div>
                  <h3>ควบคุมผ่าน Dashboard (WiFi)</h3>
                  <p>ลงทะเบียนบอร์ดด้วย UID — เปิด Dashboard ของบอร์ดนี้ได้จากทุกที่ที่ลิงก์ด้านล่าง</p>
                </div>
                <Switch checked={cloudOn} onChange={setCloudOn} aria-label="ใช้ Dashboard" />
              </header>
              {cloudOn && (
                <>
                  <div className="grid">
                    <label>ชื่อบอร์ด/โปรเจค
                      <Input size="large" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="เช่น ห้องนอน" />
                    </label>
                    <label>ชื่อ WiFi (2.4 GHz)
                      <Input size="large" value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="ชื่อ WiFi" autoComplete="off" />
                    </label>
                    <label>รหัส WiFi
                      <Input.Password size="large" value={wifiPass} onChange={(e) => setWifiPass(e.target.value)} placeholder="รหัสผ่าน" autoComplete="new-password" />
                    </label>
                  </div>
                  <div className="uid">
                    <div>
                      <span>UID ของบอร์ดนี้</span>
                      <code>{uid}</code>
                      {esp.mac && <small>ผูกกับบอร์ด MAC {esp.mac}</small>}
                    </div>
                    <div>
                      <span>ลิงก์ Dashboard</span>
                      <code>{origin}/d/{uid}</code>
                    </div>
                    <Button onClick={() => setUid(newUid())}>สร้าง UID ใหม่</Button>
                  </div>
                </>
              )}
            </WifiCard>
          </>
        )}

        {/* ---------- STEP 3 ---------- */}
        {step === 2 && (
          <>
            <Title style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
              <div>
                <h2>นี่คือโค้ดของคุณ</h2>
                <p>โค้ดตัวอย่างตามค่าที่เลือก ดาวน์โหลดไปแก้ต่อได้ ส่วนปุ่มติดตั้งใช้เฟิร์มแวร์กลางที่ผ่านการทดสอบแล้ว</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button icon={<CopyOutlined />} onClick={copyCode}>คัดลอกโค้ด</Button>
                <Button icon={<DownloadOutlined />} onClick={downloadIno}>ดาวน์โหลด .ino</Button>
              </div>
            </Title>
            <div style={{ height: 460 }}>
              <CodeEditor value={code} onChange={setCode} />
            </div>
          </>
        )}

        {/* ---------- STEP 4 ---------- */}
        {step === 3 && (
          <>
            <UploadHero $done={uploaded}>
              {uploaded ? (
                <>
                  <CheckOutlined style={{ fontSize: 40, color: "#5E7344" }} />
                  <h3>อัปโหลดสำเร็จ บอร์ดทำงานแล้ว</h3>
                  <p>ดูข้อความที่บอร์ดส่งออกมาได้ด้านล่าง</p>
                </>
              ) : busy && esp.status !== "connecting" ? (
                <>
                  <h3>{compiling ? "กำลังเตรียมและตั้งค่าบอร์ด… อย่าถอดสาย" : "กำลังเขียนลงบอร์ด… อย่าถอดสาย"}</h3>
                  <Progress type="circle" percent={compiling ? 0 : esp.progress} strokeColor="#8B5E3C" size={110}
                    format={(p) => (compiling ? "…" : `${p}%`)} />
                </>
              ) : (
                <>
                  <CloudUploadOutlined style={{ fontSize: 44, color: "#8B5E3C" }} />
                  <h3>{connected ? "พร้อมอัปโหลดลงบอร์ด" : "เชื่อมต่อบอร์ดก่อนอัปโหลด"}</h3>
                  <p>{connected ? "กดครั้งเดียว เว็บจะติดตั้งและตั้งค่าบอร์ดให้ ใช้เวลาประมาณ 1–2 นาที" : "เสียบสาย USB แล้วกดเชื่อมต่อ"}</p>
                  {connected ? (
                    <BigBtn type="primary" icon={<CloudUploadOutlined />} onClick={uploadAll}>อัปโหลดลงบอร์ด</BigBtn>
                  ) : (
                    <BigBtn type="primary" icon={<UsbOutlined />} onClick={handleConnect}
                      loading={esp.status === "connecting"} disabled={!esp.supported}>เชื่อมต่อบอร์ด</BigBtn>
                  )}
                </>
              )}
              {uploaded && cloudOn && uid && (
                <Link href={`/d/${uid}`}><BigBtn type="primary">เปิด Dashboard <ArrowRightOutlined /></BigBtn></Link>
              )}
              {uploaded && <Button onClick={uploadAll} disabled={busy}>อัปโหลดอีกครั้ง</Button>}
            </UploadHero>

            {connected && (
              <div>
                <h3 style={{ margin: "0 0 12px", font: "600 18px Prompt, sans-serif" }}>ข้อความจากบอร์ด</h3>
                <SerialMonitor
                  active={esp.status === "monitoring"}
                  disabled={!connected || busy}
                  onStart={esp.startMonitor}
                  onStop={esp.stopMonitor}
                  onSend={esp.sendSerial}
                  onReset={esp.resetBoard}
                />
              </div>
            )}

            <Collapse
              ghost
              items={[
                { key: "log", label: "รายละเอียดการทำงาน", children: <LogBox>{logs || "ยังไม่มีบันทึก"}</LogBox> },
                {
                  key: "adv",
                  label: "ตัวเลือกขั้นสูง",
                  children: (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <Checkbox checked={eraseAll} onChange={(e) => setEraseAll(e.target.checked)}>ล้างข้อมูลในบอร์ดก่อนอัปโหลด</Checkbox>
                      <BinUploader images={binImages} onChange={setBinImages} />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <Button onClick={() => flash(binImages)} disabled={busy || !connected || !binImages.length}>อัปโหลดไฟล์ .bin</Button>
                        <Popconfirm title="ล้างข้อมูลในบอร์ดทั้งหมด?" okText="ล้าง" cancelText="ยกเลิก"
                          onConfirm={() => esp.eraseFlash().catch((e) => message.error(e.message))}>
                          <Button danger disabled={busy || !connected}>ล้างหน่วยความจำบอร์ด</Button>
                        </Popconfirm>
                        <Select value={boardId} onChange={changeBoard} style={{ width: 200 }} aria-label="รุ่นบอร์ด"
                          options={BOARDS.map((b) => ({ value: b.id, label: b.label }))} />
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </>
        )}
      </Stage>

      <Footer>
        <Button size="large" icon={<ArrowLeftOutlined />} onClick={() => setStep((s) => s - 1)}
          style={{ visibility: step === 0 ? "hidden" : "visible" }} disabled={busy}>
          ย้อนกลับ
        </Button>
        {step === 0 && <BigBtn type="primary" onClick={() => setStep(1)}>ถัดไป: ตั้งค่าขา <ArrowRightOutlined /></BigBtn>}
        {step === 1 && (
          <BigBtn type="primary" onClick={genAndNext} disabled={!rows.length} loading={registering}>
            เจนโค้ด <ArrowRightOutlined />
          </BigBtn>
        )}
        {step === 2 && <BigBtn type="primary" onClick={() => setStep(3)}>ถัดไป: อัปโหลด <ArrowRightOutlined /></BigBtn>}
        {step === 3 && (
          <Button size="large" onClick={() => { setStep(1); setUploaded(false); }} disabled={busy}>แก้ไขขาอีกครั้ง</Button>
        )}
      </Footer>
    </Shell>
  );
}
