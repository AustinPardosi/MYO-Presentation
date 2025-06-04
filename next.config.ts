import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  assetPrefix: isGhPages ? "/MYO-Presentation" : "",
  basePath: isGhPages ? "/MYO-Presentation" : "",
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
