import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { DISCORD_NOTIFICATION_MODULE } from '../../../../modules/discord-notification'
import { ok, parsePagination } from '../../../../shared/http'
import { createDiscordWebhookMappingWorkflow } from '../../../../workflows/create-discord-webhook-mapping'
import type { CreateDiscordMappingBody } from '../validators'

type DiscordMappingService = {
  listAndCountDiscordWebhookMappings: (
    filters: Record<string, unknown>,
    config: { take: number; skip: number; order: { created_at: 'DESC' } },
  ) => Promise<[unknown[], number]>
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
  const { result: mapping } = await createDiscordWebhookMappingWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  return ok(res, { mapping }, 201)
}
