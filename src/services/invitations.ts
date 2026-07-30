import pb from '@/lib/pocketbase/client'

export interface Invitation {
  id: string
  name: string
  email: string
  role: string
  tenant: string
  tenantName: string
  invited_by: string
  status: string
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
    status: r.status || 'pending',
    created: r.created || '',
  }
}

export const getInvitations = async (): Promise<Invitation[]> => {
  const records = await pb
    .collection('invitations')
    .getFullList({ expand: 'tenant', sort: '-created' })
  return records.map(normalizeInvitation)
}

export const createInvitation = async (data: {
  name: string
  email: string
  role: string
  tenant: string
}) =>
  pb.send('/backend/v1/invitations/create', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })

export const activateInvitation = async (id: string) =>
  pb.send('/backend/v1/invitations/activate', {
    method: 'POST',
    body: JSON.stringify({ id }),
    headers: { 'Content-Type': 'application/json' },
  })

export const cancelInvitation = async (id: string) =>
  pb.collection('invitations').update(id, { status: 'cancelled' })
