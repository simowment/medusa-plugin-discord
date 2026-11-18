import { model } from '@medusajs/framework/utils'

/**
 * Settings saved on Settings > Discord notifications. One row. `null` means "not saved here":
 * the plugin option (or its built-in default) applies.
 */
export const DiscordPluginSetting = model.define('discord_plugin_setting', {
  id: model.id().primaryKey(),
  avatar_url: model.text().nullable(),
  footer_text: model.text().nullable(),
  /** Bot name for mappings without their own; wins over the `defaultBotName` option. */
  default_bot_name: model.text().nullable(),
  /** BCP 47 locale for prices in messages; wins over the `locale` option. */
  locale: model.text().nullable(),
})
