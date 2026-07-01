import { z } from '@medusajs/framework/zod'

const DiscordWebhookUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      value.startsWith('https://discord.com/api/webhooks/') ||
      value.startsWith('https://discordapp.com/api/webhooks/'),
    'webhook_url must be a valid Discord Webhook URL',
  )

const OptionalTextSchema = z.string().trim().nullable().optional()

const PaginationValueSchema = z.union([z.string(), z.number(), z.array(z.string())]).optional()

export const ListDiscordMappingsQuerySchema = z
  .object({
    limit: PaginationValueSchema,
    offset: PaginationValueSchema,
  })
  .passthrough()

export type ListDiscordMappingsQuery = z.infer<typeof ListDiscordMappingsQuerySchema>

export const CreateDiscordMappingSchema = z
  .object({
    event_name: z.string().trim().min(1),
    webhook_url: DiscordWebhookUrlSchema,
    channel_name: OptionalTextSchema,
    is_active: z.boolean().optional(),
    message_template: OptionalTextSchema,
    bot_name: OptionalTextSchema,
  })
  .strict()

export type CreateDiscordMappingBody = z.infer<typeof CreateDiscordMappingSchema>

export const UpdateDiscordMappingSchema = z
  .object({
    event_name: z.string().trim().min(1).optional(),
    webhook_url: DiscordWebhookUrlSchema.optional(),
    channel_name: OptionalTextSchema,
    is_active: z.boolean().optional(),
    message_template: OptionalTextSchema,
    bot_name: OptionalTextSchema,
  })
  .strict()

export type UpdateDiscordMappingBody = z.infer<typeof UpdateDiscordMappingSchema>

export const UpdateDiscordSettingsSchema = z
  .object({
    avatar_url: OptionalTextSchema,
    footer_text: OptionalTextSchema,
  })
  .strict()

export type UpdateDiscordSettingsBody = z.infer<typeof UpdateDiscordSettingsSchema>
