migrate(
  (app) => {
    // Limpeza de coleções filhas/dependentes e dados de teste em ordem segura de FKs
    const tablesToTruncate = [
      'notification_reads',
      'notifications',
      'checklist_items',
      'checklists',
      'comment_mentions',
      'project_comments',
      'project_participants',
      'documents',
      'dfds',
      'agenda_events',
      'projects',
      'invitations',
      'audit_logs',
      'frases_salvas',
      'progresso_usuario',
      'quiz_respostas',
      'education_group_members',
      'education_groups',
      'secretarias',
    ]

    for (const tbl of tablesToTruncate) {
      try {
        app.db().newQuery(`DELETE FROM ${tbl}`).execute()
      } catch (err) {
        console.log(`Aviso ao limpar ${tbl}:`, err)
      }
    }

    // user_memberships: DELETE WHERE user NOT IN ('uxnit0c8oensr67','52o9enaexq1pxev')
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM user_memberships WHERE user NOT IN ('uxnit0c8oensr67','52o9enaexq1pxev')",
        )
        .execute()
    } catch (err) {
      console.log('Erro ao limpar user_memberships:', err)
    }

    // users: DELETE WHERE email NOT IN ('sinvalsalomao@gmail.com','matheusflotencio137482@gmail.com')
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM users WHERE email NOT IN ('sinvalsalomao@gmail.com','matheusflotencio137482@gmail.com')",
        )
        .execute()
    } catch (err) {
      console.log('Erro ao limpar users:', err)
    }

    // tenants: NÃO apagar em bloco — preservar tenants referenciados por bot_api_keys
    // apagar apenas as prefeituras sem vínculo com bot_api_keys
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM tenants WHERE id NOT IN (SELECT DISTINCT tenant FROM bot_api_keys WHERE tenant IS NOT NULL AND tenant != '')",
        )
        .execute()
    } catch (err) {
      console.log('Erro ao limpar tenants sem chave:', err)
    }

    // Limpar também tenant_settings e document_templates de tenants removidos (se houver)
    try {
      app
        .db()
        .newQuery('DELETE FROM tenant_settings WHERE tenant NOT IN (SELECT id FROM tenants)')
        .execute()
    } catch (_) {}

    try {
      app
        .db()
        .newQuery('DELETE FROM document_templates WHERE tenant NOT IN (SELECT id FROM tenants)')
        .execute()
    } catch (_) {}
  },
  (app) => {
    // Migration de limpeza de dados de teste (irreversível por definição)
  },
)
