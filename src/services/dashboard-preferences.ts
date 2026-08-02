import pb from '@/lib/pocketbase/client'
import { WidgetConfig, DEFAULT_WIDGET_CONFIG } from '@/types/dashboard'

export const getDashboardPreferences = async (userId: string): Promise<WidgetConfig[]> => {
  try {
    const record = await pb
      .collection('dashboard_preferences')
      .getFirstListItem(`user = "${userId}"`)
    const config = (record as any).config
    if (Array.isArray(config) && config.length > 0) return config
    return DEFAULT_WIDGET_CONFIG
  } catch {
    return DEFAULT_WIDGET_CONFIG
  }
}

export const saveDashboardPreferences = async (
  userId: string,
  tenantId: string,
  config: WidgetConfig[],
): Promise<void> => {
  try {
    const existing = await pb
      .collection('dashboard_preferences')
      .getFirstListItem(`user = "${userId}"`)
    await pb.collection('dashboard_preferences').update(existing.id, { config })
  } catch {
    await pb.collection('dashboard_preferences').create({ user: userId, tenant: tenantId, config })
  }
}
