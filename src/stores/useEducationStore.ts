import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getTrilhas,
  getAllAulas,
  getProgresso,
  toggleProgresso,
  saveQuizResult,
  getQuizResults,
  createTrilha,
  updateTrilha,
  deleteTrilha,
  createAula,
  updateAula,
  deleteAula,
  getQuizPerguntas,
  createQuizPergunta,
  updateQuizPergunta,
  deleteQuizPergunta,
} from '@/services/education'
import { QUIZ_DATA } from '@/data/quizData'
import type { TrackWithLessons, QuizState, QuizPergunta, QuizQuestion } from '@/types/education'

function generateCertCode(): string {
  return (
    'BRZ-' +
    Math.random().toString(36).substring(2, 6).toUpperCase() +
    '-' +
    Math.random().toString(36).substring(2, 6).toUpperCase()
  )
}

function perguntaToQuestion(p: QuizPergunta): QuizQuestion {
  return {
    id: p.id,
    question: p.pergunta,
    options: p.opcoes,
    correctIndex: Math.max(0, p.opcoes.indexOf(p.respostaCorreta)),
  }
}

export function useEducationStore() {
  const { user } = useAuth()
  const [tracks, setTracks] = useState<TrackWithLessons[]>([])
  const [quizPerguntas, setQuizPerguntas] = useState<QuizPergunta[]>([])
  const [completedLessons, setCompletedLessons] = useState<Record<string, Set<string>>>({})
  const [quizStates, setQuizStates] = useState<Record<string, QuizState>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [trilhas, allAulas, progresso, quizResults, perguntas] = await Promise.all([
        getTrilhas(),
        getAllAulas(),
        getProgresso(user.id),
        getQuizResults(user.id),
        getQuizPerguntas().catch(() => []),
      ])

      const tracksWithLessons: TrackWithLessons[] = trilhas.map((t) => {
        const trackPerguntas = perguntas
          .filter((p) => p.trilhaId === t.id)
          .sort((a, b) => a.ordem - b.ordem)
        const quiz =
          trackPerguntas.length > 0
            ? trackPerguntas.map(perguntaToQuestion)
            : QUIZ_DATA[t.titulo] || []
        return {
          ...t,
          lessons: allAulas.filter((a) => a.trilhaId === t.id),
          quiz,
        }
      })

      const progressMap: Record<string, Set<string>> = {}
      const quizMap: Record<string, QuizState> = {}
      trilhas.forEach((t) => {
        progressMap[t.id] = new Set<string>()
        quizMap[t.id] = { result: 'pending', score: 0, certificateCode: null }
      })

      progresso.forEach((p) => {
        const aula = allAulas.find((a) => a.id === p.aulaId)
        if (aula && p.concluido) {
          if (!progressMap[aula.trilhaId]) progressMap[aula.trilhaId] = new Set()
          progressMap[aula.trilhaId].add(p.aulaId)
        }
      })

      quizResults.forEach((q) => {
        if (quizMap[q.trilhaId]) {
          quizMap[q.trilhaId] = {
            result: q.aprovado ? 'approved' : 'failed',
            score: q.total > 0 ? Math.round((q.acertos / q.total) * 100) : 0,
            certificateCode: q.aprovado ? generateCertCode() : null,
          }
        }
      })

      setTracks(tracksWithLessons)
      setQuizPerguntas(perguntas)
      setCompletedLessons(progressMap)
      setQuizStates(quizMap)
      setError(null)
    } catch (err) {
      setError('Erro ao carregar dados educacionais')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime(
    'trilhas',
    () => {
      loadData()
    },
    !!user,
  )
  useRealtime(
    'aulas',
    () => {
      loadData()
    },
    !!user,
  )
  useRealtime(
    'quiz_perguntas',
    () => {
      loadData()
    },
    !!user,
  )

  const toggleLesson = useCallback(
    async (trackId: string, lessonId: string) => {
      if (!user) return
      const isCompleted = (completedLessons[trackId] || new Set<string>()).has(lessonId)
      setCompletedLessons((prev) => {
        const trackSet = new Set(prev[trackId] || [])
        if (trackSet.has(lessonId)) trackSet.delete(lessonId)
        else trackSet.add(lessonId)
        return { ...prev, [trackId]: trackSet }
      })
      try {
        await toggleProgresso(user.id, trackId, lessonId, !isCompleted)
      } catch {
        setCompletedLessons((prev) => {
          const trackSet = new Set(prev[trackId] || [])
          if (isCompleted) trackSet.add(lessonId)
          else trackSet.delete(lessonId)
          return { ...prev, [trackId]: trackSet }
        })
      }
    },
    [user, completedLessons],
  )

  const isLessonCompleted = useCallback(
    (trackId: string, lessonId: string) =>
      (completedLessons[trackId] || new Set<string>()).has(lessonId),
    [completedLessons],
  )

  const getCompletedCount = useCallback(
    (trackId: string) => {
      const track = tracks.find((t) => t.id === trackId)
      if (!track) return { completed: 0, total: 0 }
      const completed = completedLessons[trackId] || new Set<string>()
      return { completed: completed.size, total: track.lessons.length }
    },
    [tracks, completedLessons],
  )

  const getTrackProgress = useCallback(
    (trackId: string) => {
      const { completed, total } = getCompletedCount(trackId)
      return total > 0 ? Math.round((completed / total) * 100) : 0
    },
    [getCompletedCount],
  )

  const setQuizResult = useCallback(
    async (trackId: string, score: number, approved: boolean): Promise<string | null> => {
      if (!user) return null
      const code = approved ? generateCertCode() : null
      setQuizStates((prev) => ({
        ...prev,
        [trackId]: { result: approved ? 'approved' : 'failed', score, certificateCode: code },
      }))
      try {
        const track = tracks.find((t) => t.id === trackId)
        const totalQuestions = track?.quiz.length || 5
        const correct = Math.round((score / 100) * totalQuestions)
        await saveQuizResult(user.id, trackId, correct, totalQuestions, approved)
      } catch {
        /* intentionally ignored */
      }
      return code
    },
    [user, tracks],
  )

  const resetQuiz = useCallback((trackId: string) => {
    setQuizStates((prev) => ({
      ...prev,
      [trackId]: { result: 'pending', score: 0, certificateCode: null },
    }))
  }, [])

  const getQuizState = useCallback(
    (trackId: string): QuizState =>
      quizStates[trackId] || { result: 'pending', score: 0, certificateCode: null },
    [quizStates],
  )

  const tracksWithProgress = useMemo(() => {
    return tracks.map((track) => {
      const { completed, total } = getCompletedCount(track.id)
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0
      return { ...track, completedCount: completed, totalLessons: total, progress }
    })
  }, [tracks, getCompletedCount])

  const createTrack = useCallback(
    async (data: { titulo: string; descricao: string; ordem: number }) => {
      const newTrack = await createTrilha(data)
      await loadData()
      return newTrack
    },
    [loadData],
  )

  const updateTrack = useCallback(
    async (id: string, data: Partial<{ titulo: string; descricao: string; ordem: number }>) => {
      const updated = await updateTrilha(id, data)
      await loadData()
      return updated
    },
    [loadData],
  )

  const deleteTrack = useCallback(
    async (id: string) => {
      await deleteTrilha(id)
      await loadData()
    },
    [loadData],
  )

  const createLesson = useCallback(
    async (data: { trilhaId: string; titulo: string; urlVideo: string; ordem?: number }) => {
      const aula = await createAula(data)
      await loadData()
      return aula
    },
    [loadData],
  )

  const updateLesson = useCallback(
    async (
      id: string,
      data: Partial<{ trilhaId: string; titulo: string; urlVideo: string; ordem: number }>,
    ) => {
      const aula = await updateAula(id, data)
      await loadData()
      return aula
    },
    [loadData],
  )

  const deleteLesson = useCallback(
    async (id: string) => {
      await deleteAula(id)
      await loadData()
    },
    [loadData],
  )

  const copyLessonToTrack = useCallback(
    async (lessonId: string, targetTrackId: string) => {
      const lesson = tracks.flatMap((t) => t.lessons).find((l) => l.id === lessonId)
      if (!lesson) return
      const targetTrack = tracks.find((t) => t.id === targetTrackId)
      const nextOrdem = targetTrack ? targetTrack.lessons.length + 1 : 1
      await createAula({
        trilhaId: targetTrackId,
        titulo: lesson.titulo,
        urlVideo: lesson.urlVideo,
        ordem: nextOrdem,
      })
      await loadData()
    },
    [tracks, loadData],
  )

  const createQuizQuestion = useCallback(
    async (data: {
      trilhaId: string
      pergunta: string
      opcoes: string[]
      respostaCorreta: string
      ordem?: number
    }) => {
      const result = await createQuizPergunta(data)
      await loadData()
      return result
    },
    [loadData],
  )

  const updateQuizQuestion = useCallback(
    async (
      id: string,
      data: Partial<{
        pergunta: string
        opcoes: string[]
        respostaCorreta: string
        ordem: number
      }>,
    ) => {
      const result = await updateQuizPergunta(id, data)
      await loadData()
      return result
    },
    [loadData],
  )

  const deleteQuizQuestion = useCallback(
    async (id: string) => {
      await deleteQuizPergunta(id)
      await loadData()
    },
    [loadData],
  )

  const getQuizPerguntasForTrack = useCallback(
    (trackId: string): QuizPergunta[] =>
      quizPerguntas.filter((p) => p.trilhaId === trackId).sort((a, b) => a.ordem - b.ordem),
    [quizPerguntas],
  )

  return {
    tracks: tracks as readonly TrackWithLessons[],
    tracksWithProgress,
    toggleLesson,
    isLessonCompleted,
    getTrackProgress,
    getCompletedCount,
    setQuizResult,
    resetQuiz,
    getQuizState,
    createTrack,
    updateTrack,
    deleteTrack,
    createLesson,
    updateLesson,
    deleteLesson,
    copyLessonToTrack,
    createQuizQuestion,
    updateQuizQuestion,
    deleteQuizQuestion,
    getQuizPerguntasForTrack,
    loading,
    error,
  }
}
