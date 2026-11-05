"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styled from "styled-components";

const Bar = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  padding: 22px 0 18px;
`;

const Brand = styled(Link)`
  display: flex;
  align-items: center;
  gap: 10px;
  font: 600 19px 'Prompt', sans-serif;
  color: ${({ theme }) => theme.text};
  text-decoration: none;
`;

const Logo = styled.span`
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: ${({ theme }) => theme.accent};
  display: grid;
  place-items: center;
`;

const Tabs = styled.nav`
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: ${({ theme }) => theme.panelAlt};
`;

const Tab = styled(Link)<{ $on: boolean }>`
  padding: 8px 16px;
  border-radius: 9px;
  font: 500 14px 'Prompt', sans-serif;
  text-decoration: none;
  color: ${({ theme, $on }) => ($on ? theme.text : "#5B4B3E")};
  background: ${({ theme, $on }) => ($on ? theme.panel : "transparent")};
  box-shadow: ${({ $on }) => ($on ? "0 1px 3px rgba(59,47,37,0.12)" : "none")};
  &:hover { color: ${({ theme }) => theme.text}; }
`;

const Right = styled.div`
  margin-left: auto;
`;

export default function NavBar({ right }: { right?: React.ReactNode }) {
  const path = usePathname();
  return (
    <Bar>
      <Brand href="/">
        <Logo aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFBF4" strokeWidth="2" strokeLinecap="round">
            <rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
          </svg>
        </Logo>
        ESP32 IoT Studio
      </Brand>
      <Tabs aria-label="เมนูหลัก">
        <Tab href="/" $on={path === "/"}>สร้างโปรเจค</Tab>
        <Tab href="/dashboard" $on={path.startsWith("/dashboard") || path.startsWith("/d/")}>Dashboard</Tab>
      </Tabs>
      {right && <Right>{right}</Right>}
    </Bar>
  );
}
