import React, { useEffect, useMemo, useState } from 'react'
import { Loader2, RotateCcw, Search, UserRoundCog } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface ProfileOption {
  id: string
  name: string
  email: string
  role: string
  prefeitura: string
}

interface ProfileSwitcherDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProfileSwitcherDialog({ open, onOpenChange }: ProfileSwitcherDialogProps) {
  const navigate = useNavigate()
  const { user, isImpersonating, switchProfile, restoreProfile } = useAuth()
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    pb.collection('users')
      .getFullList({
        filter: 'status = "ativo" && role != "superadmin"',
        expand: 'tenant',
        sort: 'name',
      })
      .then((records) => {
        setProfiles(
          records.map((record: any) => ({
            id: record.id,
            name: record.name || record.email || 'Usuário',
            email: record.email || '',
            role: record.role || 'servidor',
            prefeitura: record.expand?.tenant?.name || 'Sem prefeitura',
          })),
        )
      })
      .catch(() => toast.error('Não foi possível carregar os perfis.'))
      .finally(() => setLoading(false))
  }, [open])

  const filteredProfiles = useMemo(() => {
    const term = search.toLowerCase().trim()
    if (!term) return profiles
    return profiles.filter(
      (profile) =>
        profile.name.toLowerCase().includes(term) ||
        profile.email.toLowerCase().includes(term) ||
        profile.prefeitura.toLowerCase().includes(term),
    )
  }, [profiles, search])

  const handleSwitch = async (profile: ProfileOption) => {
    setSwitchingId(profile.id)
    try {
      await switchProfile(profile.id)
      toast.success(`Perfil alterado para ${profile.name}.`)
      onOpenChange(false)
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível alterar o perfil.')
    } finally {
      setSwitchingId(null)
    }
  }

  const handleRestore = () => {
    restoreProfile()
    onOpenChange(false)
    navigate('/superadmin')
    toast.success('Perfil de Superadmin restaurado.')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1c2a3e]">
            <UserRoundCog className="w-5 h-5 text-[#3b82f6]" />
            Alterar perfil
          </DialogTitle>
          <DialogDescription>
            Escolha um usuário para visualizar o sistema com o perfil e a prefeitura dele.
          </DialogDescription>
        </DialogHeader>

        {isImpersonating && (
          <Button
            variant="outline"
            onClick={handleRestore}
            className="justify-start border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Voltar ao perfil de Superadmin
          </Button>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, e-mail ou prefeitura"
            className="pl-9"
          />
        </div>

        <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Carregando perfis...
            </div>
          ) : filteredProfiles.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">Nenhum perfil encontrado.</p>
          ) : (
            filteredProfiles.map((profile) => (
              <button
                type="button"
                key={profile.id}
                disabled={switchingId !== null || profile.id === user?.id}
                onClick={() => handleSwitch(profile)}
                className="w-full flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-default transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm text-[#1c2a3e] truncate">{profile.name}</p>
                  <p className="text-xs text-gray-500 truncate">{profile.email}</p>
                  <p className="text-xs text-gray-400 truncate">{profile.prefeitura}</p>
                </div>
                <Badge variant="secondary" className="capitalize shrink-0">
                  {profile.role}
                </Badge>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
