import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ProjectProvider } from '@/context/ProjectContext'
import { EducationProvider } from '@/context/EducationContext'
import TrackDetailPage from '@/pages/TrackDetailPage'
import QuizPage from '@/pages/QuizPage'

import { MainLayout } from '@/components/MainLayout'
import Dashboard from '@/pages/Dashboard'
import BussolaKanban from '@/pages/BussolaKanban'
import DfdsPage from '@/pages/DfdsPage'
import NovoDfdPage from '@/pages/NovoDfdPage'
import EducacaoPage from '@/pages/EducacaoPage'
import UsuariosPage from '@/pages/UsuariosPage'
import NotFound from '@/pages/NotFound'

const App = () => (
  <BrowserRouter>
    <ProjectProvider>
      <EducationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-right" />
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/bussola" element={<BussolaKanban />} />
              <Route path="/dfds" element={<DfdsPage />} />
              <Route path="/novo-dfd" element={<NovoDfdPage />} />
              <Route path="/educacao" element={<EducacaoPage />} />
              <Route path="/educacao/trilha/:id" element={<TrackDetailPage />} />
              <Route path="/educacao/trilha/:id/quiz" element={<QuizPage />} />
              <Route path="/usuarios" element={<UsuariosPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </EducationProvider>
    </ProjectProvider>
  </BrowserRouter>
)

export default App
