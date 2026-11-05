"use client";

import { useEffect, useRef, useState } from "react";
import { App, Button, Input, Select, Space, Tooltip } from "antd";
import { ClearOutlined, PauseOutlined, CaretRightOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";
import styled from "styled-components";
import { BAUD_RATES } from "@/lib/boards";

const Console = styled.pre`
  margin: 0;
  flex: 1;
  min-height: 220px;
  max-height: 360px;
  overflow: auto;
  padding: 14px;
  background: ${({ theme }) => theme.consoleBg};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 12px;
  font: 13px/1.6 ${({ theme }) => theme.mono};
  color: ${({ theme }) => theme.text};
  white-space: pre-wrap;
  word-break: break-all;
`;

const Empty = styled.span`
  color: ${({ theme }) => theme.muted};
  font-family: 'Sarabun', sans-serif;
`;

const Col = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

interface Props {
  active: boolean;
  disabled: boolean;
  onStart: (baud: number, onData: (t: string) => void) => Promise<void>;
  onStop: () => Promise<void>;
  onSend: (t: string) => Promise<void>;
  onReset: () => Promise<void>;
}

const MAX_CHARS = 200_000;

export default function SerialMonitor({ active, disabled, onStart, onStop, onSend, onReset }: Props) {
  const { message } = App.useApp();
  const [baud, setBaud] = useState(115200);
  const [text, setText] = useState("");
  const [input, setInput] = useState("");
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [text]);

  const append = (t: string) => setText((prev) => (prev + t).slice(-MAX_CHARS));

  const toggle = async () => {
    try {
      if (active) await onStop();
      else await onStart(baud, append);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const send = async () => {
    if (!input) return;
    try {
      await onSend(input + "\n");
      append(`> ${input}\n`);
      setInput("");
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <Col>
      <Space wrap>
        <Button
          type={active ? "default" : "primary"}
          icon={active ? <PauseOutlined /> : <CaretRightOutlined />}
          onClick={toggle}
          disabled={disabled}
        >
          {active ? "หยุดอ่าน" : "เริ่มอ่านข้อความ"}
        </Button>
        <Tooltip title="ความเร็ว ต้องตรงกับ Serial.begin() ในโค้ด">
          <Select value={baud} onChange={setBaud} disabled={active} style={{ width: 130 }} aria-label="ความเร็ว (baud)"
            options={BAUD_RATES.map((b) => ({ value: b, label: `${b}` }))} />
        </Tooltip>
        <Tooltip title="รีสตาร์ทบอร์ด">
          <Button icon={<ReloadOutlined />} onClick={() => onReset().catch((e) => message.error(e.message))} disabled={!active} aria-label="รีสตาร์ทบอร์ด" />
        </Tooltip>
        <Tooltip title="ล้างข้อความ">
          <Button icon={<ClearOutlined />} onClick={() => setText("")} aria-label="ล้างข้อความ" />
        </Tooltip>
      </Space>
      <Console ref={ref}>
        {text || <Empty>{disabled ? "เชื่อมต่อบอร์ดก่อน แล้วข้อความจากบอร์ดจะแสดงที่นี่" : "กด “เริ่มอ่านข้อความ” เพื่อดูสิ่งที่บอร์ดพิมพ์ออกมา"}</Empty>}
      </Console>
      <Space.Compact style={{ width: "100%" }}>
        <Input
          placeholder="ส่งข้อความไปที่บอร์ด…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={send}
          disabled={!active}
          aria-label="ข้อความที่จะส่ง"
        />
        <Button icon={<SendOutlined />} onClick={send} disabled={!active}>ส่ง</Button>
      </Space.Compact>
    </Col>
  );
}
