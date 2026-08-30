import pb from '@/lib/pocketbase/client'
import type { GlobalUser, UserRole, UserStatus } from '@/types/superadmin'
import { sanitizeInput } from '@/lib/sanitize'

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
  try {
    // 1. Buscar via user_memberships para refletir o modelo novo
    const memberships = await pb.collection('user_memberships').getFullList({
      filter: `tenant = "${tenantId}" && status = "ativo"`,
      expand: 'user,tenant',
      sort: 'user.name',
    })

    if (memberships.length > 0) {
      return memberships.map((m: any) => {
        const u = m.expand?.user || {}
        const t = m.expand?.tenant || {}
        return {
          id: u.id || m.user,
          name: u.name || u.email || '—',
          email: u.email || '',
          prefeituraName: t.name || '—',
          prefeituraSlug: t.slug || '',
          role: (m.role || 'servidor') as UserRole,
          status: (m.status === 'ativo' ? 'ativo' : 'inativo') as UserStatus,
          lastAccess: m.updated || m.created || '—',
        }
      })
    }
  } catch (err) {
    console.warn('Erro ao consultar user_memberships, tentando fallback em users:', err)
  }

  // Fallback: consulta direta em users
  const records = await pb.collection('users').getFullList({
    filter: `tenant = "${tenantId}"`,
    expand: 'tenant',
    sort: 'name',
  })
  return records.map(normalizeUser)
}

export const updateUser = async (id: string, data: Record<string, any>) => {
  const payload: Record<string, any> = { ...data }
  if (payload.name !== undefined) payload.name = sanitizeInput(payload.name)
  if (payload.email !== undefined) payload.email = sanitizeInput(payload.email)
  if (payload.cargo !== undefined) payload.cargo = sanitizeInput(payload.cargo)
  return normalizeUser(await pb.collection('users').update(id, payload, { expand: 'tenant' }))
}

export const toggleUserStatus = async (id: string, currentStatus: string) =>
  updateUser(id, { status: currentStatus === 'ativo' ? 'inativo' : 'ativo' })

export const deleteUser = async (id: string) => pb.collection('users').delete(id)
