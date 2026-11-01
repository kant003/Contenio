import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["file-type", "pg", "nodemailer"],
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};
export default config;
