import { SkillGroup } from '@/types'

export const skillGroups: SkillGroup[] = [
  {
    title: 'Infrastruktur',
    items: ['Linux (Ubuntu/Debian)', 'Windows Server 2019', 'Active Directory', 'Proxmox', 'Hyper-V', 'DHCP'],
  },
  {
    title: 'Sky & Automatisering',
    items: ['Azure', 'AWS', 'Ansible', 'Puppet', 'PowerShell', 'Bash', 'Docker', 'Kubernetes', 'CI/CD'],
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
]
