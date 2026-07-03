import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { DISCORD_NOTIFICATION_MODULE } from '../../modules/discord-notification'

export type UpsertDiscordSettingsStepInput = {
  avatar_url?: string | null
  footer_text?: string | null
}

type DiscordSettings = {
  avatar_url?: string
  footer_text?: string
}

type DiscordPluginSettingRecord = {
  id: string
  avatar_url?: string | null
  footer_text?: string | null
}

type SettingsCompensationInput = {
  previous: DiscordPluginSettingRecord | null
  createdId: string | null
}

type DiscordSettingsService = {
  getSettings: () => Promise<DiscordSettings>
  listDiscordPluginSettings: (filters: Record<string, unknown>) => Promise<DiscordPluginSettingRecord[]>
  updateDiscordPluginSettings: (data: DiscordPluginSettingRecord) => Promise<unknown>
  createDiscordPluginSettings: (data: {
    avatar_url: string | null
    footer_text: string | null
  }) => Promise<DiscordPluginSettingRecord>
  deleteDiscordPluginSettings: (ids: string | string[]) => Promise<void>
}

function toRecordSnapshot(record: DiscordPluginSettingRecord): DiscordPluginSettingRecord {
  return {
    id: record.id,
    avatar_url: record.avatar_url ?? null,
    footer_text: record.footer_text ?? null,
  }
}

export const upsertDiscordSettingsStep = createStep(
  'upsert-discord-settings',
  async (input: UpsertDiscordSettingsStepInput, { container }) => {
    const discordSvc = container.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordSettingsService
    const existingSettings = await discordSvc.listDiscordPluginSettings({})
    const previous = existingSettings.length > 0 ? toRecordSnapshot(existingSettings[0]) : null
    const nextSettings = {
      avatar_url: input.avatar_url || null,
      footer_text: input.footer_text || null,
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
