"use client";

import { Button, Input, InputNumber, Segmented, Select, Tooltip } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import styled from "styled-components";
import { DEVICE_TYPES, INPUT_TYPES, OUTPUT_TYPES, type PinConfig } from "@/lib/devices";

/** แถวในฟอร์ม: เลขขาอาจยังว่างอยู่ */
export type PinRow = Omit<PinConfig, "gpio"> & { gpio: number | null };

export const newRow = (): PinRow => ({
  id: Math.random().toString(36).slice(2, 9),
  gpio: null,
  name: "",
  type: "switch",
  level: "LOW",
  pull: "NONE",
});

/** แปลงข้อมูลเก่าที่ยังใช้ mode แทน type */
export function migrateRow(r: PinRow & { mode?: string }): PinRow {
  if (r.type && r.type in DEVICE_TYPES) return r;
  return { ...r, type: r.mode === "INPUT" ? "button" : "switch" };
}

const COLS = "100px minmax(140px, 1fr) 250px 300px 40px";

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Head = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 12px;
  padding: 0 16px;
  font-size: 13px;
  color: ${({ theme }) => theme.muted};
  @media (max-width: 960px) { display: none; }
`;

const Row = styled.div<{ $out: boolean; $err: boolean }>`
  display: grid;
  grid-template-columns: ${COLS};
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 16px;
  border: 1.5px solid ${({ $err, $out }) => ($err ? "#C9786E" : $out ? "#E3CDB5" : "#CBD4B6")};
  background: ${({ theme, $out }) => ($out ? theme.accentSoft : theme.successSoft)};
  .lbl { display: none; font-size: 12px; color: ${({ theme }) => theme.muted}; }
  @media (max-width: 960px) {
    grid-template-columns: 1fr 1fr 40px;
    .lbl { display: block; margin-bottom: 4px; }
    .f-name { grid-column: 2 / 3; }
    .f-type, .f-val { grid-column: 1 / 4; }
    .f-del { grid-row: 1; grid-column: 3; }
  }
`;

const Dir = styled.span<{ $out: boolean }>`
  display: inline-block;
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 999px;
  font: 600 11px 'Prompt', sans-serif;
  color: #fff;
  background: ${({ theme, $out }) => ($out ? theme.accent : theme.success)};
`;

const Note = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.muted};
`;

const Err = styled.span`
  font-size: 12px;
  color: #A8443A;
`;

const Empty = styled.div`
  padding: 36px 16px;
  text-align: center;
  border: 2px dashed ${({ theme }) => theme.border};
  border-radius: 16px;
  color: ${({ theme }) => theme.muted};
  font-size: 15px;
`;

const typeOption = (t: keyof typeof DEVICE_TYPES) => ({
  value: t,
  label: DEVICE_TYPES[t].label,
  desc: DEVICE_TYPES[t].desc,
});

interface Props {
  rows: PinRow[];
  onChange: (rows: PinRow[]) => void;
}

