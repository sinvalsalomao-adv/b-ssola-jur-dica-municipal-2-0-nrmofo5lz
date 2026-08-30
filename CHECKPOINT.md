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
