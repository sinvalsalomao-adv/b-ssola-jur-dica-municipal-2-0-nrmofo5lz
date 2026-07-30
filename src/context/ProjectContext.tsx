import React, { createContext, useContext, useState, ReactNode } from 'react'
import { Project, ColumnType, Prefecture } from '@/types/project'
import { INITIAL_PROJECTS } from '@/data/mockProjects'

interface ProjectContextType {
  projects: Project[]
  selectedCity: string
  setSelectedCity: (city: string) => void
  selectedProject: Project | null
  setSelectedProject: (project: Project | null) => void
  isSidePanelOpen: boolean
  setIsSidePanelOpen: (open: boolean) => void
  isNewModalOpen: boolean
  setIsNewModalOpen: (open: boolean) => void
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  moveProjectColumn: (id: string, newColumn: ColumnType) => void
  openProjectDetails: (project: Project) => void
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS)
  const [selectedCity, setSelectedCity] = useState<string>('Todas as Prefeituras')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)

  const addProject = (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString()
    const newProj: Project = {
      ...data,
      id: `proj-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    }
    setProjects((prev) => [newProj, ...prev])
  }

  const updateProject = (id: string, updates: Partial<Project>) => {
    const now = new Date().toISOString()
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, ...updates, updatedAt: now }
          if (selectedProject?.id === id) {
            setSelectedProject(updated)
          }
          return updated
        }
        return p
      }),
    )
  }

  const deleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    if (selectedProject?.id === id) {
      setSelectedProject(null)
      setIsSidePanelOpen(false)
    }
  }

  const moveProjectColumn = (id: string, newColumn: ColumnType) => {
    updateProject(id, { column: newColumn })
  }

  const openProjectDetails = (project: Project) => {
    setSelectedProject(project)
    setIsSidePanelOpen(true)
  }

  return (
    <ProjectContext.Provider
      value={{
        projects,
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
