import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/security/session'
import { listAddresses } from '@/lib/db/repositories/users'
import { AddressesClient } from './addresses-client'

export const metadata: Metadata = { title: 'Addresses', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function AddressesPage() {
  const user = (await getSessionUser())!
  const addresses = listAddresses(user.id)
  return <AddressesClient initialAddresses={addresses} />
}
