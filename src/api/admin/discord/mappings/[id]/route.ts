import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { DISCORD_NOTIFICATION_MODULE } from '../../../../../modules/discord-notification'
import { ok, fail } from '../../../../../shared/http'
import type { UpdateDiscordMappingBody } from '../../validators'

type DiscordMappingUpdateData = {
  event_name?: string
  webhook_url?: string
  channel_name?: string | null
  is_active?: boolean
  message_template?: string | null
  bot_name?: string | null
}

type DiscordMappingService = {
  retrieveDiscordWebhookMapping: (id: string) => Promise<unknown | null>
  updateDiscordWebhookMappings: (
    data: { id: string } & DiscordMappingUpdateData,
  ) => Promise<unknown>
  deleteDiscordWebhookMappings: (id: string) => Promise<void>
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

export async function POST(
  req: AuthenticatedMedusaRequest<UpdateDiscordMappingBody>,
  res: MedusaResponse,
) {
  const discordSvc = req.scope.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordMappingService
  const { id } = req.params
  const { event_name, webhook_url, channel_name, is_active, message_template, bot_name } =
    req.validatedBody

  try {
    const existing = await discordSvc.retrieveDiscordWebhookMapping(id)
    if (!existing) {
      return fail(res, 404, 'NOT_FOUND', `Webhook mapping with ID ${id} not found`)
    }

    const updateData: DiscordMappingUpdateData = {}
    if (event_name !== undefined) updateData.event_name = event_name
    if (webhook_url !== undefined) updateData.webhook_url = webhook_url
    if (channel_name !== undefined) updateData.channel_name = channel_name || null
    if (is_active !== undefined) updateData.is_active = is_active
    if (message_template !== undefined) updateData.message_template = message_template || null
    if (bot_name !== undefined) updateData.bot_name = bot_name || null

    const mapping = await discordSvc.updateDiscordWebhookMappings({
      id,
      ...updateData,
    })

    return ok(res, { mapping })
  } catch (err: unknown) {
    return fail(res, 500, 'ERROR', getErrorMessage(err, 'Failed to update webhook mapping'))
  }
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const discordSvc = req.scope.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordMappingService
  const { id } = req.params

  try {
    const existing = await discordSvc.retrieveDiscordWebhookMapping(id)
    if (!existing) {
      return fail(res, 404, 'NOT_FOUND', `Webhook mapping with ID ${id} not found`)
    }

    await discordSvc.deleteDiscordWebhookMappings(id)

    return ok(res, { deleted: true, id })
  } catch (err: unknown) {
    return fail(res, 500, 'ERROR', getErrorMessage(err, 'Failed to delete webhook mapping'))
  }
}
