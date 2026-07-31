import pb from '@/lib/pocketbase/client'
import type { TrilhaRecord, AulaRecord, QuizPergunta } from '@/types/education'

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

export function normalizeQuizPergunta(r: any): QuizPergunta {
  let opcoes = r.opcoes
  if (typeof opcoes === 'string') {
    try {
      opcoes = JSON.parse(opcoes)
    } catch {
      opcoes = []
    }
  }
  if (!Array.isArray(opcoes)) opcoes = []
  return {
    id: r.id,
    trilhaId: r.trilha_id || '',
    pergunta: r.pergunta || '',
    opcoes: opcoes as string[],
    respostaCorreta: r.resposta_correta || '',
    ordem: r.ordem || 0,
  }
}

export const getTrilhas = async (): Promise<TrilhaRecord[]> => {
  const records = await pb.collection('trilhas').getFullList({ sort: 'ordem' })
  return records.map(normalizeTrilha)
}

export const createTrilha = async (data: {
  titulo: string
  descricao: string
  ordem: number
}): Promise<TrilhaRecord> => {
  const record = await pb.collection('trilhas').create(data)
  return normalizeTrilha(record)
}

export const updateTrilha = async (
  id: string,
  data: Partial<{ titulo: string; descricao: string; ordem: number }>,
): Promise<TrilhaRecord> => {
  const record = await pb.collection('trilhas').update(id, data)
  return normalizeTrilha(record)
}

export const deleteTrilha = async (id: string): Promise<boolean> => {
  return pb.collection('trilhas').delete(id)
}

export const getAllAulas = async (): Promise<AulaRecord[]> => {
  const records = await pb.collection('aulas').getFullList({ sort: 'ordem' })
  return records.map(normalizeAula)
}

export const createAula = async (data: {
  trilhaId: string
  titulo: string
  urlVideo: string
  ordem?: number
}): Promise<AulaRecord> => {
  const record = await pb.collection('aulas').create({
    trilha_id: data.trilhaId,
    titulo: data.titulo,
    url_video: data.urlVideo,
    ordem: data.ordem ?? 1,
  })
  return normalizeAula(record)
}

export const updateAula = async (
  id: string,
  data: Partial<{ trilhaId: string; titulo: string; urlVideo: string; ordem: number }>,
): Promise<AulaRecord> => {
  const updateData: Record<string, any> = {}
  if (data.trilhaId !== undefined) updateData.trilha_id = data.trilhaId
  if (data.titulo !== undefined) updateData.titulo = data.titulo
  if (data.urlVideo !== undefined) updateData.url_video = data.urlVideo
  if (data.ordem !== undefined) updateData.ordem = data.ordem
  const record = await pb.collection('aulas').update(id, updateData)
  return normalizeAula(record)
}

export const deleteAula = async (id: string): Promise<boolean> => {
  return pb.collection('aulas').delete(id)
}

export const reorderAulas = async (aulaIds: string[]): Promise<void> => {
  const updates = aulaIds.map((id, index) =>
    pb.collection('aulas').update(id, { ordem: index + 1 }),
  )
  await Promise.all(updates)
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

export const getQuizPerguntas = async (): Promise<QuizPergunta[]> => {
  const records = await pb.collection('quiz_perguntas').getFullList({ sort: 'ordem' })
  return records.map(normalizeQuizPergunta)
}

export const createQuizPergunta = async (data: {
  trilhaId: string
  pergunta: string
  opcoes: string[]
  respostaCorreta: string
  ordem?: number
}): Promise<QuizPergunta> => {
  const record = await pb.collection('quiz_perguntas').create({
    trilha_id: data.trilhaId,
    pergunta: data.pergunta,
    opcoes: data.opcoes,
    resposta_correta: data.respostaCorreta,
    ordem: data.ordem ?? 1,
  })
  return normalizeQuizPergunta(record)
}

export const updateQuizPergunta = async (
  id: string,
  data: Partial<{ pergunta: string; opcoes: string[]; respostaCorreta: string; ordem: number }>,
): Promise<QuizPergunta> => {
  const updateData: Record<string, any> = {}
  if (data.pergunta !== undefined) updateData.pergunta = data.pergunta
  if (data.opcoes !== undefined) updateData.opcoes = data.opcoes
  if (data.respostaCorreta !== undefined) updateData.resposta_correta = data.respostaCorreta
  if (data.ordem !== undefined) updateData.ordem = data.ordem
  const record = await pb.collection('quiz_perguntas').update(id, updateData)
  return normalizeQuizPergunta(record)
}

export const deleteQuizPergunta = async (id: string): Promise<boolean> => {
  return pb.collection('quiz_perguntas').delete(id)
}
