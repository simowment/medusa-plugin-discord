/**
 * Options accepted by the Discord notification module.
 *
 * Every option is optional. Environment variables are only read as a
 * backward-compatible fallback when the matching option is unset, and only in
 * this file.
 */
export type DiscordNotificationOptions = {
  /**
   * Global fallback bot name shown in Discord when a mapping has no `bot_name`.
   * Env fallback: `DISCORD_DEFAULT_BOT_NAME`. Default: "Discord Bot".
   */
  defaultBotName?: string
  /**
   * BCP 47 locale used to format prices in messages (`Intl.NumberFormat`).
   * Default: "en-US".
   */
  locale?: string
}

export type ResolvedDiscordNotificationOptions = {
  defaultBotName: string
  locale: string
}

export const DEFAULT_BOT_NAME = 'Discord Bot'
export const DEFAULT_LOCALE = 'en-US'

export function resolveDiscordNotificationOptions(
  options: DiscordNotificationOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): ResolvedDiscordNotificationOptions {
  return {
    defaultBotName: options.defaultBotName || env.DISCORD_DEFAULT_BOT_NAME || DEFAULT_BOT_NAME,
    locale: options.locale || DEFAULT_LOCALE,
  }
}
