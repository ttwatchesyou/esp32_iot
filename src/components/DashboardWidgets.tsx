"use client";

import { Button, Slider, Switch } from "antd";
import styled, { css, keyframes } from "styled-components";
import { DEVICE_TYPES, displayName, isActive, type PinConfig } from "@/lib/devices";

const spin = keyframes`to { transform: rotate(360deg); }`;
const ring = keyframes`
  0%, 100% { transform: rotate(0); }
  20% { transform: rotate(-14deg); }
  40% { transform: rotate(12deg); }
  60% { transform: rotate(-8deg); }
  80% { transform: rotate(6deg); }
`;
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(94, 115, 68, 0.45); }
  100% { box-shadow: 0 0 0 22px rgba(94, 115, 68, 0); }
`;

const Card = styled.section<{ $on: boolean; $dim: boolean }>`
  background: ${({ theme }) => theme.panel};
  border: 1.5px solid ${({ theme, $on }) => ($on ? "#D9B98F" : theme.border)};
  border-radius: 22px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 250px;
  opacity: ${({ $dim }) => ($dim ? 0.7 : 1)};
  transition: border-color 0.2s, box-shadow 0.2s;
  ${({ $on }) => $on && css`box-shadow: 0 8px 24px rgba(139, 94, 60, 0.12);`}
`;

const Head = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  h3 { margin: 0; font: 600 17px/1.3 'Prompt', sans-serif; }
  small { display: block; margin-top: 2px; font-size: 12px; color: ${({ theme }) => theme.muted}; }
`;

const State = styled.span<{ $on: boolean; $tone?: "out" | "in" }>`
  flex: none;
  padding: 3px 10px;
  border-radius: 999px;
  font: 600 12px 'Prompt', sans-serif;
  ${({ $on, $tone, theme }) =>
    $on
      ? css`background: ${$tone === "in" ? theme.success : theme.accent}; color: #fff;`
      : css`background: ${theme.panelAlt}; color: #5B4B3E;`}
`;

const Body = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
`;

const BigText = styled.div`
  font: 600 15px 'Prompt', sans-serif;
  color: ${({ theme }) => theme.muted};
`;

/* ---------- visuals ---------- */

const BulbBtn = styled.button<{ $on: boolean }>`
  all: unset;
  cursor: pointer;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: ${({ $on }) => ($on ? "radial-gradient(circle, #FBE7B0 0%, #F6F0E6 70%)" : "#F3EADC")};
  transition: background 0.2s;
  &:focus-visible { outline: 3px solid ${({ theme }) => theme.accent}; outline-offset: 3px; }
  &:disabled { cursor: not-allowed; }
`;

function Bulb({ on }: { on: boolean }) {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18h6M10 21h4" stroke="#6E5A48" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"
        fill={on ? "#F2C14E" : "#E6DACB"} stroke={on ? "#C98F1E" : "#B9A58A"} strokeWidth="1.4" />
      {on && <path d="M12 0.5v1.2M4.2 3.8l.9.9M19.8 3.8l-.9.9M1.5 10h1.2M21.3 10h1.2" stroke="#E0A93A" strokeWidth="1.4" strokeLinecap="round" />}
    </svg>
  );
}

const FanWrap = styled.div<{ $speed: number }>`
  width: 96px;
  height: 96px;
  svg { width: 100%; height: 100%; }
  .blades {
    transform-origin: 50% 50%;
    ${({ $speed }) => $speed > 0 && css`animation: ${spin} ${2.2 - ($speed / 100) * 1.9}s linear infinite;`}
  }
`;

function Fan({ speed }: { speed: number }) {
  const c = speed > 0 ? "#8B5E3C" : "#B9A58A";
  return (
    <FanWrap $speed={speed} aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="22" fill="#F3EADC" stroke="#E2D5C1" strokeWidth="2" />
        <g className="blades">
          {[0, 120, 240].map((a) => (
            <path key={a} d="M24 24 C 20 14, 22 7, 28 6 C 32 10, 30 18, 24 24 Z" fill={c} transform={`rotate(${a} 24 24)`} />
          ))}
        </g>
        <circle cx="24" cy="24" r="4" fill="#4A3A2E" />
      </svg>
    </FanWrap>
  );
}

const IconCircle = styled.div<{ $on: boolean; $anim?: "ring" | "pulse" }>`
  width: 96px;
  height: 96px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: ${({ $on, theme }) => ($on ? theme.accentSoft : "#F3EADC")};
  svg { ${({ $on, $anim }) => $on && $anim === "ring" && css`animation: ${ring} 0.6s ease-in-out infinite;`} }
`;

const PressDot = styled.div<{ $on: boolean }>`
  width: 96px;
  height: 96px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font: 600 14px 'Prompt', sans-serif;
  border: 4px solid ${({ theme }) => theme.success};
  background: ${({ $on, theme }) => ($on ? theme.success : theme.panel)};
  color: ${({ $on, theme }) => ($on ? "#fff" : theme.success)};
  transform: ${({ $on }) => ($on ? "scale(0.94)" : "none")};
  transition: all 0.15s;
`;

const Radar = styled.div<{ $on: boolean }>`
  width: 96px;
  height: 96px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: ${({ $on, theme }) => ($on ? theme.successSoft : "#F3EADC")};
  border: 2px solid ${({ $on, theme }) => ($on ? theme.success : theme.border)};
  ${({ $on }) => $on && css`animation: ${pulse} 1.2s ease-out infinite;`}
`;

