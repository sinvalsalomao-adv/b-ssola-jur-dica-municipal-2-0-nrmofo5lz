import pb from '@/lib/pocketbase/client'
import type { Prefeitura } from '@/types/superadmin'

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

export const updateTenant = async (id: string, data: Record<string, any>) =>
  normalizeTenant(await pb.collection('tenants').update(id, data))

export const toggleTenantStatus = async (id: string, currentStatus: string) =>
  updateTenant(id, { status: currentStatus === 'ativa' ? 'inativa' : 'ativa' })

export const createTenant = async (data: {
  name: string
  cnpj: string
  slug: string
  admin_name: string
}) =>
  pb.send('/backend/v1/tenants/create', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
