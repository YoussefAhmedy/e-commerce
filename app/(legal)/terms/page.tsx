import { LegalPage } from '../legal-page'

export const metadata = { title: 'Terms of service' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="2026-01-15">
      <p>
        These terms govern use of the Printique store. Placeholder text for engineering purposes —
        replace with reviewed terms before launch.
      </p>
      <h2>Orders</h2>
      <p>
        Prices are shown at checkout before payment and confirmed by email. Custom prints are
        produced from images you upload; you must own or have rights to any image you submit.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not upload unlawful, infringing or hateful content, attempt to breach the service, or
        scrape the catalog at abusive rates. We may suspend accounts that violate these rules.
      </p>
      <h2>Liability</h2>
      <p>
        The service is provided “as is” within the limits of applicable law. Our liability is
        capped at the amount you paid for the order concerned.
      </p>
    </LegalPage>
  )
}
