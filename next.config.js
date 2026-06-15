/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  // React Compiler memoises components automatically (handy for the
  // polling StatusDashboard and the recolouring GeoMap), so we don't
  // have to scatter useMemo / useCallback by hand.
  reactCompiler: true,
}

export default nextConfig
