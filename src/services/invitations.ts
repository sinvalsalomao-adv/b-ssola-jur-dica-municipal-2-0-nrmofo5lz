import pb from '@/lib/pocketbase/client'

export type InvitationStatus =
  | 'pending'
  | 'activated'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled'

export interface Invitation {
  id: string
  name: string
  email: string
  role: string
  tenant: string
  tenantName: string
  invited_by: string
  status: InvitationStatus
  expires_at?: string
  used_at?: string
  created: string
}

export function normalizeInvitation(r: any): Invitation {
  return {
    id: r.id,
    name: r.name || '',
    email: r.email || '',
    role: r.role || 'servidor',
    tenant: r.tenant || '',
    tenantName: r.expand?.tenant?.name || '—',
    invited_by: r.invited_by || '',
    status: (r.status || 'pending') as InvitationStatus,
    expires_at: r.expires_at || '',
    used_at: r.used_at || '',
    created: r.created || '',
  }
}

/**
 * Retorna todos os convites do tenant autorizado (respeita RLS)
 */
export const getInvitations = async (tenantId?: string): Promise<Invitation[]> => {
  let filter = ''
  if (tenantId) {
    filter = `tenant = "${tenantId}"`
  }
  const records = await pb
    .collection('invitations')
    .getFullList({ filter: filter || undefined, expand: 'tenant', sort: '-created' })
  return records.map(normalizeInvitation)
}

/**
 * Criação segura de convite municipal (Admin local ou Superadmin)
 */
export const createInvitation = async (data: {
  name: string
  email: string
  role: string
  tenant: string
}): Promise<{ success: boolean; message: string; status: string }> => {
  return await pb.send('/backend/v1/invitations/create', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Aceite de convite pelo titular autenticado
 */
export const acceptInvitation = async (payload: {
  invitationId?: string
  token?: string
}): Promise<{ success: boolean; message: string; membership?: any }> => {
  return await pb.send('/backend/v1/invitations/accept', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Recusa de convite pelo titular autenticado
 */
export const declineInvitation = async (payload: {
  invitationId?: string
  token?: string
}): Promise<{ success: boolean; message: string }> => {
  return await pb.send('/backend/v1/invitations/decline', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Cancelamento de convite pelo Administrador do município ou Superadmin
 */
export const cancelInvitation = async (
  id: string,
): Promise<{ success: boolean; message: string }> => {
  return await pb.send('/backend/v1/invitations/cancel', {
    method: 'POST',
    body: JSON.stringify({ invitationId: id }),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Compatibilidade: ativador de convite legado redirecionado para acceptInvitation
 */
export const activateInvitation = async (id: string) => {
  return await acceptInvitation({ invitationId: id })
}
