import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DfdForm } from '@/components/DfdForm'
import { RecentDfdsList } from '@/components/RecentDfdsList'
import { DfdRecord } from '@/types/dfd'
import { useAuth } from '@/context/AuthContext'
import { getRecentDfds, getDfd } from '@/services/dfds'
import { useRealtime } from '@/hooks/use-realtime'
import { Skeleton } from '@/components/ui/skeleton'

export default function NovoDfdPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('id')
  const { user } = useAuth()

  const [recentDfds, setRecentDfds] = useState<DfdRecord[]>([])
  const [editingDfd, setEditingDfd] = useState<DfdRecord | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDfds = useCallback(async () => {
    try {
      const tenantFilter = user?.role === 'superadmin' ? undefined : user?.tenantId || undefined
      const dfds = await getRecentDfds(tenantFilter, 5)
      setRecentDfds(dfds)
    } catch {
      // ignore
    }
  }, [user?.role, user?.tenantId])

  useEffect(() => {
    loadDfds().finally(() => setLoading(false))
  }, [loadDfds])

  useEffect(() => {
    if (editId) {
      getDfd(editId)
        .then(setEditingDfd)
        .catch(() => setEditingDfd(null))
    } else {
      setEditingDfd(null)
    }
  }, [editId])

  useRealtime(
    'dfds',
    () => {
      loadDfds()
    },
    true,
  )

  const handleEditDfd = (dfd: DfdRecord) => {
    navigate(`/novo-dfd?id=${dfd.id}`)
  }

  const handleDfdSaved = () => {
    loadDfds()
    if (editId) navigate('/novo-dfd')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/dfds')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-[#1c2a3e]">
            {editId ? 'Editar DFD' : 'Novo DFD'}
          </h2>
          <p className="text-sm text-gray-500">
            Documento de Formalização de Demanda — Lei nº 14.133/2021
          </p>
        </div>
      </div>

      <DfdForm key={editingDfd?.id || 'new'} dfd={editingDfd} onDfdSaved={handleDfdSaved} />

      {loading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : (
        <RecentDfdsList dfds={recentDfds} onEdit={handleEditDfd} />
      )}
    </div>
  )
}
