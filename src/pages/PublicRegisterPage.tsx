import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Loader2,
  Lock,
  Mail,
  User,
  ArrowLeft,
  MapPin,
  Building2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import pb from '@/lib/pocketbase/client'
import { getOrganizacaoBySlug, type Organizacao } from '@/services/organizacoes'
import { createMembership } from '@/services/memberships'
import {
  PasswordStrengthIndicator,
  validatePasswordStrength,
} from '@/components/PasswordStrengthIndicator'
import { sanitizeInput } from '@/lib/sanitize'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import type { UserRole } from '@/types/superadmin'

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  {
    value: 'servidor',
    label: 'Servidor Público / Geral',
    desc: 'Acesso padrão aos projetos e rotinas do município',
  },
  {
    value: 'gestor',
    label: 'Gestor de Contratos / Compras',
    desc: 'Gestão e acompanhamento operacional',
  },
  { value: 'secretario', label: 'Secretário / Diretor', desc: 'Acompanhamento executivo' },
  { value: 'procurador', label: 'Procurador / Jurídico', desc: 'Emissão de pareceres e análises' },
]

export default function PublicRegisterPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [org, setOrg] = useState<Organizacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('servidor')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [generalError, setGeneralError] = useState('')

  useEffect(() => {
    if (!slug) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setNotFound(false)
    setGeneralError('')
    setOrg(null)
    getOrganizacaoBySlug(slug)
      .then((data) => {
        if (!data || !data.id) {
          setNotFound(true)
        } else {
          setOrg(data)
        }
      })
      .catch((err: any) => {
        if (err?.status === 404) {
          setNotFound(true)
        } else {
          setGeneralError('Erro ao carregar dados do município. Tente novamente.')
        }
      })
      .finally(() => setLoading(false))
  }, [slug])

  const validate = (): boolean => {
    const errs: FieldErrors = {}
    if (!name.trim()) errs.name = 'Nome completo é obrigatório.'
    if (!email.trim()) errs.email = 'Email institucional/pessoal é obrigatório.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Email inválido.'

    if (!password) {
      errs.password = 'Senha é obrigatória.'
    } else {
      const pwdVal = validatePasswordStrength(password)
      if (!pwdVal.allValid) {
        errs.password = 'A senha não atende aos critérios de segurança mínimos.'
      }
    }

    if (password !== confirmPassword) {
      errs.confirmPassword = 'As senhas não coincidem.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError('')
    if (!validate() || !org) return

    setSubmitting(true)
    try {
      const cleanEmail = sanitizeInput(email.trim().toLowerCase())
      const cleanName = sanitizeInput(name.trim())

      // 1. Verificar se o usuário global já existe pelo e-mail
      let userRecord: any = null
      try {
        const usersList = await pb.collection('users').getFullList({
          filter: `email = "${cleanEmail}"`,
        })
        if (usersList.length > 0) {
          userRecord = usersList[0]
        }
      } catch {
        /* intentionally ignored */
      }

      // 2. Se não existir, criar a conta global do usuário
      if (!userRecord) {
        userRecord = await pb.collection('users').create({
          name: cleanName,
          email: cleanEmail,
          password: password,
          passwordConfirm: confirmPassword,
          role: role,
          status: 'ativo',
          tenant: org.id,
        })
      }

      // 3. Verificar se já existe vínculo deste usuário com esta prefeitura
      const existingMemberships = await pb.collection('user_memberships').getFullList({
        filter: `user = "${userRecord.id}" && tenant = "${org.id}"`,
      })

      if (existingMemberships.length > 0) {
        const currentMem = existingMemberships[0]
        if (currentMem.status === 'ativo') {
          setGeneralError(
            'Você já possui um cadastro ativo neste município. Faça login diretamente.',
          )
          setSubmitting(false)
          return
        }
        if (currentMem.status === 'pendente') {
          setGeneralError(
            'Você já possui uma solicitação de acesso pendente de aprovação para este município.',
          )
          setSubmitting(false)
          return
        }
        // Se estava inativo ou rejeitado, reabrir como pendente
        await pb.collection('user_memberships').update(currentMem.id, {
          status: 'pendente',
          role: role,
        })
      } else {
        // 4. Criar o vínculo com status 'pendente'
        await createMembership({
          userId: userRecord.id,
          tenantId: org.id,
          role: role,
          status: 'pendente',
        })
      }

      setSuccess(true)
    } catch (err: any) {
      console.error('Erro no auto-cadastro:', err)
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) {
        setErrors(fe)
      } else {
        setGeneralError(getErrorMessage(err) || 'Erro ao processar solicitação de cadastro.')
      }
    } finally {
      setSubmitting(false)
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
          <h2 className="text-xl font-bold text-white mb-2">Município não encontrado</h2>
          <p className="text-sm text-[#c8d6e5] mb-6">
            A organização informada na URL não existe ou está inativa.
          </p>
          <Button
            onClick={() => navigate('/login')}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para o Início
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1c2a3e] px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Topo com Brasão e Identificação da Prefeitura */}
        <div className="flex flex-col items-center mb-6">
          {org?.brasao ? (
            <img
              src={org.brasao}
              alt={org.nome}
              className="w-16 h-16 rounded-xl object-contain bg-white/10 p-2 mb-2"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-[#3b82f6] flex items-center justify-center shadow-lg mb-2">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-xl font-bold text-white text-center">{org?.nome}</h1>
          {org?.cidade && org?.estado && (
            <p className="text-xs text-[#c8d6e5] mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {org.cidade} - {org.estado}
            </p>
          )}
          <span className="inline-block mt-2 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
            Auto-cadastro de Usuário
          </span>
        </div>

        <Card className="shadow-2xl border-0 bg-white rounded-2xl overflow-hidden">
          <CardContent className="pt-6 pb-8 px-6 sm:px-8">
            {success ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1c2a3e]">
                    Solicitação enviada com sucesso!
                  </h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Seu cadastro foi registrado com status <strong>Pendente</strong>. O
                    Administrador Municipal de <strong>{org?.nome}</strong> irá revisar e aprovar o
                    seu acesso.
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 text-left">
                  💡 <strong>O que acontece agora?</strong>
                  <br />
                  Assim que o Administrador aprovar seu vínculo, você poderá entrar em{' '}
                  <span className="font-semibold text-blue-900">/login/{slug}</span> com seu e-mail
                  e senha cadastrados.
                </div>
                <div className="pt-2">
                  <Button
                    onClick={() => navigate(`/login/${slug}`)}
                    className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white"
                  >
                    Voltar para o Login
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <h2 className="text-base font-bold text-[#1c2a3e]">Dados de Acesso</h2>
                  <p className="text-xs text-gray-500">
                    Preencha suas informações para solicitar acesso à plataforma municipal.
                  </p>
                </div>

                {generalError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{generalError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Nome Completo *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: João da Silva"
                      className="pl-9 h-10 text-sm"
                      required
                    />
                  </div>
                  {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.gov.br"
                      className="pl-9 h-10 text-sm"
                      required
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">
                    Perfil / Função Solicitada *
                  </Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                    <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                      <SelectTrigger className="pl-9 h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            <div className="text-left">
                              <span className="font-medium text-sm">{r.label}</span>
                              <span className="block text-[11px] text-gray-400">{r.desc}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Senha *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        className="pl-9 h-10 text-sm"
                        required
                      />
                    </div>
                    {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Confirmar Senha *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a senha"
                        className="pl-9 h-10 text-sm"
                        required
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-xs text-red-500">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>

                {password && <PasswordStrengthIndicator password={password} />}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium shadow-md transition-all mt-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando solicitação...
                    </>
                  ) : (
                    'Solicitar Cadastro'
                  )}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/login/${slug}`)}
                    className="text-xs text-gray-500 hover:text-[#3b82f6] inline-flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Já possui conta? Faça Login
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-[#c8d6e5] mt-6">
          © 2026 Bússola Jurídica Municipal • Gestão de Acessos
        </p>
      </div>
    </div>
  )
}
