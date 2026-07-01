import Medusa from '@medusajs/js-sdk'

declare const __BACKEND_URL__: string

export const sdk = new Medusa({
  baseUrl: __BACKEND_URL__,
  auth: {
    type: 'session',
  },
})
