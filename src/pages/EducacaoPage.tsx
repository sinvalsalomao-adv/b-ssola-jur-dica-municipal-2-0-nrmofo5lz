import { useNavigate } from 'react-router-dom'
import { GraduationCap, ArrowLeft, Clock, PlayCircle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useEducation } from '@/context/EducationContext'

export default function EducacaoPage() {
  const navigate = useNavigate()
  const { tracksWithProgress } = useEducation()

  const cardColors = [
    { bg: 'bg-blue-50', text: 'text-[#3b82f6]', ring: 'ring-blue-100' },
    { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
    { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-[#1c2a3e]">Módulo de Educação e Capacitação</h2>
          <p className="text-sm text-gray-500">
            Trilhas de aprendizagem jurídicas e administrativas para servidores municipais.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tracksWithProgress.map((track, index) => {
          const colors = cardColors[index % cardColors.length]
          return (
            <Card
              key={track.id}
              className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden"
            >
              <CardContent className="p-0">
                <div className={`h-28 ${colors.bg} flex items-center justify-center relative`}>
                  <GraduationCap className={`w-12 h-12 ${colors.text}`} />
                  {track.progress === 100 && (
                    <Badge className="absolute top-3 right-3 bg-emerald-500 text-white border-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Concluída
                    </Badge>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="font-bold text-base text-[#1c2a3e] leading-snug min-h-[3rem]">
                      {track.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{track.description}</p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <PlayCircle className="w-3.5 h-3.5" />
                      {track.totalLessons} aulas
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />~{track.totalLessons * 15} min
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">Progresso</span>
                      <span className="font-bold text-[#1c2a3e]">{track.progress}%</span>
                    </div>
                    <Progress value={track.progress} className="h-2 bg-gray-100" />
                    <p className="text-[11px] text-gray-400">
                      {track.completedCount} de {track.totalLessons} aulas concluídas
                    </p>
                  </div>

                  <Button
                    onClick={() => navigate(`/educacao/trilha/${track.id}`)}
                    className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
                  >
                    Acessar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
