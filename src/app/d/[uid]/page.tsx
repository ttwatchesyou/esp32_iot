"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { App, Button, Input, Popover, QRCode, Spin } from "antd";
import { CopyOutlined, QrcodeOutlined, SendOutlined } from "@ant-design/icons";
import styled from "styled-components";
import NavBar from "@/components/NavBar";
import Widget from "@/components/DashboardWidgets";
import { useBoardMqtt } from "@/hooks/useBoardMqtt";
import { saveLocalDevice } from "@/lib/localDevices";
import { DEVICE_TYPES } from "@/lib/devices";
import { isPublicBroker, isValidUid } from "@/lib/mqttConfig";

const Shell = styled.div`
  min-height: 100vh;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 24px 40px;
  @media (max-width: 640px) { padding: 0 16px 28px; }
`;

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  .t { margin-right: auto; }
  h1 { margin: 0; font: 600 26px 'Prompt', sans-serif; }
  small { display: block; margin-top: 4px; font-size: 13px; color: ${({ theme }) => theme.muted}; }
  code { font-family: ${({ theme }) => theme.mono}; }
`;

const Pill = styled.span<{ $tone: "ok" | "bad" | "wait" }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 14px;
  background: ${({ $tone, theme }) => ($tone === "ok" ? theme.successSoft : $tone === "bad" ? "#F3E1D6" : theme.panelAlt)};
  color: ${({ $tone }) => ($tone === "ok" ? "#44552F" : $tone === "bad" ? "#7A3F1D" : "#5B4B3E")};
  &::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $tone }) => ($tone === "ok" ? "#5E7344" : $tone === "bad" ? "#B5483B" : "#B3A08A")};
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
`;

const Section = styled.h2`
  margin: 28px 0 12px;
  font: 600 16px 'Prompt', sans-serif;
  color: ${({ theme }) => theme.muted};
`;

const Note = styled.div`
  margin-bottom: 16px;
  padding: 12px 16px;
  border-radius: 14px;
  background: #F6E3D3;
  color: #7A3F1D;
  font-size: 14px;
  line-height: 1.6;
`;

const Empty = styled.div`
  padding: 56px 24px;
  border-radius: 22px;
  border: 2px dashed ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.panel};
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  h2 { margin: 0; font: 600 22px 'Prompt', sans-serif; }
  p { margin: 0; color: ${({ theme }) => theme.muted}; max-width: 480px; line-height: 1.7; }
`;

const TextCard = styled.div`
  padding: 20px;
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 18px;
  background: ${({ theme }) => theme.panel};
  .latest {
    min-height: 52px;
    margin-bottom: 14px;
    padding: 13px 15px;
    border-radius: 12px;
    background: ${({ theme }) => theme.panelAlt};
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  form { display: flex; gap: 8px; }
  small { display: block; margin-top: 10px; color: ${({ theme }) => theme.muted}; }
  @media (max-width: 520px) { form { flex-direction: column; } }
`;

