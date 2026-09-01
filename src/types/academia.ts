export interface SecretariaRecord {
  id: string
  nome: string
  sigla?: string
  descricao?: string
  tenant: string
  status: 'ativo' | 'inativo'
  created: string
  updated: string
}

export interface EducationGroupRecord {
  id: string
  nome: string
  descricao?: string
  tenant: string
  secretaria?: string
  cargos_alvo?: string[]
  status: 'ativo' | 'inativo'
  created: string
  updated: string
  // Relações expandidas opcionais
  expand?: {
    secretaria?: SecretariaRecord
    tenant?: {
      id: string
      name: string
      slug: string
    }
  }
}

export interface EducationGroupMemberRecord {
  id: string
  group: string
  user: string
  tenant: string
  added_by?: string
  status: 'ativo' | 'inativo'
  created: string
  updated: string
  // Relações expandidas opcionais
  expand?: {
    user?: {
      id: string
      name: string
      email: string
      role?: string
      status?: string
    }
    group?: EducationGroupRecord
  }
}

export interface CreateSecretariaData {
  nome: string
  sigla?: string
  descricao?: string
  tenant: string
  status?: 'ativo' | 'inativo'
}

export interface UpdateSecretariaData {
  nome?: string
  sigla?: string
  descricao?: string
  status?: 'ativo' | 'inativo'
}

export interface CreateEducationGroupData {
  nome: string
  descricao?: string
  tenant: string
  secretaria?: string
  cargos_alvo?: string[]
  status?: 'ativo' | 'inativo'
}

export interface UpdateEducationGroupData {
  nome?: string
  descricao?: string
  secretaria?: string
  cargos_alvo?: string[]
  status?: 'ativo' | 'inativo'
}

export interface AddGroupMemberData {
  group: string
  user: string
  tenant: string
  status?: 'ativo' | 'inativo'
}
