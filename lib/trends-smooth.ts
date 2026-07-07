// Kernel-density smoothing for the Trends traffic curve. A low-traffic site
// has far more time buckets than visits (7d = 169 hourly buckets, ~17
// visits), so a raw visits-per-bucket line is a spike-forest that no spline
// can make flow. Instead we treat the series as a traffic *density*: each
// visit contributes a peak-1 Gaussian bump and the bumps are summed, so a
// single visit renders as one smooth hill and nearby visits merge into a
// broader one. The result is smooth at any volume — down to a single
// visitor — and, being a sum of non-negative Gaussians, is itself
// non-negative (the area fill never dips below the baseline).
//
// Pure + deterministic, DOM-compatible only — imported under the app tsconfig
// and unit-tested.

// Smooth a zero-filled bucket series into a density curve. `sigma` is the
// kernel width in buckets. Returns a new array the same length as `values`.
export function kdeSmooth(values: number[], sigma: number): number[] {
  const n = values.length
  if (n === 0) return []
  if (sigma <= 0) return values.slice()
  const out = new Array<number>(n).fill(0)
  // Beyond ~3.5σ a Gaussian is negligible; bound the inner loop there so this
  // stays O(n·σ) rather than O(n²) on the 169-bucket 7d grid.
  const radius = Math.max(1, Math.ceil(sigma * 3.5))
  const twoSigmaSq = 2 * sigma * sigma
  for (let j = 0; j < n; j++) {
    const c = values[j]
    if (!c) continue
    const lo = Math.max(0, j - radius)
    const hi = Math.min(n - 1, j + radius)
    for (let i = lo; i <= hi; i++) {
      const d = i - j
      out[i] += c * Math.exp(-(d * d) / twoSigmaSq)
    }
  }
  return out
}

// Kernel width (in buckets) for a grid of `bucketCount` points. Scales with
// the grid so the sparse fine grids (7d's 169 hourly buckets) get a wider
// kernel that dissolves the spike-forest, while the coarser 30d grid keeps
// more of its shape. Floored so a lone visit still spreads into a visible
// hill, capped so a busy window isn't over-blurred into a featureless hump.
export function sigmaForBuckets(bucketCount: number): number {
  return Math.min(8, Math.max(1.2, bucketCount * 0.03))
}
