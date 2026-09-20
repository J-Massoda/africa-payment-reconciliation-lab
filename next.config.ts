import type { NextConfig } from "next";

const isStaticExport = process.env.STATIC_EXPORT === "true";
const githubPagesBasePath = "/africa-payment-reconciliation-lab";

const nextConfig: NextConfig = isStaticExport
  ? {
      output: "export",
      basePath: githubPagesBasePath,
      assetPrefix: githubPagesBasePath,
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {
      output: "standalone",
    };

export default nextConfig;
