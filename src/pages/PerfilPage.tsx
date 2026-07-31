import { useState, useEffect, useRef } from 'react'
import { User, Mail, Shield, Camera, KeyRound, Loader2, Save } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/context/AuthContext'
import { updateProfileName, uploadAvatar, changePassword, getAvatarUrl } from '@/services/profile'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  servidor: 'Servidor',
  gestor: 'Gestor',
  secretario: 'Secretário',
  procurador: 'Procurador',
}

export default function PerfilPage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setEmail(user.email)
    const fetchUser = async () => {
      try {
        const record = await pb.collection('users').getOne(user.id)
        if (record.avatar) {
          setAvatarUrl(getAvatarUrl(user.id, record.avatar))
        }
      } catch {
        /* ignore */
      }
    }
    fetchUser()
  }, [user?.id])

  const handleSaveName = async () => {
    if (!user) return
    setSavingName(true)
    try {
      await updateProfileName(user.id, name)
      toast.success('Nome atualizado com sucesso!')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingName(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setSavingAvatar(true)
    try {
      await uploadAvatar(user.id, file)
      const record = await pb.collection('users').getOne(user.id)
      if (record.avatar) {
        setAvatarUrl(getAvatarUrl(user.id, record.avatar))
      }
      toast.success('Avatar atualizado com sucesso!')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingAvatar(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleChangePassword = async () => {
    if (!user) return
    if (newPwd.length < 8) {
      toast.error('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (newPwd !== confirmPwd) {
      toast.error('As senhas não coincidem.')
      return
    }
    setSavingPwd(true)
    try {
      await changePassword(email, currentPwd, newPwd)
      toast.success('Senha alterada com sucesso!')
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
    } catch {
      toast.error('Senha atual incorreta ou erro ao alterar.')
    } finally {
      setSavingPwd(false)
    }
  }

  const initials = (name || 'U')
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('')

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#1c2a3e] flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1c2a3e]">Meu Perfil</h2>
          <p className="text-sm text-gray-500">Gerencie seus dados e senha de acesso.</p>
        </div>
      </div>

      <Card className="bg-white border-0 shadow-subtle">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-20 h-20 border-2 border-gray-200">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
                <AvatarFallback className="bg-[#1c2a3e] text-white text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#3b82f6] flex items-center justify-center text-white shadow-md hover:bg-[#2563eb] transition-colors"
                disabled={savingAvatar}
              >
                {savingAvatar ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1c2a3e]">{name}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Mail className="w-3 h-3" /> {email}
              </p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3" /> {ROLE_LABELS[user?.role || 'servidor'] || user?.role}
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-xs font-semibold text-gray-700">Nome</Label>
            <div className="flex gap-2 mt-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <Button
                onClick={handleSaveName}
                disabled={savingName}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white shrink-0"
              >
                {savingName ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-0 shadow-subtle">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <KeyRound className="w-4 h-4 text-[#3b82f6]" />
            <h3 className="text-sm font-bold text-[#1c2a3e]">Redefinir Senha</h3>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Senha Atual</Label>
              <Input
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Nova Senha</Label>
                <Input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Confirmar</Label>
                <Input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={savingPwd}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
            >
              {savingPwd ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
