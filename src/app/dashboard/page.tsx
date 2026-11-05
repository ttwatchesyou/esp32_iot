"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Popconfirm } from "antd";
import { ArrowRightOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import styled from "styled-components";
import NavBar from "@/components/NavBar";
import { listLocalDevices, removeLocalDevice, type LocalDevice } from "@/lib/localDevices";
import { isValidUid } from "@/lib/mqttConfig";

const Shell = styled.div`
  min-height: 100vh;
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 24px 40px;
  @media (max-width: 640px) { padding: 0 16px 28px; }
  h1 { margin: 0 0 6px; font: 600 26px 'Prompt', sans-serif; }
  .sub { margin: 0 0 20px; color: ${({ theme }) => theme.muted}; }
`;

const Open = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 18px;
  margin-bottom: 24px;
  border-radius: 18px;
  background: ${({ theme }) => theme.panel};
  border: 1px solid ${({ theme }) => theme.border};
  label { flex-basis: 100%; font: 600 15px 'Prompt', sans-serif; }
`;

const List = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  background: ${({ theme }) => theme.panel};
  border: 1px solid ${({ theme }) => theme.border};
  a { flex: 1; min-width: 0; text-decoration: none; color: inherit; }
  strong { display: block; font: 600 17px 'Prompt', sans-serif; }
  code { font-size: 13px; color: ${({ theme }) => theme.muted}; }
  &:hover { border-color: ${({ theme }) => theme.accent}; }
`;

const Empty = styled.div`
  padding: 40px 24px;
  border-radius: 18px;
  border: 2px dashed ${({ theme }) => theme.border};
  text-align: center;
  color: ${({ theme }) => theme.muted};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

export default function MyBoards() {
  const router = useRouter();
  const [list, setList] = useState<LocalDevice[]>([]);
  const [uid, setUid] = useState("");

  useEffect(() => setList(listLocalDevices()), []);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const u = uid.trim().toLowerCase().replace(/^.*\/d\//, "");
    if (isValidUid(u)) router.push(`/d/${u}`);
  };

  return (
    <Shell>
      <NavBar />
      <h1>บอร์ดของฉัน</h1>
      <p className="sub">แต่ละบอร์ดมี Dashboard ของตัวเองที่ /d/&lt;UID&gt; เปิดจากเครื่องไหนก็ได้</p>

      <Open onSubmit={go}>
        <label htmlFor="uid">เปิด Dashboard ด้วย UID หรือวางลิงก์</label>
        <Input id="uid" size="large" value={uid} onChange={(e) => setUid(e.target.value)} placeholder="เช่น k3m9x2p7q4ab" style={{ flex: "1 1 240px" }} />
        <Button type="primary" size="large" htmlType="submit" disabled={!isValidUid(uid.trim().toLowerCase().replace(/^.*\/d\//, ""))}>
          เปิด <ArrowRightOutlined />
        </Button>
      </Open>

      {list.length === 0 ? (
        <Empty>
          ยังไม่มีบอร์ดที่เคยเปิดบนเครื่องนี้
          <Link href="/"><Button icon={<PlusOutlined />}>ลงทะเบียนบอร์ดใหม่</Button></Link>
        </Empty>
      ) : (
        <List>
          {[...list].reverse().map((d) => (
            <Item key={d.uid}>
              <Link href={`/d/${d.uid}`}>
                <strong>{d.name}</strong>
                <code>/d/{d.uid}</code>
              </Link>
              <Popconfirm title="เอาออกจากรายการเครื่องนี้?" okText="เอาออก" cancelText="ยกเลิก"
                onConfirm={() => { removeLocalDevice(d.uid); setList(listLocalDevices()); }}>
                <Button type="text" icon={<DeleteOutlined />} aria-label={`เอา ${d.name} ออก`} />
              </Popconfirm>
            </Item>
          ))}
        </List>
      )}
    </Shell>
  );
}
