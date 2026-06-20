// Pure helper for the Trends-card x-axis: picks 1–3 ticks from a series so
// labels stay readable on every range. Lives outside the React component so
// it can be unit-tested without rendering.
//
//   0 pts -> no ticks
//   1 pt  -> a single centred label
//   2 pts -> first + last (a "middle" tick would land on the same x as the
//            last point and the two labels would visually collide)
//   3+    -> first + middle + last
export function xTicksFor<T>(
  items: T[],
  pickX: (t: T) => number,
  format: (t: T) => string,
): { x: number; label: string }[] {
  if (items.length === 0) return []
  if (items.length === 1) return [{ x: pickX(items[0]), label: format(items[0]) }]
  if (items.length === 2) {
    return [
      { x: pickX(items[0]), label: format(items[0]) },
      { x: pickX(items[1]), label: format(items[1]) },
    ]
  }
  const mid = Math.floor(items.length / 2)
  return [
    { x: pickX(items[0]), label: format(items[0]) },
    { x: pickX(items[mid]), label: format(items[mid]) },
    { x: pickX(items[items.length - 1]), label: format(items[items.length - 1]) },
  ]
}
