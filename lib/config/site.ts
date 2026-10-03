/** Brand + site-wide identity for the independent project. */
export const site = {
  name: 'Printique',
  legalName: 'Printique Studio',
  tagline: 'Art prints & custom framing studio',
  description:
    'Printique is a studio for museum-quality art prints and bespoke framing. Shop the curated collection or turn your own photos into gallery-grade framed art.',
  url: process.env.SITE_URL ?? 'http://localhost:3000',
  supportEmail: 'support@printique.example',
  social: {
    instagram: 'https://instagram.com/printique.studio',
    pinterest: 'https://pinterest.com/printique',
  },
} as const
