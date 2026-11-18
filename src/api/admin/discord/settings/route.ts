import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { DISCORD_NOTIFICATION_MODULE } from '../../../../modules/discord-notification'
import { DEFAULT_BOT_NAME, DEFAULT_LOCALE } from '../../../../modules/discord-notification/config'
import { upsertDiscordSettingsWorkflow } from '../../../../workflows/upsert-discord-settings'
import type { UpdateDiscordSettingsBody } from '../validators'

type DiscordSettings = {
  avatar_url?: string
  footer_text?: string
  default_bot_name?: string
  locale?: string
}

type DiscordSettingsService = {
  getSettings: () => Promise<DiscordSettings>
  getDefaultBotName: () => string
  getLocale: () => string
  isDefaultBotNameConfigured?: () => boolean
  isLocaleConfigured?: () => boolean
  getSetupHelp?: () => { text: string | null; url: string | null } | null
}

/** Where a value comes from, as the settings page shows it (S12). */
type Source = 'admin' | 'host' | 'default'

type SettingView = {
  /** The value in use. */
  value: string | null
  source: Source
  /** What applies when the saved value is cleared, and where that comes from. */
  fallback: string | null
  fallback_source: Exclude<Source, 'admin'>
}

function view(
  saved: string | undefined,
  fallback: string | null,
  fallbackSource: Exclude<Source, 'admin'>,
): SettingView {
  return saved
    ? { value: saved, source: 'admin', fallback, fallback_source: fallbackSource }
    : { value: fallback, source: fallbackSource, fallback, fallback_source: fallbackSource }
}

async function settingsResponse(discordSvc: DiscordSettingsService) {
  const settings = await discordSvc.getSettings()
  const botNameFromHost = discordSvc.isDefaultBotNameConfigured?.() ?? false
  const localeFromHost = discordSvc.isLocaleConfigured?.() ?? false
  return {
    settings,
    // Kept for older admin bundles: the bot name in use when a mapping has none.
    default_bot_name: settings.default_bot_name || discordSvc.getDefaultBotName(),
    setup_help: discordSvc.getSetupHelp?.() ?? null,
    view: {
      default_bot_name: view(
        settings.default_bot_name,
        discordSvc.getDefaultBotName() || DEFAULT_BOT_NAME,
        botNameFromHost ? 'host' : 'default',
      ),
      locale: view(
        settings.locale,
        discordSvc.getLocale() || DEFAULT_LOCALE,
        localeFromHost ? 'host' : 'default',
      ),
      avatar_url: view(settings.avatar_url, null, 'default'),
      footer_text: view(settings.footer_text, null, 'default'),
    },
    shop_slug: process.env.SHOP_SLUG || null,
  }
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const discordSvc = req.scope.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordSettingsService

  try {
    res.json(await settingsResponse(discordSvc))
  } catch {
    res.status(500).json({ message: 'Internal server error' })
  }
}

/** Saves the fields sent; an absent field keeps its value, null or "" clears it. */
export async function POST(
  req: AuthenticatedMedusaRequest<UpdateDiscordSettingsBody>,
  res: MedusaResponse,
) {
  const discordSvc = req.scope.resolve(DISCORD_NOTIFICATION_MODULE) as DiscordSettingsService
  try {
    await upsertDiscordSettingsWorkflow(req.scope).run({
      input: req.validatedBody,
    })

    res.json(await settingsResponse(discordSvc))
  } catch {
    res.status(500).json({ message: 'Internal server error' })
  }
}
