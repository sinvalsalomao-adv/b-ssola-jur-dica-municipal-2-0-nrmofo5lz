import pb from '@/lib/pocketbase/client'

export const updateProfileName = async (userId: string, name: string) =>
  pb.collection('users').update(userId, { name })

export const uploadAvatar = async (userId: string, file: File) => {
  const formData = new FormData()
  formData.append('avatar', file)
  return pb.collection('users').update(userId, formData)
}

export const changePassword = async (
  email: string,
  currentPassword: string,
  newPassword: string,
) => {
  await pb.collection('users').authWithPassword(email, currentPassword)
  const userId = pb.authStore.record?.id
  if (!userId) throw new Error('Not authenticated')
  await pb.collection('users').update(userId, {
    password: newPassword,
    passwordConfirm: newPassword,
  })
}

export const getAvatarUrl = (userId: string, avatar: string): string => {
  const base = pb.baseUrl.replace(/\/$/, '')
  return `${base}/api/files/users/${userId}/${avatar}`
}