export default function BoardDashboard({ params }: { params: Promise<{ uid: string }> }) {
  const { uid: rawUid } = use(params);
  const uid = rawUid.toLowerCase();
  const valid = isValidUid(uid);
  const { message } = App.useApp();
  const { broker, config, online, outputs, inputs, sharedText, setOutput, sendText } = useBoardMqtt(valid ? uid : null);
  const [waited, setWaited] = useState(false);
  const [link, setLink] = useState("");
  const [textDraft, setTextDraft] = useState("");

  useEffect(() => {
    setLink(window.location.href);
    const t = setTimeout(() => setWaited(true), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (config) saveLocalDevice({ uid, name: config.name });
  }, [config, uid]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      message.success("คัดลอกลิงก์แล้ว");
    } catch {
      message.error("คัดลอกไม่ได้");
    }
  };

  const control = (gpio: number, v: number) => {
    if (!setOutput(gpio, v)) message.error("ยังไม่ได้เชื่อมต่อ ลองใหม่อีกครั้ง");
  };

  const submitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textDraft.trim()) return message.warning("พิมพ์ข้อความก่อนส่ง");
    if (!sendText(textDraft)) return message.error("MQTT ยังไม่เชื่อมต่อ ลองใหม่อีกครั้ง");
    setTextDraft("");
    message.success("ส่งข้อความแล้ว");
  };

  const outs = config?.pins.filter((p) => DEVICE_TYPES[p.type].mode === "OUTPUT") ?? [];
  const ins = config?.pins.filter((p) => DEVICE_TYPES[p.type].mode === "INPUT") ?? [];
  const isOnline = online === true;

  let body: React.ReactNode;
  if (!valid) {
    body = (
      <Empty>
        <h2>UID ไม่ถูกต้อง</h2>
        <p>ลิงก์ Dashboard ต้องเป็นรูปแบบ /d/&lt;UID&gt; ที่ได้จากการลงทะเบียนบอร์ด</p>
        <Link href="/dashboard"><Button type="primary">ไปหน้าบอร์ดของฉัน</Button></Link>
      </Empty>
    );
  } else if (!config) {
    body = waited ? (
      <Empty>
        <h2>ยังไม่พบข้อมูลบอร์ดนี้</h2>
        <p>
          {broker !== "connected"
            ? "กำลังเชื่อมต่อเซิร์ฟเวอร์ MQTT… ถ้านานเกินไป ลองรีเฟรช หรือตรวจอินเทอร์เน็ต"
            : "อาจพิมพ์ UID ผิด หรือบอร์ดยังไม่เคยลงทะเบียน/ออนไลน์ — เปิดไฟเลี้ยงบอร์ดแล้วรอสักครู่ หน้านี้จะอัปเดตเอง"}
        </p>
      </Empty>
    ) : (
      <Spin style={{ display: "block", margin: "80px auto" }} />
    );
  } else {
    body = (
      <>
        {!isOnline && (
          <Note>
            บอร์ดออฟไลน์ — ตรวจว่าเปิดไฟเลี้ยงบอร์ดและ WiFi ถูกต้อง · กดสั่งไว้ล่วงหน้าได้ บอร์ดจะทำตามเมื่อกลับมาออนไลน์
          </Note>
        )}
        <Section>ทดสอบข้อความ MQTT</Section>
        <TextCard>
          <div className="latest">{sharedText || "ยังไม่มีข้อความ — ลองส่งข้อความจากช่องด้านล่าง"}</div>
          <form onSubmit={submitText}>
            <Input value={textDraft} onChange={(e) => setTextDraft(e.target.value)} maxLength={500}
              placeholder="พิมพ์ข้อความที่ต้องการแชร์" aria-label="ข้อความ MQTT" />
            <Button type="primary" htmlType="submit" icon={<SendOutlined />} disabled={broker !== "connected"}>ส่งข้อความ</Button>
          </form>
          <small>ข้อความล่าสุดถูกเก็บบน MQTT เครื่องอื่นที่เปิดลิงก์นี้จะเห็นข้อความเดียวกันทันที</small>
        </TextCard>
        {outs.length > 0 && (
          <>
            <Section>ควบคุม</Section>
            <Grid>
              {outs.map((p) => (
                <Widget key={p.gpio} pin={p} output={outputs[p.gpio]} online={isOnline} onSet={(v) => control(p.gpio, v)} />
              ))}
            </Grid>
          </>
        )}
        {ins.length > 0 && (
          <>
            <Section>สถานะจากบอร์ด</Section>
            <Grid>
              {ins.map((p) => (
                <Widget key={p.gpio} pin={p} input={inputs[p.gpio]} online={isOnline} onSet={() => {}} />
              ))}
            </Grid>
          </>
        )}
      </>
    );
  }

  return (
    <Shell>
      <NavBar />
      {valid && (
        <Head>
          <div className="t">
            <h1>{config?.name ?? "Dashboard"}</h1>
            <small>UID <code>{uid}</code>{config?.mac ? ` · MAC ${config.mac}` : ""}{config?.board ? ` · ${config.board}` : ""}</small>
          </div>
          <Pill $tone={broker !== "connected" ? "wait" : isOnline ? "ok" : online === false ? "bad" : "wait"}>
            {broker !== "connected" ? "กำลังเชื่อมต่อ…" : isOnline ? "บอร์ดออนไลน์" : online === false ? "บอร์ดออฟไลน์" : "รอสถานะบอร์ด…"}
          </Pill>
          <Button icon={<CopyOutlined />} onClick={copy}>คัดลอกลิงก์</Button>
          <Popover
            trigger="click"
            content={<div style={{ textAlign: "center" }}><QRCode value={link || "-"} size={180} /><div style={{ fontSize: 13, marginTop: 6 }}>สแกนเพื่อเปิดบนมือถือ</div></div>}
          >
            <Button icon={<QrcodeOutlined />} aria-label="QR Code" />
          </Popover>
        </Head>
      )}
      {valid && isPublicBroker && config && (
        <small style={{ display: "block", margin: "-8px 0 16px", color: "#75655A", fontSize: 12 }}>
          ใครมีลิงก์นี้ดูและสั่งบอร์ดได้ — เก็บลิงก์ไว้เป็นความลับ
        </small>
      )}
      {body}
    </Shell>
  );
}
