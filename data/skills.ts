import { SkillGroup } from '@/types'

export const skillGroups: SkillGroup[] = [
  {
    title: { nb: 'Infrastruktur', en: 'Infrastructure' },
    items: ['Linux (Ubuntu/Debian)', 'Windows Server', 'Proxmox', 'Hyper-V', 'VMware (vSphere/ESXi)', 'Active Directory', 'DNS', 'DHCP'],
  },
  {
    title: { nb: 'Sky & Automatisering', en: 'Cloud & Automation' },
    // Cloudflare Workers + GitHub Actions run this very site (Worker, D1, KV,
    // Analytics Engine, CI/CD) — demonstrated, not "learning".
    items: ['Azure', 'AWS', 'Cloudflare Workers', 'Ansible', 'PowerShell', 'Bash', 'Docker', 'Kubernetes', 'CI/CD', 'GitHub Actions'],
  },
  {
    title: { nb: 'Sikkerhet & SOC', en: 'Security & SOC' },
    items: ['Wazuh', 'Nessus', 'ESET Protect', 'VPN', { nb: 'Nettverkssegmentering', en: 'Network segmentation' }],
  },
  {
    title: { nb: 'Overvåking', en: 'Monitoring' },
    items: ['Zabbix', 'Prometheus', 'Grafana', 'Loki', 'OpenSearch', 'CloudWatch', 'Azure Monitor'],
  },
  {
    title: { nb: 'Nettverk', en: 'Networking' },
    items: ['CCNA', 'TCP/IP', 'Routing & Switching'],
  },
  {
    title: { nb: 'Utvikling', en: 'Development' },
    items: ['Node.js', 'React', 'TypeScript', 'Git'],
  },
  {
    title: { nb: 'Lærer for tiden', en: 'Currently learning' },
    learning: true,
    items: [
      'Terraform',
      'Helm',
      'ArgoCD / FluxCD',
      'GitLab CI',
      'HashiCorp Vault',
      'GitHub/GitLab Secrets',
      'Trivy',
      'mTLS',
      'OAuth2',
      'OpenTelemetry',
      'Tempo',
      'Alertmanager',
      'HAProxy',
      'NGINX',
      'Traefik',
      'WireGuard',
      'Istio',
      'nftables/iptables',
      'Python',
      'Go',
    ],
  },
]
