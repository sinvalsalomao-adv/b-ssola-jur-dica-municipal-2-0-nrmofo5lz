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

export interface TenantUserListOptions {
  search?: string
  status?: string
  page?: number
  perPage?: number
}

export interface TenantUserListResponse {
  page: number
  perPage: number
  totalItems: number
  totalPages: number
  items: GlobalUser[]
}

/**
 * Consulta autenticada de usuários de um tenant via endpoint seguro de backend
 */
export const getUsersByTenant = async (
  tenantId: string,
  options?: TenantUserListOptions,
): Promise<GlobalUser[]> => {
  try {
    const params = new URLSearchParams()
    if (tenantId) params.set('tenant', tenantId)
    if (options?.search) params.set('search', options.search)
    if (options?.status) params.set('status', options.status)
    if (options?.page) params.set('page', String(options.page))
    if (options?.perPage) params.set('perPage', String(options.perPage))

    const url = `/backend/v1/tenant-users/list${params.toString() ? '?' + params.toString() : ''}`
    const res: any = await pb.send(url, { method: 'GET' })

    if (res?.items && Array.isArray(res.items)) {
      return res.items.map((item: any) => ({
        id: item.id,
        name: item.name || '—',
        email: item.email || '',
        prefeituraName: item.prefeituraName || '—',
        prefeituraSlug: item.prefeituraSlug || '',
        role: (item.role || 'servidor') as UserRole,
        status: (item.status === 'ativo' ? 'ativo' : 'inativo') as UserStatus,
        lastAccess: item.lastAccess || '—',
      }))
    }
    return []
  } catch (err) {
    // Se o usuário logado for superadmin e o endpoint falhar, pode consultar via users
    if (pb.authStore.record?.role === 'superadmin') {
      try {
        const filter = tenantId ? `tenant = "${tenantId}"` : ''
        const records = await pb.collection('users').getFullList({
          filter: filter || undefined,
          expand: 'tenant',
          sort: 'name',
        })
        return records.map(normalizeUser)
      } catch {
        /* intentionally ignored */
      }
    }
    return []
  }
}

/**
 * Consulta um único usuário de um tenant via endpoint seguro
 */
export const getTenantUser = async (
  userId: string,
  tenantId?: string,
): Promise<GlobalUser | null> => {
  try {
    const params = new URLSearchParams()
    params.set('userId', userId)
    if (tenantId) params.set('tenant', tenantId)

    const res: any = await pb.send(`/backend/v1/tenant-users/view?${params.toString()}`, {
      method: 'GET',
    })
    if (res?.id) {
      return {
        id: res.id,
        name: res.name || '—',
        email: res.email || '',
        prefeituraName: res.prefeituraName || '—',
        prefeituraSlug: res.prefeituraSlug || '',
        role: (res.role || 'servidor') as UserRole,
        status: (res.status === 'ativo' ? 'ativo' : 'inativo') as UserStatus,
        lastAccess: res.updated || res.created || '—',
      }
    }
    return null
  } catch (_) {
    return null
  }
}

/**
 * Atualiza usuário/vínculo via endpoint transacional seguro
 */
export const updateTenantUser = async (payload: {
  userId: string
  tenant?: string
  name?: string
  role?: UserRole
  status?: UserStatus
}): Promise<{ success: boolean; message: string; user?: any }> => {
  const cleanPayload: Record<string, any> = { ...payload }
  if (cleanPayload.name) cleanPayload.name = sanitizeInput(cleanPayload.name)

  return await pb.send('/backend/v1/tenant-users/update', {
    method: 'POST',
    body: JSON.stringify(cleanPayload),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Desvincula / remove usuário de um tenant via endpoint transacional seguro
 */
export const deleteTenantUser = async (payload: {
  userId: string
  tenant?: string
}): Promise<{ success: boolean; message: string }> => {
  return await pb.send('/backend/v1/tenant-users/delete', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
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
