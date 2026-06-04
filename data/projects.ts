import { Project } from '@/types'

export const projects: Project[] = [
  {
    id: 1,
    title: 'E-commerce-plattform',
    description: 'Fullverdig e-handelsplattform med handlekurv, betalingsbehandling og administrasjonspanel.',
    techStack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Stripe', 'PostgreSQL'],
    link: 'https://example.com',
    github: 'https://github.com/username/ecommerce',
    year: 2024,
  },
  {
    id: 2,
    title: 'Oppgavebehandler',
    description: 'Applikasjon for oppgavehåndtering med drag-and-drop-grensesnitt, teamsamarbeid og fremdriftssporing.',
    techStack: ['React', 'Node.js', 'MongoDB', 'Socket.io'],
    link: 'https://example.com',
    github: 'https://github.com/username/taskmanager',
    year: 2023,
  },
  {
    id: 3,
    title: 'Portefølje-nettside',
    description: 'Moderne porteføljeside med statisk eksport, mørkt tema og fullt responsivt design.',
    techStack: ['Next.js', 'TypeScript', 'Tailwind CSS'],
    link: 'https://example.com',
    github: 'https://github.com/username/portfolio',
    year: 2024,
  },
]
