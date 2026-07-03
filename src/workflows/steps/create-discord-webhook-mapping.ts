import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { DISCORD_NOTIFICATION_MODULE } from '../../modules/discord-notification'

export type CreateDiscordWebhookMappingStepInput = {
  event_name: string
  webhook_url: string
  channel_name?: string | null
  is_active?: boolean
  message_template?: string | null
  bot_name?: string | null
}

type DiscordWebhookMapping = {
  id: string
  event_name: string
  webhook_url: string
  channel_name: string | null
  is_active: boolean
  message_template: string | null
  bot_name: string | null
}

type DiscordMappingService = {
  createDiscordWebhookMappings: (data: {
    event_name: string
    webhook_url: string
    channel_name: string | null
    is_active: boolean
    message_template: string | null
    bot_name: string | null
  }) => Promise<DiscordWebhookMapping>
  deleteDiscordWebhookMappings: (id: string) => Promise<void>
}

export const createDiscordWebhookMappingStep = createStep(
  'create-discord-webhook-mapping',
  async (input: CreateDiscordWebhookMappingStepInput, { container }) => {
    const discordSvc = container.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordMappingService

    const mapping = await discordSvc.createDiscordWebhookMappings({
      event_name: input.event_name,
      webhook_url: input.webhook_url,
      channel_name: input.channel_name || null,
      is_active: input.is_active !== undefined ? input.is_active : true,
      message_template: input.message_template || null,
      bot_name: input.bot_name || null,
    })

    return new StepResponse(mapping, mapping.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const discordSvc = container.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordMappingService

    await discordSvc.deleteDiscordWebhookMappings(id)
  },
)
