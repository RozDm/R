import CopyLink from './CopyLink'

// Plain share links — no third-party SDKs, no extra scripts, CSP untouched.
export default function ShareRow({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  const linkClass =
    'inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors'

  return (
    <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-mono">
      <span className="text-gray-400 dark:text-gray-500 uppercase tracking-widest">Del</span>
      <a
        href={`https://twitter.com/intent/tweet?url=${u}&text=${t}`}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        X
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
        </svg>
        LinkedIn
      </a>
      <a href={`mailto:?subject=${t}&body=${u}`} className={linkClass}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 6L2 7" />
        </svg>
        E-post
      </a>
      <CopyLink url={url} />
    </div>
  )
}
