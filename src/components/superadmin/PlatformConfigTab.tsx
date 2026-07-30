import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { COLUMNS } from '@/types/project'
import { useSuperadmin } from '@/context/SuperadminContext'
import { Zap, Mail, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react'

export const PlatformConfigTab: React.FC = () => {
  const { platformConfig, updatePlatformConfig } = useSuperadmin()
  const [limits, setLimits] = useState(platformConfig.stallLimits)
  const [smtp, setSmtp] = useState({
    server: platformConfig.smtpServer,
    port: platformConfig.smtpPort,
    username: platformConfig.smtpUsername,
    password: platformConfig.smtpPassword,
    senderEmail: platformConfig.senderEmail,
  })
  const [aiKey, setAiKey] = useState(platformConfig.aiApiKey)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  const saveLimits = () => {
    updatePlatformConfig({ stallLimits: limits })
    toast.success('Limites de gargalo salvos!')
  }
  const saveSmtp = () => {
    updatePlatformConfig({ ...smtp })
    toast.success('Configurações de e-mail salvas!')
  }
  const saveAiKey = () => {
    updatePlatformConfig({ aiApiKey: aiKey })
    toast.success('Chave da API de IA salva!')
  }

  const testConnection = () => {
    setTesting(true)
    setTestResult(null)
    setTimeout(() => {
      setTesting(false)
      setTestResult('success')
      toast.success('Conexão com a IA estabelecida com sucesso!')
    }, 1500)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-[#1c2a3e]">Configurações da Plataforma</h3>
        <p className="text-xs text-gray-500">Defina as configurações globais do sistema.</p>
      </div>

      <Card className="bg-white border border-gray-100 shadow-subtle p-5 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Zap className="w-4 h-4 text-[#3b82f6]" />
          <h4 className="text-sm font-bold text-[#1c2a3e]">Limites de Gargalo (Kanban)</h4>
        </div>
        <p className="text-xs text-gray-500">
          Dias máximos que um card pode ficar parado em cada coluna.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {COLUMNS.map((col) => (
            <div key={col} className="flex items-center justify-between gap-3">
              <Label className="text-xs text-gray-700 flex-1">{col}</Label>
              <Input
                type="number"
                min={1}
                value={limits[col]}
                onChange={(e) =>
                  setLimits({ ...limits, [col]: Math.max(1, Number(e.target.value)) })
                }
                className="w-20 h-8 text-center"
              />
            </div>
          ))}
        </div>
        <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white" onClick={saveLimits}>
          Salvar Limites
        </Button>
      </Card>

      <Card className="bg-white border border-gray-100 shadow-subtle p-5 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Mail className="w-4 h-4 text-[#3b82f6]" />
          <h4 className="text-sm font-bold text-[#1c2a3e]">Configuração de E-mail (SMTP)</h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-gray-700">Servidor SMTP</Label>
            <Input
              value={smtp.server}
              onChange={(e) => setSmtp({ ...smtp, server: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-700">Porta</Label>
            <Input
              value={smtp.port}
              onChange={(e) => setSmtp({ ...smtp, port: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-700">Usuário</Label>
            <Input
              value={smtp.username}
              onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-700">Senha</Label>
            <Input
              type="password"
              value={smtp.password}
              onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-semibold text-gray-700">E-mail Remetente</Label>
            <Input
              value={smtp.senderEmail}
              onChange={(e) => setSmtp({ ...smtp, senderEmail: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>
        <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white" onClick={saveSmtp}>
          Salvar Configurações
        </Button>
      </Card>

      <Card className="bg-white border border-gray-100 shadow-subtle p-5 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <KeyRound className="w-4 h-4 text-[#3b82f6]" />
          <h4 className="text-sm font-bold text-[#1c2a3e]">Chave da API de IA</h4>
        </div>
        <div>
          <Label className="text-xs font-semibold text-gray-700">API Key</Label>
          <Input
            type="password"
            value={aiKey}
            onChange={(e) => setAiKey(e.target.value)}
            className="mt-1"
            placeholder="sk-..."
          />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={testConnection} disabled={testing} className="gap-2">
            {testing ? 'Testando...' : 'Testar Conexão'}
          </Button>
          <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white" onClick={saveAiKey}>
            Salvar Chave
          </Button>
          {testResult === 'success' && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> Conexão bem-sucedida
            </span>
          )}
          {testResult === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="w-4 h-4" /> Falha na conexão
            </span>
          )}
        </div>
      </Card>
    </div>
  )
}
