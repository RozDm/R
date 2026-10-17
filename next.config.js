/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  // React Compiler memoises components automatically (handy for the
  // polling StatusDashboard and the recolouring GeoMap), so we don't
  // have to scatter useMemo / useCallback by hand.
  reactCompiler: true,
  // Shared client modules into shared chunks instead of a copy per page
  // chunk: -12 to -32 KB gzip per first view (CLAUDE.md Gotchas; CI checks
  // the dictionary stays in one chunk).
  experimental: { turbopackChunking: { minChunkSize: 15000 } },
}

export default nextConfig
