/**
 * Contrato de Schema Canônico Sanitizado e Drift Checker (Segurança v4)
 *
 * 1. Define o schema efetivo canônico (collections, fields, indexes, apiRules/RLS)
 *    sem NENHUM dado de produção/preview, sem PII, sem segredos e sem registros.
 * 2. Gera a migration consolidada e sanitizada para inicialização da instância efêmera do PocketBase.
 * 3. Oferece verificação de Drift estrita (drift check) entre o contrato e o schema.json / banco de testes.
 */

import fs from 'node:fs'
import path from 'node:path'

export interface SchemaFieldContract {
  name: string
  type: string
  required?: boolean
  collectionRef?: string
  selectValues?: string[]
  maxSelect?: number
  maxSize?: number
  mimeTypes?: string[]
  cascadeDelete?: boolean
  onlyInt?: boolean
  autodateTriggers?: string[]
}

export interface CollectionContract {
  name: string
  type: 'base' | 'auth' | 'view'
  apiRules: {
    list: string | null
    view: string | null
    create: string | null
    update: string | null
    delete: string | null
  }
  fields: SchemaFieldContract[]
  indexes: string[]
}

export interface SchemaContractDefinition {
  version: string
  collections: CollectionContract[]
}

/**
 * Contrato Sanitizado Canônico Fiel ao PocketBase v0.26 / v0.36
 * Derivado das regras RLS e schemas aprovados (0001 a 0033).
 */
