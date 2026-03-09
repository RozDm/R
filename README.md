# Portfolio Website

A modern, responsive portfolio website built with Next.js, TypeScript, and Tailwind CSS. Features a clean design with dark/light theme support.

## Features

- 🎨 **Modern Design** - Clean and professional UI with Tailwind CSS
- 🌓 **Dark/Light Theme** - Toggle between themes with persistent preference
- 📱 **Fully Responsive** - Optimized for all device sizes
- ⚡ **Fast Performance** - Built with Next.js for optimal performance
- 🔧 **TypeScript** - Full type safety for better development experience
- 🧩 **Component-Based** - Modular architecture for easy maintenance

## Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **PostCSS**: [Autoprefixer](https://github.com/postcss/autoprefixer)

## Project Structure

```
portfolio/
├── app/                  # Next.js App Router
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/           # React components
│   ├── About.tsx         # About section
│   ├── Footer.tsx        # Footer component
│   ├── Header.tsx        # Navigation header
│   ├── ProjectCard.tsx   # Project card component
│   ├── Projects.tsx      # Projects section
│   ├── Skills.tsx        # Skills section
│   └── ThemeToggle.tsx   # Theme switcher
├── context/              # React Context
│   └── ThemeContext.tsx  # Theme provider
├── data/                 # Static data
│   └── projects.ts       # Project data
├── types/                # TypeScript types
│   └── index.ts          # Type definitions
└── public/               # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd portfolio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |

## Customization

### Adding Projects

Edit `data/projects.ts` to add or modify your projects:

```typescript
export const projects: IProject[] = [
  {
    id: 1,
    title: 'Your Project',
    description: 'Project description',
    techStack: ['React', 'TypeScript'],
    image: '/projects/your-project.jpg',
    link: 'https://your-project.com',
    github: 'https://github.com/username/project',
    year: 2024,
  },
];
```

### Styling

Modify `tailwind.config.ts` to customize colors, fonts, and other design tokens.

### Content

Update the content in respective components under `components/` directory to personalize your portfolio.

## Deployment

The easiest way to deploy is using [Vercel](https://vercel.com/):

1. Push your code to GitHub
2. Import your repository to Vercel
3. Deploy!

Or build for production and deploy to any static hosting:

```bash
npm run build
```

## License

This project is open source and available under the [MIT License](LICENSE).

## Author

Your Name - [Your Website](https://yourwebsite.com)

---

Built with ❤️ using Next.js and Tailwind CSS
