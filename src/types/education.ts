export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
}

export interface TrilhaRecord {
  id: string
  titulo: string
  descricao: string
  ordem: number
}

export interface AulaRecord {
  id: string
  trilhaId: string
  titulo: string
  urlVideo: string
  ordem: number
}

export interface QuizPergunta {
  id: string
  trilhaId: string
  pergunta: string
  opcoes: string[]
  respostaCorreta: string
  ordem: number
}

export interface FraseSalva {
  id: string
  texto: string
  tipo: 'objeto' | 'descricao'
  contadorUso: number
}

export interface QuizState {
  result: 'pending' | 'approved' | 'failed'
  score: number
  certificateCode: string | null
}

export interface TrackWithLessons extends TrilhaRecord {
  lessons: AulaRecord[]
  quiz: QuizQuestion[]
}

export interface TrackProgress {
  completedCount: number
  totalLessons: number
  progress: number
}
