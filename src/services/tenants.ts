import pb from '@/lib/pocketbase/client'
import type { Prefeitura } from '@/types/superadmin'
import { sanitizeInput } from '@/lib/sanitize'

export function normalizeTenant(r: any): Prefeitura {
  return {
    id: r.id,
    name: r.name || '',
    cnpj: r.cnpj || '',
    slug: r.slug || '',
    logo: r.logo || null,
    adminName: r.admin_name || '',
    cidade: r.cidade || '',
    estado: r.estado || '',
    status: r.status || 'ativa',
    createdAt: r.created || '',
  }
}

export const getTenants = async (): Promise<Prefeitura[]> => {
  const records = await pb.collection('tenants').getFullList({ sort: 'created' })
  return records.map(normalizeTenant)
}

export const getTenant = async (id: string) =>
  normalizeTenant(await pb.collection('tenants').getOne(id))

export const updateTenant = async (id: string, data: Record<string, any>) => {
  const payload: Record<string, any> = { ...data }
  if (payload.name !== undefined) payload.name = sanitizeInput(payload.name)
  if (payload.admin_name !== undefined) payload.admin_name = sanitizeInput(payload.admin_name)
  if (payload.adminName !== undefined) payload.adminName = sanitizeInput(payload.adminName)
  if (payload.cidade !== undefined) payload.cidade = sanitizeInput(payload.cidade)
  if (payload.estado !== undefined) payload.estado = sanitizeInput(payload.estado)
  return normalizeTenant(await pb.collection('tenants').update(id, payload))
}

export const toggleTenantStatus = async (id: string, currentStatus: string) =>
  updateTenant(id, { status: currentStatus === 'ativa' ? 'inativa' : 'ativa' })

export const createTenant = async (data: {
  name: string
  cnpj: string
  slug: string
  admin_name: string
}) => {
  const sanitized = {
    ...data,
    name: sanitizeInput(data.name),
    admin_name: sanitizeInput(data.admin_name),
  }
  return pb.send('/backend/v1/tenants/create', {
    method: 'POST',
    body: JSON.stringify(sanitized),
    headers: { 'Content-Type': 'application/json' },
  })
}
