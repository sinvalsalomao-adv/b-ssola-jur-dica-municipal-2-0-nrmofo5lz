import pb from '@/lib/pocketbase/client'
import type { TrilhaRecord, AulaRecord } from '@/types/education'

export function normalizeTrilha(r: any): TrilhaRecord {
  return {
    id: r.id,
    titulo: r.titulo || '',
    descricao: r.descricao || '',
    ordem: r.ordem || 0,
  }
}

export function normalizeAula(r: any): AulaRecord {
  return {
    id: r.id,
    trilhaId: r.trilha_id || '',
    titulo: r.titulo || '',
    urlVideo: r.url_video || '',
    ordem: r.ordem || 0,
  }
}

export const getTrilhas = async (): Promise<TrilhaRecord[]> => {
  const records = await pb.collection('trilhas').getFullList({ sort: 'ordem' })
  return records.map(normalizeTrilha)
}

export const getAllAulas = async (): Promise<AulaRecord[]> => {
  const records = await pb.collection('aulas').getFullList({ sort: 'ordem' })
  return records.map(normalizeAula)
}

export const getProgresso = async (usuarioId: string) => {
  const records = await pb.collection('progresso_usuario').getFullList({
    filter: `usuario_id = "${usuarioId}"`,
  })
  return records.map((r) => ({
    id: r.id,
    trilhaId: r.trilha_id || '',
    aulaId: r.aula_id || '',
    concluido: r.concluido || false,
  }))
}

export const toggleProgresso = async (
  usuarioId: string,
  trilhaId: string,
  aulaId: string,
  concluido: boolean,
) => {
  try {
    const existing = await pb
      .collection('progresso_usuario')
      .getFirstListItem(`usuario_id = "${usuarioId}" && aula_id = "${aulaId}"`)
    return pb.collection('progresso_usuario').update(existing.id, { concluido })
  } catch {
    return pb.collection('progresso_usuario').create({
      usuario_id: usuarioId,
      trilha_id: trilhaId,
      aula_id: aulaId,
      concluido,
    })
  }
}

export const saveQuizResult = async (
  usuarioId: string,
  trilhaId: string,
  acertos: number,
  total: number,
  aprovado: boolean,
) => {
  const today = new Date().toISOString().split('T')[0]
  return pb.collection('quiz_respostas').create({
    usuario_id: usuarioId,
    trilha_id: trilhaId,
    acertos,
    total,
    aprovado,
    data: today,
  })
}

export const getQuizResults = async (usuarioId: string) => {
  const records = await pb.collection('quiz_respostas').getFullList({
    filter: `usuario_id = "${usuarioId}"`,
    sort: '-created',
  })
  return records.map((r) => ({
    id: r.id,
    trilhaId: r.trilha_id || '',
    acertos: r.acertos || 0,
    total: r.total || 0,
    aprovado: r.aprovado || false,
    data: r.data || '',
  }))
}
