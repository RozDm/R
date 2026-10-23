import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { pageMetadata } from '@/lib/metadata'

// English translation of /personvern/. The Norwegian notice stays the
// authoritative one — keep the two in step when either changes.
export const metadata: Metadata = pageMetadata({
  lang: 'en',
  title: 'Privacy',
  description: 'What this website collects, and why.',
  path: '/en/privacy/',
  noindex: true,
})

export default function PrivacyPage() {
  return (
    <>
      <Header lang="en" />
      <main id="main" className="max-w-3xl mx-auto px-4 md:px-8 py-20 min-h-[70vh]">
        <Link
          href="/en/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors mb-8"
        >
          &larr; Back to the home page
        </Link>

        <p className="text-red-600 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          Privacy
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Privacy notice
        </h1>
        <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mb-4">
          Last updated: 23 October 2026
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10 max-w-xl">
          This is a translation for convenience. The{' '}
          <Link
            href="/personvern/"
            hrefLang="nb"
            className="text-red-600 dark:text-red-400 underline underline-offset-2 hover:decoration-2"
          >
            Norwegian version
          </Link>{' '}
          is the authoritative one.
        </p>

        <div className="prose dark:prose-invert max-w-none prose-a:text-red-600 dark:prose-a:text-red-400 prose-a:underline prose-a:underline-offset-2 hover:prose-a:decoration-2 prose-headings:font-bold">
          <h2>Data controller</h2>
          <p>
            Dmytro Rozsoshnykh is responsible for the processing of personal data on this website.
            Questions about privacy can be sent to{' '}
            <a href="mailto:contact@rozsoshnykh.no">contact@rozsoshnykh.no</a>.
          </p>

          <h2>The contact form</h2>
          <p>
            When you send a message through the <Link href="/en/contact/">contact form</Link>, your
            name, email address and message are processed — along with the IP address the request
            came from. The information is used only to reply to your enquiry and to limit abuse of
            the form (the number of submissions per address).
          </p>
          <p>
            The message is delivered to my Gmail inbox, and a copy is stored in a database at
            Cloudflare. The database copy is deleted automatically after 30 days. If the email
            cannot be delivered, the copy is deleted at once and you are asked to try again. The
            email itself is deleted no later than three months after our last contact about the
            enquiry, unless it leads to an assignment or contract that requires keeping it longer.
          </p>
          <p>
            The form is protected by Cloudflare Turnstile, which tells humans from bots. To do that,
            Turnstile processes a small set of technical signals from your browser and connection
            (including the IP address), solely to stop abuse. See{' '}
            <a
              href="https://www.cloudflare.com/turnstile-privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cloudflare’s Turnstile privacy addendum
            </a>
            .
          </p>

          <h2>Visitor statistics</h2>
          <p>
            The website counts visits anonymously: which country a visit comes from and which
            network it came through (the network operator, for example an internet provider or a
            data centre — used to tell bots from people), both derived by Cloudflare at the edge of
            its network, and how many times a blog post has been read. The figures cannot be linked
            to individuals, and no IP addresses are stored in the statistics. A visit counts at
            most once per browser per day, and only once the page is actually used (the mouse
            moves, the screen is touched or a key is pressed) — never from a browser under
            automated control.
          </p>
          <p>
            If your browser blocks something on a page for security reasons (a so-called Content
            Security Policy), it automatically sends a technical error report here. From the report,
            only the page concerned and the type of resource that was blocked are stored — no IP
            address and no information about you.
          </p>

          <h2>Technical logs</h2>
          <p>
            When the website’s server (a Cloudflare Worker) handles a request, Cloudflare stores a
            technical log of it: among other things the time, the address requested and details of
            the connection, which may include your IP address. The logs are used only for
            troubleshooting and security, kept for up to 7 days and then deleted automatically.
          </p>

          <h2>Cookies and local storage</h2>
          <p>
            The website uses no cookies for tracking or marketing. The browser’s local storage is
            used only for functional choices — the colour theme, whether the intro animation has
            been shown, how many times the screensaver has appeared, the date your visit was last
            counted and which posts you have already read. These values stay in your browser and are
            not passed on.
          </p>

          <h2>Legal basis</h2>
          <ul>
            <li>
              <strong>Replying to messages from the contact form:</strong> legitimate interest in
              being able to answer enquiries you send yourself (GDPR Article 6(1)(f)). If the
              enquiry concerns an assignment, a job or another possible contract, the basis is that
              the processing is necessary to take steps at your request before entering into a
              contract (Article 6(1)(b)).
            </li>
            <li>
              <strong>
                The IP address for limiting abuse, Turnstile, technical logs and the visitor
                statistics:
              </strong>{' '}
              legitimate interest in keeping the website secure, available and free of abuse, and
              in knowing how it is used (Article 6(1)(f)).
            </li>
          </ul>

          <h2>Data processor and transfers to the US</h2>
          <p>
            The website runs on Cloudflare’s platform (Cloudflare, Inc.), which processes traffic
            and stores the data described above on behalf of the data controller. Cloudflare is a
            US company, so the data may be processed in the United States. The transfer relies on
            the EU–US Data Privacy Framework, under which Cloudflare is certified; where the
            framework does not apply, it relies on the European Commission’s standard contractual
            clauses in Cloudflare’s data processing addendum. See{' '}
            <a href="https://www.cloudflare.com/trust-hub/gdpr/" target="_blank" rel="noopener noreferrer">
              Cloudflare’s GDPR page
            </a>
            .
          </p>
          <p>
            Messages from the contact form are delivered to a Gmail account. Google LLC (USA)
            therefore receives and stores your name, email address and message. Google is also
            certified under the EU–US Data Privacy Framework.
          </p>

          <h2>Your rights</h2>
          <p>
            You have the right to access, correct and delete information about you, and to have
            its processing restricted. You can also object to processing based on legitimate
            interest. Send an email to <a href="mailto:contact@rozsoshnykh.no">contact@rozsoshnykh.no</a> and I will take
            care of it. You can also complain to the Norwegian Data Protection Authority,{' '}
            <a href="https://www.datatilsynet.no/en/" target="_blank" rel="noopener noreferrer">
              Datatilsynet
            </a>
            , if you believe the processing breaches data protection law.
          </p>
        </div>
      </main>
      <Footer lang="en" />
    </>
  )
}
