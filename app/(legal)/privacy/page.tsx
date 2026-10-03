import { LegalPage } from '../legal-page'

export const metadata = { title: 'Privacy policy' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="2026-01-15">
      <p>
        This policy describes what Printique Studio (“we”) collects when you use the store and why.
        It is a baseline template for the product — have counsel review it before production launch.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details you provide (name, email, password — stored only as a bcrypt hash).</li>
        <li>Order information: items, addresses and amounts needed for fulfillment and tax records.</li>
        <li>Images you upload for custom prints, used solely to produce your order.</li>
        <li>First-party product analytics (product views, add-to-cart events) used for merchandising.</li>
      </ul>
      <h2>What we never do</h2>
      <ul>
        <li>We never sell personal data and never run third-party ad trackers.</li>
        <li>Payment card details never touch our servers — they are handled by the payment provider.</li>
        <li>Customer uploads are never used to train models or shared with other customers.</li>
      </ul>
      <h2>Your choices</h2>
      <p>
        You can browse without an account, request account deletion, and manage notifications from
        your account settings. Contact {`support@printique.example`} for data requests.
      </p>
    </LegalPage>
  )
}
