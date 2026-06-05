// Kanoniske tag-navn — den «riktige» stavemåten som vises i UI og sitemap.
// Når en artikkel bruker en variant (annen casing, alias, skrivefeil),
// blir den løst tilbake til en av disse via STANDARD_TAGS eller TAG_ALIASES.
export const STANDARD_TAGS = [
  // Infrastruktur
  'Linux',
  'Windows Server',
  'Active Directory',
  'DNS',
  'DHCP',
  'Proxmox',
  'Hyper-V',
  'VMware',
  'Virtualisering',

  // Sky & Automatisering
  'Azure',
  'AWS',
  'GCP',
  'Docker',
  'Kubernetes',
  'Helm',
  'Ansible',
  'Terraform',
  'ArgoCD',
  'PowerShell',
  'Bash',
  'CI/CD',
  'GitHub Actions',

  // Sikkerhet
  'Sikkerhet',
  'SOC',
  'Wazuh',
  'Nessus',
  'ESET',
  'VPN',
  'WireGuard',
  'mTLS',
  'OAuth2',
  'Vault',

  // Overvåking
  'Overvåking',
  'Prometheus',
  'Grafana',
  'Zabbix',
  'Loki',
  'OpenSearch',
  'OpenTelemetry',
  'Tempo',
  'Alertmanager',

  // Nettverk
  'Nettverk',
  'CCNA',
  'TCP/IP',
  'NGINX',
  'HAProxy',
  'Traefik',
  'Istio',
  'Cloudflare',
  'iptables',

  // Utvikling
  'Python',
  'Go',
  'Node.js',
  'React',
  'TypeScript',
  'Git',

  // Tema
  'DevOps',
  'Automatisering',
  'Migrering',
  'SRE',
] as const

// Aliaser: lowercase nøkkel → kanonisk tag.
// Brukes til å fange opp vanlige skrivemåter, forkortelser og engelske varianter.
export const TAG_ALIASES: Record<string, string> = {
  // Tema
  'dev ops': 'DevOps',
  'dev-ops': 'DevOps',

  // Virtualisering
  hyperv: 'Hyper-V',
  'hyper v': 'Hyper-V',
  esxi: 'VMware',
  vsphere: 'VMware',
  'vmware vsphere': 'VMware',
  'vmware esxi': 'VMware',
  virtualization: 'Virtualisering',

  // Identitet
  ad: 'Active Directory',

  // CI/CD
  cicd: 'CI/CD',
  'ci-cd': 'CI/CD',
  'ci cd': 'CI/CD',

  // Sky
  'amazon web services': 'AWS',
  'microsoft azure': 'Azure',
  'google cloud': 'GCP',
  'google cloud platform': 'GCP',

  // Kubernetes
  k8s: 'Kubernetes',
  kube: 'Kubernetes',

  // Språk / runtime
  node: 'Node.js',
  nodejs: 'Node.js',

  // Sikkerhet
  'hashicorp vault': 'Vault',
  security: 'Sikkerhet',

  // Nettverk
  tcpip: 'TCP/IP',
  wg: 'WireGuard',

  // Overvåking
  otel: 'OpenTelemetry',
  monitoring: 'Overvåking',
  overvaking: 'Overvåking', // manglende diakritisk tegn
  networking: 'Nettverk',

  // Operasjoner
  migration: 'Migrering',
  migrasjon: 'Migrering',
}

function capitalizeFirst(s: string): string {
  if (!s) return s
  return s[0].toLocaleUpperCase('nb-NO') + s.slice(1)
}

/**
 * Normaliserer ett tag-navn:
 *   1) Aliasoppslag (case-insensitivt)
 *   2) Sammenligning mot STANDARD_TAGS (case-insensitivt)
 *   3) Ukjent? Returneres trimmet med stor forbokstav («kunstig intelligens»
 *      → «Kunstig intelligens»). Resten av casing-en beholdes uendret slik at
 *      ord som «iOS» eller «macOS» ikke ødelegges.
 */
export function normalizeTag(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const key = trimmed.toLowerCase()

  if (TAG_ALIASES[key]) return TAG_ALIASES[key]

  const canonical = STANDARD_TAGS.find((t) => t.toLowerCase() === key)
  if (canonical) return canonical

  return capitalizeFirst(trimmed)
}

/**
 * Normaliserer en hel tag-liste (fra frontmatter) og fjerner duplikater
 * som oppstår etter normalisering (f.eks. ["devops", "DevOps"] → ["DevOps"]).
 */
export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    const normalized = normalizeTag(raw)
    if (!normalized) continue
    const dedupeKey = normalized.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    result.push(normalized)
  }
  return result
}
