import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework/http'
import {
  CreateDiscordMappingSchema,
  ListDiscordMappingsQuerySchema,
  UpdateDiscordMappingSchema,
  UpdateDiscordSettingsSchema,
} from './admin/discord/validators'

const adminAuth = authenticate('user', ['session', 'bearer'])

export default defineMiddlewares({
  routes: [
    {
      matcher: '/admin/discord/mappings',
      method: 'GET',
      middlewares: [adminAuth, validateAndTransformQuery(ListDiscordMappingsQuerySchema, {})],
    },
    {
      matcher: '/admin/discord/mappings',
      method: 'POST',
      middlewares: [adminAuth, validateAndTransformBody(CreateDiscordMappingSchema)],
    },
    {
      matcher: '/admin/discord/mappings/:id',
      method: 'POST',
      middlewares: [adminAuth, validateAndTransformBody(UpdateDiscordMappingSchema)],
    },
    {
      matcher: '/admin/discord/mappings/:id',
      method: 'DELETE',
      middlewares: [adminAuth],
    },
    {
      matcher: '/admin/discord/settings',
      method: 'GET',
      middlewares: [adminAuth],
    },
    {
      matcher: '/admin/discord/settings',
      method: 'POST',
      middlewares: [adminAuth, validateAndTransformBody(UpdateDiscordSettingsSchema)],
    },
  ],
})
