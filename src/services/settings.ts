import pb from '@/lib/pocketbase/client'
import type { PlatformConfig } from '@/types/superadmin'
import { DEFAULT_STALL_LIMITS, DEFAULT_PROXIMITY_DAYS, StallLimits } from '@/types/controle'

export const getPlatformSettings = async (): Promise<any | null> => {
  try {
    const records = await pb.collection('platform_settings').getFullList()
    return records[0] || null
  } catch {
    return null
  }
}

export const savePlatformSettings = async (id: string, data: Record<string, any>) =>
  pb.collection('platform_settings').update(id, data)

export const createPlatformSettings = async (data: Record<string, any>) =>
  pb.collection('platform_settings').create(data)

export const getTenantSettings = async (tenantId: string): Promise<any | null> => {
  try {
    const records = await pb.collection('tenant_settings').getFullList({
      filter: `tenant = "${tenantId}"`,
    })
    return records[0] || null
  } catch {
    return null
  }
}

export const saveTenantSettings = async (id: string, data: Record<string, any>) =>
  pb.collection('tenant_settings').update(id, data)

export const createTenantSettings = async (data: Record<string, any>) =>
  pb.collection('tenant_settings').create(data)

export function parseStallLimits(json: any): StallLimits {
  if (!json) return { ...DEFAULT_STALL_LIMITS }
  try {
    const obj = typeof json === 'string' ? JSON.parse(json) : json
    return { ...DEFAULT_STALL_LIMITS, ...obj }
  } catch {
    return { ...DEFAULT_STALL_LIMITS }
  }
}

export function parseSmtpConfig(json: any) {
  if (!json) return { server: '', port: '', username: '', password: '', senderEmail: '' }
  try {
    const obj = typeof json === 'string' ? JSON.parse(json) : json
    return { server: '', port: '', username: '', password: '', senderEmail: '', ...obj }
  } catch {
    return { server: '', port: '', username: '', password: '', senderEmail: '' }
  }
}
