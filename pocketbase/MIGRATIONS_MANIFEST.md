# Manifest de Reconciliação de Migrations (Skip Cloud / PocketBase)

**Projeto:** Bússola Jurídica Municipal 2.0  
**Versão Atual do Projeto:** 0.0.71  
**Data da Reconciliação:** 2026-08-31  
**Escopo:** Reconciliação de Integridade, Registro de Exceções Legadas e Governança de Migrations

---

## 1. Exceções Legadas de Interpolação/Concatenação em Migrations Históricas

As seguintes migrations históricas contêm concatenações legadas de strings em chamadas de migração interna de dados. Ambas são classificadas formalmente como **EXCEÇÕES LEGADAS JÁ APLICADAS E IMUTÁVEIS**:

### 1. Migration `0009_seed_education_and_update.js`

- **Status:** Aplicada e Imutável (`applied`).
- **Motivo da Ocorrência Histórica:** Migration inicial de seed e amarração referencial de projetos/DFDs criados na fase prototipal de desenvolvimento.
- **Avaliação de Risco:** Risco nulo/inexistente em produção. A migration foi executada uma única vez no momento do setup da base de dados com dados de seed controlados.
- **Regra Explícita de Governança:** **NÃO EDITAR OU REESCREVER** esta migration. NUNCA copiar ou replicar este padrão em nenhuma nova migration ou hook.

### 2. Migration `0021_create_user_memberships_and_migrate.js`

- **Status:** Aplicada e Imutável (`applied`).
- **Motivo da Ocorrência Histórica:** Script pontual de migração de dados que migrou a relação 1:1 legada (`users.tenant`) para a coleção de N:N (`user_memberships`).
- **Avaliação de Risco:** Risco nulo/inexistente em produção. A migration já foi aplicada com sucesso em estágio inicial e não é reexecutada.
- **Regra Explícita de Governança:** **NÃO EDITAR OU REESCREVER** esta migration (imutabilidade e integridade referencial). NUNCA reproduzir concatenação dinâmica de strings em novos scripts. Qualquer nova consulta em hooks ou migrations DEVE utilizar exclusivamente a parametrização oficial `{:param}` ou queries tipadas.

---

## 2. Reconciliação Fiel dos Ordinais Registrados no Banco vs. Arquivos Físicos

A tabela abaixo registra o status fiel de todos os ordinais retornados pela API oficial de metadados da instância (`list_migrations`) em comparação com a árvore de arquivos físicos do repositório (`pocketbase/migrations/`):

