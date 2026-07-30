import { useState, useCallback, useMemo } from 'react'
import { MOCK_TRACKS, type Track } from '@/data/mockEducation'

export type QuizResult = 'pending' | 'approved' | 'failed'

export interface QuizState {
  result: QuizResult
  score: number
  certificateCode: string | null
}

export function useEducationStore() {
  const [completedLessons, setCompletedLessons] = useState<Record<string, Set<string>>>(() => ({
    'trilha-1': new Set(['l1-1', 'l1-2']),
    'trilha-2': new Set<string>(),
    'trilha-3': new Set<string>(),
  }))

  const [quizStates, setQuizStates] = useState<Record<string, QuizState>>({
    'trilha-1': { result: 'pending', score: 0, certificateCode: null },
    'trilha-2': { result: 'pending', score: 0, certificateCode: null },
    'trilha-3': { result: 'pending', score: 0, certificateCode: null },
  })

  const toggleLesson = useCallback((trackId: string, lessonId: string) => {
    setCompletedLessons((prev) => {
      const trackSet = new Set(prev[trackId] || [])
      if (trackSet.has(lessonId)) {
        trackSet.delete(lessonId)
      } else {
        trackSet.add(lessonId)
      }
      return { ...prev, [trackId]: trackSet }
    })
  }, [])

  const isLessonCompleted = useCallback(
    (trackId: string, lessonId: string) => {
      return (completedLessons[trackId] || new Set<string>()).has(lessonId)
    },
    [completedLessons],
  )

  const getTrackProgress = useCallback(
    (trackId: string) => {
      const track = MOCK_TRACKS.find((t) => t.id === trackId)
      if (!track) return 0
      const completed = completedLessons[trackId] || new Set<string>()
      return Math.round((completed.size / track.lessons.length) * 100)
    },
    [completedLessons],
  )

  const getCompletedCount = useCallback(
    (trackId: string) => {
      const track = MOCK_TRACKS.find((t) => t.id === trackId)
      if (!track) return { completed: 0, total: 0 }
      const completed = completedLessons[trackId] || new Set<string>()
      return { completed: completed.size, total: track.lessons.length }
    },
    [completedLessons],
  )

  const setQuizResult = useCallback((trackId: string, score: number, approved: boolean) => {
    const code = approved
      ? 'BRZ-' +
        Math.random().toString(36).substring(2, 6).toUpperCase() +
        '-' +
        Math.random().toString(36).substring(2, 6).toUpperCase()
      : null
    setQuizStates((prev) => ({
      ...prev,
      [trackId]: {
        result: approved ? 'approved' : 'failed',
        score,
        certificateCode: code,
      },
    }))
    return code
  }, [])

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
    return MOCK_TRACKS.map((track) => {
      const { completed, total } = getCompletedCount(track.id)
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0
      return { ...track, completedCount: completed, totalLessons: total, progress }
    })
  }, [completedLessons, getCompletedCount])

  return {
    tracks: MOCK_TRACKS as readonly Track[],
    tracksWithProgress,
    toggleLesson,
    isLessonCompleted,
    getTrackProgress,
    getCompletedCount,
    setQuizResult,
    resetQuiz,
    getQuizState,
  }
}
