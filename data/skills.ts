import { SkillGroup } from '@/types'

// Strongest first within every group (the owner's call). The page lays the
// groups out two to a row, so keep an even number of half-width groups
// before each full-row one (`wide`, and the learning group last).
export const skillGroups: SkillGroup[] = [
  {
    title: { nb: 'Drift & infrastruktur', en: 'Operations & infrastructure' },
    items: [
      'Linux (Ubuntu/Debian)',
      'Windows Server',
      'Proxmox',
      'Hyper-V',
      'VMware vSphere/ESXi',
      'Active Directory',
      'Veeam',
      'DNS/DHCP',
    ],
  },
  {
    title: { nb: 'Sky & Microsoft 365', en: 'Cloud & Microsoft 365' },
    // Cloudflare runs this very site (Worker, D1, KV, WAF rule) — demonstrated.
    items: ['Azure', 'Microsoft 365', 'Entra ID', 'Intune', 'AWS', 'Cloudflare (Workers, D1, WAF)'],
  },
  {
    title: { nb: 'Automatisering & CI/CD', en: 'Automation & CI/CD' },
    // GitHub Actions builds, checks and deploys this site. Kubernetes: lab only.
    items: ['PowerShell', 'Bash', 'Ansible', 'Git', 'GitHub Actions', 'Docker', 'Kubernetes (lab)'],
  },
  {
    title: { nb: 'Overvåking & logging', en: 'Monitoring & logging' },
    items: ['Zabbix', 'Prometheus', 'Grafana', 'Loki', 'OpenSearch', 'CloudWatch', 'Azure Monitor'],
  },
  {
    title: { nb: 'Sikkerhet & SOC', en: 'Security & SOC' },
    // DNSSEC and DMARC (p=reject) are live on this site's own domain.
    items: [
      'Wazuh (SIEM)',
      'Nessus',
      'ESET Protect',
      'VPN',
      { nb: 'Nettverkssegmentering', en: 'Network segmentation' },
      'DNSSEC',
      'SPF/DKIM/DMARC',
    ],
  },
  {
    title: { nb: 'Utvikling', en: 'Development' },
    items: ['Node.js', 'React / Next.js', 'TypeScript', 'Python'],
  },
  {
    title: { nb: 'Nettverk', en: 'Networking' },
    // The CCNA syllabus (the certificate itself: data/certifications.ts).
    wide: true,
    items: [
      'TCP/IP',
      'Cisco IOS',
      'IPv4/IPv6',
      'Subnetting (VLSM)',
      'VLAN/802.1Q',
      { nb: 'Inter-VLAN-ruting', en: 'Inter-VLAN routing' },
      'STP/RSTP',
      'EtherChannel (LACP)',
      { nb: 'Statisk ruting', en: 'Static routing' },
      'OSPF',
      'EIGRP',
      'HSRP',
      'ACL',
      'NAT/PAT',
      'Port security',
      'DHCP snooping',
      'AAA (RADIUS/TACACS+)',
      'SNMP',
      'Syslog',
      'NTP',
      'QoS',
      'WLAN (WPA2/WPA3)',
      'SDN',
    ],
  },
  {
    title: { nb: 'Lærer for tiden', en: 'Currently learning' },
    learning: true,
    items: ['Terraform', 'Helm + ArgoCD', 'OpenTelemetry', 'HashiCorp Vault'],
  },
]