| Ordinal Registrado no Banco (`list_migrations`)         | Arquivo Físico no Repositório                                                     | Status no Banco | Diagnóstico / Observação                                                             |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------ |
| `0001_create_tenants_platform_settings.js`              | `pocketbase/migrations/0001_create_tenants_platform_settings.js`                  | applied         | Presente e Sincronizado                                                              |
| `0002_update_users.js`                                  | `pocketbase/migrations/0002_update_users.js`                                      | applied         | Presente e Sincronizado                                                              |
| `0003_create_projects_notifications_events_document.js` | `pocketbase/migrations/0003_create_projects_notifications_events_documents.js`    | applied         | Presente e Sincronizado (variação nominal cosmética no sulfixo)                      |
| `0004_create_audit_tenant_settings_invitations_dfds.js` | `pocketbase/migrations/0004_create_audit_tenant_settings_invitations_dfds.js`     | applied         | Presente e Sincronizado                                                              |
| `0005_seed_tenants_users.js`                            | `pocketbase/migrations/0005_seed_tenants_users.js`                                | applied         | Presente e Sincronizado                                                              |
| `0006_seed_data.js`                                     | `pocketbase/migrations/0006_seed_data.js`                                         | applied         | Presente e Sincronizado                                                              |
| `0007_update_existing_collections.js`                   | `pocketbase/migrations/0007_update_existing_collections.js`                       | applied         | Presente e Sincronizado                                                              |
| `0008_create_education_collections.js`                  | `pocketbase/migrations/0008_create_education_collections.js`                      | applied         | Presente e Sincronizado                                                              |
| `0009_seed_education_and_update.js`                     | `pocketbase/migrations/0009_seed_education_and_update.js`                         | applied         | Presente e Sincronizado (Exceção Legada Documentada)                                 |
| `0010_rename_fields.js`                                 | `pocketbase/migrations/0010_rename_fields.js`                                     | applied         | Presente e Sincronizado                                                              |
| `0011_create_document_templates.js`                     | `pocketbase/migrations/0011_create_document_templates.js`                         | applied         | Presente e Sincronizado                                                              |
| `0012_create_quiz_perguntas.js`                         | `pocketbase/migrations/0012_create_quiz_perguntas.js`                             | applied         | Presente e Sincronizado                                                              |
| `0013_update_tenants_add_city_state.js`                 | `pocketbase/migrations/0013_update_tenants_add_city_state.js`                     | applied         | Presente e Sincronizado                                                              |
| `0014_add_aviso_interno_notification_type.js`           | `pocketbase/migrations/0014_add_aviso_interno_notification_type.js`               | applied         | Presente e Sincronizado                                                              |
| `0015_add_scheduling_and_dashboard_prefs.js`            | `pocketbase/migrations/0015_add_scheduling_and_dashboard_prefs.js`                | applied         | Presente e Sincronizado                                                              |
| `0016_add_recurrence_and_reads.js`                      | `pocketbase/migrations/0016_add_recurrence_and_reads.js`                          | applied         | Presente e Sincronizado                                                              |
| `0017_create_checklists.js`                             | `pocketbase/migrations/0017_create_checklists.js`                                 | applied         | Presente e Sincronizado                                                              |
| `0018_enhance_documents_and_audit_actions.js`           | `pocketbase/migrations/0018_enhance_documents_and_audit_actions.js`               | applied         | Presente e Sincronizado                                                              |
| `0019_create_comments_mentions_participants.js`         | `pocketbase/migrations/0019_create_comments_mentions_participants.js`             | applied         | Presente e Sincronizado                                                              |
| `0020_security_audit_fixes.js`                          | `pocketbase/migrations/0020_security_audit_fixes.js`                              | applied         | Presente e Sincronizado                                                              |
| `0021_create_user_memberships_and_migrate.js`           | `pocketbase/migrations/0021_create_user_memberships_and_migrate.js`               | applied         | Presente e Sincronizado (Exceção Legada Documentada)                                 |
| `0022_fix_security_audit_v056.js`                       | `pocketbase/migrations/0022_fix_security_audit_v056.js`                           | applied         | Presente e Sincronizado                                                              |
| `0023_fix_users_tautology_and_isolation.js`             | `pocketbase/migrations/0023_fix_users_tautology_and_isolation.js`                 | applied         | Presente e Sincronizado                                                              |
| `0024_invalidate_historical_seed_passwords.js`          | `pocketbase/migrations/0024_invalidate_historical_seed_passwords.js`              | applied         | Presente e Sincronizado                                                              |
| `0025_invalidate_historical_seed_passwords.js`          | _(sem arquivo local)_                                                             | applied         | Divergência histórica: executada pontualmente no backend durante ciclo de saneamento |
| `0026_invalidate_historical_seed_passwords.js`          | _(sem arquivo local)_                                                             | applied         | Divergência histórica: executada pontualmente no backend durante ciclo de saneamento |
| `0027_invalidate_historical_seed_passwords.js`          | _(sem arquivo local)_                                                             | applied         | Divergência histórica: executada pontualmente no backend durante ciclo de saneamento |
| `0028_rotate_seed_sessions_token_key.js`                | `pocketbase/migrations/0028_rotate_seed_sessions_token_key.js`                    | applied         | Presente e Sincronizado                                                              |
| `0029_create_security_audit_markers_and_rotate.js`      | `pocketbase/migrations/0029_create_security_audit_markers_and_rotate.js`          | applied         | Presente e Sincronizado                                                              |
| `0030_enhance_invitations_for_secure_membership.js`     | `pocketbase/migrations/0030_enhance_invitations_for_secure_membership.js`         | applied         | Presente e Sincronizado                                                              |
| `0031_strict_memberships_rls_and_invitations_unique.js` | `pocketbase/migrations/0031_strict_memberships_rls_and_invitations_uniqueness.js` | applied         | Presente e Sincronizado (variação nominal cosmética no sulfixo)                      |
| `0032_seed_testrunner_superadmin.js`                    | `pocketbase/migrations/0032_seed_testrunner_superadmin.js`                        | applied         | Presente e Sincronizado                                                              |
| `0033_remove_testrunner_superadmin.js`                  | `pocketbase/migrations/0033_remove_testrunner_superadmin.js`                      | applied         | Presente e Sincronizado                                                              |
| `0034_seed_testrunner_superadmin.js`                    | _(sem arquivo local)_                                                             | applied         | Divergência histórica de execução pontual do test runner                             |
| `0035_remove_testrunner_superadmin.js`                  | _(sem arquivo local)_                                                             | applied         | Divergência histórica de execução pontual do test runner                             |

---

## 3. Próximo Número de Migration Disponível

Conforme verificado em `list_migrations`:

- **Próximo ordinal sequencial para novas migrations:** **`0036`**

---

## 4. Princípios de Governança e Regras de Reconciliação

1. **Imutabilidade Absoluta (Forward-Only):** Nenhuma migration aplicada (`0001` a `0035`) foi ou será editada, alterada ou removida.
2. **Zero Colisão de Ordinais:** Qualquer nova migration do projeto deve iniciar obrigatoriamente a partir de `0036`.
3. **Parametrização Estrita de Consultas:** Todo novo código em migrations e hooks deve utilizar parâmetros nomeados `{:param}` e maps estruturados, sem exceções.
4. **Ausência Total de Segredos:** Nenhum segredo, token, chave de API ou senha consta ou constará neste manifesto.
