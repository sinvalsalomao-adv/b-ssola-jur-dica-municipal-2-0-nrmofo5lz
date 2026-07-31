import pb from '@/lib/pocketbase/client'

export interface Organizacao {
  id: string
  nome: string
  slug: string
  brasao: string | null
  cidade: string
  estado: string
}

function resolveBrasao(path: string | null): string | null {
  if (!path) return null
  const base = pb.baseUrl.replace(/\/$/, '')
  return `${base}${path}`
}

export const getOrganizacoes = async (): Promise<Organizacao[]> => {
  const result = await pb.send('/backend/v1/organizacoes-public', { method: 'GET' })
  return (result as any[]).map((o) => ({
    id: o.id,
    nome: o.nome,
    slug: o.slug,
    brasao: resolveBrasao(o.brasao),
    cidade: o.cidade || '',
    estado: o.estado || '',
  }))
}

export const getOrganizacaoBySlug = async (slug: string): Promise<Organizacao> => {
  const result = await pb.send(`/backend/v1/organizacoes-public/${slug}`, { method: 'GET' })
  return {
    id: result.id,
    nome: result.nome,
    slug: result.slug,
    brasao: resolveBrasao(result.brasao),
    cidade: result.cidade || '',
    estado: result.estado || '',
  }
}
