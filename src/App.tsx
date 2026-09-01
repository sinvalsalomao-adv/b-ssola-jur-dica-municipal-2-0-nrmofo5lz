import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/context/AuthContext'
import { ProjectProvider } from '@/context/ProjectContext'
import { EducationProvider } from '@/context/EducationContext'
import TrackDetailPage from '@/pages/TrackDetailPage'
import QuizPage from '@/pages/QuizPage'
import SuperadminPage from '@/pages/SuperadminPage'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import AdminAuditLogsPage from '@/pages/AdminAuditLogsPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'

import { MainLayout } from '@/components/MainLayout'
import AcademiaGroupsManager from '@/components/academia/AcademiaGroupsManager'
import LoginPage from '@/pages/LoginPage'
import OrgLoginPage from '@/pages/OrgLoginPage'
import PublicRegisterPage from '@/pages/PublicRegisterPage'
import ConvitePage from '@/pages/ConvitePage'
import Dashboard from '@/pages/Dashboard'

import BussolaKanban from '@/pages/BussolaKanban'
import ControlePage from '@/pages/ControlePage'
import DfdsPage from '@/pages/DfdsPage'
import DfdDetailPage from '@/pages/DfdDetailPage'
import NovoDfdPage from '@/pages/NovoDfdPage'
import EducacaoPage from '@/pages/EducacaoPage'
import UsuariosPage from '@/pages/UsuariosPage'
import RelatoriosPage from '@/pages/RelatoriosPage'
import NotificacoesPage from '@/pages/NotificacoesPage'
import ConfiguracoesPage from '@/pages/ConfiguracoesPage'
import PerfilPage from '@/pages/PerfilPage'
import NotFound from '@/pages/NotFound'

const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
          <EducationProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner position="top-right" />
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/login/:slug" element={<OrgLoginPage />} />
                <Route path="/cadastro/:slug" element={<PublicRegisterPage />} />
                <Route path="/convite" element={<ConvitePage />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/bussola" element={<BussolaKanban />} />
                  <Route path="/controle" element={<ControlePage />} />
                  <Route path="/dfds" element={<DfdsPage />} />
                  <Route path="/dfds/:id" element={<DfdDetailPage />} />
                  <Route path="/novo-dfd" element={<NovoDfdPage />} />
                  <Route path="/educacao" element={<EducacaoPage />} />
                  <Route path="/educacao/grupos" element={<AcademiaGroupsManager />} />
                  <Route path="/educacao/trilha/:id" element={<TrackDetailPage />} />
                  <Route path="/educacao/trilha/:id/quiz" element={<QuizPage />} />
                  <Route path="/usuarios" element={<UsuariosPage />} />
                  <Route path="/relatorios" element={<RelatoriosPage />} />
                  <Route path="/notificacoes" element={<NotificacoesPage />} />
                  <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                  <Route path="/perfil" element={<PerfilPage />} />
                  <Route path="/audit-logs" element={<AdminAuditLogsPage />} />
                  <Route path="/superadmin" element={<SuperadminPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </EducationProvider>
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
)

export default App
