import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Compass,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/context/AuthContext'
import { acceptInvitation, declineInvitation } from '@/services/invitations'

// Token em memória durante a sessão da tela (transitório, nunca persistido em storage/analytics/logs)
let memoryInvitationToken = ''

export function setTransientInviteToken(token: string) {
  memoryInvitationToken = token
}

export function getTransientInviteToken(): string {
  return memoryInvitationToken
}

export function clearTransientInviteToken() {
  memoryInvitationToken = ''
}

type InviteUIState =
  | 'extracting'
  | 'needs_login'
  | 'pending'
  | 'processing'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'used'
  | 'invalid'

export default function ConvitePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, login, loading: authLoading } = useAuth()

  const [uiState, setUiState] = useState<InviteUIState>('extracting')
  const [tokenPresent, setTokenPresent] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [acceptedMembership, setAcceptedMembership] = useState<any>(null)

  // Login form states (quando o usuário precisa autenticar como titular)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginSubmitting, setLoginSubmitting] = useState(false)
  const [loginError, setLoginError] = useState('')

  const hasExtracted = useRef(false)

  // 1. Extração segura do token do fragmento (#token=... ou #/convite?token=...)
  useEffect(() => {
    if (hasExtracted.current) return
    hasExtracted.current = true

    let extractedToken = ''

    // A. Verifica fragmento (hash)
    const hash = window.location.hash || ''
    if (hash) {
      const matchToken = hash.match(/(?:#|\?|&)(?:token|inviteToken)=([a-zA-Z0-9_-]+)/)
      if (matchToken && matchToken[1]) {
        extractedToken = matchToken[1].trim()
      }
    }

    // B. Fallback caso venha por query param (por links legados)
    if (!extractedToken) {
      const searchParams = new URLSearchParams(window.location.search)
      const qToken = searchParams.get('token') || searchParams.get('inviteToken')
      if (qToken) {
        extractedToken = qToken.trim()
      }
    }

    // C. Remove IMEDIATAMENTE da barra de endereços via history.replaceState
    try {
      window.history.replaceState(null, '', window.location.pathname)
    } catch {
      /* ignore */
    }

    if (extractedToken && extractedToken.length >= 16) {
      setTransientInviteToken(extractedToken)
      setTokenPresent(true)
    } else {
      const existingInMemory = getTransientInviteToken()
      if (existingInMemory && existingInMemory.length >= 16) {
        setTokenPresent(true)
      } else {
        setUiState('invalid')
      }
    }
  }, [location])

  // 2. Controle de autenticação e transição de estados da UI
  useEffect(() => {
    if (authLoading) return

    const activeToken = getTransientInviteToken()
    if (!activeToken) {
      if (uiState !== 'accepted' && uiState !== 'rejected') {
        setUiState('invalid')
      }
      return
    }

    if (!isAuthenticated || !user) {
      setUiState('needs_login')
    } else {
      if (uiState === 'extracting' || uiState === 'needs_login' || uiState === 'invalid') {
        setUiState('pending')
      }
    }
  }, [isAuthenticated, user, authLoading, tokenPresent, uiState])

  // Submissão do login inline para autenticar o titular
  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoginSubmitting(true)

    try {
      const { error: err } = await login(email, password)
      if (err) {
        setLoginError(err.message || 'Credenciais inválidas. Verifique seu e-mail e senha.')
      } else {
        setUiState('pending')
      }
    } catch (err: any) {
      setLoginError('Erro ao realizar autenticação.')
    } finally {
      setLoginSubmitting(false)
    }
  }

  // Ação de Aceitar Convite
  const handleAccept = async () => {
    const activeToken = getTransientInviteToken()
    if (!activeToken) {
      setUiState('invalid')
      return
    }

    setUiState('processing')
    setErrorMessage('')

    try {
      const res = await acceptInvitation({ token: activeToken })
      if (res.success) {
        clearTransientInviteToken()
        setAcceptedMembership(res.membership || null)
        setSuccessMessage(res.message || 'Convite aceito com sucesso! Vínculo ativado.')
        setUiState('accepted')
      } else {
        setUiState('invalid')
      }
    } catch (err: any) {
      const status = err?.status
      const msg = String(err?.response?.message || err?.message || '').toLowerCase()

      if (status === 403) {
        setErrorMessage(
          'Apenas o titular do e-mail convidado pode aceitar este convite. Por favor, conecte-se com a conta correspondente.',
        )
        setUiState('invalid')
      } else if (msg.includes('expirado') || msg.includes('expired')) {
        clearTransientInviteToken()
        setUiState('expired')
      } else if (msg.includes('utilizado') || msg.includes('used')) {
        clearTransientInviteToken()
        setUiState('used')
      } else {
        clearTransientInviteToken()
        setUiState('invalid')
      }
    }
  }

  // Ação de Recusar Convite
  const handleDecline = async () => {
    const activeToken = getTransientInviteToken()
    if (!activeToken) {
      setUiState('invalid')
      return
    }

    setUiState('processing')
    setErrorMessage('')

    try {
      const res = await declineInvitation({ token: activeToken })
      clearTransientInviteToken()
      if (res.success) {
        setSuccessMessage('Convite recusado com sucesso. Nenhum vínculo municipal foi ativado.')
        setUiState('rejected')
      } else {
        setUiState('invalid')
      }
    } catch (err: any) {
      clearTransientInviteToken()
      if (err?.status === 403) {
        setErrorMessage('Apenas o destinatário do convite pode recusá-lo.')
        setUiState('invalid')
      } else {
        setUiState('rejected')
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1c2a3e] px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header institucional */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-14 h-14 rounded-xl bg-[#3b82f6] flex items-center justify-center shadow-lg mb-3">
            <Compass className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Bússola Jurídica Municipal
          </h1>
          <p className="text-sm text-[#c8d6e5] mt-1">Vínculo Seguro de Identidade Municipal</p>
        </div>

        {/* 1. ESTADO: EXTRAINDO / CARREGANDO */}
        {(uiState === 'extracting' || (authLoading && uiState !== 'invalid')) && (
          <Card className="shadow-xl border-gray-200">
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
              <p className="text-sm text-gray-600">Verificando credenciais de acesso seguro...</p>
            </CardContent>
          </Card>
        )}

        {/* 2. ESTADO: EXIGE LOGIN DO TITULAR */}
        {uiState === 'needs_login' && (
          <Card className="shadow-xl border-gray-200">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 text-[#3b82f6] flex items-center justify-center mb-2">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg text-[#1c2a3e]">Autenticação do Titular</CardTitle>
              <CardDescription className="text-xs">
                Para aceitar ou gerenciar este convite, confirme sua identidade efetuando login.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <form onSubmit={handleInlineLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium text-[#1c2a3e]">
                    E-mail do Titular
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu.email@orgao.gov.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="pl-9 h-10 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-medium text-[#1c2a3e]">
                    Senha de Acesso
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
                      className="pl-9 h-10 text-sm"
                    />
                  </div>
                </div>

                {loginError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                    {loginError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loginSubmitting}
                  className="w-full h-10 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium"
                >
                  {loginSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Autenticando...
                    </>
                  ) : (
                    'Entrar e Prosseguir'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* 3. ESTADO: PENDENTE (Autenticado, pronto para Aceitar ou Recusar) */}
        {uiState === 'pending' && (
          <Card className="shadow-xl border-gray-200">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 text-[#3b82f6] flex items-center justify-center mb-2">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex justify-center mb-1">
                <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50/50">
                  Convite Pendente
                </Badge>
              </div>
              <CardTitle className="text-lg text-[#1c2a3e]">
                Convite de Integração Municipal
              </CardTitle>
              <CardDescription className="text-xs">
                Conectado como <strong className="text-gray-700">{user?.email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 space-y-4">
              <p className="text-xs text-gray-600 text-center">
                Você recebeu um convite para vincular sua conta à equipe municipal. Deseja aceitar o
                vínculo e ingressar no sistema com segurança?
              </p>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={handleAccept}
                  className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium h-10"
                >
                  Aceitar Convite e Vincular
                </Button>
                <Button
                  onClick={handleDecline}
                  variant="outline"
                  className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 h-10"
                >
                  Recusar Convite
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 4. ESTADO: PROCESSANDO AÇÃO */}
        {uiState === 'processing' && (
          <Card className="shadow-xl border-gray-200">
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
              <p className="text-sm text-gray-700 font-medium">
                Processando solicitação de convite com segurança...
              </p>
            </CardContent>
          </Card>
        )}

        {/* 5. ESTADO: ACEITO COM SUCESSO */}
        {uiState === 'accepted' && (
          <Card className="shadow-xl border-gray-200">
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-[#1c2a3e]">Convite Aceito com Sucesso!</h2>
                <p className="text-xs text-gray-600">
                  {successMessage || 'Seu vínculo municipal foi ativado e confirmado com êxito.'}
                </p>
                {acceptedMembership?.tenantName && (
                  <p className="text-xs font-semibold text-[#3b82f6] pt-1">
                    Município: {acceptedMembership.tenantName}
                  </p>
                )}
              </div>
              <Button
                onClick={() => navigate('/dashboard')}
                className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium mt-2"
              >
                Acessar Painel de Controle
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 6. ESTADO: RECUSADO */}
        {uiState === 'rejected' && (
          <Card className="shadow-xl border-gray-200">
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                <XCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-[#1c2a3e]">Convite Recusado</h2>
                <p className="text-xs text-gray-600">
                  {successMessage ||
                    'Você recusou o convite. Nenhum acesso ou vínculo adicional foi concedido.'}
                </p>
              </div>
              <Button
                onClick={() => navigate('/login')}
                variant="outline"
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 mt-2"
              >
                Retornar ao Início
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 7. ESTADO: EXPIRADO */}
        {uiState === 'expired' && (
          <Card className="shadow-xl border-gray-200">
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-[#1c2a3e]">Convite Expirado</h2>
                <p className="text-xs text-gray-600">
                  Este link de convite ultrapassou o período de validade de 48 horas.
                </p>
                <p className="text-xs text-gray-500 pt-1">
                  Solicite ao Administrador do município a emissão de um novo convite.
                </p>
              </div>
              <Button
                onClick={() => navigate('/login')}
                variant="outline"
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 mt-2"
              >
                Voltar à Página Principal
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 8. ESTADO: JÁ UTILIZADO */}
        {uiState === 'used' && (
          <Card className="shadow-xl border-gray-200">
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-[#3b82f6] flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-[#1c2a3e]">Convite Já Utilizado</h2>
                <p className="text-xs text-gray-600">
                  Este convite de uso único já foi processado anteriormente.
                </p>
              </div>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium mt-2"
              >
                Efetuar Login
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 9. ESTADO: INVÁLIDO OU ERRO GENÉRICO (SEM ENUMERAÇÃO/SEM VAZAR PII) */}
        {uiState === 'invalid' && (
          <Card className="shadow-xl border-gray-200">
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-[#1c2a3e]">
                  Convite Inválido ou Inacessível
                </h2>
                <p className="text-xs text-gray-600">
                  {errorMessage ||
                    'O link informado é inválido, inexistente, expirou ou já foi processado.'}
                </p>
              </div>
              <Button
                onClick={() => navigate('/login')}
                variant="outline"
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 mt-2"
              >
                Ir para o Início
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-[#c8d6e5] mt-6">
          © 2026 Bússola Jurídica Municipal. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
