import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Đảm bảo query engine của Prisma được đưa vào bản standalone.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.prisma/client/**/*"],
  },
};

export default nextConfig;
