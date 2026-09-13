import React from 'react'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import pb from '@/lib/pocketbase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/context/AuthContext'
import { useProjects } from '@/context/ProjectContext'
import { useUnsavedChanges } from '@/context/UnsavedChangesContext'

interface TenantRequiredNoticeProps {
  title?: string
  description?: string
  onSelected?: (tenantId: string) => void
}

export const TenantRequiredNotice: React.FC<TenantRequiredNoticeProps> = ({
  title = 'Selecione uma prefeitura para operar',
  description = 'Como superadministrador na visão global, você precisa selecionar explicitamente um município para acessar, visualizar ou cadastrar dados operacionais nesta seção.',
  onSelected,
}) => {
  const { setTenantContext } = useAuth()
  const { tenants: contextTenants } = useProjects()
  const { confirmTenantSwitch } = useUnsavedChanges()

  const [tenants, setTenants] = React.useState<{ id: string; name: string }[]>(
    contextTenants && contextTenants.length > 0 ? contextTenants : [],
  )
  const [loading, setLoading] = React.useState<boolean>(
    !contextTenants || contextTenants.length === 0,
  )
  const [error, setError] = React.useState<string | null>(null)
  const [isSelecting, setIsSelecting] = React.useState<boolean>(false)

  const loadTenants = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await pb
        .collection('tenants')
        .getFullList<{ id: string; name: string; status?: string }>({
          filter: 'status = "ativa"',
          sort: 'name',
        })
      const list = records.map((t) => ({ id: t.id, name: t.name }))
      if (list.length === 0) {
        // Fallback: se não houver filtro status="ativa" ou todos os registros não tiverem status preenchido
        const allRecords = await pb
          .collection('tenants')
          .getFullList<{ id: string; name: string }>({
            sort: 'name',
          })
        setTenants(allRecords.map((t) => ({ id: t.id, name: t.name })))
      } else {
        setTenants(list)
      }
    } catch (err: any) {
      console.error('Erro ao carregar prefeituras ativas:', err)
      // Tentar usar contextTenants como fallback caso exista
      if (contextTenants && contextTenants.length > 0) {
        setTenants(contextTenants)
      } else {
        setError(err?.message || 'Não foi possível carregar a lista de prefeituras.')
      }
    } finally {
      setLoading(false)
    }
  }, [contextTenants])

  React.useEffect(() => {
    loadTenants()
  }, [loadTenants])

  // Se contextTenants for atualizado externamente e não tivermos prefeituras locais ainda
  React.useEffect(() => {
    if (contextTenants && contextTenants.length > 0) {
      setTenants((prev) => (prev.length === 0 ? contextTenants : prev))
    }
  }, [contextTenants])

  const handleSelectTenant = (tenantId: string) => {
    if (!tenantId || isSelecting) return
    setIsSelecting(true)
    confirmTenantSwitch(async () => {
      try {
        await setTenantContext(tenantId)
        onSelected?.(tenantId)
      } catch (err: any) {
        console.error('Erro ao definir prefeitura ativa:', err)
        setError('Ocorreu uma falha ao selecionar a prefeitura. Tente novamente.')
      } finally {
        setIsSelecting(false)
      }
    })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center bg-white rounded-2xl border border-gray-100 shadow-xs max-w-2xl mx-auto my-8">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-5 text-[#3b82f6] shadow-xs">
        <Building2 className="w-8 h-8" />
      </div>

      <h3 className="text-xl font-bold text-[#1c2a3e] tracking-tight mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-md mb-6 leading-relaxed">{description}</p>

      <div className="w-full max-w-xs space-y-3">
        <label className="text-xs font-semibold text-gray-700 block text-left">
          Escolha o Município:
        </label>

        {loading ? (
          <div className="w-full h-11 bg-slate-50 border border-gray-200 rounded-md flex items-center justify-center gap-2 text-xs text-gray-500">
            <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Carregando prefeituras...</span>
          </div>
        ) : error ? (
          <div className="space-y-2 text-left">
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-md">
              {error}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadTenants}
              className="w-full text-xs h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              Tentar carregar novamente
            </Button>
          </div>
        ) : tenants.length === 0 ? (
          <div className="space-y-2 text-left">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-md">
              Nenhuma prefeitura ativa encontrada.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadTenants}
              className="w-full text-xs h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              Recarregar lista
            </Button>
          </div>
        ) : (
          <Select onValueChange={handleSelectTenant} disabled={isSelecting}>
            <SelectTrigger className="w-full h-11 bg-slate-50 border-gray-200">
              <SelectValue
                placeholder={
                  isSelecting ? 'Aplicando prefeitura...' : 'Selecione uma prefeitura...'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <p className="text-[11px] text-gray-400">
          Você também pode alternar o contexto de prefeitura a qualquer momento pelo menu superior.
        </p>
      </div>
    </div>
  )
}
