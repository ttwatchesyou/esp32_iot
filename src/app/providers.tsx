"use client";

import { App as AntApp, ConfigProvider } from "antd";
import thTH from "antd/locale/th_TH";
import { createGlobalStyle, ThemeProvider } from "styled-components";

/** โทนเอิร์ธ: ครีม · น้ำตาล · เขียวมะกอก */
export const appTheme = {
  bg: "#F6F0E6",
  panel: "#FFFBF4",
  panelAlt: "#EFE5D5",
  border: "#E2D5C1",
  text: "#3B2F25",
  muted: "#75655A",
  accent: "#8B5E3C",
  accentSoft: "#F1E3D3",
  success: "#5E7344",
  successSoft: "#E7EBDA",
  danger: "#A8443A",
  consoleBg: "#FBF6EC",
  mono: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
};

export type AppTheme = typeof appTheme;

declare module "styled-components" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends AppTheme {}
}

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600&family=Sarabun:wght@400;500&family=JetBrains+Mono&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  html, body { min-height: 100%; background: ${({ theme }) => theme.bg}; color: ${({ theme }) => theme.text}; }
  body { font-family: 'Sarabun', system-ui, sans-serif; }
  h1, h2, h3 { font-family: 'Prompt', 'Sarabun', sans-serif; }
`;

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={appTheme}>
      <ConfigProvider
        locale={thTH}
        theme={{
          token: {
            colorPrimary: appTheme.accent,
            colorSuccess: appTheme.success,
            colorError: appTheme.danger,
            colorBgLayout: appTheme.bg,
            colorBgContainer: appTheme.panel,
            colorBgElevated: appTheme.panel,
            colorBorder: appTheme.border,
            colorBorderSecondary: appTheme.border,
            colorText: appTheme.text,
            colorTextSecondary: appTheme.muted,
            borderRadius: 12,
            controlHeight: 40,
            fontSize: 15,
            fontFamily: "'Sarabun', system-ui, sans-serif",
          },
          components: {
            Button: { fontWeight: 500, primaryShadow: "none" },
            Collapse: { headerBg: appTheme.panel },
          },
        }}
      >
        <AntApp>
          <GlobalStyle />
          {children}
        </AntApp>
      </ConfigProvider>
    </ThemeProvider>
  );
}
