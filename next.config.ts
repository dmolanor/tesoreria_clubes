import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Permite abrir `next dev` a través de un túnel de ngrok (npm run share:dev).
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app", "*.ngrok.dev"],
  experimental: {
    // Comprobantes de hasta 8 MB (lib/storage.ts) viajan por server actions.
    serverActions: { bodySizeLimit: "10mb" },
  },
}

export default nextConfig
