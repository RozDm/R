import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { pageMetadata } from '@/lib/metadata'

// Utility page, like /kontakt: keep it out of search results (and out of
// the sitemap — a sitemap must not list noindex URLs).
export const metadata: Metadata = pageMetadata({
  title: 'Personvern',
  description: 'Hvilke opplysninger dette nettstedet samler inn, og hvorfor.',
  path: '/personvern/',
  noindex: true,
})

export default function PersonvernPage() {
  return (
    <>
      <Header />
      <main id="main" className="max-w-3xl mx-auto px-4 md:px-8 py-20 min-h-[70vh]">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors mb-8"
        >
          &larr; Tilbake til forsiden
        </Link>

        <p className="text-red-600 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          Personvern
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Personvernerklæring
        </h1>
        <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mb-10">
          Sist oppdatert: 4. oktober 2026
        </p>

        <div className="prose dark:prose-invert max-w-none prose-a:text-red-600 dark:prose-a:text-red-400 prose-a:underline prose-a:underline-offset-2 hover:prose-a:decoration-2 prose-headings:font-bold">
          <h2>Behandlingsansvarlig</h2>
          <p>
            Dmytro Rozsoshnykh er ansvarlig for behandlingen av personopplysninger på dette
            nettstedet. Spørsmål om personvern kan sendes til{' '}
            <a href="mailto:contact@rozsoshnykh.no">contact@rozsoshnykh.no</a>.
          </p>

          <h2>Kontaktskjemaet</h2>
          <p>
            Når du sender en melding via <Link href="/kontakt/">kontaktskjemaet</Link>, behandles
            navnet, e-postadressen og meldingen din — samt IP-adressen forespørselen kom fra.
            Opplysningene brukes kun til å svare på henvendelsen og til å begrense misbruk av
            skjemaet (antall innsendinger per adresse).
          </p>
          <p>
            Meldingen leveres til e-postinnboksen min, og en kopi lagres i en database hos
            Cloudflare. Databasekopien slettes automatisk etter 30 dager. Hvis e-posten ikke
            kan leveres, slettes kopien med en gang, og du får beskjed om å prøve igjen.
          </p>
          <p>
            Skjemaet er beskyttet av Cloudflare Turnstile, som skiller mennesker fra roboter.
            For å gjøre det behandler Turnstile et lite sett tekniske signaler fra nettleseren
            og forbindelsen din (blant annet IP-adressen), kun for å stoppe misbruk. Se{' '}
            <a
              href="https://www.cloudflare.com/turnstile-privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cloudflares personvernvedlegg for Turnstile
            </a>
            .
          </p>

          <h2>Besøksstatistikk</h2>
          <p>
            Nettstedet teller besøk anonymt: hvilket land et besøk kommer fra og hvilket nettverk
            det kom gjennom (nettverksoperatøren, for eksempel en internettleverandør eller et
            datasenter — brukt til å skille roboter fra mennesker), begge avledet av Cloudflare
            på kanten av nettverket, og hvor mange ganger et blogginnlegg er lest. Tallene kan
            ikke knyttes til enkeltpersoner, og ingen IP-adresser lagres i statistikken.
          </p>
          <p>
            I tillegg brukes Cloudflare Web Analytics, en personvernvennlig måling uten
            informasjonskapsler og uten sporing på tvers av nettsteder.
          </p>

          <h2>Informasjonskapsler og lokal lagring</h2>
          <p>
            Nettstedet bruker ingen informasjonskapsler til sporing eller markedsføring.
            Nettleserens lokale lagring brukes kun til funksjonelle valg — fargetema, om
            introanimasjonen er vist, hvor mange ganger skjermspareren har dukket opp, og om
            besøket og innleggene du har lest allerede er telt. Disse verdiene blir værende
            i nettleseren din og sendes ikke videre.
          </p>

          <h2>Databehandler</h2>
          <p>
            Nettstedet driftes på Cloudflare sin plattform (Cloudflare, Inc.), som behandler
            trafikk og lagrer dataene beskrevet ovenfor på vegne av behandlingsansvarlig.
          </p>

          <h2>Dine rettigheter</h2>
          <p>
            Du har rett til innsyn i, retting av og sletting av opplysninger om deg. Send en
            e-post til <a href="mailto:contact@rozsoshnykh.no">contact@rozsoshnykh.no</a>, så
            ordner jeg det. Du kan også klage til{' '}
            <a href="https://www.datatilsynet.no/" target="_blank" rel="noopener noreferrer">
              Datatilsynet
            </a>{' '}
            hvis du mener behandlingen bryter med personvernregelverket.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
