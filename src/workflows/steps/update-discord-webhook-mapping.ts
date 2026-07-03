import { MedusaError } from '@medusajs/framework/utils'
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { DISCORD_NOTIFICATION_MODULE } from '../../modules/discord-notification'

export type UpdateDiscordWebhookMappingStepInput = {
  id: string
  event_name?: string
  webhook_url?: string
  channel_name?: string | null
  is_active?: boolean
  message_template?: string | null
  bot_name?: string | null
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

type DiscordMappingUpdateData = {
  event_name?: string
  webhook_url?: string
  channel_name?: string | null
  is_active?: boolean
  message_template?: string | null
  bot_name?: string | null
}

type DiscordMappingService = {
  retrieveDiscordWebhookMapping: (id: string) => Promise<DiscordWebhookMappingSnapshot | null>
  updateDiscordWebhookMappings: (
    data: { id: string } & DiscordMappingUpdateData,
  ) => Promise<DiscordWebhookMappingSnapshot>
}

function toSnapshot(mapping: DiscordWebhookMappingSnapshot): DiscordWebhookMappingSnapshot {
  return {
    id: mapping.id,
    event_name: mapping.event_name,
    webhook_url: mapping.webhook_url,
    channel_name: mapping.channel_name ?? null,
    is_active: mapping.is_active,
    message_template: mapping.message_template ?? null,
    bot_name: mapping.bot_name ?? null,
  }
}

function toUpdateData(input: UpdateDiscordWebhookMappingStepInput): DiscordMappingUpdateData {
  const updateData: DiscordMappingUpdateData = {}

  if (input.event_name !== undefined) updateData.event_name = input.event_name
  if (input.webhook_url !== undefined) updateData.webhook_url = input.webhook_url
  if (input.channel_name !== undefined) updateData.channel_name = input.channel_name || null
  if (input.is_active !== undefined) updateData.is_active = input.is_active
  if (input.message_template !== undefined) updateData.message_template = input.message_template || null
  if (input.bot_name !== undefined) updateData.bot_name = input.bot_name || null

  return updateData
}

export const updateDiscordWebhookMappingStep = createStep(
  'update-discord-webhook-mapping',
  async (input: UpdateDiscordWebhookMappingStepInput, { container }) => {
    const discordSvc = container.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordMappingService
    const existing = await discordSvc.retrieveDiscordWebhookMapping(input.id)

    if (!existing) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Webhook mapping with ID ${input.id} not found`,
      )
    }

    const mapping = await discordSvc.updateDiscordWebhookMappings({
      id: input.id,
      ...toUpdateData(input),
    })

    return new StepResponse(mapping, toSnapshot(existing))
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }

    const discordSvc = container.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordMappingService

    await discordSvc.updateDiscordWebhookMappings(previous)
  },
)
