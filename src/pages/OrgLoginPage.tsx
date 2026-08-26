import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Lock, Mail, ArrowLeft, MapPin, Building2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import pb from '@/lib/pocketbase/client'
import { getOrganizacaoBySlug, type Organizacao } from '@/services/organizacoes'

export default function OrgLoginPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { login } = useAuth()

  const [org, setOrg] = useState<Organizacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [failedAttempts, setFailedAttempts] = useState(0)
  const isLocked = failedAttempts >= 3

  useEffect(() => {
    if (!slug) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setNotFound(false)
    setError('')
    setOrg(null)
    getOrganizacaoBySlug(slug)
      .then((data) => {
        setOrg(data)
      })
      .catch((err: any) => {
        if (err?.status === 404) {
          setNotFound(true)
        } else {
          setError('Erro ao carregar organização. Tente novamente.')
        }
      })
      .finally(() => setLoading(false))
  }, [slug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLocked) return
    setError('')
    setSubmitting(true)
    const { error: loginError } = await login(email, password)
    if (loginError) {
      const newAttempts = failedAttempts + 1
      setFailedAttempts(newAttempts)
      if (newAttempts >= 3) {
        setError('Muitas tentativas. Aguarde 15 minutos.')
      } else {
        setError('Email ou senha incorretos. Tente novamente.')
      }
      setSubmitting(false)
    } else {
      setFailedAttempts(0)
      const role = (pb.authStore.record as any)?.role || 'servidor'
      if (role === 'superadmin') {
        navigate('/superadmin')
      } else {
        navigate('/dashboard')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1c2a3e]">
        <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1c2a3e] px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Organização não encontrada</h2>
          <p className="text-sm text-[#c8d6e5] mb-6">
            A organização que você procura não existe ou não está ativa.
          </p>
          <Button
            onClick={() => navigate('/login')}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  if (error && !org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1c2a3e] px-4">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <Button
            onClick={() => navigate('/login')}
            variant="outline"
            className="text-white border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1c2a3e] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          {org?.brasao ? (
            <img
              src={org.brasao}
              alt={org.nome}
              className="w-20 h-20 rounded-xl object-contain bg-white/10 p-2 mb-3"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-[#3b82f6] flex items-center justify-center shadow-lg mb-3">
              <Building2 className="w-10 h-10 text-white" />
            </div>
          )}
          <h1 className="text-xl font-bold text-white text-center">{org?.nome}</h1>
          {org?.cidade && org?.estado && (
            <p className="text-sm text-[#c8d6e5] mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {org.cidade} - {org.estado}
            </p>
          )}
        </div>

        <Card className="shadow-xl border-gray-200">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-[#1c2a3e]">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="pl-9 h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-[#1c2a3e]">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pl-9 h-10"
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || isLocked}
                className="w-full h-10 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : isLocked ? (
                  'Acesso bloqueado temporariamente'
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-4">
          <button
            onClick={() => navigate('/login')}
            className="text-xs text-[#c8d6e5] hover:text-white transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Trocar organização
          </button>
        </div>

        <p className="text-center text-xs text-[#c8d6e5] mt-6">
          © 2026 Bússola Jurídica Municipal. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
