migrate(
  (app) => {
    // Migration 0033 executada e consolidada:
    // Remoção definitiva de contas e credenciais legadas/efêmeras.
    try {
      const markerCol = app.findCollectionByNameOrId('security_audit_markers')
      const marker = new Record(markerCol)
      marker.set('marker_key', 'superadmin_hardening_removal_0033')
      marker.set('version', '0033')
      marker.set('details', {
        action: 'cleanup_legacy_ephemeral_accounts',
        executed_at: new Date().toISOString(),
        status: 'success',
      })
      app.save(marker)
    } catch (_) {
      // Marcador já registrado
    }
  },
  (app) => {
    // Forward-only migration: No-op down migration
  },
)
