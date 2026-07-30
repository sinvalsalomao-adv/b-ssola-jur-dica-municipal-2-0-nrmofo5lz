import React, { useState } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  KanbanSquare,
  FileText,
  Gauge,
  GraduationCap,
  Users,
  Compass,
  Menu,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  Shield,
  BarChart3,
  Settings,
  LogOut,
  User as UserIcon,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ProjectSidePanel } from '@/components/ProjectSidePanel'
import { NewProjectModal } from '@/components/NewProjectModal'
import { NotificationBell } from '@/components/NotificationBell'

export const MainLayout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const { user, logout } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'

  const handleLogout = () => {
    try {
      logout()
      setLogoutDialogOpen(false)
      navigate('/login', { replace: true })
    } catch {
      setLogoutError('Ocorreu um erro ao sair, mas sua sessão foi limpa.')
      logout()
      setLogoutDialogOpen(false)
      navigate('/login', { replace: true })
    }
  }

  const userInitials = (user?.name || 'US')
    .split(' ')
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join('')

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Bússola', path: '/bussola', icon: KanbanSquare },
    { label: 'Central de Controle', path: '/controle', icon: Gauge },
    { label: 'DFDs', path: '/dfds', icon: FileText },
    { label: 'Educação', path: '/educacao', icon: GraduationCap },
    { label: 'Usuários', path: '/usuarios', icon: Users },
    ...(isSuperadmin ? [{ label: 'Superadmin', path: '/superadmin', icon: Shield }] : []),
    ...(isSuperadmin ? [{ label: 'Relatórios', path: '/relatorios', icon: BarChart3 }] : []),
    { label: 'Notificações', path: '/notificacoes', icon: Bell },
    ...(user?.role === 'admin' || isSuperadmin
      ? [{ label: 'Configurações', path: '/configuracoes', icon: Settings }]
      : []),
  ]

  const pageTitles: Record<string, string> = {
    '/': 'Dashboard',
    '/dashboard': 'Dashboard',
    '/bussola': 'Bússola',
    '/controle': 'Central de Controle',
    '/dfds': 'Diagramas de Fluxo de Dados (DFDs)',
    '/educacao': 'Módulo de Educação',
    '/usuarios': 'Gestão de Usuários',
    '/novo-dfd': 'Novo DFD',
    '/superadmin': 'Painel do Superadministrador',
    '/relatorios': 'Relatórios Comparativos',
    '/notificacoes': 'Notificações',
    '/configuracoes': 'Configurações',
  }

  const currentTitle = pageTitles[location.pathname] || 'Bússola Jurídica Municipal'

  const renderNavLinks = (isMobile = false) => (
    <nav className="space-y-1 px-2 mt-4">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive =
          location.pathname === item.path ||
          (item.path === '/dashboard' && location.pathname === '/') ||
          (item.path === '/dfds' && location.pathname === '/novo-dfd')

        const linkContent = (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => isMobile && setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[#2a3f5f] text-white border-l-4 border-[#3b82f6]'
                : 'text-[#c8d6e5] hover:bg-[#3b5a7a] hover:text-white'
            } ${collapsed && !isMobile ? 'justify-center px-0' : ''}`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {(!collapsed || isMobile) && <span>{item.label}</span>}
          </Link>
        )

        if (collapsed && !isMobile) {
          return (
            <Tooltip key={item.path} delayDuration={100}>
              <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
              <TooltipContent side="right" className="bg-[#1c2a3e] text-white border-none">
                {item.label}
              </TooltipContent>
            </Tooltip>
          )
        }

        return linkContent
      })}
    </nav>
  )

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#f5f6fa] text-[#1e293b] flex">
        {/* Desktop / Tablet Sidebar */}
        <aside
          className={`hidden md:flex flex-col fixed top-0 bottom-0 left-0 bg-[#1c2a3e] z-30 transition-all duration-300 ${
            collapsed ? 'w-[64px]' : 'w-[240px]'
          }`}
        >
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-[#2a3f5f]">
            <Link to="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-[#3b82f6] flex items-center justify-center shrink-0 shadow-sm">
                <Compass className="w-5 h-5 text-white animate-spin-slow" />
              </div>
              {!collapsed && (
                <span className="font-bold text-base text-white truncate tracking-tight">
                  Bússola Jurídica
                </span>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="text-[#c8d6e5] hover:text-white hover:bg-[#2a3f5f] hidden lg:flex"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Nav Items */}
          <div className="flex-1 overflow-y-auto">{renderNavLinks()}</div>

          {/* Footer info in sidebar */}
          {!collapsed && (
            <div className="p-4 border-t border-[#2a3f5f] text-xs text-[#c8d6e5]">
              <p className="font-semibold text-white">Prefeitura Digital</p>
              <p className="text-gray-400 mt-0.5">Gestão Municipal v1.0</p>
            </div>
          )}
        </aside>

        {/* Main Content Layout Wrapper */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
            collapsed ? 'md:ml-[64px]' : 'md:ml-[240px]'
          }`}
        >
          {/* Top Bar */}
          <header className="h-16 bg-white border-b border-[#e2e8f0] px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-3">
              {/* Mobile Drawer Hamburger */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden text-gray-700">
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="bg-[#1c2a3e] border-r-0 text-white w-[240px] p-0"
                >
                  <div className="h-16 flex items-center gap-2.5 px-4 border-b border-[#2a3f5f]">
                    <div className="w-8 h-8 rounded-lg bg-[#3b82f6] flex items-center justify-center">
                      <Compass className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-base text-white">Bússola Jurídica</span>
                  </div>
                  {renderNavLinks(true)}
                </SheetContent>
              </Sheet>

              <h1 className="text-lg md:text-xl font-bold text-[#1c2a3e]">{currentTitle}</h1>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              <NotificationBell />

              <div className="h-8 w-px bg-gray-200 hidden sm:block" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2.5 pl-1 rounded-lg hover:bg-gray-50 transition-colors py-1 px-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
                    aria-label="Menu do usuário"
                  >
                    <Avatar className="w-9 h-9 border border-gray-200">
                      <AvatarImage
                        src="https://img.usecurling.com/ppl/medium?gender=male&seed=12"
                        alt="Usuário"
                      />
                      <AvatarFallback className="bg-[#1c2a3e] text-white text-xs font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block text-left">
                      <p className="text-xs font-semibold text-[#1c2a3e]">
                        {user?.name || 'Usuário'}
                      </p>
                      <p className="text-[10px] text-gray-500 capitalize">
                        {user?.role || 'servidor'}
                      </p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-[#1c2a3e]">
                        {user?.name || 'Usuário'}
                      </p>
                      <p className="text-xs leading-none text-gray-500">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                    onClick={() => setLogoutDialogOpen(true)}
                    aria-label="Sair da conta"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Body */}
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
            <Outlet />
          </main>
        </div>

        {/* Shared Modals and Side Panels */}
        <ProjectSidePanel />
        <NewProjectModal />

        {/* Logout Confirmation Dialog */}
        <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deseja realmente sair?</AlertDialogTitle>
              <AlertDialogDescription>
                Sua sessão será encerrada e você será redirecionado para a tela de login.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {logoutError && (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {logoutError}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
