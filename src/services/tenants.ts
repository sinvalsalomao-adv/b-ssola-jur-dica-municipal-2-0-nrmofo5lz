import pb from '@/lib/pocketbase/client'
import type { Prefeitura } from '@/types/superadmin'
import { sanitizeInput } from '@/lib/sanitize'

function parseHermesAllowedRoles(raw: any): string[] {
  if (!raw) return []
  let cur = raw
  let maxDepth = 5
  while (typeof cur === 'string' && maxDepth > 0) {
    maxDepth--
    const trimmed = cur.trim()
    if (!trimmed) return []
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        cur = JSON.parse(trimmed)
      } catch {
        break
      }
    } else {
      break
    }
  }

  let list: any[] = []
  if (Array.isArray(cur)) {
    list = cur
  } else if (cur && typeof cur === 'object' && typeof cur.length === 'number') {
    list = Array.from(cur)
  } else if (typeof cur === 'string') {
    list = [cur]
  }

  const result: string[] = []
  for (const item of list) {
    if (item !== null && item !== undefined) {
      const str = String(item).trim().toLowerCase()
      if (str && !result.includes(str)) {
        result.push(str)
      }
    }
  }
  return result
}

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
    hermesEnabled: Boolean(r.hermes_enabled),
    hermesAllowedRoles: parseHermesAllowedRoles(r.hermes_allowed_roles),
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
  if (payload.hermesEnabled !== undefined && payload.hermes_enabled === undefined) {
    payload.hermes_enabled = Boolean(payload.hermesEnabled)
    delete payload.hermesEnabled
  }
  if (payload.hermesAllowedRoles !== undefined && payload.hermes_allowed_roles === undefined) {
    payload.hermes_allowed_roles = parseHermesAllowedRoles(payload.hermesAllowedRoles)
    delete payload.hermesAllowedRoles
  } else if (payload.hermes_allowed_roles !== undefined) {
    payload.hermes_allowed_roles = parseHermesAllowedRoles(payload.hermes_allowed_roles)
  }
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
