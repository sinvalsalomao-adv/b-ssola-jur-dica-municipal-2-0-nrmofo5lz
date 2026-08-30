import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react'
import { Project, ColumnType, Priority } from '@/types/project'
import {
  getProjects,
  createProject as createProjectService,
  updateProject as updateProjectService,
  deleteProject as deleteProjectService,
  getTenants,
  createAuditLog,
} from '@/services/projects'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'

export interface NewProjectData {
  title: string
  description?: string
  responsible?: string
  responsibleUserId?: string
  deadline?: string
  column?: ColumnType
  prefeitura?: string
  tenantId?: string
  priority?: Priority
  objeto?: string
  justificativa?: string
}

interface ProjectContextType {
  projects: Project[]
  tenants: { id: string; name: string }[]
  loading: boolean
  saving: boolean
  error: string | null
  selectedCity: string
  setSelectedCity: (city: string) => void
  selectedProject: Project | null
  setSelectedProject: (project: Project | null) => void
  isNewModalOpen: boolean
  setIsNewModalOpen: (open: boolean) => void
  isSidePanelOpen: boolean
  setIsSidePanelOpen: (open: boolean) => void
  openProjectDetails: (project: Project) => void
  addProject: (data: NewProjectData) => Promise<Project>
  updateProject: (id: string, data: Partial<NewProjectData>) => Promise<Project>
  moveProjectColumn: (id: string, targetColumn: ColumnType) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  refreshProjects: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export const useProjects = () => {
  const context = useContext(ProjectContext)
  if (!context) throw new Error('useProjects must be used within a ProjectProvider')
  return context
}

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<string>('Todas as Prefeituras')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)

  const fetchTenants = useCallback(async () => {
    try {
      const list = await getTenants()
      setTenants(list)
    } catch (err) {
      console.error('Erro ao carregar prefeituras:', err)
    }
  }, [])

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tenantFilter = user?.role === 'superadmin' ? undefined : user?.tenantId || undefined
      const data = await getProjects(tenantFilter)
      setProjects(data)
    } catch (err: any) {
      console.error('Erro ao carregar projetos:', err)
      setError(err?.message || 'Falha ao carregar projetos.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useRealtime('projects', () => {
    fetchProjects()
  })

  const openProjectDetails = (project: Project) => {
    setSelectedProject(project)
    setIsSidePanelOpen(true)
  }

  // Ouvir evento customizado para abrir projeto específico e opcionalmente selecionar aba
  useEffect(() => {
    const handleOpenProjectById = (e: any) => {
      const { projectId, tab } = e.detail || {}
      if (!projectId) return

      const target = projects.find((p) => p.id === projectId)
      if (target) {
        setSelectedProject(target)
        setIsSidePanelOpen(true)
        if (tab) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('openProjectSidePanelTab', { detail: { tab } }))
          }, 50)
        }
      }
    }

    window.addEventListener('openProjectById', handleOpenProjectById)
    return () => {
      window.removeEventListener('openProjectById', handleOpenProjectById)
    }
  }, [projects])

  const resolveTenantId = async (
    inputTenantId?: string,
    prefeituraName?: string,
  ): Promise<string> => {
    if (inputTenantId && inputTenantId.trim() !== '') return inputTenantId
    if (user?.tenantId && user.tenantId.trim() !== '') return user.tenantId

    const currentTenants = tenants.length > 0 ? tenants : await getTenants().catch(() => [])
    if (currentTenants.length > 0 && tenants.length === 0) {
      setTenants(currentTenants)
    }

    if (prefeituraName) {
      const prefLower = prefeituraName.toLowerCase().trim()
      const found = currentTenants.find(
        (t) =>
          t.name.toLowerCase().trim() === prefLower ||
          t.name.toLowerCase().includes(prefLower) ||
          prefLower.includes(t.name.toLowerCase()),
      )
      if (found) return found.id
    }

    if (currentTenants.length > 0) return currentTenants[0].id

    try {
      const pbModule = await import('@/lib/pocketbase/client')
      const pb = pbModule.default
      const first = await pb.collection('tenants').getFirstListItem('', { requestKey: null })
      if (first?.id) return first.id
    } catch (e) {
      console.error('Nenhum tenant encontrado:', e)
    }

    throw new Error(
      'Prefeitura (tenant) não identificada. Por favor, selecione uma Prefeitura válida.',
    )
  }

  const addProject = async (data: NewProjectData): Promise<Project> => {
    setSaving(true)
    try {
      const tenantId = await resolveTenantId(data.tenantId, data.prefeitura)
      if (!tenantId) {
        throw new Error('Não foi possível identificar a Prefeitura (Tenant) correspondente.')
      }

      const pbData: Record<string, any> = {
        titulo: data.title.trim(),
        descricao: data.description?.trim() || '',
        prazo: data.deadline
          ? data.deadline.includes(' ') || data.deadline.includes('T')
            ? data.deadline
            : `${data.deadline} 00:00:00.000Z`
          : null,
        coluna_kanban: data.column || 'Ideação',
        priority: data.priority || 'Média',
        tenant: tenantId,
        objeto: data.objeto?.trim() || '',
        justificativa: data.justificativa?.trim() || '',
      }

      if (
        data.responsibleUserId &&
        data.responsibleUserId !== 'none' &&
        data.responsibleUserId.trim() !== ''
      ) {
        pbData.responsible_user = data.responsibleUserId
      }

      const created = await createProjectService(pbData)

      if (!created || !created.id) {
        throw new Error('Retorno inválido ao criar projeto.')
      }

      await createAuditLog({
        userName: user?.name || 'Usuário',
        actionType: 'Criou card',
        description: `Criou o projeto "${created.title}" na etapa "${created.column}"`,
        projectTitle: created.title,
        tenantId: tenantId,
      })

      setProjects((prev) => {
        const cleaned = (prev || []).filter((p) => p && p.id && p.id !== created.id)
        return [created, ...cleaned]
      })

      return created
    } catch (err) {
      console.error('Erro em addProject:', err)
      throw err
    } finally {
      setSaving(false)
    }
  }

  const updateProject = async (id: string, data: Partial<NewProjectData>): Promise<Project> => {
    setSaving(true)
    try {
      const existing = projects.find((p) => p.id === id)
      const tenantId = await resolveTenantId(data.tenantId, data.prefeitura || existing?.prefeitura)

      const pbData: Record<string, any> = {}
      if (data.title !== undefined) pbData.titulo = data.title
      if (data.description !== undefined) pbData.descricao = data.description
      if (data.responsibleUserId !== undefined)
        pbData.responsible_user = data.responsibleUserId || null
      if (data.deadline !== undefined) {
        pbData.prazo = data.deadline
          ? data.deadline.includes(' ') || data.deadline.includes('T')
            ? data.deadline
            : `${data.deadline} 00:00:00.000Z`
          : null
      }
      if (data.column !== undefined) pbData.coluna_kanban = data.column
      if (data.priority !== undefined) pbData.priority = data.priority
      if (data.objeto !== undefined) pbData.objeto = data.objeto
      if (data.justificativa !== undefined) pbData.justificativa = data.justificativa
      if (tenantId) pbData.tenant = tenantId

      const updated = await updateProjectService(id, pbData)

      const changes: string[] = []
      if (data.title && existing && data.title !== existing.title)
        changes.push(`título para "${data.title}"`)
      if (data.column && existing && data.column !== existing.column)
        changes.push(`etapa de "${existing.column}" para "${data.column}"`)
      if (data.priority && existing && data.priority !== existing.priority)
        changes.push(`prioridade para "${data.priority}"`)

      const desc =
        changes.length > 0 ? `Alterou ${changes.join(', ')}` : `Atualizou os dados do projeto`

      await createAuditLog({
        userName: user?.name || 'Usuário',
        actionType:
          data.column && existing && data.column !== existing.column ? 'Moveu card' : 'Editou card',
        description: desc,
        projectTitle: updated.title,
        tenantId: tenantId,
      })

      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)))
      if (selectedProject?.id === id) {
        setSelectedProject(updated)
      }
      return updated
    } finally {
      setSaving(false)
    }
  }

  const moveProjectColumn = async (id: string, targetColumn: ColumnType): Promise<void> => {
    const existing = projects.find((p) => p.id === id)
    if (!existing || existing.column === targetColumn) return

    const oldColumn = existing.column
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, column: targetColumn } : p)))

    try {
      const tenantId = await resolveTenantId(undefined, existing.prefeitura)
      await updateProjectService(id, { coluna_kanban: targetColumn })

      await createAuditLog({
        userName: user?.name || 'Usuário',
        actionType: 'Moveu card',
        description: `Alterou a etapa de "${oldColumn}" para "${targetColumn}"`,
        projectTitle: existing.title,
        tenantId: tenantId,
      })
    } catch (err) {
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, column: oldColumn } : p)))
      throw err
    }
  }

  const deleteProject = async (id: string): Promise<void> => {
    setSaving(true)
    try {
      await deleteProjectService(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
      if (selectedProject?.id === id) {
        setSelectedProject(null)
        setIsSidePanelOpen(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProjectContext.Provider
      value={{
        projects,
        tenants,
        loading,
        saving,
        error,
        selectedCity,
        setSelectedCity,
        selectedProject,
        setSelectedProject,
        isNewModalOpen,
        setIsNewModalOpen,
        isSidePanelOpen,
        setIsSidePanelOpen,
        openProjectDetails,
        addProject,
        updateProject,
        moveProjectColumn,
        deleteProject,
        refreshProjects: fetchProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}
