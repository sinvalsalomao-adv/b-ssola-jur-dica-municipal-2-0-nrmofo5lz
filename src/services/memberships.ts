import pb from '@/lib/pocketbase/client'
import type { UserRole, UserStatus } from '@/types/superadmin'

export type MembershipStatus = 'pendente' | 'ativo' | 'inativo' | 'rejeitado'

export interface UserMembership {
  id: string
  userId: string
  userName?: string
  userEmail?: string
  tenantId: string
  tenantName?: string
  tenantSlug?: string
  role: UserRole
  status: MembershipStatus
  created: string
  updated: string
}

export function normalizeMembership(r: any): UserMembership {
  return {
    id: r.id,
    userId: r.user || r.expand?.user?.id || '',
    userName: r.expand?.user?.name || r.expand?.user?.email || '—',
    userEmail: r.expand?.user?.email || '',
    tenantId: r.tenant || r.expand?.tenant?.id || '',
    tenantName: r.expand?.tenant?.name || '—',
    tenantSlug: r.expand?.tenant?.slug || '',
    role: (r.role || 'servidor') as UserRole,
    status: (r.status || 'pendente') as MembershipStatus,
    created: r.created || '',
    updated: r.updated || '',
  }
}

/**
 * Retorna todos os vínculos do próprio usuário logado
 */
export async function getUserMemberships(userId: string): Promise<UserMembership[]> {
  const records = await pb.collection('user_memberships').getFullList({
    filter: `user = "${userId}"`,
    expand: 'tenant,user',
    sort: '-created',
  })
  return records.map(normalizeMembership)
}

/**
 * Retorna o vínculo de um usuário em um município/tenant específico
 */
export async function getUserMembershipForTenant(
  userId: string,
  tenantId: string,
): Promise<UserMembership | null> {
  const records = await pb.collection('user_memberships').getFullList({
    filter: `user = "${userId}" && tenant = "${tenantId}"`,
    expand: 'tenant,user',
    sort: '-created',
  })
  if (records.length > 0) {
    return normalizeMembership(records[0])
  }
  return null
}

/**
 * Retorna todas as memberships de um tenant (com filtro opcional de status).
 * Somente para uso autorizado (respeita RLS no PB).
 */
export async function getMembershipsByTenant(
  tenantId: string,
  status?: MembershipStatus,
): Promise<UserMembership[]> {
  let filter = `tenant = "${tenantId}"`
  if (status) {
    filter += ` && status = "${status}"`
  }
  const records = await pb.collection('user_memberships').getFullList({
    filter,
    expand: 'user,tenant',
    sort: '-created',
  })
  return records.map(normalizeMembership)
}

/**
 * Retorna cadastros pendentes de um município via endpoint transacional e autenticado.
 * R-1a: Sem fallback para acesso direto a coleções na gestão municipal.
 */
export async function getPendingMemberships(tenantId?: string): Promise<UserMembership[]> {
  const params = new URLSearchParams()
  if (tenantId) params.set('tenant', tenantId)
  params.set('status', 'pendente')

  const res: any = await pb.send(`/backend/v1/tenant-users/list?${params.toString()}`, {
    method: 'GET',
  })

  if (res?.items && Array.isArray(res.items)) {
    return res.items.map((item: any) => ({
      id: item.membershipId || item.id,
      userId: item.id,
      userName: item.name || '—',
      userEmail: item.email || '',
      tenantId: item.tenantId || tenantId || '',
      tenantName: item.prefeituraName || '—',
      tenantSlug: item.prefeituraSlug || '',
      role: (item.role || 'servidor') as UserRole,
      status: 'pendente' as MembershipStatus,
      created: item.created || '',
      updated: item.lastAccess || '',
    }))
  }
  return []
}

/**
 * Aprova um vínculo pendente via endpoint backend seguro e transacional (R-1b).
 * Valida tenant do admin autenticado, impede autopromoção e protege o último admin ativo.
 */
export async function approveMembership(
  membershipId: string,
  tenantId: string,
  role?: UserRole,
): Promise<{ success: boolean; message: string; membership: UserMembership }> {
  const payload: Record<string, any> = {
    membershipId,
    tenant: tenantId,
  }
  if (role) payload.role = role

  const res: any = await pb.send('/backend/v1/tenant-users/approve', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })

  return res
}

/**
 * Rejeita um vínculo pendente via endpoint backend seguro e transacional (R-1b).
 * Valida tenant do admin autenticado e protege o último admin ativo.
 */
export async function rejectMembership(
  membershipId: string,
  tenantId: string,
): Promise<{ success: boolean; message: string; membership: UserMembership }> {
  const payload: Record<string, any> = {
    membershipId,
    tenant: tenantId,
  }

  const res: any = await pb.send('/backend/v1/tenant-users/reject', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })

  return res
}

/**
 * Atualiza o papel ou status de uma membership via endpoint seguro de gestão
 */
export async function updateMembership(
  membershipId: string,
  data: { role?: UserRole; status?: MembershipStatus },
): Promise<UserMembership> {
  const updated = await pb.collection('user_memberships').update(membershipId, data, {
    expand: 'user,tenant',
  })
  return normalizeMembership(updated)
}

/**
 * Deleta um vínculo de usuário
 */
export async function deleteMembership(membershipId: string): Promise<boolean> {
  return await pb.collection('user_memberships').delete(membershipId)
}

/**
 * Cria ou recupera um usuário global e associa um vínculo (uso interno)
 */
export async function createMembership(data: {
  userId: string
  tenantId: string
  role: UserRole
  status: MembershipStatus
}): Promise<UserMembership> {
  const record = await pb.collection('user_memberships').create(
    {
      user: data.userId,
      tenant: data.tenantId,
      role: data.role,
      status: data.status,
    },
    { expand: 'user,tenant' },
  )
  return normalizeMembership(record)
}

/**
 * Endpoint seguro e transacional para auto-cadastro público
 */
export async function registerPublicUser(payload: {
  slug: string
  name: string
  email: string
  password: string
  passwordConfirm: string
  role?: UserRole
}): Promise<{ success: boolean; status: string; message: string }> {
  return await pb.send('/backend/v1/auth/register-public', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Criação e vinculação transacional segura de usuário por Admin local ou Superadmin
 */
export async function createTenantUserSecure(payload: {
  name: string
  email: string
  tenant: string
  role: UserRole
}): Promise<{ success: boolean; message: string; status?: string }> {
  return await pb.send('/backend/v1/tenant-users/create', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
}
