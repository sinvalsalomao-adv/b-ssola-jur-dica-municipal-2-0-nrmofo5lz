import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass, Loader2, Search, Building2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getOrganizacoes, type Organizacao } from '@/services/organizacoes'

export default function LoginPage() {
  const navigate = useNavigate()
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    getOrganizacoes()
      .then(setOrganizacoes)
      .catch(() => setError('Não foi possível carregar as organizações.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = organizacoes.filter(
    (o) =>
      o.nome.toLowerCase().includes(search.toLowerCase()) ||
      o.slug.toLowerCase().includes(search.toLowerCase()) ||
      (o.cidade && o.cidade.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1c2a3e] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-[#3b82f6] flex items-center justify-center shadow-lg mb-4">
            <Compass className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Bússola Jurídica Municipal
          </h1>
          <p className="text-sm text-[#c8d6e5] mt-1">Selecione sua organização</p>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar organização..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-11"
                  autoFocus
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">
                    Nenhuma organização encontrada.
                  </div>
                ) : (
                  filtered.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => navigate(`/login/${org.slug}`)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      {org.brasao ? (
                        <img
                          src={org.brasao}
                          alt=""
                          className="w-9 h-9 rounded-lg object-contain bg-slate-50 border border-gray-100"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[#1c2a3e] truncate">{org.nome}</p>
                        {org.cidade && org.estado && (
                          <p className="text-xs text-gray-400 truncate">
                            {org.cidade}/{org.estado}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[#c8d6e5] mt-6">
          © 2026 Bússola Jurídica Municipal. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
