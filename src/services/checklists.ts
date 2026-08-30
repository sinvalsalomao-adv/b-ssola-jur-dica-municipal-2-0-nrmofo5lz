import pb from '@/lib/pocketbase/client'
import { Checklist, ChecklistItem } from '@/types/project'
import { sanitizeInput } from '@/lib/sanitize'
import { normalizeDateForInput } from '@/lib/dateUtils'

export function normalizeChecklistItem(r: any): ChecklistItem {
  const formattedPrazo = normalizeDateForInput(r.prazo)

  return {
    id: r.id || '',
    checklistId: r.checklist_id || '',
    projetoId: r.projeto_id || '',
    texto: r.texto || '',
    concluido: !!r.concluido,
    responsibleUserId: r.responsible_user || undefined,
    responsibleUserName: r.expand?.responsible_user?.name || undefined,
    prazo: formattedPrazo,
    ordem: typeof r.ordem === 'number' ? r.ordem : 0,
    tenantId: r.tenant || '',
    createdAt: r.created || new Date().toISOString(),
    updatedAt: r.updated || new Date().toISOString(),
  }
}

export function normalizeChecklist(r: any, items: ChecklistItem[] = []): Checklist {
  return {
    id: r.id || '',
    titulo: r.titulo || 'Checklist Sem Título',
    projetoId: r.projeto_id || '',
    tenantId: r.tenant || '',
    ordem: typeof r.ordem === 'number' ? r.ordem : 0,
    items: items.sort((a, b) => a.ordem - b.ordem),
    createdAt: r.created || new Date().toISOString(),
    updatedAt: r.updated || new Date().toISOString(),
  }
}

export const getChecklistsByProject = async (projectId: string): Promise<Checklist[]> => {
  if (!projectId) return []

  const [checklistRecords, itemRecords] = await Promise.all([
    pb.collection('checklists').getFullList({
      filter: `projeto_id = "${projectId}"`,
      sort: 'ordem,created',
    }),
    pb.collection('checklist_items').getFullList({
      filter: `projeto_id = "${projectId}"`,
      expand: 'responsible_user',
      sort: 'ordem,created',
    }),
  ])

  const normalizedItems = itemRecords.map(normalizeChecklistItem)

  const itemsByChecklist: Record<string, ChecklistItem[]> = {}
  for (const item of normalizedItems) {
    if (!itemsByChecklist[item.checklistId]) {
      itemsByChecklist[item.checklistId] = []
    }
    itemsByChecklist[item.checklistId].push(item)
  }

  return checklistRecords.map((c) => normalizeChecklist(c, itemsByChecklist[c.id] || []))
}

async function resolveFallbackTenant(tenantId?: string, projectId?: string): Promise<string> {
  if (tenantId && tenantId.trim() !== '') return tenantId.trim()

  if (pb.authStore.record?.tenant) {
    return pb.authStore.record.tenant
  }

  // If projectId is provided, fetch the project's tenant explicitly
  if (projectId) {
    try {
      const proj = await pb
        .collection('projects')
        .getOne(projectId, { fields: 'tenant', requestKey: null })
      if (proj?.tenant) return proj.tenant
    } catch {
      // ignore
    }
  }

  return ''
}

export const createChecklist = async (data: {
  titulo: string
  projetoId: string
  tenantId?: string
  ordem?: number
}): Promise<Checklist> => {
  let resolvedTenant = data.tenantId?.trim() || ''
  if (!resolvedTenant) {
    resolvedTenant = await resolveFallbackTenant(data.tenantId, data.projetoId)
  }

  const payload: Record<string, any> = {
    titulo: sanitizeInput(data.titulo.trim()),
    projeto_id: data.projetoId,
    tenant: resolvedTenant,
    ordem: data.ordem ?? 0,
  }

  const record = await pb.collection('checklists').create(payload)
  return normalizeChecklist(record, [])
}

export const updateChecklist = async (
  id: string,
  data: {
    titulo?: string
    ordem?: number
  },
): Promise<Checklist> => {
  const payload: Record<string, any> = {}
  if (data.titulo !== undefined) payload.titulo = sanitizeInput(data.titulo.trim())
  if (data.ordem !== undefined) payload.ordem = data.ordem

  const record = await pb.collection('checklists').update(id, payload)
  return normalizeChecklist(record)
}

export const deleteChecklist = async (id: string): Promise<void> => {
  await pb.collection('checklists').delete(id)
}

export const createChecklistItem = async (data: {
  texto: string
  checklistId: string
  projetoId: string
  tenantId?: string
  concluido?: boolean
  responsibleUserId?: string
  prazo?: string
  ordem?: number
}): Promise<ChecklistItem> => {
  let resolvedTenant = data.tenantId?.trim() || ''
  if (!resolvedTenant) {
    resolvedTenant = await resolveFallbackTenant(data.tenantId, data.projetoId)
  }

  const payload: Record<string, any> = {
    texto: sanitizeInput(data.texto.trim()),
    checklist_id: data.checklistId,
    projeto_id: data.projetoId,
    tenant: resolvedTenant,
    concluido: !!data.concluido,
    ordem: data.ordem ?? 0,
  }

  if (data.responsibleUserId && data.responsibleUserId !== 'none') {
    payload.responsible_user = data.responsibleUserId
  } else {
    payload.responsible_user = null
  }

  if (data.prazo) {
    payload.prazo =
      data.prazo.includes(' ') || data.prazo.includes('T')
        ? data.prazo
        : `${data.prazo} 00:00:00.000Z`
  } else {
    payload.prazo = null
  }

  const record = await pb.collection('checklist_items').create(payload, {
    expand: 'responsible_user',
  })
  return normalizeChecklistItem(record)
}

export const updateChecklistItem = async (
  id: string,
  data: {
    texto?: string
    concluido?: boolean
    responsibleUserId?: string | null
    prazo?: string | null
    ordem?: number
  },
): Promise<ChecklistItem> => {
  const payload: Record<string, any> = {}
  if (data.texto !== undefined) payload.texto = sanitizeInput(data.texto.trim())
  if (data.concluido !== undefined) payload.concluido = data.concluido
  if (data.responsibleUserId !== undefined) {
    payload.responsible_user =
      data.responsibleUserId && data.responsibleUserId !== 'none' ? data.responsibleUserId : null
  }
  if (data.prazo !== undefined) {
    payload.prazo = data.prazo
      ? data.prazo.includes(' ') || data.prazo.includes('T')
        ? data.prazo
        : `${data.prazo} 00:00:00.000Z`
      : null
  }
  if (data.ordem !== undefined) payload.ordem = data.ordem

  const record = await pb.collection('checklist_items').update(id, payload, {
    expand: 'responsible_user',
  })
  return normalizeChecklistItem(record)
}

export const deleteChecklistItem = async (id: string): Promise<void> => {
  await pb.collection('checklist_items').delete(id)
}
