import { LegalPage } from '../legal-page'

export const metadata = { title: 'Shipping policy' }

export default function ShippingPage() {
  return (
    <LegalPage title="Shipping policy" updated="2026-01-15">
      <h2>Production time</h2>
      <p>Every piece is made to order: 2–4 business days for printing and framing before dispatch.</p>
      <h2>Delivery</h2>
      <ul>
        <li>Standard tracked shipping: 3–7 business days, flat $9.99.</li>
        <li>Free standard shipping on orders over $100 (after discounts).</li>
      </ul>
      <h2>Packaging</h2>
      <p>
        Framed pieces ship in rigid, corner-protected flat packaging. Prints ship rolled in
        protective tubes. If anything arrives damaged, our refund policy applies.
      </p>
    </LegalPage>
  )
}
