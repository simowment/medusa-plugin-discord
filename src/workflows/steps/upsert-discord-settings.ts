import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { DISCORD_NOTIFICATION_MODULE } from '../../modules/discord-notification'

export type UpsertDiscordSettingsStepInput = {
  avatar_url?: string | null
  footer_text?: string | null
  default_bot_name?: string | null
  locale?: string | null
}

type DiscordSettings = {
  avatar_url?: string
  footer_text?: string
  default_bot_name?: string
  locale?: string
}

type DiscordPluginSettingRecord = {
  id: string
  avatar_url?: string | null
  footer_text?: string | null
  default_bot_name?: string | null
  locale?: string | null
}

const FIELDS = ['avatar_url', 'footer_text', 'default_bot_name', 'locale'] as const

type SettingsCompensationInput = {
  previous: DiscordPluginSettingRecord | null
  createdId: string | null
}

type DiscordSettingsService = {
  getSettings: () => Promise<DiscordSettings>
  listDiscordPluginSettings: (filters: Record<string, unknown>) => Promise<DiscordPluginSettingRecord[]>
  updateDiscordPluginSettings: (data: DiscordPluginSettingRecord) => Promise<unknown>
  createDiscordPluginSettings: (
    data: Omit<DiscordPluginSettingRecord, 'id'>,
  ) => Promise<DiscordPluginSettingRecord>
  deleteDiscordPluginSettings: (ids: string | string[]) => Promise<void>
}

function toRecordSnapshot(record: DiscordPluginSettingRecord): DiscordPluginSettingRecord {
  return {
    id: record.id,
    avatar_url: record.avatar_url ?? null,
    footer_text: record.footer_text ?? null,
    default_bot_name: record.default_bot_name ?? null,
    locale: record.locale ?? null,
  }
}

export const upsertDiscordSettingsStep = createStep(
  'upsert-discord-settings',
  async (input: UpsertDiscordSettingsStepInput, { container }) => {
    const discordSvc = container.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordSettingsService
    const existingSettings = await discordSvc.listDiscordPluginSettings({})
    const previous = existingSettings.length > 0 ? toRecordSnapshot(existingSettings[0]) : null
    // A field absent from the input keeps its saved value; null or "" clears it.
    const nextSettings: Omit<DiscordPluginSettingRecord, 'id'> = {}
    for (const field of FIELDS) {
      if (input[field] !== undefined) nextSettings[field] = input[field] || null
    }
    let createdId: string | null = null

    if (previous) {
      await discordSvc.updateDiscordPluginSettings({
        id: previous.id,
        ...nextSettings,
      })
    } else {
      const created = await discordSvc.createDiscordPluginSettings(nextSettings)
      createdId = created.id
    }

    const settings = await discordSvc.getSettings()

    return new StepResponse(settings, { previous, createdId })
  },
  async (compensationInput: SettingsCompensationInput, { container }) => {
    const discordSvc = container.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordSettingsService

    if (compensationInput.previous) {
      await discordSvc.updateDiscordPluginSettings(compensationInput.previous)
      return
    }

    if (compensationInput.createdId) {
      await discordSvc.deleteDiscordPluginSettings(compensationInput.createdId)
    }
  },
)
