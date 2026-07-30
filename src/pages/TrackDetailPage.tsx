import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Circle, FileQuestion } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useEducation } from '@/context/EducationContext'

export default function TrackDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tracks, toggleLesson, isLessonCompleted, getCompletedCount, getQuizState } =
    useEducation()

  const track = tracks.find((t) => t.id === id)

  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-gray-500">Trilha não encontrada.</p>
        <Button onClick={() => navigate('/educacao')} variant="outline">
          Voltar para Educação
        </Button>
      </div>
    )
  }

  const { completed, total } = getCompletedCount(track.id)
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0
  const quizState = getQuizState(track.id)

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/educacao')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-[#1c2a3e]">{track.title}</h2>
          <p className="text-sm text-gray-500">{track.description}</p>
        </div>
      </div>

      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#1c2a3e]">Progresso da Trilha</span>
            <span className="text-sm font-bold text-[#3b82f6]">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2.5 bg-gray-100" />
          <p className="text-xs text-gray-400 mt-1.5">
            {completed} de {total} aulas concluídas
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {track.lessons.map((lesson, index) => {
          const done = isLessonCompleted(track.id, lesson.id)
          return (
            <Card
              key={lesson.id}
              className={`bg-white border shadow-sm overflow-hidden transition-all duration-200 ${
                done ? 'border-emerald-200' : 'border-gray-100'
              }`}
            >
              <CardContent className="p-0">
                <div className="p-4 flex items-start gap-3 border-b border-gray-50">
                  <div className="mt-0.5">
                    {done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-[#1c2a3e]">{lesson.title}</h3>
                    {done && (
                      <Badge className="mt-1 bg-emerald-50 text-emerald-700 border-0 text-[10px]">
                        Concluído
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-gray-50">
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      className="absolute top-0 left-0 w-full h-full rounded-lg"
                      src={`https://www.youtube.com/embed/${lesson.youtubeId}`}
                      title={lesson.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>

                <div className="p-4 pt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant={done ? 'outline' : 'default'}
                    onClick={() => toggleLesson(track.id, lesson.id)}
                    className={
                      done
                        ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                        : 'bg-[#3b82f6] hover:bg-[#2563eb] text-white'
                    }
                  >
                    {done ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Concluído
                      </>
                    ) : (
                      'Marcar como Concluído'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="pt-2">
        <Button
          onClick={() => navigate(`/educacao/trilha/${track.id}/quiz`)}
          className="w-full bg-[#1c2a3e] hover:bg-[#2a3f5f] text-white gap-2"
        >
          <FileQuestion className="w-4 h-4" />
          {quizState.result === 'approved' ? 'Refazer Quiz' : 'Fazer Quiz'}
        </Button>
      </div>
    </div>
  )
}
