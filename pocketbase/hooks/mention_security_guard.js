// Security Hook: Restrict @mentions (comment_mentions) to active users within the exact same tenant
// Rules:
// 1. Target mentioned user must exist.
// 2. Target mentioned user must not be inactive ('inativo').
// 3. Target mentioned user must have a non-empty tenant.
// 4. Target mentioned user tenant must strictly match the project/mention tenant.
// 5. No personal details or foreign tenant info leaked in error responses.

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
      message: 'Dados incompletos para registrar menção.',
    })
  }

  try {
    const targetUser = $app.findRecordById('users', targetUserId)
    if (!targetUser) {
      return e.json(400, {
        code: 400,
        message: 'O usuário mencionado não foi encontrado.',
      })
    }

    const userStatus = targetUser.getString('status')
    if (userStatus === 'inativo') {
      return e.json(400, {
        code: 400,
        message: 'Não é possível mencionar um usuário inativo.',
      })
    }

    const userTenant = targetUser.getString('tenant')
    if (!userTenant || userTenant !== mentionTenant) {
      return e.json(400, {
        code: 400,
        message:
          'Não é possível mencionar usuários sem prefeitura vinculada ou de outro município.',
      })
    }
  } catch (err) {
    return e.json(400, {
      code: 400,
      message: 'O usuário mencionado é inválido ou não pertence a esta prefeitura.',
    })
  }

  return e.next()
}, 'comment_mentions')
