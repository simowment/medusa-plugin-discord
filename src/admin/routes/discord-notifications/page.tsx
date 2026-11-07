import { defineRouteConfig } from '@medusajs/admin-sdk'
import { Discord } from '@medusajs/icons'
import SettingsPage from '../settings/discord-notifications/page'

// Same page as Settings > Discord notifications, also listed in the main sidebar so it can be
// reached without going through Settings.
export const config = defineRouteConfig({
  label: 'Discord notifications',
  icon: Discord,
})

export default SettingsPage
