import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { DISCORD_NOTIFICATION_MODULE } from '../../../../modules/discord-notification'
import type { UpdateDiscordSettingsBody } from '../validators'

type DiscordSettings = {
  avatar_url?: string
  footer_text?: string
}

type DiscordSettingsService = {
  getSettings: () => Promise<DiscordSettings>
  upsertSettings: (data: { avatar_url: string | null; footer_text: string | null }) => Promise<void>
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
  const discordSvc = req.scope.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordSettingsService
  const body = req.validatedBody

  try {
    await discordSvc.upsertSettings({
      avatar_url: body.avatar_url || null,
      footer_text: body.footer_text || null,
    })
    const settings = await discordSvc.getSettings()
    res.json({ settings })
  } catch {
    res.status(500).json({ message: 'Internal server error' })
  }
}
