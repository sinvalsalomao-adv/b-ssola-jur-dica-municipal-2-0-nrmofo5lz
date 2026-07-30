import pb from '@/lib/pocketbase/client'
import type { GlobalUser, UserRole, UserStatus } from '@/types/superadmin'

export function normalizeUser(r: any): GlobalUser {
  return {
    id: r.id,
    name: r.name || '',
    email: r.email || '',
    prefeituraName: r.expand?.tenant?.name || '—',
    prefeituraSlug: r.expand?.tenant?.slug || '',
    role: (r.role || 'servidor') as UserRole,
    status: (r.status || 'ativo') as UserStatus,
    lastAccess: r.updated || r.created || '—',
  }
}

export const getUsers = async (): Promise<GlobalUser[]> => {
  const records = await pb.collection('users').getFullList({ expand: 'tenant', sort: 'name' })
  return records.map(normalizeUser)
}

export const getUsersByTenant = async (tenantId: string): Promise<GlobalUser[]> => {
  const records = await pb.collection('users').getFullList({
    filter: `tenant = "${tenantId}"`,
    expand: 'tenant',
    sort: 'name',
  })
  return records.map(normalizeUser)
}

export const updateUser = async (id: string, data: Record<string, any>) =>
  normalizeUser(await pb.collection('users').update(id, data, { expand: 'tenant' }))

export const toggleUserStatus = async (id: string, currentStatus: string) =>
  updateUser(id, { status: currentStatus === 'ativo' ? 'inativo' : 'ativo' })
