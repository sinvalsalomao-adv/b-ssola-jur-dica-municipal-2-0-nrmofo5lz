import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, XCircle, Award, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useEducation } from '@/context/EducationContext'
import { MOCK_USER_NAME } from '@/data/mockEducation'

export default function QuizPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tracks, setQuizResult, resetQuiz } = useEducation()

  const track = useMemo(() => tracks.find((t) => t.id === id), [tracks, id])

  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [certCode, setCertCode] = useState<string | null>(null)

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

  const allAnswered = track.quiz.every((q) => answers[q.id] !== undefined)
  const approved = score >= 70

  const handleSubmit = () => {
    let correct = 0
    track.quiz.forEach((q) => {
      if (answers[q.id] === q.correctIndex) correct++
    })
    const pct = Math.round((correct / track.quiz.length) * 100)
    setScore(pct)
    setSubmitted(true)
    const code = setQuizResult(track.id, pct, pct >= 70)
    setCertCode(code)
  }

  const handleRetry = () => {
    setAnswers({})
    setSubmitted(false)
    setScore(0)
    setCertCode(null)
    resetQuiz(track.id)
  }

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(`/educacao/trilha/${track.id}`)}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-[#1c2a3e]">Quiz: {track.titulo}</h2>
          <p className="text-sm text-gray-500">
            Responda às 5 questões. Aprovação a partir de 70%.
          </p>
        </div>
      </div>

      {!submitted && (
        <div className="space-y-4">
          {track.quiz.map((q, qIndex) => (
            <Card key={q.id} className="bg-white border border-gray-100 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start gap-2 mb-4">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1c2a3e] text-white text-xs font-bold shrink-0">
                    {qIndex + 1}
                  </span>
                  <p className="font-semibold text-sm text-[#1c2a3e]">{q.question}</p>
                </div>
                <RadioGroup
                  value={answers[q.id] !== undefined ? String(answers[q.id]) : ''}
                  onValueChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: Number(val) }))}
                >
                  <div className="space-y-2 ml-8">
                    {q.options.map((opt, optIndex) => (
                      <div
                        key={optIndex}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <RadioGroupItem value={String(optIndex)} id={`${q.id}-${optIndex}`} />
                        <Label
                          htmlFor={`${q.id}-${optIndex}`}
                          className="text-sm text-gray-700 cursor-pointer flex-1"
                        >
                          {opt}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          ))}

          <Button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white disabled:bg-gray-300"
          >
            Enviar Respostas
          </Button>
          {!allAnswered && (
            <p className="text-center text-xs text-gray-400">
              Responda todas as questões para enviar.
            </p>
          )}
        </div>
      )}

      {submitted && (
        <div className="space-y-6">
          <Card
            className={`border-2 shadow-sm ${
              approved ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <CardContent className="p-8 flex flex-col items-center text-center space-y-3">
              {approved ? (
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              ) : (
                <XCircle className="w-16 h-16 text-red-500" />
              )}
              <h3
                className={`text-2xl font-bold ${approved ? 'text-emerald-700' : 'text-red-700'}`}
              >
                {approved ? 'Aprovado!' : 'Reprovado'}
              </h3>
              <p className="text-sm text-gray-600">
                Você acertou {Math.round((score / 100) * track.quiz.length)} de {track.quiz.length}{' '}
                questões ({score}%)
              </p>
              {!approved && (
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100 gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Tentar Novamente
                </Button>
              )}
            </CardContent>
          </Card>

          {approved && certCode && (
            <Card className="bg-white border-2 border-[#d4af37] shadow-lg overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-[#d4af37] via-[#f5d061] to-[#d4af37]" />
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center justify-center gap-3">
                  <Award className="w-10 h-10 text-[#d4af37]" />
                  <h3 className="text-xl font-bold text-[#1c2a3e]">Certificado de Conclusão</h3>
                </div>

                <div className="text-center space-y-1 py-4 border-y border-gray-100">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">
                    Este certificado é concedido a
                  </p>
                  <p className="text-lg font-bold text-[#1c2a3e]">{MOCK_USER_NAME}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider pt-3">
                    pela conclusão da trilha de aprendizagem
                  </p>
                  <p className="text-base font-semibold text-[#3b82f6]">{track.titulo}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Data</p>
                    <p className="font-medium text-[#1c2a3e]">{currentDate}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Nota Final</p>
                    <p className="font-medium text-[#1c2a3e]">{score}%</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                    Código de Autenticidade
                  </p>
                  <p className="font-mono font-bold text-base text-[#1c2a3e] tracking-wider">
                    {certCode}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    onClick={() => navigate('/educacao')}
                    className="flex-1 bg-[#3b82f6] hover:bg-[#2563eb] text-white"
                  >
                    Voltar às Trilhas
                  </Button>
                  <Button
                    onClick={() => navigate(`/educacao/trilha/${track.id}`)}
                    variant="outline"
                    className="flex-1 border-gray-200 text-[#1c2a3e] hover:bg-gray-50"
                  >
                    Revisar Aulas
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {approved && (
            <div className="flex justify-center">
              <Button
                onClick={handleRetry}
                variant="ghost"
                className="text-gray-500 hover:text-gray-700 gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Refazer Quiz
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
