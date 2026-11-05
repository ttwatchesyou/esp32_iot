"use client";

import dynamic from "next/dynamic";
import { Spin } from "antd";
import styled from "styled-components";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <Center>
      <Spin />
    </Center>
  ),
});

const Center = styled.div`
  height: 100%;
  display: grid;
  place-items: center;
`;

const Wrap = styled.div`
  height: 100%;
  min-height: 420px;
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 12px;
  overflow: hidden;
  background: ${({ theme }) => theme.consoleBg};
`;

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function CodeEditor({ value, onChange }: Props) {
  return (
    <Wrap>
      <Monaco
        height="100%"
        language="cpp"
        theme="earth"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        beforeMount={(monaco) => {
          monaco.editor.defineTheme("earth", {
            base: "vs",
            inherit: true,
            rules: [
              { token: "comment", foreground: "9A8774", fontStyle: "italic" },
              { token: "keyword", foreground: "8B5E3C", fontStyle: "bold" },
              { token: "string", foreground: "5E7344" },
              { token: "number", foreground: "A8443A" },
              { token: "type", foreground: "6B4E7A" },
            ],
            colors: {
              "editor.background": "#FBF6EC",
              "editor.foreground": "#3B2F25",
              "editorLineNumber.foreground": "#B8A690",
              "editorLineNumber.activeForeground": "#8B5E3C",
              "editor.lineHighlightBackground": "#F3EADC",
              "editor.selectionBackground": "#E6D3BC",
              "editorCursor.foreground": "#8B5E3C",
            },
          });
        }}
        options={{
          fontSize: 15,
          lineHeight: 24,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 2,
          automaticLayout: true,
          padding: { top: 12 },
          renderLineHighlight: "line",
        }}
      />
    </Wrap>
  );
}
