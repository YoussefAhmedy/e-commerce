import bcrypt from 'bcryptjs'

/**
 * Password hashing — bcrypt (cost 12), never plaintext, never logged.
 */

const COST = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash)
  } catch {
    return false
  }
}

/** Dummy hash to equalize timing when the user does not exist (prevents user enumeration via timing). */
export const DUMMY_HASH = '$2b$12$LJ3m4yF1p8tH8mFk7JgM9O7y9pQz7w5f3o7k0EwE8u2Yq5s0u0u0u0u'
