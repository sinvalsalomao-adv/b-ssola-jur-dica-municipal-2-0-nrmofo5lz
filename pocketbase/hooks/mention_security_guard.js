// Security Hook: Restrict @mentions (comment_mentions) to active users within the exact same tenant
// Rules:
// 1. Target mentioned user must exist.
// 2. Target mentioned user status must be strictly equal to 'ativo' (allowlist estrita).
// 3. Target mentioned user must have a non-empty tenant.
// 4. Target mentioned user tenant must strictly match the project/mention tenant.
// 5. No personal details, status, existence or foreign tenant info leaked in error responses (uniform generic message).

onRecordCreateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const record = e.record
  if (!record) return e.next()

  const targetUserId = record.getString('mentioned_user_id')
  const mentionTenant = record.getString('tenant')

  if (!targetUserId || !mentionTenant) {
    return e.json(400, {
      code: 400,
      message: 'Não foi possível adicionar uma ou mais menções.',
    })
  }

  try {
    const targetUser = $app.findRecordById('users', targetUserId)
    if (!targetUser) {
      return e.json(400, {
        code: 400,
        message: 'Não foi possível adicionar uma ou mais menções.',
      })
    }

    // Verificar se usuário tem status ativo no users ou vínculo ativo em user_memberships no mentionTenant
    let isUserActiveInTenant = false

    // Verificar campo direto caso ainda exista
    const userStatus = targetUser.getString('status')
    const userTenant = targetUser.getString('tenant')
    if (userStatus === 'ativo' && userTenant && userTenant === mentionTenant) {
      isUserActiveInTenant = true
    } else {
      // Verificar em user_memberships
      try {
        const memberships = $app.findRecordsByFilter(
          'user_memberships',
          "user = '" + targetUserId + "' && tenant = '" + mentionTenant + "' && status = 'ativo'",
          '',
          1,
          0,
        )
        if (memberships.length > 0) {
          isUserActiveInTenant = true
        }
      } catch (_) {}
    }

    if (!isUserActiveInTenant) {
      return e.json(400, {
        code: 400,
        message: 'Não foi possível adicionar uma ou mais menções.',
      })
    }
  } catch (err) {
    return e.json(400, {
      code: 400,
      message: 'Não foi possível adicionar uma ou mais menções.',
    })
  }

  return e.next()
}, 'comment_mentions')
