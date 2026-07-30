import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { Project, ColumnType } from '@/types/project'
import { useAuth } from '@/context/AuthContext'
import {
  getProjects,
  createProject as createProjectApi,
  updateProject as updateProjectApi,
  deleteProject as deleteProjectApi,
  getTenants,
  createAuditLog,
} from '@/services/projects'
import { useRealtime } from '@/hooks/use-realtime'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'

interface TenantInfo {
  id: string
  name: string
}

interface ProjectContextType {
  projects: Project[]
  loading: boolean
  saving: boolean
  error: string | null
  tenants: TenantInfo[]
  selectedCity: string
  setSelectedCity: (city: string) => void
  selectedProject: Project | null
  setSelectedProject: (project: Project | null) => void
  isSidePanelOpen: boolean
  setIsSidePanelOpen: (open: boolean) => void
  isNewModalOpen: boolean
  setIsNewModalOpen: (open: boolean) => void
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  moveProjectColumn: (id: string, newColumn: ColumnType) => Promise<void>
  openProjectDetails: (project: Project) => void
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'

  const [projects, setProjects] = useState<Project[]>([])
  const [tenants, setTenants] = useState<TenantInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCity, setSelectedCityRaw] = useState<string>('Todas as Prefeituras')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)

  const loadProjects = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await getProjects(user.tenantId || undefined)
      setProjects(data)
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    if (isAuthenticated) {
      getTenants()
        .then(setTenants)
        .catch(() => {})
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isSuperadmin && user?.prefeitura) {
      setSelectedCityRaw(user.prefeitura)
    } else if (isSuperadmin) {
      setSelectedCityRaw('Todas as Prefeituras')
    }
  }, [isSuperadmin, user])

  useRealtime(
    'projects',
    () => {
      loadProjects()
    },
    isAuthenticated,
  )

  const setSelectedCity = (city: string) => {
    if (!isSuperadmin) return
    setSelectedCityRaw(city)
  }

  const resolveTenantId = (prefeituraName: string): string => {
    // 1. Check user auth record
    const userTenant = pb.authStore.record?.tenant || user?.tenantId || user?.tenant
    if (!isSuperadmin && userTenant) {
      return typeof userTenant === 'string' ? userTenant : userTenant.id
    }

    // 2. Try finding by prefeituraName in loaded tenants list
    if (prefeituraName) {
      const tenant = tenants.find(
        (t) =>
          t.name.toLowerCase() === prefeituraName.toLowerCase() ||
          t.name.toLowerCase().includes(prefeituraName.toLowerCase()) ||
          prefeituraName.toLowerCase().includes(t.name.toLowerCase()) ||
          t.id === prefeituraName,
      )
      if (tenant) return tenant.id
    }

    // 3. Fallback to auth record
    if (userTenant) {
      return typeof userTenant === 'string' ? userTenant : userTenant.id
    }

    // 4. Fallback to first tenant
    if (tenants.length > 0) return tenants[0].id

    return ''
  }

  const addProject = async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    setSaving(true)
    setError(null)
    try {
      let tenantId = resolveTenantId(data.prefeitura)

      // Fallback: if tenants list was not loaded yet, fetch now
      if (!tenantId) {
        const fetchedTenants = await getTenants()
        setTenants(fetchedTenants)
        if (fetchedTenants.length > 0) {
          const match = fetchedTenants.find(
            (t) =>
              t.name.toLowerCase().includes(data.prefeitura.toLowerCase()) ||
              data.prefeitura.toLowerCase().includes(t.name.toLowerCase()),
          )
          tenantId = match ? match.id : fetchedTenants[0].id
        }
      }

      const authTenant = pb.authStore.record?.tenant || user?.tenantId || user?.tenant
      if (!tenantId && authTenant) {
        tenantId = typeof authTenant === 'string' ? authTenant : authTenant.id
      }

      if (!tenantId) {
        throw new Error('Prefeitura (tenant) não identificada. Por favor, tente novamente.')
      }

      const pbData: Record<string, any> = {
        titulo: data.title,
        descricao: data.description || '',
        prazo: data.deadline
          ? data.deadline.includes('T') || data.deadline.includes(' ')
            ? data.deadline
            : `${data.deadline} 12:00:00.000Z`
          : null,
        priority: data.priority || 'Média',
        coluna_kanban: data.column || 'Ideação',
        objeto: data.objeto || '',
        justificativa: data.justificativa || '',
        tenant: tenantId,
      }

      if (
        data.responsibleUserId &&
        data.responsibleUserId.trim() !== '' &&
        data.responsibleUserId !== 'none'
      ) {
        pbData.responsible_user = data.responsibleUserId.trim()
      }

      const newProj = await createProjectApi(pbData)
      setProjects((prev) => [newProj, ...prev])

      // Record Audit Log
      await createAuditLog({
        userName: user?.name || user?.email || 'Usuário',
        actionType: 'Criou card',
        description: `Criou o projeto na etapa '${data.column || 'Ideação'}' com prioridade ${data.priority || 'Média'}`,
        projectTitle: data.title,
        tenantId,
      })

      return newProj
    } catch (err) {
      setError(getErrorMessage(err))
      throw err
    } finally {
      setSaving(false)
    }
  }

  const updateProject = async (id: string, updates: Partial<Project>) => {
    setSaving(true)
    setError(null)
    try {
      const existing = projects.find((p) => p.id === id)
      const pbData: Record<string, any> = {}
      const changes: string[] = []

      if (updates.title !== undefined && updates.title !== existing?.title) {
        pbData.titulo = updates.title
        changes.push(`Título alterado para '${updates.title}'`)
      }
      if (updates.description !== undefined && updates.description !== existing?.description) {
        pbData.descricao = updates.description
        changes.push('Descrição atualizada')
      }
      if (updates.deadline !== undefined && updates.deadline !== existing?.deadline) {
        pbData.prazo = updates.deadline
          ? updates.deadline.includes('T') || updates.deadline.includes(' ')
            ? updates.deadline
            : `${updates.deadline} 12:00:00.000Z`
          : null
        changes.push(`Prazo alterado para ${updates.deadline}`)
      }
      if (updates.priority !== undefined && updates.priority !== existing?.priority) {
        pbData.priority = updates.priority
        changes.push(`Prioridade de ${existing?.priority} para ${updates.priority}`)
      }
      if (updates.column !== undefined && updates.column !== existing?.column) {
        pbData.coluna_kanban = updates.column
        changes.push(`Etapa de '${existing?.column}' para '${updates.column}'`)
      }
      if (updates.objeto !== undefined) pbData.objeto = updates.objeto
      if (updates.justificativa !== undefined) pbData.justificativa = updates.justificativa
      if (updates.responsibleUserId !== undefined) {
        pbData.responsible_user =
          updates.responsibleUserId &&
          updates.responsibleUserId.trim() !== '' &&
          updates.responsibleUserId !== 'none'
            ? updates.responsibleUserId.trim()
            : null
        changes.push('Responsável atualizado')
      }

      const updated = await updateProjectApi(id, pbData)
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)))
      if (selectedProject?.id === id) setSelectedProject(updated)

      // Audit Log
      const tenantId = resolveTenantId(updated.prefeitura) || pb.authStore.record?.tenant
      if (tenantId && changes.length > 0) {
        const resolvedId = typeof tenantId === 'string' ? tenantId : tenantId.id
        await createAuditLog({
          userName: user?.name || user?.email || 'Usuário',
          actionType:
            updates.column && updates.column !== existing?.column ? 'Moveu card' : 'Editou card',
          description: changes.join(', '),
          projectTitle: updated.title,
          tenantId: resolvedId,
        })
      }
    } catch (err) {
      setError(getErrorMessage(err))
      throw err
    } finally {
      setSaving(false)
    }
  }

  const deleteProject = async (id: string) => {
    setSaving(true)
    setError(null)
    try {
      await deleteProjectApi(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
      if (selectedProject?.id === id) {
        setSelectedProject(null)
        setIsSidePanelOpen(false)
      }
    } catch (err) {
      setError(getErrorMessage(err))
      throw err
    } finally {
      setSaving(false)
    }
  }

  const moveProjectColumn = async (id: string, newColumn: ColumnType) => {
    const existing = projects.find((p) => p.id === id)
    const oldColumn = existing?.column || 'Ideação'

    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, column: newColumn } : p)))
    try {
      const updated = await updateProjectApi(id, { coluna_kanban: newColumn })
      const tenantId = resolveTenantId(updated.prefeitura) || pb.authStore.record?.tenant
      if (tenantId) {
        const resolvedId = typeof tenantId === 'string' ? tenantId : tenantId.id
        await createAuditLog({
          userName: user?.name || user?.email || 'Usuário',
          actionType: 'Moveu card',
          description: `Moveu o card de '${oldColumn}' para '${newColumn}'`,
          projectTitle: updated.title,
          tenantId: resolvedId,
        })
      }
    } catch (err) {
      loadProjects()
      setError(getErrorMessage(err))
      toast.error('Erro ao mover card: ' + getErrorMessage(err))
    }
  }

  const openProjectDetails = (project: Project) => {
    setSelectedProject(project)
    setIsSidePanelOpen(true)
  }

  return (
    <ProjectContext.Provider
      value={{
        projects,
        loading,
        saving,
        error,
        tenants,
        selectedCity,
        setSelectedCity,
        selectedProject,
        setSelectedProject,
        isSidePanelOpen,
        setIsSidePanelOpen,
        isNewModalOpen,
        setIsNewModalOpen,
        addProject,
        updateProject,
        deleteProject,
        moveProjectColumn,
        openProjectDetails,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export const useProjects = () => {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider')
  }
  return context
}
