import { LegalPage } from '../legal-page'

export const metadata = { title: 'Refund policy' }

export default function RefundsPage() {
  return (
    <LegalPage title="Refund policy" updated="2026-01-15">
      <h2>Custom prints</h2>
      <p>
        Custom-upload prints are made to order and cannot be returned for change of mind.
        If your piece arrives damaged or with a production defect, contact us within 14 days with
        photos — we will reprint or refund you in full.
      </p>
      <h2>Collection prints & frames</h2>
      <p>
        Unframed collection prints and frames can be returned within 30 days in original condition.
        Refunds are issued to the original payment method within 5–10 business days of receipt.
      </p>
      <h2>Cancellations</h2>
      <p>
        Orders can be cancelled free of charge until payment is captured or production begins,
        whichever comes first — use the cancel button on your order page.
      </p>
    </LegalPage>
  )
}
