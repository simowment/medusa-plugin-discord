import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { DISCORD_NOTIFICATION_MODULE } from '../../../../modules/discord-notification'
import { ok, parsePagination } from '../../../../shared/http'
import type { CreateDiscordMappingBody } from '../validators'

type DiscordMappingService = {
  listAndCountDiscordWebhookMappings: (
    filters: Record<string, unknown>,
    config: { take: number; skip: number; order: { created_at: 'DESC' } },
  ) => Promise<[unknown[], number]>
  createDiscordWebhookMappings: (data: {
    event_name: string
    webhook_url: string
    channel_name: string | null
    is_active: boolean
    message_template: string | null
    bot_name: string | null
  }) => Promise<unknown>
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const discordSvc = req.scope.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordMappingService
  const { limit, offset } = parsePagination(req.validatedQuery as Record<string, unknown>)

  const [mappings, count] = await discordSvc.listAndCountDiscordWebhookMappings(
    {},
    {
      take: limit,
      skip: offset,
      order: { created_at: 'DESC' },
    },
  )

  return ok(res, { mappings, count })
}

export async function POST(
  req: AuthenticatedMedusaRequest<CreateDiscordMappingBody>,
  res: MedusaResponse,
) {
  const discordSvc = req.scope.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordMappingService
  const { event_name, webhook_url, channel_name, is_active, message_template, bot_name } =
    req.validatedBody

  const mapping = await discordSvc.createDiscordWebhookMappings({
    event_name,
    webhook_url,
    channel_name: channel_name || null,
    is_active: is_active !== undefined ? is_active : true,
    message_template: message_template || null,
    bot_name: bot_name || null,
  })

  return ok(res, { mapping }, 201)
}
