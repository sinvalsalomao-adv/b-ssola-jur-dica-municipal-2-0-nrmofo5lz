import pb from '@/lib/pocketbase/client'

export interface DocumentTemplateItem {
  id: string
  name: string
  content: string
  type: 'Minuta' | 'Ofício' | 'Parecer' | 'Declaração' | 'Outro'
  tenant: string
  created: string
  updated: string
}

export function normalizeDocumentTemplate(r: any): DocumentTemplateItem {
  return {
    id: r.id,
    name: r.name || '',
    content: r.content || '',
    type: r.type || 'Outro',
    tenant: r.tenant || '',
    created: r.created || '',
    updated: r.updated || '',
  }
}

export const getDocumentTemplates = async (tenantId?: string): Promise<DocumentTemplateItem[]> => {
  const options: Record<string, any> = { sort: '-created' }
  if (tenantId) {
    options.filter = `tenant = "${tenantId}"`
  }
  const records = await pb.collection('document_templates').getFullList(options)
  return records.map(normalizeDocumentTemplate)
}

export const createDocumentTemplate = async (data: {
  name: string
  content: string
  type: string
  tenant: string
}): Promise<DocumentTemplateItem> => {
  const record = await pb.collection('document_templates').create(data)
  return normalizeDocumentTemplate(record)
}

export const updateDocumentTemplate = async (
  id: string,
  data: Partial<{ name: string; content: string; type: string }>,
): Promise<DocumentTemplateItem> => {
  const record = await pb.collection('document_templates').update(id, data)
  return normalizeDocumentTemplate(record)
}

export const deleteDocumentTemplate = async (id: string): Promise<void> => {
  await pb.collection('document_templates').delete(id)
}
