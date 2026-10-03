/**
 * Domain model — the shapes services/UI work with.
 * Repositories map SQL rows → these types (including JSON columns parsed + validated).
 */

export type Role = 'CUSTOMER' | 'ADMIN'
export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type ProductType = 'POSTER' | 'FRAME'
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
export type FulfillmentStatus = 'UNFULFILLED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED'
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface User {
  id: string
  email: string
  name: string
  passwordHash: string
  role: Role
  emailVerifiedAt: string | null
  failedLogins: number
  lockedUntil: string | null
  createdAt: string
}

/** User shape safe to cross the server→client boundary (no password hash). */
export type PublicUser = Pick<User, 'id' | 'email' | 'name' | 'role' | 'emailVerifiedAt'>

export interface Category {
  id: string
  slug: string
  name: string
  description: string | null
  imageUrl: string | null
  position: number
}

export interface ProductImage {
  id: string
  productId: string
  url: string
  alt: string
  position: number
}

export interface ProductVariant {
  id: string
  productId: string
  sku: string
  name: string
  options: Record<string, string>
  priceDeltaCents: number
  stock: number
  reserved: number
  active: boolean
}

export interface Product {
  id: string
  slug: string
  name: string
  summary: string
  description: string
  categoryId: string | null
  categoryName: string | null
  categorySlug: string | null
  type: ProductType
  status: ProductStatus
  basePriceCents: number
  compareAtCents: number | null
  currency: string
  tags: string[]
  attributes: Record<string, string>
  featured: boolean
  seoTitle: string | null
  seoDescription: string | null
  images: ProductImage[]
  variants: ProductVariant[]
  ratingAvg: number | null
  ratingCount: number
  createdAt: string
  updatedAt: string
}

export interface CartCustomization {
  uploadId?: string
  uploadKey?: string
  frameVariantId?: string
  note?: string
}

export interface CartLine {
  id: string
  variantId: string
  productId: string
  productSlug: string
  productName: string
  variantName: string
  sku: string
  imageUrl: string | null
  quantity: number
  customization: CartCustomization | null
  /** Server-computed per-unit price in cents — the only price the UI displays. */
  unitPriceCents: number
  availableStock: number
}

export interface Cart {
  id: string
  token: string
  userId: string | null
  status: 'ACTIVE' | 'CHECKED_OUT' | 'ABANDONED'
  lines: CartLine[]
}

export interface AddressInput {
  firstName: string
  lastName: string
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode: string
  country: string
  phone?: string
}

export interface Address extends AddressInput {
  id: string
  userId: string
  label: string
  isDefault: boolean
}

export interface OrderItem {
  id: string
  orderId: string
  productId: string | null
  variantId: string | null
  name: string
  sku: string
  options: Record<string, string>
  previewUrl: string | null
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
}

export interface Order {
  id: string
  number: string
  userId: string | null
  guestEmail: string | null
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  currency: string
  subtotalCents: number
  discountCents: number
  taxCents: number
  shippingCents: number
  totalCents: number
  couponId: string | null
  couponCode: string | null
  shippingAddress: AddressInput
  shippingMethod: string
  trackingNumber: string | null
  carrier: string | null
  idempotencyKey: string
  placedAt: string
  items: OrderItem[]
}

export interface Coupon {
  id: string
  code: string
  type: 'PERCENT' | 'FIXED'
  value: number
  minSubtotalCents: number
  startsAt: string | null
  endsAt: string | null
  maxRedemptions: number | null
  perUserLimit: number
  active: boolean
  redemptionCount?: number
}

export interface Review {
  id: string
  productId: string
  userId: string
  userName: string
  rating: number
  title: string
  body: string
  status: ReviewStatus
  verifiedPurchase: boolean
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body: string
  data: Record<string, string>
  readAt: string | null
  createdAt: string
}

export interface Upload {
  id: string
  ownerUserId: string | null
  storageKey: string
  mime: string
  sizeBytes: number
  width: number | null
  height: number | null
  originalName: string
  createdAt: string
}
