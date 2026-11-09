import { describe, expect, it } from 'vitest'
import { markdownToHtml } from '@/lib/markdown'

// The RSS render and PostPage share HIGHLIGHT_OPTIONS, so this one speaks for
// both.
describe('code highlighting', () => {
  it('colours PowerShell, which lowlight’s common set lacks', async () => {
    const html = await markdownToHtml('```powershell\n# the adapter\nGet-NetAdapter\n```\n')
    expect(html).toContain('<code class="hljs language-powershell">')
    expect(html).toContain('<span class="hljs-comment"># the adapter</span>')
    expect(html).toContain('<span class="hljs-built_in">Get-NetAdapter</span>')
  })

  it('still colours the common languages', async () => {
    expect(await markdownToHtml('```bash\necho hi\n```\n')).toContain('<span class="hljs-built_in">echo</span>')
  })
})
