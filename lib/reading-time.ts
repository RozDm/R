// Estimated reading time for a markdown body. Code blocks read slower than
// prose, but for short technical posts a flat words-per-minute rate is fine.
const WORDS_PER_MINUTE = 200

export function readingTimeMinutes(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, ' ') // fenced code counts as a pause, not prose
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}
