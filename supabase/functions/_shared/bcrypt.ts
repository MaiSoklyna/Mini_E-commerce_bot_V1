import bcrypt from 'https://esm.sh/bcryptjs@2.4.3'

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compareSync(password, hash)
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}
