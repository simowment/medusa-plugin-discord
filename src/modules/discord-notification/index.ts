import { Module } from '@medusajs/framework/utils'
import DiscordNotificationModuleService from './service'
export type { DiscordNotificationOptions } from './service'
export {
  resolveDiscordNotificationOptions,
  DEFAULT_BOT_NAME,
  DEFAULT_LOCALE,
  type ResolvedDiscordNotificationOptions,
} from './config'

export const DISCORD_NOTIFICATION_MODULE = 'discordNotificationModuleService'

export default Module(DISCORD_NOTIFICATION_MODULE, {
  service: DiscordNotificationModuleService,
})
