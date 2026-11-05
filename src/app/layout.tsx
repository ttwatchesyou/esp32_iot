import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import StyledComponentsRegistry from "@/lib/registry";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "ESP32 IoT Studio",
  description: "เขียนโค้ด คอมไพล์ และอัปโหลดลงบอร์ด ESP32 ผ่านเว็บเบราว์เซอร์",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body style={{ margin: 0 }}>
        <StyledComponentsRegistry>
          <AntdRegistry>
            <Providers>{children}</Providers>
          </AntdRegistry>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
