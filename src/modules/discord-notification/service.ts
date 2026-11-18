import { MedusaService } from '@medusajs/framework/utils'
import DiscordWebhookMapping from './models/discord_webhook_mapping'
import DiscordOrderMessage from './models/discord_order_message'
import { DiscordPluginSetting } from './models/discord_plugin_setting'
import type { AlertPayload } from '../../shared/types'
import {
  resolveDiscordNotificationOptions,
  safeBotName,
  type DiscordNotificationOptions,
  type ResolvedDiscordNotificationOptions,
} from './config'

export type { DiscordNotificationOptions } from './config'

class DiscordNotificationModuleService extends MedusaService({
  DiscordWebhookMapping,
  DiscordOrderMessage,
  DiscordPluginSetting,
}) {
  private options_: ResolvedDiscordNotificationOptions

  constructor(container: any, options?: DiscordNotificationOptions) {
    super(...(arguments as any))
    this.options_ = resolveDiscordNotificationOptions(options)
  }

  getDefaultBotName(): string {
    return this.options_.defaultBotName
  }

  /** Host setup hint for the Admin page, or `null` when the option is unset. */
  getSetupHelp(): { text: string | null; url: string | null } | null {
    return this.options_.setupHelp
  }

  /** Locale used to format prices in Discord messages. */
  getLocale(): string {
    return this.options_.locale
  }

  /** Values saved on the settings page; an absent key means "not saved here". */
  async getSettings(): Promise<{
    avatar_url?: string
    footer_text?: string
    default_bot_name?: string
    locale?: string
  }> {
    const settings = await this.listDiscordPluginSettings({})
    if (settings && settings.length > 0) {
      const row = settings[0] as typeof settings[0] & {
        default_bot_name?: string | null
        locale?: string | null
      }
      return {
        avatar_url: row.avatar_url ?? undefined,
        footer_text: row.footer_text ?? undefined,
        default_bot_name: row.default_bot_name ?? undefined,
        locale: row.locale ?? undefined,
      }
    }
    return {}
  }

  /** True when the plugin option (or DISCORD_DEFAULT_BOT_NAME) sets the bot name, not the default. */
  isDefaultBotNameConfigured(): boolean {
    return this.options_.defaultBotNameConfigured
  }

  /** True when the `locale` plugin option is set. */
  isLocaleConfigured(): boolean {
    return this.options_.localeConfigured
  }

  async upsertSettings(data: {
    avatar_url?: string | null
    footer_text?: string | null
    default_bot_name?: string | null
    locale?: string | null
  }): Promise<void> {
    const settings = await this.listDiscordPluginSettings({})
    if (settings && settings.length > 0) {
      await this.updateDiscordPluginSettings({
        id: settings[0].id,
        ...data,
      })
    } else {
      await this.createDiscordPluginSettings({ ...data })
    }
  }

  /**
   * Send a system alert to all active "system.alert" webhook mappings.
   * Best-effort — silently ignores failures.
   */
  async sendAlert(alert: AlertPayload): Promise<void> {
    const mappings = await this.listDiscordWebhookMappings({
      event_name: 'system.alert',
      is_active: true,
    })
    if (!mappings?.length) return

    const globalSettings = await this.getSettings()

    const payload: Record<string, unknown> = {
      username: safeBotName(globalSettings.default_bot_name || this.getDefaultBotName()),
      embeds: [
        {
          title: alert.title,
          description: alert.description,
          color: alert.color ?? 15158332,
          fields: alert.fields ?? [],
          timestamp: new Date().toISOString(),
          footer: { text: globalSettings.footer_text || 'Medusa Store' },
        },
      ],
    }
    if (globalSettings.avatar_url) {
      payload.avatar_url = globalSettings.avatar_url
    }

    await Promise.all(
      mappings.map((m: any) =>
        fetch(m.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        }).catch(() => {}),
      ),
    )
  }
}

export default DiscordNotificationModuleService
