"use client";

import { Button, Input, Table, Upload, Space, Typography, App } from "antd";
import { DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import type { FlashImage } from "@/lib/boards";
import { hex } from "@/lib/boards";

interface Props {
  images: FlashImage[];
  onChange: (imgs: FlashImage[]) => void;
}

/** เดาที่อยู่จากชื่อไฟล์มาตรฐานของ Arduino/ESP-IDF */
function guessAddress(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("merged") || n.includes("factory")) return 0x0;
  if (n.includes("bootloader")) return 0x1000;
  if (n.includes("partition")) return 0x8000;
  if (n.includes("boot_app0") || n.includes("ota_data")) return 0xe000;
  return 0x10000;
}

export default function BinUploader({ images, onChange }: Props) {
  const { message } = App.useApp();

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      <Upload.Dragger
        accept=".bin"
        multiple
        showUploadList={false}
        beforeUpload={async (file) => {
          const data = new Uint8Array(await file.arrayBuffer());
          onChange([...images, { name: file.name, address: guessAddress(file.name), data }]);
          message.success(`เพิ่ม ${file.name}`);
          return false;
        }}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">ลากไฟล์ .bin มาวาง หรือคลิกเพื่อเลือก</p>
        <p className="ant-upload-hint">ใช้กับเฟิร์มแวร์ที่คอมไพล์แล้ว (Arduino IDE, PlatformIO, ESP-IDF)</p>
      </Upload.Dragger>

      <Table<FlashImage>
        size="small"
        rowKey={(r) => r.name + r.address}
        pagination={false}
        dataSource={images}
        locale={{ emptyText: "ยังไม่มีไฟล์" }}
        scroll={{ x: true }}
        columns={[
          { title: "ไฟล์", dataIndex: "name" },
          { title: "ขนาด", render: (_, r) => `${(r.data.length / 1024).toFixed(1)} KB`, width: 100 },
          {
            title: "Address",
            width: 140,
            render: (_, r, i) => (
              <Input
                defaultValue={hex(r.address)}
                onBlur={(e) => {
                  const v = parseInt(e.target.value, 16);
                  if (Number.isNaN(v)) return message.error("address ต้องเป็นเลขฐาน 16");
                  onChange(images.map((x, j) => (j === i ? { ...x, address: v } : x)));
                }}
                style={{ fontFamily: "monospace" }}
              />
            ),
          },
          {
            title: "",
            width: 56,
            render: (_, __, i) => (
              <Button danger type="text" icon={<DeleteOutlined />} aria-label="ลบไฟล์"
                onClick={() => onChange(images.filter((_, j) => j !== i))} />
            ),
          },
        ]}
      />
      <Typography.Text type="secondary">
        ค่าทั่วไปของ ESP32: bootloader 0x1000 (S3/C3: 0x0) · partitions 0x8000 · boot_app0 0xE000 · app 0x10000 · merged 0x0
      </Typography.Text>
    </Space>
  );
}
