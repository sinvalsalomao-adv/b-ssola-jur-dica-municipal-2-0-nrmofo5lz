migrate(
  (app) => {
    const MARKER_KEY = 'telegram_avisos_bot_token'
    const tokenVal = '8982704760:AAFEozmY6NRm4g4xOzvHtAb96z3MxZQ1ALc'

    let rec = null
    try {
      rec = app.findFirstRecordByData('security_audit_markers', 'marker_key', MARKER_KEY)
    } catch (_) {}

    if (rec) {
      rec.set('version', 'v1')
      rec.set('details', { token: tokenVal, updated_at: new Date().toISOString() })
      app.save(rec)
    } else {
      const col = app.findCollectionByNameOrId('security_audit_markers')
      rec = new Record(col)
      rec.set('marker_key', MARKER_KEY)
      rec.set('version', 'v1')
      rec.set('details', { token: tokenVal, created_at: new Date().toISOString() })
      app.save(rec)
    }
  },
  (app) => {
    try {
      const rec = app.findFirstRecordByData(
        'security_audit_markers',
        'marker_key',
        'telegram_avisos_bot_token',
      )
      app.delete(rec)
    } catch (_) {}
  },
)
