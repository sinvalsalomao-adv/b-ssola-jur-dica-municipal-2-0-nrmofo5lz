import React from 'react'
import { Building2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const { tenants } = useProjects()
  const { confirmTenantSwitch } = useUnsavedChanges()

  const handleSelectTenant = (tenantId: string) => {
    confirmTenantSwitch(async () => {
      await setTenantContext(tenantId)
      onSelected?.(tenantId)
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
        <Select onValueChange={handleSelectTenant}>
          <SelectTrigger className="w-full h-11 bg-slate-50 border-gray-200">
            <SelectValue placeholder="Selecione uma prefeitura..." />
          </SelectTrigger>
          <SelectContent>
            {tenants.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                {tenant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-[11px] text-gray-400">
          Você também pode alternar o contexto de prefeitura a qualquer momento pelo menu superior.
        </p>
      </div>
    </div>
  )
}
