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
import { TenantRequiredNotice } from '@/components/TenantRequiredNotice'

export default function NovoDfdPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const editId = searchParams.get('id')

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

  const isSuperadminWithoutTenant = user?.role === 'superadmin' && !user?.tenantId
  if (isSuperadminWithoutTenant) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <TenantRequiredNotice
          title="Selecione uma prefeitura para elaborar um DFD"
          description="A elaboração e consulta de DFDs pertencem a uma prefeitura específica. Como superadministrador na visão global, selecione um município para continuar."
          onSelected={() => loadDfds()}
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3.5 min-w-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/dfds')}
            className="h-9 w-9 border-slate-300 shrink-0"
            aria-label="Voltar para a lista de DFDs"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-[#1c2a3e] tracking-tight truncate">
              {editId ? 'Editar DFD' : 'Novo DFD'}
            </h1>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5">
              Documento de Formalização de Demanda — Lei nº 14.133/2021
            </p>
          </div>
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
