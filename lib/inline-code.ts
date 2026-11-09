// Inline code on the post page: each word of a command goes in its own
// .code-word span (white-space: nowrap, app/globals.css), so a narrow screen
// breaks a line between words only. Left alone, the browser breaks right
// after a hyphen: `curl -` on one line, `v` on the next. Code blocks (code
// inside pre) are untouched; they scroll instead.

interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

// A word longer than this stays breakable, so it can never push the page
// wider than a phone (about 38 characters fit a 360 px screen).
export const MAX_NOWRAP_WORD = 30

function words(node: HastNode): HastNode[] {
  if (node.type !== 'text' || !node.value) return [node]
  return node.value
    .split(/(\s+)/)
    .filter(Boolean)
    .map((part) =>
      /^\s/.test(part) || part.length > MAX_NOWRAP_WORD
        ? { type: 'text', value: part }
        : { type: 'element', tagName: 'span', properties: { className: ['code-word'] }, children: [{ type: 'text', value: part }] },
    )
}

export function rehypeInlineCode() {
  const walk = (node: HastNode, parent?: HastNode) => {
    if (node.type === 'element' && node.tagName === 'code' && parent?.tagName !== 'pre') {
      node.children = node.children?.flatMap(words)
      return
    }
    node.children?.forEach((child) => walk(child, node))
  }
  return (tree: HastNode) => walk(tree)
}
