# @sam-ael/medusa-plugin-discord

Discord webhook notifications for **Medusa v2**. Route store events to Discord channels with rich embeds that are edited in place as an order moves from placed to fulfilled, shipped, completed or canceled. Webhook mappings, templates and branding are managed from the Medusa Admin.

> Originally created by [SAM-AEL](https://www.github.com/SAM-AEL). This repository is a maintained fork; the package name and original attribution are kept.

## Features

- **Live message editing**: one Discord message per order and webhook, edited in place on later events. No channel spam.
- **Shipment & tracking**: shows tracking numbers and links as Discord markdown once a fulfillment is shipped.
- **Default rich embeds**: color-coded order, payment, fulfillment and shipment status, total and items (no customer personal data).
- **Custom templates**: plain-text/Markdown or full JSON webhook payloads with `{placeholders}`.
- **Per-mapping bot name**, plus a global default from plugin options.
- **Global avatar and footer** configurable from the Admin UI.
- **Admin UI** under Settings → Discord notifications, with a placeholder sidebar, a confirmed "Send test" button and a read-only operator alerts status.
- **Privacy by default**: default messages carry the order number, statuses, items and total, never customer names, emails, phones or addresses. New mappings start disabled.
- **System alerts**: other code can call `sendAlert()` on the module service to post to `system.alert` mappings.

## Compatibility

| Requirement | Version                                               |
| ----------- | ----------------------------------------------------- |
| Medusa      | `^2.21.2` (`@medusajs/framework`, `@medusajs/medusa`) |
| Admin       | `@medusajs/ui ^4.0.25`, React 18                      |
| Node.js     | `>= 20.19.0`                                          |

## Installation

```bash
pnpm add @sam-ael/medusa-plugin-discord
```

Register it in `medusa-config.ts`:

```ts
import type { DiscordNotificationOptions } from '@sam-ael/medusa-plugin-discord/modules/discord-notification'

module.exports = defineConfig({
  // ...
  plugins: [
    {
      resolve: '@sam-ael/medusa-plugin-discord',
      options: {
        defaultBotName: 'Store Bot',
      } satisfies DiscordNotificationOptions,
    },
  ],
})
```

Medusa passes plugin options to the plugin's auto-registered module. If your setup also registers the module explicitly (some local/workspace setups need this), pass the options on that entry too, because an explicit module entry replaces the auto-registered one:

```ts
modules: [
  {
    resolve: require.resolve('@sam-ael/medusa-plugin-discord/modules/discord-notification'),
    options: { defaultBotName: 'Store Bot' },
  },
],
```

Then run the migrations (see below) and open **Settings → Discord notifications** in the Admin.

## Configuration

All options are optional. They are resolved in one place (`src/modules/discord-notification/config.ts`); the environment variable is only read when the option is unset.

| Option           | Env fallback               | Default         | Description                                                                 |
| ---------------- | -------------------------- | --------------- | --------------------------------------------------------------------------- |
| `defaultBotName` | `DISCORD_DEFAULT_BOT_NAME` | `"Store Bot"` | Bot name used when a mapping has no `bot_name`. Discord rejects names containing "discord" or "clyde", so those words are removed from every bot name. |
| `locale`         | none                       | `"en-US"`       | Locale passed to `Intl.NumberFormat` when formatting prices in the order currency. |
| `setupHelp`      | none                       | unset           | Optional `{ text?: string; url?: string }` hint shown on the Admin page, for hosts that set up the operator alerts webhook their own way. Returned by `GET /admin/discord/settings` as `setup_help`. |

Webhook URLs are not plugin options: each one is stored on a mapping created in the Admin (or through the admin API). Nothing is sent until at least one active mapping exists.

Settings stored in the database and edited in the Admin:

| Setting       | Default when empty                                                   | Description                         |
| ------------- | -------------------------------------------------------------------- | ----------------------------------- |
| `avatar_url`  | Discord webhook default avatar                                       | Avatar image URL for all messages.  |
| `footer_text` | `"Medusa Storefront"` (event embeds), `"Medusa Store"` (system alerts) | Footer text of default embeds.      |

## Database / migrations

```bash
npx medusa db:migrate
```

| Table                     | Purpose                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `discord_webhook_mapping` | Event name → webhook URL, channel label, active flag, template, bot name.  |
| `discord_order_message`   | Discord message ID posted per order and webhook URL, used for in-place edits. |
| `discord_plugin_setting`  | Single row with global `avatar_url` and `footer_text`.                     |

## API routes

All routes are admin routes and require an authenticated admin user (session or bearer).

| Method   | Path                          | Purpose                                                                 |
| -------- | ----------------------------- | ----------------------------------------------------------------------- |
| `GET`    | `/admin/discord/mappings`     | List mappings. Query: `limit` (default 50, max 100), `offset`.          |
| `POST`   | `/admin/discord/mappings`     | Create a mapping.                                                       |
| `POST`   | `/admin/discord/mappings/:id` | Update a mapping.                                                       |
| `DELETE` | `/admin/discord/mappings/:id` | Delete a mapping.                                                       |
| `GET`    | `/admin/discord/settings`     | Read global avatar and footer settings, plus the read-only `default_bot_name` and `setup_help` from the plugin options. |
| `POST`   | `/admin/discord/settings`     | Update global avatar and footer settings.                               |
| `POST`   | `/admin/discord/verify`       | Send a sample message for mapping `id` (body or query) to the real channel now, using sample data. Gives up after 10 s (`504 WEBHOOK_TIMEOUT`). |

Mapping payload:

```json
{
  "event_name": "order.placed",
  "webhook_url": "https://discord.com/api/webhooks/...",
  "channel_name": "#orders",
  "bot_name": "Sales Bot",
  "is_active": true,
  "message_template": "New order **#{display_id}**: **{total}**"
}
```

`webhook_url` must start with `https://discord.com/api/webhooks/` or `https://discordapp.com/api/webhooks/`. `is_active` defaults to `false` when omitted.

## Admin UI

- **Route**: Settings → Discord notifications (`src/admin/routes/settings/discord-notifications/page.tsx`).
- **Operator alerts line**: read-only "Configured / Not configured" from `GET /admin/operator-alerts/status` (provided by the host backend, not this plugin; a 404 shows "Unknown"). Operator alerts use their own webhook, which the host sets up outside this plugin (for example on a host settings page). The optional `setupHelp` text and link are shown under this line; a `url` starting with a single `/` (a page in the same admin, such as `/app/settings/operator-alerts`) opens in the same tab, any other URL in a new tab.
- **Mappings tab**: create, edit, enable/disable, delete (with a confirmation) and send a sample message (with a confirmation that it posts to the real channel now). New mappings start disabled. The bot name field shows the real fallback name. A sidebar lists placeholders for the selected event and inserts them at the cursor, with a privacy note on the personal-data placeholders.
- **Appearance tab**: the fallback bot name (read-only, from `defaultBotName`), global avatar URL and footer text.

The event picker offers `order.placed`, `order.fulfillment_created`, `fulfillment.shipment_created`, `order.completed`, `order.canceled`, `payment.captured`, `payment.refunded`, `customer.created` and `customer.updated`.

## Events, subscribers & scheduled jobs

One subscriber (`src/subscribers/discord-notifier.ts`) listens to:

`order.placed`, `order.completed`, `order.canceled`, `order.updated`, `order.fulfillment_created`, `fulfillment.created`, `fulfillment.shipment_created`, `shipment.created`, `customer.created`, `customer.updated`, `payment.captured`, `payment.refunded`.

- **Customer events** post a new message to every active mapping for that event.
- **Order-related events** resolve the order (directly, or via fulfillment, payment or payment collection), then edit the messages already posted for that order on webhooks that still have an active mapping, and post a new message to mappings for this event on webhooks that have none yet. If a message was deleted in Discord, a new one is posted.
- **System alerts**: `sendAlert({ title, description, color?, fields? })` on the module service (container key `discordNotificationModuleService`) posts to every active `system.alert` mapping. Failures are ignored.

There are no scheduled jobs. To stop notifications, disable or delete the mappings; with no active mappings the subscriber sends nothing.

Delivery errors are logged and never fail the originating Medusa workflow.

## Template placeholders

Templates use `{path}` placeholders resolved against the event data. Price paths (`total`, `subtotal`, `*.total`, `*.subtotal`, `*.price`, `*.unit_price`) are formatted in the order currency with the `locale` option. An `items` array is rendered as a bulleted list. If the compiled template is valid JSON it is sent as the webhook payload (for custom embeds); otherwise it is sent as `content`.

### Order events

| Placeholder                     | Description                                          |
| ------------------------------- | ---------------------------------------------------- |
| `{id}` / `{display_id}`         | Order ID / human-readable order number               |
| `{status}`                      | Order status                                         |
| `{total}` / `{subtotal}`        | Formatted totals                                     |
| `{currency_code}`               | Currency code                                        |
| `{email}`                       | Order email                                          |
| `{payment_status}`              | Payment status                                       |
| `{fulfillment_status}`          | Fulfillment status                                   |
| `{shipment_status}`             | `Pending`, `Fulfillment Created` or `Shipped`        |
| `{tracking_numbers}`            | Comma-separated tracking numbers                     |
| `{tracking_links}`              | Tracking numbers as Discord markdown links           |
| `{thumbnail}`                   | First item's thumbnail URL                           |
| `{items}`                       | Bulleted item list with quantity and unit price      |
| `{shipping_address.first_name}`, `{shipping_address.last_name}`, `{shipping_address.city}`, `{shipping_address.phone}` | Shipping address fields |
| `{billing_address.first_name}`, `{billing_address.last_name}`, `{billing_address.phone}` | Billing address fields |
| `{customer.first_name}`, `{customer.last_name}`, `{customer.email}`, `{customer.phone}` | Customer fields |

### Customer events

`{id}`, `{email}`, `{first_name}`, `{last_name}`, `{phone}`.

## Message lifecycle

```
order.placed                 → POST new message, message_id saved
order.fulfillment_created    → PATCH same message (Fulfillment Created)
fulfillment.shipment_created → PATCH same message (Shipped + tracking)
order.completed              → PATCH same message (Completed, green)
order.canceled               → PATCH same message (Canceled, red)
```

## Storefront integration

None needed. The plugin works entirely from backend events and the Admin.

## Security notes

- Discord webhook URLs are secrets: anyone with the URL can post to the channel. They are stored in plain text in `discord_webhook_mapping` and returned by the admin mappings API, so restrict admin access accordingly.
- Default messages include order details only (number, statuses, items, total; customer events show the customer ID). Placeholders such as `{email}`, `{customer.phone}` or `{shipping_address.city}` send personal data to Discord; use them only in private channels whose members may see it.
- Admin routes require an authenticated admin user. Logs only include the webhook ID segment, not the full URL, for customer notifications.
- The test-send route uses fixed sample data (`example.com` addresses), not real customers.

## Limitations / status

- Messages are formatted in English; only price formatting follows the `locale` option.
- `return.*`, `claim.created`, `exchange.created` and `fulfillment.delivery_created` appear in the placeholder helper but are not subscribed to, so mappings for them never fire.
- Customer and system-alert messages are always new posts; only order-related messages are edited in place.
- No retry queue: a failed webhook call is logged and dropped.

## Development

```bash
pnpm typecheck
pnpm build
```

## License

MIT. Copyright (c) 2026 SAM-AEL. See [LICENSE](./LICENSE).
