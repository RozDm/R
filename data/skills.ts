import { SkillGroup } from '@/types'

export const skillGroups: SkillGroup[] = [
  {
    title: 'Infrastruktur',
    items: ['Linux (Ubuntu/Debian)', 'Windows Server', 'Proxmox', 'Hyper-V', 'VMware (vSphere/ESXi)', 'Active Directory', 'DNS', 'DHCP'],
  },
  {
    title: 'Sky & Automatisering',
    items: ['Azure', 'AWS', 'Ansible', 'PowerShell', 'Bash', 'Docker', 'Kubernetes', 'CI/CD'],
  },
  {
    title: 'Sikkerhet & SOC',
    items: ['Wazuh', 'Nessus', 'ESET Protect', 'VPN', 'Nettverkssegmentering'],
  },
  {
    title: 'Overvåking',
    items: ['Zabbix', 'Prometheus', 'Grafana', 'Loki', 'OpenSearch', 'CloudWatch', 'Azure Monitor'],
  },
  {
    title: 'Nettverk',
    items: ['CCNA', 'TCP/IP', 'Routing & Switching'],
  },
  {
    title: 'Utvikling',
    items: ['Node.js', 'React', 'TypeScript', 'Git'],
  },
  {
    title: 'Lærer for tiden',
    learning: true,
    items: [
      'Terraform',
      'Helm',
      'ArgoCD / FluxCD',
      'GitHub Actions / GitLab CI',
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
      'Cloudflare',
      'Python',
      'Go',
    ],
  },
]
