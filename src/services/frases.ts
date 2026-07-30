import pb from '@/lib/pocketbase/client'
import type { FraseSalva } from '@/types/education'

export function normalizeFrase(r: any): FraseSalva {
  return {
    id: r.id,
    texto: r.texto || '',
    tipo: (r.tipo || 'objeto') as 'objeto' | 'descricao',
    contadorUso: r.contador_uso || 0,
  }
}

export const getFrases = async (tenantId: string, tipo?: string): Promise<FraseSalva[]> => {
  const filter = tipo ? `tenant = "${tenantId}" && tipo = "${tipo}"` : `tenant = "${tenantId}"`
  const records = await pb.collection('frases_salvas').getFullList({
    filter,
    sort: '-contador_uso',
  })
  return records.map(normalizeFrase)
}

export const createFrase = async (texto: string, tipo: string, tenantId: string) => {
  const record = await pb.collection('frases_salvas').create({
    texto,
    tipo,
    tenant: tenantId,
    contador_uso: 0,
  })
  return normalizeFrase(record)
}

export const incrementFraseUso = async (id: string) => {
  try {
    const record = await pb.collection('frases_salvas').getOne(id)
    const currentCount = record.contador_uso || 0
    return pb.collection('frases_salvas').update(id, { contador_uso: currentCount + 1 })
  } catch {
    return null
  }
}
