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
 * Retorna todos os vínculos de um usuário
 */
export async function getUserMemberships(userId: string): Promise<UserMembership[]> {
  try {
    const records = await pb.collection('user_memberships').getFullList({
      filter: `user = "${userId}"`,
      expand: 'tenant,user',
      sort: '-created',
    })
    return records.map(normalizeMembership)
  } catch (err) {
    console.error('Erro ao buscar vínculos do usuário:', err)
    return []
  }
}

/**
 * Retorna o vínculo de um usuário em um município/tenant específico
 */
export async function getUserMembershipForTenant(
  userId: string,
  tenantId: string,
): Promise<UserMembership | null> {
  try {
    const records = await pb.collection('user_memberships').getFullList({
      filter: `user = "${userId}" && tenant = "${tenantId}"`,
      expand: 'tenant,user',
      sort: '-created',
    })
    if (records.length > 0) {
      return normalizeMembership(records[0])
    }
    return null
  } catch (err) {
    console.error('Erro ao buscar vínculo do tenant:', err)
    return null
  }
}

/**
 * Retorna todas as memberships de um tenant (com filtro opcional de status)
 */
export async function getMembershipsByTenant(
  tenantId: string,
  status?: MembershipStatus,
): Promise<UserMembership[]> {
  try {
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
  } catch (err) {
    console.error('Erro ao buscar memberships do tenant:', err)
    return []
  }
}

/**
 * Retorna todos os vínculos pendentes (para o Superadmin ou por tenant)
 */
export async function getPendingMemberships(tenantId?: string): Promise<UserMembership[]> {
  try {
    // Usar o endpoint seguro de tenant-users com status=pendente
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
  } catch (err) {
    console.warn('Fallback para user_memberships ao buscar cadastros pendentes:', err)
  }

  // Fallback caso seja superadmin acessando direto
  try {
    const filter = tenantId
      ? `tenant = "${tenantId}" && status = "pendente"`
      : `status = "pendente"`
    const records = await pb.collection('user_memberships').getFullList({
      filter,
      expand: 'user,tenant',
      sort: '-created',
    })
    return records.map(normalizeMembership)
  } catch (err) {
    console.error('Erro ao buscar cadastros pendentes:', err)
    return []
  }
}

/**
 * Aprova um vínculo pendente (status -> 'ativo', role opcionalmente customizado)
 */
export async function approveMembership(
  membershipId: string,
  role?: UserRole,
): Promise<UserMembership> {
  const payload: Record<string, any> = {
    status: 'ativo',
  }
  if (role) payload.role = role
  const updated = await pb.collection('user_memberships').update(membershipId, payload, {
    expand: 'user,tenant',
  })
  return normalizeMembership(updated)
}

/**
 * Rejeita um vínculo pendente (status -> 'rejeitado')
 */
export async function rejectMembership(membershipId: string): Promise<UserMembership> {
  const updated = await pb.collection('user_memberships').update(
    membershipId,
    {
      status: 'rejeitado',
    },
    {
      expand: 'user,tenant',
    },
  )
  return normalizeMembership(updated)
}

/**
 * Atualiza o papel ou status de uma membership
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
 * Cria ou recupera um usuário global e associa um vínculo
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
  password?: string
  passwordConfirm?: string
}): Promise<{ success: boolean; message: string; user?: any; membership?: any }> {
  return await pb.send('/backend/v1/tenant-users/create', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
}
