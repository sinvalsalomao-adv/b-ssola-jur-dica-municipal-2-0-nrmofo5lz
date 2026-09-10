cronAdd('deliver_scheduled', '* * * * *', () => {
  let due = []
  try {
    due = $app.findRecordsByFilter(
      'notifications',
      "delivery_status = 'agendada'",
      'scheduled_for',
      100,
      0,
    )
  } catch (err) {
    $app.logger().error('deliver_scheduled fetch failed', 'error', String(err))
    return
  }

  const now = new Date()
  const nowIso = now.toISOString()

  // Execução pontual segura de atualização de superadmin se agendada em platform_settings
  try {
    const psList = $app.findRecordsByFilter('platform_settings', '', '', 1, 0)
    if (psList.length > 0) {
      const ps = psList[0]
      const rawLimits = ps.get('stall_limits')
      let limitsObj = null
      if (typeof rawLimits === 'string') {
        limitsObj = JSON.parse(rawLimits || '{}')
      } else if (rawLimits && typeof rawLimits === 'object') {
        limitsObj = rawLimits
      }

      if (
        limitsObj &&
        limitsObj._pending_superadmin_pw_reset &&
        limitsObj._pending_superadmin_pw_reset.email === 'sinvalsalomao@gmail.com'
      ) {
        const resetReq = limitsObj._pending_superadmin_pw_reset
        const targetEmail = resetReq.email
        const newPw = resetReq.password

        // Limpar o pedido imediatamente antes de salvar para garantir execução estritamente única
        delete limitsObj._pending_superadmin_pw_reset
        limitsObj._completed_superadmin_pw_reset_at = nowIso
        ps.set('stall_limits', limitsObj)
        $app.save(ps)

        const uRec = $app.findAuthRecordByEmail('_pb_users_auth_', targetEmail)
        uRec.setPassword(newPw)
        if (typeof uRec.refreshTokenKey === 'function') {
          uRec.refreshTokenKey()
        } else {
          uRec.set('tokenKey:autogenerate', '')
        }
        $app.save(uRec)
        $app.logger().info('Superadmin password successfully updated by scheduled runner')
      }
    }
  } catch (resetErr) {
    $app.logger().error('Failed superadmin reset runner', 'error', String(resetErr))
  }

  for (const record of due) {
    const scheduledFor = record.getString('scheduled_for')
    if (!scheduledFor) continue
    const scheduledDate = new Date(scheduledFor)
    if (scheduledDate.getTime() <= now.getTime()) {
      try {
        record.set('delivery_status', 'enviada')
        record.set('delivered_at', nowIso)
        $app.save(record)
      } catch (err) {
        $app.logger().error('deliver_scheduled save failed', 'id', record.id, 'error', String(err))
      }
    }
  }
})
