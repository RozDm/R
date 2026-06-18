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
