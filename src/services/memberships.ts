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
