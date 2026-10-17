import type { Lang } from '@/lib/i18n'

// The error boundary's copy, both languages. app/error.tsx loads on every page
// in its own chunk, so it imports this instead of DICT: importing DICT there
// put a second copy of the dictionary on every page (and the whole of it on
// the 404). data/i18n.ts spreads it into nb/en, so the copy has one source
// and the dictionary tests cover it.

const nb = {
  backHome: 'Tilbake til forsiden',
  error: {
    eyebrow: 'Systemfeil',
    title: 'Noe gikk galt. Jeg er redd jeg ikke kan fortsette akkurat nå.',
    retry: 'Prøv på nytt',
  },
}

export const ERROR_COPY: Record<Lang, typeof nb> = {
  nb,
  en: {
    backHome: 'Back to the home page',
    error: {
      eyebrow: 'System error',
      title: 'Something went wrong. I’m afraid I can’t continue right now.',
      retry: 'Try again',
    },
  },
}
