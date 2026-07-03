import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { DISCORD_NOTIFICATION_MODULE } from '../../../../modules/discord-notification'
import { upsertDiscordSettingsWorkflow } from '../../../../workflows/upsert-discord-settings'
import type { UpdateDiscordSettingsBody } from '../validators'

type DiscordSettings = {
  avatar_url?: string
  footer_text?: string
}

type DiscordSettingsService = {
  getSettings: () => Promise<DiscordSettings>
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const discordSvc = req.scope.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordSettingsService

  try {
    const settings = await discordSvc.getSettings()
    res.json({ settings })
  } catch {
    res.status(500).json({ message: 'Internal server error' })
  }
}

export async function POST(
  req: AuthenticatedMedusaRequest<UpdateDiscordSettingsBody>,
  res: MedusaResponse,
) {
  try {
    const { result: settings } = await upsertDiscordSettingsWorkflow(req.scope).run({
      input: req.validatedBody,
    })

    res.json({ settings })
  } catch {
    res.status(500).json({ message: 'Internal server error' })
  }
}
