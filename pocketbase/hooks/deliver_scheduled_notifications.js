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
