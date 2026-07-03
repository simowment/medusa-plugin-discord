import { MedusaError } from '@medusajs/framework/utils'
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { DISCORD_NOTIFICATION_MODULE } from '../../modules/discord-notification'

export type DeleteDiscordWebhookMappingStepInput = {
  id: string
}

type DiscordWebhookMappingSnapshot = {
  id: string
  event_name: string
  webhook_url: string
  channel_name: string | null
  is_active: boolean
  message_template: string | null
  bot_name: string | null
}

type DiscordMappingService = {
  retrieveDiscordWebhookMapping: (id: string) => Promise<DiscordWebhookMappingSnapshot | null>
  softDeleteDiscordWebhookMappings: (id: string | string[]) => Promise<unknown>
  restoreDiscordWebhookMappings: (id: string | string[]) => Promise<unknown>
}

export const deleteDiscordWebhookMappingStep = createStep(
  'delete-discord-webhook-mapping',
  async (input: DeleteDiscordWebhookMappingStepInput, { container }) => {
    const discordSvc = container.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordMappingService
    const existing = await discordSvc.retrieveDiscordWebhookMapping(input.id)

    if (!existing) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Webhook mapping with ID ${input.id} not found`,
      )
    }

    await discordSvc.softDeleteDiscordWebhookMappings(input.id)

    return new StepResponse({ deleted: true, id: input.id }, input.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const discordSvc = container.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordMappingService

    await discordSvc.restoreDiscordWebhookMappings(id)
  },
)
