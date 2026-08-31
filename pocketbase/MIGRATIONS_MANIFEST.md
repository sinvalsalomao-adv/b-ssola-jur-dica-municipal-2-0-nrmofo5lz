# Manifest de Reconciliação de Migrations (Skip Cloud / PocketBase)

**Projeto:** Bússola Jurídica Municipal 2.0  
**Data da Reconciliação:** 2026-08-31  
**Escopo:** Problema 1 de Segurança (Neutralização de credenciais conhecidas Skip@Pass e Invalidação de Sessões)

---

## 1. Contexto e Diagnóstico de Divergência

Durante o ciclo de desenvolvimento das versões 0.0.60–0.0.63, a neutralização da senha legada de seed (`Skip@Pass`) foi executada e registrada na tabela interna de migrations do banco PocketBase sob os ordinais `0024`, `0025`, `0026` e `0027`.

Uma inspeção via API nativa de metadados (`list_migrations`) retornou a seguinte listagem oficial aplicada no banco de dados da instância:

- `0001_create_tenants_platform_settings.js` (applied)
- `0002_update_users.js` (applied)
- `0003_create_projects_notifications_events_document.js` (applied)
- `0004_create_audit_tenant_settings_invitations_dfds.js` (applied)
- `0005_seed_tenants_users.js` (applied)
- `0006_seed_data.js` (applied)
- `0007_update_existing_collections.js` (applied)
- `0008_create_education_collections.js` (applied)
- `0009_seed_education_and_update.js` (applied)
- `0010_rename_fields.js` (applied)
- `0011_create_document_templates.js` (applied)
- `0012_create_quiz_perguntas.js` (applied)
- `0013_update_tenants_add_city_state.js` (applied)
- `0014_add_aviso_interno_notification_type.js` (applied)
- `0015_add_scheduling_and_dashboard_prefs.js` (applied)
- `0016_add_recurrence_and_reads.js` (applied)
- `0017_create_checklists.js` (applied)
- `0018_enhance_documents_and_audit_actions.js` (applied)
- `0019_create_comments_mentions_participants.js` (applied)
- `0020_security_audit_fixes.js` (applied)
- `0021_create_user_memberships_and_migrate.js` (applied)
- `0022_fix_security_audit_v056.js` (applied)
- `0023_fix_users_tautology_and_isolation.js` (applied)
- `0024_invalidate_historical_seed_passwords.js` (applied)
- `0025_invalidate_historical_seed_passwords.js` (applied)
- `0026_invalidate_historical_seed_passwords.js` (applied)
- `0027_invalidate_historical_seed_passwords.js` (applied)

No diretório de arquivos do repositório (`pocketbase/migrations/`), o arquivo `0024_invalidate_historical_seed_passwords.js` está presente, enquanto os ordinais `0025`, `0026` e `0027` não possuem arquivos físicos locais correspondentes no disco (o banco os registrou como aplicados).

---

## 2. Princípios de Governança e Regras de Reconciliação

1. **Imutabilidade e Não-Regressão (Forward-Only):**
   Nenhuma migration aplicada (`0001` a `0027`) foi alterada, excluída ou reescrita. O histórico de ordinais no banco é preservado integralmente.
2. **Sem Colisão de Ordinais:**
   Não foram recriados arquivos `0025`, `0026` ou `0027` de forma especulativa ou redundante. A próxima migration legítima no repositório é única e exclusivamente a **`0028_rotate_seed_sessions_token_key.js`**.
3. **Preservação de Dados e Integridade Referencial:**
   Todos os dados de tenants, usuários, memberships, projetos, auditorias e documentos permanecem intactos e protegidos.
4. **Auditoria e Transparência:**
   Este documento serve como manifesto formal da reconciliação entre o histórico registrado no banco de dados e a árvore de arquivos do repositório.
