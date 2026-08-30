import React, { useState, useEffect } from 'react'
import { useProjects } from '@/context/ProjectContext'
import { useAuth } from '@/context/AuthContext'
import { COLUMNS, PREFEITURAS, ColumnType, Priority } from '@/types/project'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Trash2,
  Save,
  Calendar,
  User,
  Building2,
  Flag,
  Loader2,
  History,
  Clock,
  CheckSquare,
  FileText,
} from 'lucide-react'
import { getUsers } from '@/services/users'
import { getAuditLogsByProjectTitle } from '@/services/projects'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { formatDate, normalizeDateForInput } from '@/lib/dateUtils'
import { MessageSquare } from 'lucide-react'
import { ProjectChecklistSection } from '@/components/ProjectChecklistSection'
import { ProjectDocumentsSection } from '@/components/ProjectDocumentsSection'
import { ProjectCommentsSection } from '@/components/ProjectCommentsSection'
import { ProjectParticipantsSection } from '@/components/ProjectParticipantsSection'

interface AuditEntry {
  id: string
  userName: string
  actionType: string
  description: string
  projectTitle: string
  dateTime: string
}

export const ProjectSidePanel: React.FC = () => {
  const {
    selectedProject,
    isSidePanelOpen,
    setIsSidePanelOpen,
    updateProject,
    deleteProject,
    saving,
  } = useProjects()
  const { user } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'

  const [activeTab, setActiveTab] = useState<
    'details' | 'checklist' | 'documents' | 'comments' | 'history'
  >('details')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [responsibleUserId, setResponsibleUserId] = useState('')
  const [users, setUsers] = useState<
    {
      id: string
      name: string
      email?: string
      role?: string
      avatar?: string | null
      status?: string
    }[]
  >([])
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState<Priority>('Média')
  const [prefeitura, setPrefeitura] = useState('Florânia')
  const [column, setColumn] = useState<ColumnType>('Ideação')
  const [objeto, setObjeto] = useState('')
  const [justificativa, setJustificativa] = useState('')

  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    if (isSidePanelOpen) {
      getUsers()
        .then((data) =>
          setUsers(
            data.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              status: u.status,
            })),
          ),
        )
        .catch(() => {})
    }
  }, [isSidePanelOpen])

  useEffect(() => {
    if (selectedProject) {
      setTitle(selectedProject.title)
      setDescription(selectedProject.description || '')
      setResponsibleUserId(selectedProject.responsibleUserId || '')
      setDeadline(normalizeDateForInput(selectedProject.deadline))
      setPriority(selectedProject.priority)
      setPrefeitura(selectedProject.prefeitura)
      setColumn(selectedProject.column)
      setObjeto(selectedProject.objeto || '')
      setJustificativa(selectedProject.justificativa || '')

      loadHistory(selectedProject.title)
    }
  }, [selectedProject])

  // Escutar evento global de abertura direta de aba (ex: via notificação de menção)
  useEffect(() => {
    const handleSwitchTab = (e: CustomEvent<{ tab: string }>) => {
      if (
        e.detail?.tab &&
        ['details', 'checklist', 'documents', 'comments', 'history'].includes(e.detail.tab)
      ) {
        setActiveTab(e.detail.tab as 'details' | 'checklist' | 'documents' | 'comments' | 'history')
      }
    }
    window.addEventListener('openProjectSidePanelTab' as any, handleSwitchTab)
    return () => {
      window.removeEventListener('openProjectSidePanelTab' as any, handleSwitchTab)
    }
  }, [])

  const loadHistory = async (projectTitle: string) => {
    setLoadingHistory(true)
    try {
      const logs = await getAuditLogsByProjectTitle(projectTitle, user?.tenantId || undefined)
      setAuditLogs(logs as AuditEntry[])
    } catch {
      setAuditLogs([])
    } finally {
      setLoadingHistory(false)
    }
  }

  if (!selectedProject) return null

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('O título do projeto não pode ficar em branco.')
      return
    }
    try {
      await updateProject(selectedProject.id, {
        title: title.trim(),
        description,
        responsibleUserId,
        deadline,
        priority,
        prefeitura,
        column,
        objeto,
        justificativa,
      })
      toast.success('Projeto atualizado!')
      loadHistory(title.trim())
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este projeto?')) return
    try {
      await deleteProject(selectedProject.id)
      toast.success('Projeto removido.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const formattedCreated = formatDate(selectedProject.createdAt, '-')
  const formattedUpdated = formatDate(selectedProject.updatedAt, '-')

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'Criou card':
        return <Badge className="bg-emerald-500 text-white text-[10px]">Criou card</Badge>
      case 'Moveu card':
        return <Badge className="bg-blue-500 text-white text-[10px]">Moveu</Badge>
      case 'Adicionou documento':
        return <Badge className="bg-blue-600 text-white text-[10px]">Doc Anexado</Badge>
      case 'Nova versão documento':
        return <Badge className="bg-violet-600 text-white text-[10px]">Nova Versão</Badge>
      case 'Arquivou documento':
        return <Badge className="bg-amber-600 text-white text-[10px]">Doc Arquivado</Badge>
      case 'Restaurou documento':
        return <Badge className="bg-emerald-600 text-white text-[10px]">Doc Restaurado</Badge>
      case 'Visualizou documento':
        return <Badge className="bg-sky-500 text-white text-[10px]">Visualizou</Badge>
      case 'Baixou documento':
        return <Badge className="bg-slate-600 text-white text-[10px]">Baixou</Badge>
      case 'Adicionou participante':
        return <Badge className="bg-cyan-600 text-white text-[10px]">Participante</Badge>
      case 'Removeu participante':
        return <Badge className="bg-rose-600 text-white text-[10px]">Part. Removido</Badge>
      case 'Criou comentário':
      case 'Criou resposta':
        return <Badge className="bg-indigo-600 text-white text-[10px]">Comentou</Badge>
      case 'Editou comentário':
      case 'Editou resposta':
        return <Badge className="bg-violet-600 text-white text-[10px]">Editou Coment.</Badge>
      case 'Removeu comentário':
      case 'Removeu resposta':
        return <Badge className="bg-rose-500 text-white text-[10px]">Remov. Coment.</Badge>
      case 'Mencionou usuário':
        return <Badge className="bg-blue-600 text-white text-[10px]">Mencionou</Badge>
      default:
        return <Badge className="bg-amber-500 text-white text-[10px]">Editou</Badge>
    }
  }

  return (
    <Sheet open={isSidePanelOpen} onOpenChange={setIsSidePanelOpen}>
      <SheetContent className="w-full sm:max-w-[480px] bg-white p-6 overflow-y-auto flex flex-col justify-between">
        <div>
          <SheetHeader className="text-left border-b pb-3 mb-3">
            <div className="flex items-center justify-between mb-1">
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                {prefeitura}
              </Badge>
              <Badge
                className={
                  priority === 'Alta'
                    ? 'bg-red-500 text-white'
                    : priority === 'Média'
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-500 text-white'
                }
              >
                {priority}
              </Badge>
            </div>
            <SheetTitle className="text-lg font-bold text-[#1c2a3e]">
              Detalhes do Projeto
            </SheetTitle>
            <SheetDescription className="text-xs text-gray-500">
              ID: {selectedProject.id} • Criado em {formattedCreated}
            </SheetDescription>
          </SheetHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) =>
              setActiveTab(v as 'details' | 'checklist' | 'documents' | 'comments' | 'history')
            }
          >
            {/* Ordem estrita exigida: Detalhes | Checklist | Documentos | Comentários | Histórico */}
            <TabsList className="grid grid-cols-5 mb-4">
              <TabsTrigger value="details" className="text-xs px-1">
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="checklist" className="text-xs flex items-center gap-1 px-1">
                <CheckSquare className="w-3 h-3" />
                <span className="hidden sm:inline">Checklist</span>
                <span className="sm:hidden">Check</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-xs flex items-center gap-1 px-1">
                <FileText className="w-3 h-3" />
                <span className="hidden sm:inline">Documentos</span>
                <span className="sm:hidden">Docs</span>
              </TabsTrigger>
              <TabsTrigger value="comments" className="text-xs flex items-center gap-1 px-1">
                <MessageSquare className="w-3 h-3" />
                <span className="hidden sm:inline">Comentários</span>
                <span className="sm:hidden">Coment.</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs flex items-center gap-1 px-1">
                <History className="w-3 h-3" />
                <span className="hidden sm:inline">Histórico</span>
                <span className="sm:hidden">Hist.</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Título</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 text-sm font-medium"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 min-h-[70px] text-sm text-gray-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-gray-500" /> Responsável Principal
                  </Label>
                  <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-500" /> Prazo
                  </Label>
                  <Input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              {/* Seção de Participantes separada do Responsável Principal */}
              <ProjectParticipantsSection
                project={selectedProject}
                tenantUsers={users}
                onHistoryUpdate={() => loadHistory(title.trim() || selectedProject.title)}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-gray-500" /> Prefeitura
                  </Label>
                  <Select value={prefeitura} onValueChange={setPrefeitura} disabled={!isSuperadmin}>
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PREFEITURAS.map((pref) => (
                        <SelectItem key={pref} value={pref}>
                          {pref}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <Flag className="w-3.5 h-3.5 text-gray-500" /> Prioridade
                  </Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alta">Alta</SelectItem>
                      <SelectItem value="Média">Média</SelectItem>
                      <SelectItem value="Baixa">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Etapa Atual</Label>
                <Select value={column} onValueChange={(v) => setColumn(v as ColumnType)}>
                  <SelectTrigger className="mt-1 bg-slate-50 font-medium text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Objeto do Projeto</Label>
                <Textarea
                  value={objeto}
                  onChange={(e) => setObjeto(e.target.value)}
                  placeholder="Detalhamento do objeto..."
                  className="mt-1 min-h-[50px] text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Justificativa</Label>
                <Textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Justificativa de interesse público..."
                  className="mt-1 min-h-[50px] text-xs"
                />
              </div>

              <div className="pt-1 text-[11px] text-gray-400">
                Última atualização: {formattedUpdated}
              </div>
            </TabsContent>

            <TabsContent value="checklist" className="space-y-4">
              <ProjectChecklistSection
                project={selectedProject}
                users={users}
                onHistoryUpdate={() => loadHistory(title.trim() || selectedProject.title)}
              />
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <ProjectDocumentsSection
                project={selectedProject}
                onHistoryUpdate={() => loadHistory(title.trim() || selectedProject.title)}
              />
            </TabsContent>

            <TabsContent value="comments" className="space-y-4">
              <ProjectCommentsSection
                project={selectedProject}
                tenantUsers={users}
                onHistoryUpdate={() => loadHistory(title.trim() || selectedProject.title)}
              />
            </TabsContent>

            <TabsContent value="history" className="space-y-3">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-500">
                  <Clock className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  Nenhum registro de alteração encontrado para este projeto.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {auditLogs.map((log) => {
                    const formattedDate = log.dateTime
                      ? new Date(log.dateTime).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''
                    return (
                      <div
                        key={log.id}
                        className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <span>{log.userName}</span>
                            {getActionBadge(log.actionType)}
                          </div>
                          <span className="text-[10px] text-gray-400">{formattedDate}</span>
                        </div>
                        <p className="text-slate-600 leading-snug">{log.description}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <SheetFooter className="border-t pt-4 mt-6 flex-row justify-between items-center space-x-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={saving}
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            title="Excluir projeto"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
          </Button>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setIsSidePanelOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-1.5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
