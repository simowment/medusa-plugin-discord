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
  getDefaultBotName: () => string
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const discordSvc = req.scope.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordSettingsService

  try {
    const settings = await discordSvc.getSettings()
    // The fallback bot name comes from the plugin options, not from these
    // settings; it is returned read-only so the admin can show the real value.
    res.json({ settings, default_bot_name: discordSvc.getDefaultBotName() })
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
