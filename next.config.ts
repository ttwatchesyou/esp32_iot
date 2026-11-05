import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // เปิด SWC plugin ของ styled-components (displayName + SSR)
  compiler: {
    styledComponents: true,
  },
};

export default nextConfig;