export default function PinForm({ rows, onChange }: Props) {
  const update = (id: string, patch: Partial<PinRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const counts = new Map<number, number>();
  rows.forEach((r) => r.gpio !== null && counts.set(r.gpio, (counts.get(r.gpio) ?? 0) + 1));

  return (
    <List>
      {rows.length > 0 && (
        <Head>
          <span>เลขขา (GPIO)</span>
          <span>ชื่อเรียก (ไม่ใส่ก็ได้)</span>
          <span>ต่อกับอะไร</span>
          <span>ค่าเริ่มต้น</span>
          <span />
        </Head>
      )}

      {rows.length === 0 && <Empty>ยังไม่มีขา — กด “เพิ่มขา” แล้วพิมพ์เลขขาที่ต้องการ</Empty>}

      {rows.map((r) => {
        const info = DEVICE_TYPES[r.type];
        const isOut = info.mode === "OUTPUT";
        const dup = r.gpio !== null && (counts.get(r.gpio) ?? 0) > 1;
        return (
          <div key={r.id}>
            <Row $out={isOut} $err={dup}>
              <div>
                <div className="lbl">เลขขา</div>
                <InputNumber
                  value={r.gpio}
                  onChange={(v) => update(r.id, { gpio: typeof v === "number" ? v : null })}
                  min={0} max={99} precision={0} placeholder="เช่น 2"
                  aria-label="เลขขา GPIO" style={{ width: "100%" }} size="large"
                />
              </div>
              <div className="f-name">
                <div className="lbl">ชื่อเรียก</div>
                <Input value={r.name} onChange={(e) => update(r.id, { name: e.target.value })}
                  placeholder="เช่น ไฟห้องนอน" aria-label="ชื่อเรียก" size="large" />
              </div>
              <div className="f-type">
                <div className="lbl">ต่อกับอะไร</div>
                <Select
                  size="large"
                  value={r.type}
                  onChange={(t) => update(r.id, { type: t })}
                  style={{ width: "100%" }}
                  aria-label="ชนิดอุปกรณ์"
                  popupMatchSelectWidth={300}
                  listHeight={480}
                  options={[
                    { label: "ควบคุม (ขาออก)", options: OUTPUT_TYPES.map(typeOption) },
                    { label: "อ่านค่า (ขาเข้า)", options: INPUT_TYPES.map(typeOption) },
                  ]}
                  optionRender={(o) => (
                    <div style={{ lineHeight: 1.35, padding: "2px 0" }}>
                      <div>{o.data.label}</div>
                      {"desc" in o.data && <div style={{ fontSize: 12, color: "#75655A", whiteSpace: "normal" }}>{String(o.data.desc)}</div>}
                    </div>
                  )}
                  labelRender={(o) => (
                    <span>{o.label}<Dir $out={isOut}>{isOut ? "OUT" : "IN"}</Dir></span>
                  )}
                />
              </div>
              <div className="f-val">
                <div className="lbl">ค่าเริ่มต้น</div>
                {isOut && info.signal === "digital" && (
                  <Segmented block size="large" value={r.level}
                    onChange={(v) => update(r.id, { level: v as PinRow["level"] })}
                    options={[{ value: "HIGH", label: "HIGH (เปิด)" }, { value: "LOW", label: "LOW (ปิด)" }]} />
                )}
                {isOut && info.signal === "pwm" && <Note>เริ่มที่หยุด · ปรับความเร็วที่ Dashboard</Note>}
                {!isOut && info.signal === "digital" && (
                  <Segmented block size="large" value={r.pull}
                    onChange={(v) => update(r.id, { pull: v as PinRow["pull"] })}
                    options={[
                      { value: "NONE", label: "ไม่ใช้" },
                      { value: "PULLUP", label: <span style={{ fontSize: 13 }}>PULLUP</span> },
                      { value: "PULLDOWN", label: <span style={{ fontSize: 13 }}>PULLDOWN</span> },
                    ]} />
                )}
                {!isOut && info.signal === "analog" && <Note>อ่านค่า 0–4095 (ใช้ขา ADC เช่น 32–39)</Note>}
              </div>
              <div className="f-del">
                <Tooltip title="ลบแถวนี้">
                  <Button type="text" danger icon={<DeleteOutlined />} aria-label="ลบแถวนี้"
                    onClick={() => onChange(rows.filter((x) => x.id !== r.id))} />
                </Tooltip>
              </div>
            </Row>
            {dup && <Err>ขา {r.gpio} ถูกใช้ซ้ำ ใช้ได้แถวละ 1 ขา</Err>}
          </div>
        );
      })}

      <Button icon={<PlusOutlined />} size="large" onClick={() => onChange([...rows, newRow()])} style={{ alignSelf: "flex-start" }}>
        เพิ่มขา
      </Button>
    </List>
  );
}
