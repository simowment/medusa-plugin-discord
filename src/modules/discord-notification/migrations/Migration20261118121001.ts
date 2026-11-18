import { Migration } from '@medusajs/framework/mikro-orm/migrations'

/** Default bot name and price locale saved from the settings page. Additive only. */
export class Migration20261118121001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "discord_plugin_setting" add column if not exists "default_bot_name" text null, add column if not exists "locale" text null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "discord_plugin_setting" drop column if exists "default_bot_name", drop column if exists "locale";`,
    )
  }
}
