import React from 'react'
import { FileText, ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

export default function DfdsPage() {
  const navigate = useNavigate()

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-[#1c2a3e]">Diagramas de Fluxo de Dados (DFDs)</h2>
          <p className="text-sm text-gray-500">
            Mapeamento dos fluxos de processos administrativos e jurídicos das prefeituras.
          </p>
        </div>
      </div>

      <Card className="bg-white border-0 shadow-subtle p-12 text-center">
        <CardContent className="space-y-4 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#3b82f6] flex items-center justify-center">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#1c2a3e]">Módulo DFDs em Construção</h3>
          <p className="text-sm text-gray-500 max-w-md">
            Em breve você poderá visualizar, criar e exportar os fluxogramas técnicos e documentais
            exigidos nos procedimentos municipais.
          </p>
          <Button onClick={() => navigate('/bussola')} className="bg-[#3b82f6] text-white mt-2">
            Ir para a Bússola de Projetos
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
