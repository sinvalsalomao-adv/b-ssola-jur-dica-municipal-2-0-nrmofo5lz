import React, { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { DfdForm } from '@/components/DfdForm'
import { RecentDfdsList } from '@/components/RecentDfdsList'
import { MOCK_RECENT_DFDs } from '@/data/mockDfds'
import { DfdRecord } from '@/types/dfd'

export default function NovoDfdPage() {
  const navigate = useNavigate()
  const [recentDfds, setRecentDfds] = useState<DfdRecord[]>(MOCK_RECENT_DFDs)

  const handleDfdCreated = (dfd: DfdRecord) => {
    setRecentDfds((prev) => [dfd, ...prev])
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/dfds')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-[#1c2a3e]">Novo DFD</h2>
          <p className="text-sm text-gray-500">
            Documento de Formalização de Demanda — Lei nº 14.133/2021
          </p>
        </div>
      </div>

      <DfdForm onDfdCreated={handleDfdCreated} />
      <RecentDfdsList dfds={recentDfds} />
    </div>
  )
}
