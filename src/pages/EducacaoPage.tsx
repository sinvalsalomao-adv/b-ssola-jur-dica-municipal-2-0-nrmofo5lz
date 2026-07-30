import React from 'react'
import { GraduationCap, ArrowLeft, BookOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

export default function EducacaoPage() {
  const navigate = useNavigate()

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-[#1c2a3e]">Módulo de Educação e Capacitação</h2>
          <p className="text-sm text-gray-500">
            Treinamentos jurídicos e licitatórios para servidores públicos municipais.
          </p>
        </div>
      </div>

      <Card className="bg-white border-0 shadow-subtle p-12 text-center">
        <CardContent className="space-y-4 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#1c2a3e]">Módulo de Treinamento em Construção</h3>
          <p className="text-sm text-gray-500 max-w-md">
            Cursos sobre a Nova Lei de Licitações (Lei 14.133/21), REURB e gestão pública estarão
            disponíveis aqui em breve.
          </p>
          <Button onClick={() => navigate('/dashboard')} className="bg-[#3b82f6] text-white mt-2">
            Voltar ao Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
