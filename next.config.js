/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  // React Compiler memoises components automatically (handy for the
  // polling StatusDashboard and the recolouring GeoMap), so we don't
  // have to scatter useMemo / useCallback by hand.
  reactCompiler: true,
  // Turbopack's default 50 kB minChunkSize copied shared client modules
  // (Header/Footer client parts, next/link, the dictionary) into every page
  // chunk, and viewport prefetch downloads the prefetched routes' chunks
  // too. 15 kB moves them into shared chunks: -12 to -32 KB gzip per first
  // view, for 4-5 more scripts, which skip the Worker and the rate limit.
  experimental: { turbopackChunking: { minChunkSize: 15000 } },
}

export default nextConfig
