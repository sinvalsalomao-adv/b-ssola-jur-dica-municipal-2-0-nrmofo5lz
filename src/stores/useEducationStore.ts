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
} from '@/services/education'
import { QUIZ_DATA } from '@/data/quizData'
import type { TrackWithLessons, QuizState } from '@/types/education'

function generateCertCode(): string {
  return (
    'BRZ-' +
    Math.random().toString(36).substring(2, 6).toUpperCase() +
    '-' +
    Math.random().toString(36).substring(2, 6).toUpperCase()
  )
}

export function useEducationStore() {
  const { user } = useAuth()
  const [tracks, setTracks] = useState<TrackWithLessons[]>([])
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
      const [trilhas, allAulas, progresso, quizResults] = await Promise.all([
        getTrilhas(),
        getAllAulas(),
        getProgresso(user.id),
        getQuizResults(user.id),
      ])

      const tracksWithLessons: TrackWithLessons[] = trilhas.map((t) => ({
        ...t,
        lessons: allAulas.filter((a) => a.trilhaId === t.id),
        quiz: QUIZ_DATA[t.titulo] || [],
      }))

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
        // silent fail — local state already updated
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
    loading,
    error,
  }
}