function Gauge({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value / 4095));
  const R = 52;
  const len = Math.PI * R;
  return (
    <svg width="150" height="92" viewBox="0 0 150 92" role="img" aria-label={`ค่า ${value} (${Math.round(pct * 100)}%)`}>
      <path d={`M 23 80 A ${R} ${R} 0 0 1 127 80`} fill="none" stroke="#EFE5D5" strokeWidth="14" strokeLinecap="round" />
      <path d={`M 23 80 A ${R} ${R} 0 0 1 127 80`} fill="none" stroke="#5E7344" strokeWidth="14" strokeLinecap="round"
        strokeDasharray={`${len * pct} ${len}`} />
      <text x="75" y="70" textAnchor="middle" style={{ font: "600 24px Prompt, sans-serif", fill: "#3B2F25" }}>{Math.round(pct * 100)}%</text>
      <text x="75" y="88" textAnchor="middle" style={{ font: "12px Sarabun, sans-serif", fill: "#75655A" }}>{value} / 4095</text>
    </svg>
  );
}

const Plug = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6E4A2F" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M9 2v5M15 2v5M6 7h12v3a6 6 0 0 1-12 0V7zM12 16v6" />
  </svg>
);

const Bell = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6E4A2F" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 21h4" />
  </svg>
);

const Eye = ({ on }: { on: boolean }) => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={on ? "#44552F" : "#B9A58A"} strokeWidth="1.8" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const BigSwitch = styled(Switch)`
  &.ant-switch { transform: scale(1.6); margin: 10px 0; }
`;

/* ---------- widget ---------- */

interface Props {
  pin: PinConfig;
  output?: number;
  input?: number;
  online: boolean;
  onSet: (value: number) => void;
}

export default function Widget({ pin, output = 0, input, online, onSet }: Props) {
  const info = DEVICE_TYPES[pin.type];
  const sub = `GPIO ${pin.gpio} · ${info.label}`;
  const on = info.mode === "OUTPUT" ? output > 0 : pin.type === "analog" ? false : isActive(pin, input);
  const title = displayName(pin);

  let state = "";
  let body: React.ReactNode = null;

  switch (pin.type) {
    case "switch":
      state = on ? "เปิด" : "ปิด";
      body = (
        <>
          <BigSwitch checked={on} onChange={(c) => onSet(c ? 1 : 0)} aria-label={`สวิตช์ ${title}`} />
          <BigText>{on ? "เปิดอยู่" : "ปิดอยู่"}</BigText>
        </>
      );
      break;
    case "light":
      state = on ? "ไฟติด" : "ไฟดับ";
      body = (
        <>
          <BulbBtn type="button" $on={on} onClick={() => onSet(on ? 0 : 1)} aria-pressed={on} aria-label={`ไฟ ${title}`}>
            <Bulb on={on} />
          </BulbBtn>
          <BigText>แตะหลอดไฟเพื่อ{on ? "ปิด" : "เปิด"}</BigText>
        </>
      );
      break;
    case "relay":
      state = on ? "จ่ายไฟ" : "ตัดไฟ";
      body = (
        <>
          <IconCircle $on={on}><Plug /></IconCircle>
          <Switch checked={on} onChange={(c) => onSet(c ? 1 : 0)} checkedChildren="ON" unCheckedChildren="OFF" aria-label={`รีเลย์ ${title}`} />
        </>
      );
      break;
    case "buzzer":
      state = on ? "กำลังดัง" : "เงียบ";
      body = (
        <>
          <IconCircle $on={on} $anim="ring"><Bell /></IconCircle>
          <Button type={on ? "default" : "primary"} onClick={() => onSet(on ? 0 : 1)}>{on ? "หยุดเสียง" : "ส่งเสียง"}</Button>
        </>
      );
      break;
    case "motor": {
      const pct = Math.round((output / 255) * 100);
      state = pct ? `${pct}%` : "หยุด";
      body = (
        <>
          <Fan speed={pct} />
          <div style={{ width: "100%" }}>
            <Slider min={0} max={100} value={pct} onChange={(v) => onSet(Math.round((v / 100) * 255))}
              tooltip={{ formatter: (v) => `${v}%` }} aria-label={`ความเร็ว ${title}`} />
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Button size="small" onClick={() => onSet(0)}>หยุด</Button>
              <Button size="small" onClick={() => onSet(128)}>50%</Button>
              <Button size="small" onClick={() => onSet(255)}>100%</Button>
            </div>
          </div>
        </>
      );
      break;
    }
    case "button":
      state = on ? "กดอยู่" : "ปล่อย";
      body = (
        <>
          <PressDot $on={on}>{on ? "กดอยู่" : "ปล่อย"}</PressDot>
          <BigText>{input === undefined ? "รอข้อมูลจากบอร์ด…" : "แสดงสถานะปุ่มบนบอร์ด"}</BigText>
        </>
      );
      break;
    case "sensor":
      state = on ? "ตรวจพบ" : "ปกติ";
      body = (
        <>
          <Radar $on={on}><Eye on={on} /></Radar>
          <BigText>{input === undefined ? "รอข้อมูลจากบอร์ด…" : on ? "ตรวจพบ!" : "ไม่พบความเคลื่อนไหว"}</BigText>
        </>
      );
      break;
    case "analog":
      state = input === undefined ? "—" : `${Math.round((input / 4095) * 100)}%`;
      body = input === undefined ? <BigText>รอข้อมูลจากบอร์ด…</BigText> : <Gauge value={input} />;
      break;
  }

  return (
    <Card $on={on} $dim={!online}>
      <Head>
        <div>
          <h3>{title}</h3>
          <small>{sub}</small>
        </div>
        <State $on={on} $tone={info.mode === "INPUT" ? "in" : "out"}>{state}</State>
      </Head>
      <Body>{body}</Body>
    </Card>
  );
}
