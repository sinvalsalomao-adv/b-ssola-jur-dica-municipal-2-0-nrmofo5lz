import pb from '@/lib/pocketbase/client'
import type {
  SecretariaRecord,
  EducationGroupRecord,
  EducationGroupMemberRecord,
  CreateSecretariaData,
  UpdateSecretariaData,
  CreateEducationGroupData,
  UpdateEducationGroupData,
  AddGroupMemberData,
} from '@/types/academia'

// --- SECRETARIAS ---

export async function getSecretariasByTenant(tenantId: string): Promise<SecretariaRecord[]> {
  if (!tenantId) return []
  return pb.collection('secretarias').getFullList<SecretariaRecord>({
    filter: pb.filter('tenant = {:tenantId}', { tenantId }),
    sort: 'nome',
  })
}

export async function createSecretaria(data: CreateSecretariaData): Promise<SecretariaRecord> {
  return pb.collection('secretarias').create<SecretariaRecord>({
    ...data,
    status: data.status || 'ativo',
  })
}

export async function updateSecretaria(
  id: string,
  data: UpdateSecretariaData,
): Promise<SecretariaRecord> {
  return pb.collection('secretarias').update<SecretariaRecord>(id, data)
}

export async function deleteSecretaria(id: string): Promise<boolean> {
  return pb.collection('secretarias').delete(id)
}

// --- EDUCATION GROUPS ---

export async function getEducationGroupsByTenant(
  tenantId: string,
): Promise<EducationGroupRecord[]> {
  if (!tenantId) return []
  return pb.collection('education_groups').getFullList<EducationGroupRecord>({
    filter: pb.filter('tenant = {:tenantId}', { tenantId }),
    expand: 'secretaria',
    sort: 'nome',
  })
}

export async function createEducationGroup(
  data: CreateEducationGroupData,
): Promise<EducationGroupRecord> {
  return pb.collection('education_groups').create<EducationGroupRecord>({
    ...data,
    status: data.status || 'ativo',
    cargos_alvo: data.cargos_alvo || [],
  })
}

export async function updateEducationGroup(
  id: string,
  data: UpdateEducationGroupData,
): Promise<EducationGroupRecord> {
  return pb.collection('education_groups').update<EducationGroupRecord>(id, data)
}

export async function deleteEducationGroup(id: string): Promise<boolean> {
  return pb.collection('education_groups').delete(id)
}

// --- GROUP MEMBERS ---

export async function getGroupMembers(groupId: string): Promise<EducationGroupMemberRecord[]> {
  if (!groupId) return []
  return pb.collection('education_group_members').getFullList<EducationGroupMemberRecord>({
    filter: pb.filter('group = {:groupId}', { groupId }),
    expand: 'user',
    sort: '-created',
  })
}

export async function getUserGroupMemberships(
  userId: string,
  tenantId?: string,
): Promise<EducationGroupMemberRecord[]> {
  if (!userId) return []
  let filterStr = 'user = {:userId}'
  const params: Record<string, string> = { userId }
  if (tenantId) {
    filterStr += ' && tenant = {:tenantId}'
    params.tenantId = tenantId
  }
  return pb.collection('education_group_members').getFullList<EducationGroupMemberRecord>({
    filter: pb.filter(filterStr, params),
    expand: 'group,group.secretaria',
    sort: '-created',
  })
}

export async function addMemberToGroup(
  data: AddGroupMemberData,
): Promise<EducationGroupMemberRecord> {
  return pb.collection('education_group_members').create<EducationGroupMemberRecord>({
    ...data,
    status: data.status || 'ativo',
  })
}

export async function removeMemberFromGroup(memberRecordId: string): Promise<boolean> {
  return pb.collection('education_group_members').delete(memberRecordId)
}
