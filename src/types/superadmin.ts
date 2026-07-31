export type UserRole = 'superadmin' | 'admin' | 'servidor' | 'gestor' | 'secretario' | 'procurador'
export type PrefeituraStatus = 'ativa' | 'inativa'
export type UserStatus = 'ativo' | 'inativo'

export interface Prefeitura {
  id: string
  name: string
  cnpj: string
  slug: string
  logo: string | null
  adminName: string
  cidade: string
  estado: string
  status: PrefeituraStatus
  createdAt: string
}

export interface GlobalUser {
  id: string
  name: string
  email: string
  prefeituraName: string
  prefeituraSlug: string
  role: UserRole
  status: UserStatus
  lastAccess: string
}

export interface PlatformConfig {
  stallLimits: Record<string, number>
  smtpServer: string
  smtpPort: string
  smtpUsername: string
  smtpPassword: string
  senderEmail: string
  aiApiKey: string
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function isValidCNPJ(cnpj: string): boolean {
  return /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(cnpj)
}
