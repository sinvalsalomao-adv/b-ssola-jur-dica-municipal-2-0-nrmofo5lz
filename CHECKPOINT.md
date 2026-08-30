# Checkpoints do Projeto - Bússola Jurídica Municipal 2.0

## Checkpoint 1: Versão Base Pré-Sanitização

- **Data/Hora:** 2025-05-18
- **Propósito:** Ponto de restauração identificado antes da implementação da sanitização de erros sensíveis.

## Checkpoint 2: Ponto de Restauração Pré-Implementação da Aba "Documentos" no Painel Lateral

- **Data/Hora:** 2025-05-19
- **Versão:** 0.0.48
- **Módulo:** Bússola (Kanban e Detalhes do Projeto)
- **Estado preservado:**
  - Login e autenticação multi-tenant
  - Menu lateral e rotas completas
  - Quadro Kanban e filtros por município e etapa
  - Exportação de relatórios em PDF
  - Abas atuais do painel lateral (Detalhes, Checklist, Histórico)
  - Coleções existentes no PocketBase e integridade dos dados
- **Propósito:** Ponto de restauração antes de adicionar a migração aditiva para a coleção `documents` (versões, arquivamento, categoria, etapa, descrição) e criar a aba "Documentos" no painel lateral de Detalhes do Projeto.

## Checkpoint 3: Ponto de Restauração Pré-Implementação de Comentários, Menções e Participantes

- **Data/Hora:** 2025-05-20
- **Versão:** 0.0.49
- **Módulo:** Bússola Jurídica Municipal 2.0 (Cartão de Projeto 2.0)
- **Estado preservado:**
  - Checklist completo com itens, responsáveis e prazos
  - Aba Documentos completa com versionamento (v1, v2...), notas, arquivamento, restauração, prévia PDF e auditoria
  - Histórico de auditoria completo para cards e documentos
  - Sistema de Notificações obrigatórias, agendadas e avisos internos
  - Autenticação e isolamento multi-tenant
  - Quadro Kanban e ordenações/filtros
- **Propósito:** Ponto de restauração antes de implementar coleções de participantes (`project_participants`), comentários (`project_comments`) com soft delete e threading em 1 nível, menções (`comment_mentions`), notificações automáticas e chip/avatares no Kanban e Detalhes.

## Checkpoint 4: Ponto de Restauração Pré-Correções de Segurança da Auditoria Técnica

- **Data/Hora:** 2025-05-21
- **Versão:** 0.0.50
- **Módulo:** Segurança, Controle de Acesso, RLS e Proteção de Rotas
- **Estado preservado:**
  - Versão funcional da Bússola Jurídica Municipal (v0.0.50) com todas as coleções de negócio íntegras
  - Checklist, Documentos, Comentários, Kanban, DFDs, Relatórios, Educação e Dashboards funcionando
  - Migrações 0001 a 0019 aplicadas
  - Estrutura de dados preservada sem perda de registros
- **Propósito:** Ponto de restauração antes da aplicação do pacote de correções de segurança aprovadas pela auditoria técnica (P0: escalada de privilégio em users, vazamento de credenciais platform_settings, rotas desprotegidas no App.tsx; P1: tenant_settings restrito a admin/superadmin e mascaramento de segredos, validação de tenant em menções, remoção de fallbacks de primeiro tenant e role fallback; P2: normalização de datas no Dashboard, tenant no audit_log_create, remoção de mock de convite para servidor).

## Checkpoint 5: Ponto de Restauração — Correções Residuais da Auditoria Final v0.0.51

- **Data/Hora:** 2025-05-22
- **Versão:** 0.0.51
- **Módulos:** DfdForm, NewProjectModal, mask_settings_secrets.js, PlatformConfigTab, ConfiguracoesPage, ProjectContext, dfds.ts, projects.ts
- **Estado preservado:**
  - Login, perfis, autenticação e isolamento multi-tenant
  - Dashboard, Bússola Kanban, DFDs, Checklist, Documentos, Comentários, Relatórios e Educação
  - Coleções do PocketBase e integridade dos dados existentes
  - Preservação estrita de segredos: sem persistência de máscaras e sem vazamento em logs/respostas
- **Correções aplicadas:**
  1. Proibição absoluta de fallback de primeiro município (`tenants[0]`, `getFirstListItem` sem filtro):
     - Superadmin sem contexto municipal explícito inicia sem seleção e é bloqueado até seleção explícita.
     - Admin e Servidor utilizam exclusivamente o tenant autenticado.
     - Validação estrita de tenant nos serviços `createProject` e `createDfd`.
  2. Mascaramento e proteção de `ai_api_key`:
     - `mask_settings_secrets.js` enriquecido para mascarar `ai_api_key` em `tenant_settings` e `platform_settings`.
     - Preservação de segredos no update quando máscara é submetida.
     - UI da plataforma e configurações de tenant não retêm chaves em claro no estado do cliente.

## Checkpoint 6: Ponto de Restauração — Correção de Segurança em Menções Multi-Tenant v0.0.52

- **Data/Hora:** 2025-05-23
- **Versão:** 0.0.52
- **Módulos:** `src/services/comments.ts`, `pocketbase/hooks/mention_security_guard.js`, `src/components/ProjectSidePanel.tsx`, `src/components/ProjectCommentsSection.tsx`, `src/services/comments.test.ts`
- **Estado preservado:**
  - Login `/login/:slug`, kanban, DFDs, documentos, comentários/menções/participantes, histórico, 3 perfis (superadmin, admin, servidor)
  - Integridade de todas as coleções existentes (`project_comments`, `comment_mentions`, `users`, `project_participants`, `notifications`, `audit_logs`, `checklists`, `documents`, `projects`, `tenants`)
  - Threading em 1 nível, soft delete, edição, notificações internas e logs de auditoria intactos
  - Menções e comentários antigos já salvos preservados sem alterações ou deleções
- **Correção de segurança aplicada:**
  1. Proibição de menção a usuários sem tenant ou de tenant divergente:
     - Validação estrita: `targetUser.tenant && targetUser.tenant === data.tenantId`
     - Usuário sem tenant, de outro município/tenant, inativo ou inexistente é rejeitado tanto na camada de frontend quanto no serviço e backend hook.
     - Superadmin sem tenant pode comentar quando autorizado mas não pode ser mencionado sem tenant correspondente.
     - Sugestões de menção restritas a usuários ativos do tenant do projeto.
