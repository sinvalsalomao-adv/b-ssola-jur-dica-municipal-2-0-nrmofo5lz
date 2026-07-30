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
} from '@/services/projects'
import { useRealtime } from '@/hooks/use-realtime'
import { getErrorMessage } from '@/lib/pocketbase/errors'

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
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
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
    if (isSuperadmin) {
      getTenants()
        .then(setTenants)
        .catch(() => {})
    }
  }, [isSuperadmin])

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
    if (!isSuperadmin && user?.tenantId) return user.tenantId
    const tenant = tenants.find((t) => t.name === prefeituraName)
    return tenant?.id || user?.tenantId || ''
  }

  const addProject = async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    setSaving(true)
    setError(null)
    try {
      const tenantId = resolveTenantId(data.prefeitura)
      const pbData: Record<string, any> = {
        title: data.title,
        description: data.description,
        deadline: data.deadline,
        priority: data.priority,
        column: data.column,
        objeto: data.objeto || '',
        justificativa: data.justificativa || '',
        tenant: tenantId,
        responsible_user: data.responsibleUserId || '',
      }
      const newProj = await createProjectApi(pbData)
      setProjects((prev) => [newProj, ...prev])
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
      const pbData: Record<string, any> = {}
      if (updates.title !== undefined) pbData.title = updates.title
      if (updates.description !== undefined) pbData.description = updates.description
      if (updates.deadline !== undefined) pbData.deadline = updates.deadline
      if (updates.priority !== undefined) pbData.priority = updates.priority
      if (updates.column !== undefined) pbData.column = updates.column
      if (updates.objeto !== undefined) pbData.objeto = updates.objeto
      if (updates.justificativa !== undefined) pbData.justificativa = updates.justificativa
      if (updates.responsibleUserId !== undefined)
        pbData.responsible_user = updates.responsibleUserId

      const updated = await updateProjectApi(id, pbData)
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)))
      if (selectedProject?.id === id) setSelectedProject(updated)
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
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, column: newColumn } : p)))
    try {
      await updateProjectApi(id, { column: newColumn })
    } catch (err) {
      loadProjects()
      setError(getErrorMessage(err))
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
