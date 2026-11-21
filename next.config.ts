import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets the dev server be opened as 127.0.0.1 as well as localhost (otherwise the page never hydrates)
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