export const CANONICAL_SCHEMA_CONTRACT: SchemaContractDefinition = {
  version: '1.0.0-sanitized-v4',
  collections: [
    {
      name: 'users',
      type: 'auth',
      apiRules: {
        list: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || id = @request.auth.id)",
        view: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || id = @request.auth.id)",
        create: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        update:
          "@request.auth.id != '' && (@request.auth.role = 'superadmin' || id = @request.auth.id)",
        delete: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
      },
      fields: [
        { name: 'name', type: 'text', required: false },
        { name: 'avatar', type: 'file', required: false, maxSelect: 1, maxSize: 5242880 },
        {
          name: 'role',
          type: 'select',
          required: false,
          selectValues: ['superadmin', 'admin', 'servidor', 'gestor', 'secretario', 'procurador'],
          maxSelect: 1,
        },
        {
          name: 'tenant',
          type: 'relation',
          required: false,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: false,
          selectValues: ['ativo', 'inativo'],
          maxSelect: 1,
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_tokenKey__pb_users_auth_` ON `users` (`tokenKey`)',
        "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `users` (`email`) WHERE `email` != ''",
        'CREATE INDEX `idx_users_tenant` ON `users` (tenant)',
      ],
    },
    {
      name: 'tenants',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != ''",
        view: "@request.auth.id != ''",
        create: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        update: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        delete: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
      },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'cnpj', type: 'text', required: false },
        { name: 'slug', type: 'text', required: true },
        { name: 'admin_name', type: 'text', required: false },
        {
          name: 'status',
          type: 'select',
          required: false,
          selectValues: ['ativa', 'inativa'],
          maxSelect: 1,
        },
        { name: 'logo', type: 'file', required: false, maxSelect: 1, maxSize: 5242880 },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_tenants_slug ON tenants (slug)'],
    },
    {
      name: 'platform_settings',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        view: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        create: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        update: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        delete: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
      },
      fields: [
        { name: 'stall_limits', type: 'json', required: false },
        { name: 'smtp_config', type: 'json', required: false },
        { name: 'ai_api_key', type: 'text', required: false },
        { name: 'proximity_days', type: 'number', required: false, onlyInt: true },
      ],
      indexes: [],
    },
    {
      name: 'projects',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      },
      fields: [
        {
          name: 'priority',
          type: 'select',
          required: false,
          selectValues: ['Alta', 'Média', 'Baixa'],
          maxSelect: 1,
        },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
        { name: 'objeto', type: 'text', required: false },
        { name: 'justificativa', type: 'text', required: false },
        {
          name: 'responsible_user',
          type: 'relation',
          required: false,
          collectionRef: 'users',
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text', required: true },
        { name: 'descricao', type: 'text', required: false },
        { name: 'prazo', type: 'date', required: false },
        {
          name: 'coluna_kanban',
          type: 'select',
          required: false,
          selectValues: [
            'Ideação',
            'Projeto Executivo',
            'Elaborar DFD',
            'Procedimentos Internos',
            'Execução',
            'Prestação de Contas',
            'Marketing',
          ],
          maxSelect: 1,
        },
      ],
      indexes: [
        'CREATE INDEX idx_projects_tenant ON projects (tenant)',
        'CREATE INDEX `idx_projects_responsible_user` ON `projects` (responsible_user)',
      ],
    },
    {
      name: 'notifications',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      },
      fields: [
        { name: 'project_title', type: 'text', required: false },
        { name: 'column', type: 'text', required: false },
        { name: 'days_stalled', type: 'number', required: false },
        { name: 'person_responsible', type: 'text', required: false },
        { name: 'alert_date', type: 'date', required: false },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
        {
          name: 'projeto_id',
          type: 'relation',
          required: false,
          collectionRef: 'projects',
          maxSelect: 1,
        },
        { name: 'mensagem', type: 'text', required: false },
        { name: 'enviada_em', type: 'autodate', required: false },
        { name: 'lida', type: 'bool', required: false },
        {
          name: 'tipo',
          type: 'select',
          required: false,
          selectValues: ['Gargalo', 'Prazo Fatal', 'Aviso Interno', 'Mencao'],
          maxSelect: 1,
        },
        { name: 'scheduled_for', type: 'date', required: false },
        {
          name: 'delivery_status',
          type: 'select',
          required: false,
          selectValues: ['enviada', 'agendada', 'cancelada'],
          maxSelect: 1,
        },
        { name: 'delivered_at', type: 'date', required: false },
        {
          name: 'recorrencia',
          type: 'select',
          required: false,
          selectValues: ['nenhuma', 'diaria', 'semanal', 'mensal'],
          maxSelect: 1,
        },
        {
          name: 'dia_semana',
          type: 'select',
          required: false,
          selectValues: ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'],
          maxSelect: 1,
        },
        { name: 'dia_mes', type: 'number', required: false },
        { name: 'exige_confirmacao', type: 'bool', required: false },
        {
          name: 'modo_confirmacao',
          type: 'select',
          required: false,
          selectValues: ['leitura', 'video'],
          maxSelect: 1,
        },
        { name: 'video_url', type: 'url', required: false },
        { name: 'recorrencia_ativa', type: 'bool', required: false },
        {
          name: 'parent_notification',
          type: 'relation',
          required: false,
          collectionRef: 'notifications',
          maxSelect: 1,
        },
        {
          name: 'target_user',
          type: 'relation',
          required: false,
          collectionRef: 'users',
          maxSelect: 1,
        },
      ],
      indexes: [
        'CREATE INDEX idx_notifications_tenant ON notifications (tenant)',
        'CREATE INDEX `idx_notifications_projeto_id` ON `notifications` (projeto_id)',
        'CREATE INDEX `idx_notifications_lida` ON `notifications` (lida)',
      ],
    },
    {
      name: 'agenda_events',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      },
      fields: [
        { name: 'day', type: 'date', required: false },
        { name: 'card_title', type: 'text', required: false },
        { name: 'card_id', type: 'text', required: false },
        {
          name: 'color_code',
          type: 'select',
          required: false,
          selectValues: ['green', 'yellow', 'red'],
          maxSelect: 1,
        },
        { name: 'responsible', type: 'text', required: false },
        { name: 'column', type: 'text', required: false },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
      ],
      indexes: ['CREATE INDEX idx_agenda_tenant ON agenda_events (tenant)'],
    },
    {
      name: 'documents',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      },
      fields: [
        { name: 'project_name', type: 'text', required: false },
        { name: 'file', type: 'file', required: false, maxSelect: 1, maxSize: 52428800 },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
        {
          name: 'projeto_id',
          type: 'relation',
          required: false,
          collectionRef: 'projects',
          maxSelect: 1,
        },
        { name: 'nome_arquivo', type: 'text', required: false },
        { name: 'url', type: 'url', required: false },
        { name: 'tamanho', type: 'number', required: false },
        { name: 'upload_em', type: 'date', required: false },
        { name: 'upload_por', type: 'text', required: false },
        {
          name: 'categoria',
          type: 'select',
          required: false,
          selectValues: [
            'Edital / Termo de Referência',
            'Parecer Jurídico',
            'Contrato / Aditivo',
            'Nota de Empenho / Fiscal',
            'DFD / Estudo Técnico Preliminar',
            'Publicação / Diário Oficial',
            'Planilha Orçamentária',
            'Outro',
          ],
          maxSelect: 1,
        },
        {
          name: 'etapa',
          type: 'select',
          required: false,
          selectValues: [
            'Ideação',
            'Projeto Executivo',
            'Elaborar DFD',
            'Procedimentos Internos',
            'Execução',
            'Prestação de Contas',
            'Marketing',
          ],
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', required: false },
        { name: 'versao', type: 'number', required: false },
        {
          name: 'parent_document_id',
          type: 'relation',
          required: false,
          collectionRef: 'documents',
          maxSelect: 1,
        },
        { name: 'is_latest_version', type: 'bool', required: false },
        { name: 'arquivado', type: 'bool', required: false },
        {
          name: 'user_id',
          type: 'relation',
          required: false,
          collectionRef: 'users',
          maxSelect: 1,
        },
      ],
      indexes: [
        'CREATE INDEX idx_documents_tenant ON documents (tenant)',
        'CREATE INDEX `idx_documents_projeto_id` ON `documents` (projeto_id)',
        'CREATE INDEX `idx_documents_arquivado` ON `documents` (arquivado)',
        'CREATE INDEX `idx_documents_parent` ON `documents` (parent_document_id)',
        'CREATE INDEX `idx_documents_latest` ON `documents` (is_latest_version)',
      ],
    },
    {
      name: 'audit_logs',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        delete: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
      },
      fields: [
        { name: 'user_name', type: 'text', required: false },
        {
          name: 'action_type',
          type: 'select',
          required: false,
          selectValues: [
            'Criou card',
            'Moveu card',
            'Editou card',
            'Adicionou documento',
            'Nova versão documento',
            'Arquivou documento',
            'Restaurou documento',
            'Visualizou documento',
            'Baixou documento',
            'Adicionou participante',
            'Removeu participante',
            'Criou comentário',
            'Editou comentário',
            'Removeu comentário',
            'Criou resposta',
            'Editou resposta',
            'Removeu resposta',
            'Mencionou usuário',
          ],
          maxSelect: 1,
        },
        { name: 'description', type: 'text', required: false },
        { name: 'project_title', type: 'text', required: false },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
      ],
      indexes: ['CREATE INDEX idx_audit_tenant ON audit_logs (tenant)'],
    },
    {
      name: 'tenant_settings',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      },
      fields: [
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
        { name: 'stall_limits', type: 'json', required: false },
        { name: 'smtp_config', type: 'json', required: false },
        { name: 'ai_api_key', type: 'text', required: false },
        { name: 'proximity_days', type: 'number', required: false, onlyInt: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_tenant_settings_tenant ON tenant_settings (tenant)'],
    },
    {
      name: 'invitations',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
        view: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
        create:
          "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
        update:
          "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
        delete:
          "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'text', required: true },
        {
          name: 'role',
          type: 'select',
          required: true,
          selectValues: ['admin', 'servidor', 'gestor', 'secretario', 'procurador'],
          maxSelect: 1,
        },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
        { name: 'invited_by', type: 'text', required: false },
        {
          name: 'status',
          type: 'select',
          required: false,
          selectValues: ['pending', 'activated', 'accepted', 'rejected', 'expired', 'cancelled'],
          maxSelect: 1,
        },
        { name: 'token_hash', type: 'text', required: false },
        { name: 'expires_at', type: 'date', required: false },
        { name: 'used_at', type: 'date', required: false },
        { name: 'user', type: 'relation', required: false, collectionRef: 'users', maxSelect: 1 },
        { name: 'rate_limit_hash', type: 'text', required: false },
        { name: 'recipient_hash', type: 'text', required: false },
        { name: 'active_key', type: 'text', required: false },
        {
          name: 'delivery_status',
          type: 'select',
          required: false,
          selectValues: ['delivered', 'delivery_pending', 'delivery_failed', 'skipped'],
          maxSelect: 1,
        },
      ],
      indexes: [
        'CREATE INDEX idx_invitations_tenant ON invitations (tenant)',
        'CREATE INDEX `idx_invitations_token_hash` ON `invitations` (token_hash)',
        'CREATE INDEX `idx_invitations_email` ON `invitations` (email)',
        'CREATE INDEX `idx_invitations_status` ON `invitations` (status)',
        'CREATE INDEX `idx_invitations_rate_limit_hash` ON `invitations` (rate_limit_hash)',
        'CREATE INDEX `idx_invitations_recipient_hash` ON `invitations` (recipient_hash)',
        'CREATE UNIQUE INDEX `idx_invitations_active_key` ON `invitations` (active_key)',
      ],
    },
    {
      name: 'dfds',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      },
      fields: [
        { name: 'objeto', type: 'text', required: false },
        { name: 'descricao', type: 'text', required: false },
        { name: 'justificativa', type: 'text', required: false },
        {
          name: 'status',
          type: 'select',
          required: false,
          selectValues: ['Rascunho', 'Finalizado'],
          maxSelect: 1,
        },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
        {
          name: 'projeto_id',
          type: 'relation',
          required: false,
          collectionRef: 'projects',
          maxSelect: 1,
        },
        {
          name: 'responsible_user',
          type: 'relation',
          required: false,
          collectionRef: 'users',
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text', required: true },
        { name: 'prazo', type: 'date', required: false },
      ],
      indexes: [
        'CREATE INDEX idx_dfds_tenant ON dfds (tenant)',
        'CREATE INDEX `idx_dfds_projeto_id` ON `dfds` (projeto_id)',
        'CREATE INDEX `idx_dfds_responsible_user` ON `dfds` (responsible_user)',
      ],
    },
    {
      name: 'frases_salvas',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      },
      fields: [
        { name: 'texto', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: false,
          selectValues: ['objeto', 'descricao'],
          maxSelect: 1,
        },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
        { name: 'contador_uso', type: 'number', required: false, onlyInt: true },
      ],
      indexes: [
        'CREATE INDEX idx_frases_salvas_tenant ON frases_salvas (tenant)',
        'CREATE INDEX idx_frases_salvas_tipo ON frases_salvas (tipo)',
      ],
    },
    {
      name: 'trilhas',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != ''",
        view: "@request.auth.id != ''",
        create: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        update: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        delete: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
      },
      fields: [
        { name: 'titulo', type: 'text', required: true },
        { name: 'descricao', type: 'text', required: false },
        { name: 'ordem', type: 'number', required: false, onlyInt: true },
      ],
      indexes: ['CREATE INDEX idx_trilhas_ordem ON trilhas (ordem)'],
    },
    {
      name: 'aulas',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != ''",
        view: "@request.auth.id != ''",
        create: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        update: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        delete: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
      },
      fields: [
        {
          name: 'trilha_id',
          type: 'relation',
          required: true,
          collectionRef: 'trilhas',
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text', required: true },
        { name: 'url_video', type: 'url', required: false },
        { name: 'ordem', type: 'number', required: false, onlyInt: true },
      ],
      indexes: [
        'CREATE INDEX idx_aulas_trilha_id ON aulas (trilha_id)',
        'CREATE INDEX idx_aulas_ordem ON aulas (ordem)',
      ],
    },
    {
      name: 'progresso_usuario',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
      },
      fields: [
        {
          name: 'usuario_id',
          type: 'relation',
          required: true,
          collectionRef: 'users',
          maxSelect: 1,
        },
        {
          name: 'trilha_id',
          type: 'relation',
          required: true,
          collectionRef: 'trilhas',
          maxSelect: 1,
        },
        { name: 'aula_id', type: 'relation', required: true, collectionRef: 'aulas', maxSelect: 1 },
        { name: 'concluido', type: 'bool', required: false },
      ],
      indexes: [
        'CREATE INDEX idx_progresso_usuario_id ON progresso_usuario (usuario_id)',
        'CREATE INDEX idx_progresso_trilha_id ON progresso_usuario (trilha_id)',
        'CREATE INDEX idx_progresso_aula_id ON progresso_usuario (aula_id)',
        'CREATE UNIQUE INDEX idx_progresso_usuario_aula ON progresso_usuario (usuario_id, aula_id)',
      ],
    },
    {
      name: 'quiz_respostas',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
      },
      fields: [
        {
          name: 'usuario_id',
          type: 'relation',
          required: true,
          collectionRef: 'users',
          maxSelect: 1,
        },
        {
          name: 'trilha_id',
          type: 'relation',
          required: true,
          collectionRef: 'trilhas',
          maxSelect: 1,
        },
        { name: 'acertos', type: 'number', required: false, onlyInt: true },
        { name: 'total', type: 'number', required: false, onlyInt: true },
        { name: 'aprovado', type: 'bool', required: false },
        { name: 'data', type: 'date', required: false },
      ],
      indexes: [
        'CREATE INDEX idx_quiz_respostas_usuario_id ON quiz_respostas (usuario_id)',
        'CREATE INDEX idx_quiz_respostas_trilha_id ON quiz_respostas (trilha_id)',
        'CREATE INDEX idx_quiz_respostas_data ON quiz_respostas (data)',
      ],
    },
    {
      name: 'document_templates',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'content', type: 'text', required: false },
        {
          name: 'type',
          type: 'select',
          required: false,
          selectValues: ['Minuta', 'Ofício', 'Parecer', 'Declaração', 'Outro'],
          maxSelect: 1,
        },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
      ],
      indexes: ['CREATE INDEX idx_document_templates_tenant ON document_templates (tenant)'],
    },
    {
      name: 'quiz_perguntas',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != ''",
        view: "@request.auth.id != ''",
        create: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        update: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        delete: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
      },
      fields: [
        {
          name: 'trilha_id',
          type: 'relation',
          required: true,
          collectionRef: 'trilhas',
          maxSelect: 1,
        },
        { name: 'pergunta', type: 'text', required: true },
        { name: 'opcoes', type: 'json', required: true },
        { name: 'resposta_correta', type: 'text', required: true },
        { name: 'ordem', type: 'number', required: false, onlyInt: true },
      ],
      indexes: ['CREATE INDEX idx_quiz_perguntas_trilha_id ON quiz_perguntas (trilha_id)'],
    },
    {
      name: 'dashboard_preferences',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && user = @request.auth.id",
        view: "@request.auth.id != '' && user = @request.auth.id",
        create: "@request.auth.id != '' && user = @request.auth.id",
        update: "@request.auth.id != '' && user = @request.auth.id",
        delete: "@request.auth.id != '' && user = @request.auth.id",
      },
      fields: [
        { name: 'user', type: 'relation', required: true, collectionRef: 'users', maxSelect: 1 },
        {
          name: 'tenant',
          type: 'relation',
          required: false,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
        { name: 'config', type: 'json', required: false },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_dashboard_pref_user ON dashboard_preferences (user)'],
    },
    {
      name: 'notification_reads',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'superadmin')",
      },
      fields: [
        {
          name: 'notification',
          type: 'relation',
          required: true,
          collectionRef: 'notifications',
          maxSelect: 1,
        },
        { name: 'user', type: 'relation', required: true, collectionRef: 'users', maxSelect: 1 },
        {
          name: 'tenant',
          type: 'relation',
          required: false,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
        { name: 'read_at', type: 'date', required: false },
        { name: 'confirmed_at', type: 'date', required: false },
        { name: 'watched_at', type: 'date', required: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_notification_reads_notif_user ON notification_reads (notification, user)',
        'CREATE INDEX idx_notification_reads_tenant ON notification_reads (tenant)',
        'CREATE INDEX idx_notification_reads_user ON notification_reads (user)',
        'CREATE INDEX idx_notification_reads_notif ON notification_reads (notification)',
      ],
    },
    {
      name: 'checklists',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      },
      fields: [
        { name: 'titulo', type: 'text', required: true },
        {
          name: 'projeto_id',
          type: 'relation',
          required: true,
          collectionRef: 'projects',
          maxSelect: 1,
        },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
        { name: 'ordem', type: 'number', required: false, onlyInt: true },
      ],
      indexes: [
        'CREATE INDEX idx_checklists_projeto ON checklists (projeto_id)',
        'CREATE INDEX idx_checklists_tenant ON checklists (tenant)',
      ],
    },
    {
      name: 'checklist_items',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      },
      fields: [
        { name: 'texto', type: 'text', required: true },
        { name: 'concluido', type: 'bool', required: false },
        {
          name: 'checklist_id',
          type: 'relation',
          required: true,
          collectionRef: 'checklists',
          maxSelect: 1,
        },
        {
          name: 'projeto_id',
          type: 'relation',
          required: false,
          collectionRef: 'projects',
          maxSelect: 1,
        },
        {
          name: 'responsible_user',
          type: 'relation',
          required: false,
          collectionRef: 'users',
          maxSelect: 1,
        },
        { name: 'prazo', type: 'date', required: false },
        { name: 'ordem', type: 'number', required: false, onlyInt: true },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
      ],
      indexes: [
        'CREATE INDEX idx_checklist_items_checklist ON checklist_items (checklist_id)',
        'CREATE INDEX idx_checklist_items_projeto ON checklist_items (projeto_id)',
        'CREATE INDEX idx_checklist_items_tenant ON checklist_items (tenant)',
        'CREATE INDEX idx_checklist_items_responsible ON checklist_items (responsible_user)',
      ],
    },
    {
      name: 'project_participants',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      },
      fields: [
        {
          name: 'project_id',
          type: 'relation',
          required: true,
          collectionRef: 'projects',
          maxSelect: 1,
        },
        { name: 'user_id', type: 'relation', required: true, collectionRef: 'users', maxSelect: 1 },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
        {
          name: 'added_by',
          type: 'relation',
          required: false,
          collectionRef: 'users',
          maxSelect: 1,
        },
        { name: 'role', type: 'text', required: false },
      ],
      indexes: [
        'CREATE INDEX idx_proj_part_project ON project_participants (project_id)',
        'CREATE INDEX idx_proj_part_user ON project_participants (user_id)',
        'CREATE INDEX idx_proj_part_tenant ON project_participants (tenant)',
        'CREATE UNIQUE INDEX idx_proj_part_unique ON project_participants (project_id, user_id)',
      ],
    },
    {
      name: 'project_comments',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update:
          "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.role = 'superadmin')",
        delete:
          "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.role = 'superadmin')",
      },
      fields: [
        {
          name: 'project_id',
          type: 'relation',
          required: true,
          collectionRef: 'projects',
          maxSelect: 1,
        },
        { name: 'user_id', type: 'relation', required: true, collectionRef: 'users', maxSelect: 1 },
        { name: 'author_name', type: 'text', required: false },
        { name: 'content', type: 'text', required: true },
        { name: 'parent_id', type: 'text', required: false },
        { name: 'is_edited', type: 'bool', required: false },
        { name: 'edited_at', type: 'date', required: false },
        { name: 'deleted', type: 'bool', required: false },
        { name: 'deleted_at', type: 'date', required: false },
        {
          name: 'deleted_by',
          type: 'relation',
          required: false,
          collectionRef: 'users',
          maxSelect: 1,
        },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
      ],
      indexes: [
        'CREATE INDEX idx_proj_comm_project ON project_comments (project_id)',
        'CREATE INDEX idx_proj_comm_user ON project_comments (user_id)',
        'CREATE INDEX idx_proj_comm_parent ON project_comments (parent_id)',
        'CREATE INDEX idx_proj_comm_deleted ON project_comments (deleted)',
        'CREATE INDEX idx_proj_comm_tenant ON project_comments (tenant)',
      ],
    },
    {
      name: 'comment_mentions',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        view: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        create:
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
        update: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        delete: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
      },
      fields: [
        {
          name: 'comment_id',
          type: 'relation',
          required: true,
          collectionRef: 'project_comments',
          maxSelect: 1,
        },
        {
          name: 'project_id',
          type: 'relation',
          required: true,
          collectionRef: 'projects',
          maxSelect: 1,
        },
        {
          name: 'mentioned_user_id',
          type: 'relation',
          required: true,
          collectionRef: 'users',
          maxSelect: 1,
        },
        {
          name: 'author_id',
          type: 'relation',
          required: true,
          collectionRef: 'users',
          maxSelect: 1,
        },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
      ],
      indexes: [
        'CREATE INDEX idx_mentions_comment ON comment_mentions (comment_id)',
        'CREATE INDEX idx_mentions_project ON comment_mentions (project_id)',
        'CREATE INDEX idx_mentions_user ON comment_mentions (mentioned_user_id)',
        'CREATE INDEX idx_mentions_tenant ON comment_mentions (tenant)',
      ],
    },
    {
      name: 'user_memberships',
      type: 'base',
      apiRules: {
        list: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || user = @request.auth.id || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
        view: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || user = @request.auth.id || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
        create: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        update:
          "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
        delete:
          "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      },
      fields: [
        { name: 'user', type: 'relation', required: true, collectionRef: 'users', maxSelect: 1 },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionRef: 'tenants',
          maxSelect: 1,
        },
        {
          name: 'role',
          type: 'select',
          required: true,
          selectValues: ['admin', 'servidor', 'gestor', 'secretario', 'procurador'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          selectValues: ['pendente', 'ativo', 'inativo', 'rejeitado'],
          maxSelect: 1,
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_user_membership_unique ON user_memberships (user, tenant)',
        'CREATE INDEX idx_user_membership_tenant ON user_memberships (tenant)',
        'CREATE INDEX idx_user_membership_user ON user_memberships (user)',
        'CREATE INDEX idx_user_membership_status ON user_memberships (status)',
      ],
    },
    {
      name: 'security_audit_markers',
      type: 'base',
      apiRules: {
        list: null,
        view: null,
        create: null,
        update: null,
        delete: null,
      },
      fields: [
        { name: 'marker_key', type: 'text', required: true },
        { name: 'version', type: 'text', required: true },
        { name: 'details', type: 'json', required: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_security_audit_marker_key ON security_audit_markers (marker_key)',
      ],
    },
  ],
}

/**
 * Realiza verificação de Drift entre o Contrato Canônico e um objeto de schema fornecido (ex: schema.json)
 */
export function checkSchemaDrift(targetSchema: { collections: any[] }): {
  hasDrift: boolean
  differences: string[]
} {
  const differences: string[] = []
  const contractCols = CANONICAL_SCHEMA_CONTRACT.collections

  for (const contractCol of contractCols) {
    const targetCol = targetSchema.collections.find((c) => c.name === contractCol.name)
    if (!targetCol) {
      differences.push(`Coleção ausente no schema alvo: ${contractCol.name}`)
      continue
    }

    // Verificar tipo
    if (contractCol.type !== targetCol.type) {
      differences.push(
        `Tipo de coleção divergente para ${contractCol.name}: esperado ${contractCol.type}, obtido ${targetCol.type}`,
      )
    }

    // Verificar campos essenciais
    for (const contractField of contractCol.fields) {
      const targetField = targetCol.fields?.find((f: any) => f.name === contractField.name)
      if (!targetField) {
        differences.push(
          `Campo ausente na coleção ${contractCol.name}: ${contractField.name} (tipo ${contractField.type})`,
        )
      } else if (targetField.type !== contractField.type) {
        differences.push(
          `Tipo divergente no campo ${contractCol.name}.${contractField.name}: esperado ${contractField.type}, obtido ${targetField.type}`,
        )
      }
    }

    // Verificar API Rules / RLS
    for (const ruleKey of ['list', 'view', 'create', 'update', 'delete'] as const) {
      const expectedRule = contractCol.apiRules[ruleKey]
      const actualRule = targetCol.apiRules
        ? targetCol.apiRules[ruleKey]
        : targetCol[`${ruleKey}Rule`]
      // Normalizar null / undefined / string vazia se aplicável
      const normExpected = expectedRule === undefined ? null : expectedRule
      const normActual = actualRule === undefined ? null : actualRule
      if (normExpected !== normActual) {
        differences.push(
          `Regra RLS '${ruleKey}' divergente na coleção ${contractCol.name}:\n  Esperado: ${normExpected}\n  Obtido:   ${normActual}`,
        )
      }
    }
  }

  return {
    hasDrift: differences.length > 0,
    differences,
  }
}

/**
 * Gera o arquivo JS de migration PocketBase autocontido a partir do contrato
 */
export function generateCanonicalMigrationJs(): string {
  return `
// Migration Canônica Sanitizada Auto-gerada (Segurança v4)
// Inicializa o banco PocketBase efêmero exatamente com as collections, campos, RLS e índices do contrato.
migrate((app) => {
  // 1. Atualizar coleção users
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.listRule = "@request.auth.id != '' && (@request.auth.role = 'superadmin' || id = @request.auth.id)";
  usersCol.viewRule = "@request.auth.id != '' && (@request.auth.role = 'superadmin' || id = @request.auth.id)";
  usersCol.createRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'";
  usersCol.updateRule = "@request.auth.id != '' && (@request.auth.role = 'superadmin' || id = @request.auth.id)";
  usersCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'";
  app.save(usersCol);

  // 2. Criar tenants e platform_settings
  app.save(new Collection({
    name: "tenants",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    updateRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    deleteRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    fields: [
      { name: "name", type: "text", required: true },
      { name: "cnpj", type: "text" },
      { name: "slug", type: "text", required: true },
      { name: "admin_name", type: "text" },
      { name: "status", type: "select", values: ["ativa", "inativa"], maxSelect: 1 },
      { name: "logo", type: "file", maxSelect: 1, maxSize: 5242880, mimeTypes: ["image/jpeg", "image/png"] },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: ["CREATE UNIQUE INDEX idx_tenants_slug ON tenants (slug)"]
  }));

  const tenantsId = app.findCollectionByNameOrId("tenants").id;

  // Atualizar campos de users com referência a tenants
  if (!usersCol.fields.getByName("role")) {
    usersCol.fields.add(new SelectField({
      name: "role",
      values: ["superadmin", "admin", "servidor", "gestor", "secretario", "procurador"],
      maxSelect: 1
    }));
  }
  if (!usersCol.fields.getByName("tenant")) {
    usersCol.fields.add(new RelationField({
      name: "tenant",
      collectionId: tenantsId,
      maxSelect: 1,
      cascadeDelete: false
    }));
  }
  if (!usersCol.fields.getByName("status")) {
    usersCol.fields.add(new SelectField({
      name: "status",
      values: ["ativo", "inativo"],
      maxSelect: 1
    }));
  }
  try {
    usersCol.addIndex("idx_users_tenant", false, "tenant", "");
  } catch { /* intentionally ignored */ }
  app.save(usersCol);

  app.save(new Collection({
    name: "platform_settings",
    type: "base",
    listRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    viewRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    createRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    updateRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    deleteRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    fields: [
      { name: "stall_limits", type: "json" },
      { name: "smtp_config", type: "json" },
      { name: "ai_api_key", type: "text" },
      { name: "proximity_days", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ]
  }));

  // 3. Demais coleções
  app.save(new Collection({
    name: "projects",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    fields: [
      { name: "priority", type: "select", values: ["Alta", "Média", "Baixa"], maxSelect: 1 },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "objeto", type: "text" },
      { name: "justificativa", type: "text" },
      { name: "responsible_user", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "titulo", type: "text", required: true },
      { name: "descricao", type: "text" },
      { name: "prazo", type: "date" },
      { name: "coluna_kanban", type: "select", values: ["Ideação", "Projeto Executivo", "Elaborar DFD", "Procedimentos Internos", "Execução", "Prestação de Contas", "Marketing"], maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_projects_tenant ON projects (tenant)",
      "CREATE INDEX idx_projects_responsible_user ON projects (responsible_user)"
    ]
  }));

  const projectsId = app.findCollectionByNameOrId("projects").id;

  app.save(new Collection({
    name: "notifications",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    fields: [
      { name: "project_title", type: "text" },
      { name: "column", type: "text" },
      { name: "days_stalled", type: "number" },
      { name: "person_responsible", type: "text" },
      { name: "alert_date", type: "date" },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "projeto_id", type: "relation", collectionId: projectsId, maxSelect: 1 },
      { name: "mensagem", type: "text" },
      { name: "enviada_em", type: "autodate", onCreate: true, onUpdate: false },
      { name: "lida", type: "bool" },
      { name: "tipo", type: "select", values: ["Gargalo", "Prazo Fatal", "Aviso Interno", "Mencao"], maxSelect: 1 },
      { name: "scheduled_for", type: "date" },
      { name: "delivery_status", type: "select", values: ["enviada", "agendada", "cancelada"], maxSelect: 1 },
      { name: "delivered_at", type: "date" },
      { name: "recorrencia", type: "select", values: ["nenhuma", "diaria", "semanal", "mensal"], maxSelect: 1 },
      { name: "dia_semana", type: "select", values: ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"], maxSelect: 1 },
      { name: "dia_mes", type: "number" },
      { name: "exige_confirmacao", type: "bool" },
      { name: "modo_confirmacao", type: "select", values: ["leitura", "video"], maxSelect: 1 },
      { name: "video_url", type: "url" },
      { name: "recorrencia_ativa", type: "bool" },
      { name: "target_user", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_notifications_tenant ON notifications (tenant)",
      "CREATE INDEX idx_notifications_projeto_id ON notifications (projeto_id)",
      "CREATE INDEX idx_notifications_lida ON notifications (lida)"
    ]
  }));

  const notifCol = app.findCollectionByNameOrId("notifications");
  notifCol.fields.add(new RelationField({
    name: "parent_notification",
    collectionId: notifCol.id,
    maxSelect: 1
  }));
  app.save(notifCol);

  app.save(new Collection({
    name: "agenda_events",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    fields: [
      { name: "day", type: "date" },
      { name: "card_title", type: "text" },
      { name: "card_id", type: "text" },
      { name: "color_code", type: "select", values: ["green", "yellow", "red"], maxSelect: 1 },
      { name: "responsible", type: "text" },
      { name: "column", type: "text" },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: ["CREATE INDEX idx_agenda_tenant ON agenda_events (tenant)"]
  }));

  app.save(new Collection({
    name: "documents",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    fields: [
      { name: "project_name", type: "text" },
      { name: "file", type: "file", maxSelect: 1, maxSize: 52428800 },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "projeto_id", type: "relation", collectionId: projectsId, maxSelect: 1 },
      { name: "nome_arquivo", type: "text" },
      { name: "url", type: "url" },
      { name: "tamanho", type: "number" },
      { name: "upload_em", type: "date" },
      { name: "upload_por", type: "text" },
      { name: "categoria", type: "select", values: ["Edital / Termo de Referência", "Parecer Jurídico", "Contrato / Aditivo", "Nota de Empenho / Fiscal", "DFD / Estudo Técnico Preliminar", "Publicação / Diário Oficial", "Planilha Orçamentária", "Outro"], maxSelect: 1 },
      { name: "etapa", type: "select", values: ["Ideação", "Projeto Executivo", "Elaborar DFD", "Procedimentos Internos", "Execução", "Prestação de Contas", "Marketing"], maxSelect: 1 },
      { name: "descricao", type: "text" },
      { name: "versao", type: "number" },
      { name: "is_latest_version", type: "bool" },
      { name: "arquivado", type: "bool" },
      { name: "user_id", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_documents_tenant ON documents (tenant)",
      "CREATE INDEX idx_documents_projeto_id ON documents (projeto_id)",
      "CREATE INDEX idx_documents_arquivado ON documents (arquivado)",
      "CREATE INDEX idx_documents_latest ON documents (is_latest_version)"
    ]
  }));

  const docsCol = app.findCollectionByNameOrId("documents");
  docsCol.fields.add(new RelationField({
    name: "parent_document_id",
    collectionId: docsCol.id,
    maxSelect: 1
  }));
  try {
    docsCol.addIndex("idx_documents_parent", false, "parent_document_id", "");
  } catch { /* intentionally ignored */ }
  app.save(docsCol);

  app.save(new Collection({
    name: "audit_logs",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    deleteRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    fields: [
      { name: "user_name", type: "text" },
      { name: "action_type", type: "select", values: ["Criou card", "Moveu card", "Editou card", "Adicionou documento", "Nova versão documento", "Arquivou documento", "Restaurou documento", "Visualizou documento", "Baixou documento", "Adicionou participante", "Removeu participante", "Criou comentário", "Editou comentário", "Removeu comentário", "Criou resposta", "Editou resposta", "Removeu resposta", "Mencionou usuário"], maxSelect: 1 },
      { name: "description", type: "text" },
      { name: "project_title", type: "text" },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: ["CREATE INDEX idx_audit_tenant ON audit_logs (tenant)"]
  }));

  app.save(new Collection({
    name: "tenant_settings",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    fields: [
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "stall_limits", type: "json" },
      { name: "smtp_config", type: "json" },
      { name: "ai_api_key", type: "text" },
      { name: "proximity_days", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: ["CREATE UNIQUE INDEX idx_tenant_settings_tenant ON tenant_settings (tenant)"]
  }));

  app.save(new Collection({
    name: "invitations",
    type: "base",
    listRule: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
    viewRule: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
    create: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
    updateRule: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
    deleteRule: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
    fields: [
      { name: "name", type: "text", required: true },
      { name: "email", type: "text", required: true },
      { name: "role", type: "select", required: true, values: ["admin", "servidor", "gestor", "secretario", "procurador"], maxSelect: 1 },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "invited_by", type: "text" },
      { name: "status", type: "select", values: ["pending", "activated", "accepted", "rejected", "expired", "cancelled"], maxSelect: 1 },
      { name: "token_hash", type: "text" },
      { name: "expires_at", type: "date" },
      { name: "used_at", type: "date" },
      { name: "user", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "rate_limit_hash", type: "text" },
      { name: "recipient_hash", type: "text" },
      { name: "active_key", type: "text" },
      { name: "delivery_status", type: "select", values: ["delivered", "delivery_pending", "delivery_failed", "skipped"], maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_invitations_tenant ON invitations (tenant)",
      "CREATE INDEX idx_invitations_token_hash ON invitations (token_hash)",
      "CREATE INDEX idx_invitations_email ON invitations (email)",
      "CREATE INDEX idx_invitations_status ON invitations (status)",
      "CREATE INDEX idx_invitations_rate_limit_hash ON invitations (rate_limit_hash)",
      "CREATE INDEX idx_invitations_recipient_hash ON invitations (recipient_hash)",
      "CREATE UNIQUE INDEX idx_invitations_active_key ON invitations (active_key)"
    ]
  }));

  const invCol = app.findCollectionByNameOrId("invitations");
  invCol.createRule = "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))";
  app.save(invCol);

  app.save(new Collection({
    name: "dfds",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    fields: [
      { name: "objeto", type: "text" },
      { name: "descricao", type: "text" },
      { name: "justificativa", type: "text" },
      { name: "status", type: "select", values: ["Rascunho", "Finalizado"], maxSelect: 1 },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "projeto_id", type: "relation", collectionId: projectsId, maxSelect: 1 },
      { name: "responsible_user", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "titulo", type: "text", required: true },
      { name: "prazo", type: "date" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_dfds_tenant ON dfds (tenant)",
      "CREATE INDEX idx_dfds_projeto_id ON dfds (projeto_id)",
      "CREATE INDEX idx_dfds_responsible_user ON dfds (responsible_user)"
    ]
  }));

  app.save(new Collection({
    name: "frases_salvas",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    fields: [
      { name: "texto", type: "text", required: true },
      { name: "tipo", type: "select", values: ["objeto", "descricao"], maxSelect: 1 },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "contador_uso", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_frases_salvas_tenant ON frases_salvas (tenant)",
      "CREATE INDEX idx_frases_salvas_tipo ON frases_salvas (tipo)"
    ]
  }));

  app.save(new Collection({
    name: "trilhas",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    updateRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    deleteRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    fields: [
      { name: "titulo", type: "text", required: true },
      { name: "descricao", type: "text" },
      { name: "ordem", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: ["CREATE INDEX idx_trilhas_ordem ON trilhas (ordem)"]
  }));

  const trilhasId = app.findCollectionByNameOrId("trilhas").id;

  app.save(new Collection({
    name: "aulas",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    updateRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    deleteRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    fields: [
      { name: "trilha_id", type: "relation", required: true, collectionId: trilhasId, maxSelect: 1 },
      { name: "titulo", type: "text", required: true },
      { name: "url_video", type: "url" },
      { name: "ordem", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_aulas_trilha_id ON aulas (trilha_id)",
      "CREATE INDEX idx_aulas_ordem ON aulas (ordem)"
    ]
  }));

  const aulasId = app.findCollectionByNameOrId("aulas").id;

  app.save(new Collection({
    name: "progresso_usuario",
    type: "base",
    listRule: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
    fields: [
      { name: "usuario_id", type: "relation", required: true, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "trilha_id", type: "relation", required: true, collectionId: trilhasId, maxSelect: 1 },
      { name: "aula_id", type: "relation", required: true, collectionId: aulasId, maxSelect: 1 },
      { name: "concluido", type: "bool" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_progresso_usuario_id ON progresso_usuario (usuario_id)",
      "CREATE INDEX idx_progresso_trilha_id ON progresso_usuario (trilha_id)",
      "CREATE INDEX idx_progresso_aula_id ON progresso_usuario (aula_id)",
      "CREATE UNIQUE INDEX idx_progresso_usuario_aula ON progresso_usuario (usuario_id, aula_id)"
    ]
  }));

  app.save(new Collection({
    name: "quiz_respostas",
    type: "base",
    listRule: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (usuario_id = @request.auth.id || @request.auth.role = 'superadmin')",
    fields: [
      { name: "usuario_id", type: "relation", required: true, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "trilha_id", type: "relation", required: true, collectionId: trilhasId, maxSelect: 1 },
      { name: "acertos", type: "number", onlyInt: true },
      { name: "total", type: "number", onlyInt: true },
      { name: "aprovado", type: "bool" },
      { name: "data", type: "date" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_quiz_respostas_usuario_id ON quiz_respostas (usuario_id)",
      "CREATE INDEX idx_quiz_respostas_trilha_id ON quiz_respostas (trilha_id)",
      "CREATE INDEX idx_quiz_respostas_data ON quiz_respostas (data)"
    ]
  }));

  app.save(new Collection({
    name: "document_templates",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    fields: [
      { name: "name", type: "text", required: true },
      { name: "content", type: "text" },
      { name: "type", type: "select", values: ["Minuta", "Ofício", "Parecer", "Declaração", "Outro"], maxSelect: 1 },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: ["CREATE INDEX idx_document_templates_tenant ON document_templates (tenant)"]
  }));

  app.save(new Collection({
    name: "quiz_perguntas",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    updateRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    deleteRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    fields: [
      { name: "trilha_id", type: "relation", required: true, collectionId: trilhasId, maxSelect: 1 },
      { name: "pergunta", type: "text", required: true },
      { name: "opcoes", type: "json", required: true },
      { name: "resposta_correta", type: "text", required: true },
      { name: "ordem", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: ["CREATE INDEX idx_quiz_perguntas_trilha_id ON quiz_perguntas (trilha_id)"]
  }));

  app.save(new Collection({
    name: "dashboard_preferences",
    type: "base",
    listRule: "@request.auth.id != '' && user = @request.auth.id",
    viewRule: "@request.auth.id != '' && user = @request.auth.id",
    createRule: "@request.auth.id != '' && user = @request.auth.id",
    updateRule: "@request.auth.id != '' && user = @request.auth.id",
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      { name: "user", type: "relation", required: true, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "tenant", type: "relation", collectionId: tenantsId, maxSelect: 1 },
      { name: "config", type: "json" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: ["CREATE UNIQUE INDEX idx_dashboard_pref_user ON dashboard_preferences (user)"]
  }));

  app.save(new Collection({
    name: "notification_reads",
    type: "base",
    listRule: "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'superadmin')",
    fields: [
      { name: "notification", type: "relation", required: true, collectionId: notifCol.id, maxSelect: 1 },
      { name: "user", type: "relation", required: true, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "tenant", type: "relation", collectionId: tenantsId, maxSelect: 1 },
      { name: "read_at", type: "date" },
      { name: "confirmed_at", type: "date" },
      { name: "watched_at", type: "date" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_notification_reads_notif_user ON notification_reads (notification, user)",
      "CREATE INDEX idx_notification_reads_tenant ON notification_reads (tenant)",
      "CREATE INDEX idx_notification_reads_user ON notification_reads (user)",
      "CREATE INDEX idx_notification_reads_notif ON notification_reads (notification)"
    ]
  }));

  app.save(new Collection({
    name: "checklists",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    fields: [
      { name: "titulo", type: "text", required: true },
      { name: "projeto_id", type: "relation", required: true, collectionId: projectsId, maxSelect: 1 },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "ordem", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_checklists_projeto ON checklists (projeto_id)",
      "CREATE INDEX idx_checklists_tenant ON checklists (tenant)"
    ]
  }));

  const checkCol = app.findCollectionByNameOrId("checklists");

  app.save(new Collection({
    name: "checklist_items",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    fields: [
      { name: "texto", type: "text", required: true },
      { name: "concluido", type: "bool" },
      { name: "checklist_id", type: "relation", required: true, collectionId: checkCol.id, maxSelect: 1 },
      { name: "projeto_id", type: "relation", collectionId: projectsId, maxSelect: 1 },
      { name: "responsible_user", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "prazo", type: "date" },
      { name: "ordem", type: "number", onlyInt: true },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_checklist_items_checklist ON checklist_items (checklist_id)",
      "CREATE INDEX idx_checklist_items_projeto ON checklist_items (projeto_id)",
      "CREATE INDEX idx_checklist_items_tenant ON checklist_items (tenant)",
      "CREATE INDEX idx_checklist_items_responsible ON checklist_items (responsible_user)"
    ]
  }));

  app.save(new Collection({
    name: "project_participants",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    fields: [
      { name: "project_id", type: "relation", required: true, collectionId: projectsId, maxSelect: 1 },
      { name: "user_id", type: "relation", required: true, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "added_by", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "role", type: "text" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_proj_part_project ON project_participants (project_id)",
      "CREATE INDEX idx_proj_part_user ON project_participants (user_id)",
      "CREATE INDEX idx_proj_part_tenant ON project_participants (tenant)",
      "CREATE UNIQUE INDEX idx_proj_part_unique ON project_participants (project_id, user_id)"
    ]
  }));

  app.save(new Collection({
    name: "project_comments",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.role = 'superadmin')",
    deleteRule: "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.role = 'superadmin')",
    fields: [
      { name: "project_id", type: "relation", required: true, collectionId: projectsId, maxSelect: 1 },
      { name: "user_id", type: "relation", required: true, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "author_name", type: "text" },
      { name: "content", type: "text", required: true },
      { name: "parent_id", type: "text" },
      { name: "is_edited", type: "bool" },
      { name: "edited_at", type: "date" },
      { name: "deleted", type: "bool" },
      { name: "deleted_at", type: "date" },
      { name: "deleted_by", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_proj_comm_project ON project_comments (project_id)",
      "CREATE INDEX idx_proj_comm_user ON project_comments (user_id)",
      "CREATE INDEX idx_proj_comm_parent ON project_comments (parent_id)",
      "CREATE INDEX idx_proj_comm_deleted ON project_comments (deleted)",
      "CREATE INDEX idx_proj_comm_tenant ON project_comments (tenant)"
    ]
  }));

  const commCol = app.findCollectionByNameOrId("project_comments");

  app.save(new Collection({
    name: "comment_mentions",
    type: "base",
    listRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    viewRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    createRule: "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
    updateRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    deleteRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    fields: [
      { name: "comment_id", type: "relation", required: true, collectionId: commCol.id, maxSelect: 1 },
      { name: "project_id", type: "relation", required: true, collectionId: projectsId, maxSelect: 1 },
      { name: "mentioned_user_id", type: "relation", required: true, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "author_id", type: "relation", required: true, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE INDEX idx_mentions_comment ON comment_mentions (comment_id)",
      "CREATE INDEX idx_mentions_project ON comment_mentions (project_id)",
      "CREATE INDEX idx_mentions_user ON comment_mentions (mentioned_user_id)",
      "CREATE INDEX idx_mentions_tenant ON comment_mentions (tenant)"
    ]
  }));

  app.save(new Collection({
    name: "user_memberships",
    type: "base",
    listRule: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || user = @request.auth.id || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
    viewRule: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || user = @request.auth.id || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
    createRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
    updateRule: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
    deleteRule: "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
    fields: [
      { name: "user", type: "relation", required: true, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "tenant", type: "relation", required: true, collectionId: tenantsId, maxSelect: 1 },
      { name: "role", type: "select", required: true, values: ["admin", "servidor", "gestor", "secretario", "procurador"], maxSelect: 1 },
      { name: "status", type: "select", required: true, values: ["pendente", "ativo", "inativo", "rejeitado"], maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_user_membership_unique ON user_memberships (user, tenant)",
      "CREATE INDEX idx_user_membership_tenant ON user_memberships (tenant)",
      "CREATE INDEX idx_user_membership_user ON user_memberships (user)",
      "CREATE INDEX idx_user_membership_status ON user_memberships (status)"
    ]
  }));

  app.save(new Collection({
    name: "security_audit_markers",
    type: "base",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "marker_key", type: "text", required: true },
      { name: "version", type: "text", required: true },
      { name: "details", type: "json" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: ["CREATE UNIQUE INDEX idx_security_audit_marker_key ON security_audit_markers (marker_key)"]
  }));
}, (app) => {});
`
}

/**
 * CLI para verificação direta de drift
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const schemaJsonPath = path.join(process.cwd(), 'src', 'lib', 'pocketbase', 'schema.json')
  if (!fs.existsSync(schemaJsonPath)) {
    console.error('schema.json não encontrado em src/lib/pocketbase/schema.json')
    process.exit(1)
  }
  const rawSchema = JSON.parse(fs.readFileSync(schemaJsonPath, 'utf-8'))
  const driftResult = checkSchemaDrift(rawSchema)
  if (driftResult.hasDrift) {
    console.error('❌ DRIFT DE SCHEMA DETECTADO:')
    for (const diff of driftResult.differences) {
      console.error(`  - ${diff}`)
    }
    process.exit(1)
  } else {
    console.log('✅ Verificação de Drift: Contrato Canônico Fiel ao schema.json (0 divergências)')
    process.exit(0)
  }
}
