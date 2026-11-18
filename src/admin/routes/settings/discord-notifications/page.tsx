import {
  Container,
  Heading,
  Button,
  Input,
  Label,
  Switch,
  Table,
  Badge,
  Text,
  Select,
  FocusModal,
  toast,
  usePrompt,
} from '@medusajs/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { sdk } from '../../../lib/sdk'
import { InstallerCode } from '../../../components/ui/installer-hint'
import { SaveBar, SavedAutomatically } from '../../../components/ui/save-bar'
import { SettingRow, SettingsPage, SettingsSection } from '../../../components/ui/settings-page'
import { useUnsavedGuard } from '../../../components/ui/use-unsaved-guard'
import { getSuggestedDataPathsForEvent } from '../../../../shared/discord-fields'

const SETTINGS_QUERY_KEY = ['discord-settings']
const MAPPINGS_QUERY_KEY = ['discord-mappings']
const OPERATOR_ALERTS_QUERY_KEY = ['operator-alerts-status']

const PRIVACY_NOTE =
  'Discord is outside your store. The default messages show only the order number, statuses, items and total. ' +
  'Placeholders such as {email}, {customer.phone} or {shipping_address.city} send customer personal data to Discord; ' +
  'use them only if everyone in the channel may see it.'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

type DiscordSettings = {
  avatar_url?: string | null
  footer_text?: string | null
  default_bot_name?: string | null
  locale?: string | null
}

type DiscordMapping = {
  id: string
  event_name: string
  webhook_url: string
  channel_name?: string | null
  is_active: boolean
  message_template?: string | null
  bot_name?: string | null
}

type DiscordSettingsResponse = {
  settings?: DiscordSettings
  /** Bot name in use when a mapping has none (saved here, else the option, else the default). */
  default_bot_name?: string
  setup_help?: { text: string | null; url: string | null } | null
  view?: Record<
    'default_bot_name' | 'locale' | 'avatar_url' | 'footer_text',
    {
      value: string | null
      source: 'admin' | 'host' | 'default'
      fallback: string | null
      fallback_source: 'host' | 'default'
    }
  >
  shop_slug?: string | null
}

type OperatorAlertsStatus = { configured: boolean; channel?: string | null }

type DiscordMappingsResponse = {
  mappings?: DiscordMapping[]
}

type DiscordMutationResponse = {
  success?: boolean
  message?: string
}

const PRESET_EVENTS = [
  { value: 'order.placed', label: 'Order Placed (order.placed)' },
  { value: 'order.fulfillment_created', label: 'Fulfillment Created (order.fulfillment_created)' },
  {
    value: 'shipment.created',
    label: 'Order Shipped (shipment.created)',
  },
  { value: 'order.completed', label: 'Order Completed (order.completed)' },
  { value: 'order.canceled', label: 'Order Canceled (order.canceled)' },
  { value: 'payment.captured', label: 'Payment Captured (payment.captured)' },
  { value: 'payment.refunded', label: 'Payment Refunded (payment.refunded)' },
  { value: 'customer.created', label: 'Customer Created (customer.created)' },
  { value: 'customer.updated', label: 'Customer Updated (customer.updated)' },
]

const EXAMPLE_TEMPLATES: Record<string, string> = {
  'order.placed': JSON.stringify(
    {
      embeds: [
        {
          title: '🛍️ New Order #{display_id}!',
          description: 'A new order was just placed.',
          color: 3447003,
          fields: [
            { name: 'Total Amount', value: '**{total}**', inline: true },
            { name: 'Payment Status', value: '{payment_status}', inline: true },
          ],
          footer: { text: 'Powered by Medusa' },
        },
      ],
    },
    null,
    2,
  ),
  'order.fulfillment_created': JSON.stringify(
    {
      embeds: [
        {
          title: '📦 Fulfillment Created!',
          description: 'Items for order **#{display_id}** are being packed.',
          color: 15105570,
        },
      ],
    },
    null,
    2,
  ),
  'shipment.created': JSON.stringify(
    {
      embeds: [
        {
          title: '🚚 Order Shipped!',
          description: 'Order **#{display_id}** is on its way!\n\n**Tracking:** {tracking_links}',
          color: 3066993,
        },
      ],
    },
    null,
    2,
  ),
  'order.completed': JSON.stringify(
    {
      embeds: [
        {
          title: '✅ Order Completed!',
          description: 'Order **#{display_id}** is now complete.',
          color: 3066993,
        },
      ],
    },
    null,
    2,
  ),
  'order.canceled': JSON.stringify(
    {
      embeds: [
        {
          title: '❌ Order Canceled!',
          description: 'Order **#{display_id}** has been canceled.',
          color: 15158332,
        },
      ],
    },
    null,
    2,
  ),
  'payment.captured': JSON.stringify(
    {
      embeds: [
        {
          title: '💰 Payment Captured!',
          description: 'Payment for order **#{display_id}** was successfully captured.',
          color: 3066993,
        },
      ],
    },
    null,
    2,
  ),
  'payment.refunded': JSON.stringify(
    {
      embeds: [
        {
          title: '💸 Payment Refunded!',
          description: 'Payment for order **#{display_id}** was refunded.',
          color: 15105570,
        },
      ],
    },
    null,
    2,
  ),
  'customer.created': JSON.stringify(
    {
      embeds: [
        {
          title: '👤 New Customer!',
          description: 'A new customer account was created ({id}).',
          color: 3447003,
        },
      ],
    },
    null,
    2,
  ),
  'customer.updated': JSON.stringify(
    {
      embeds: [
        {
          title: '👤 Customer Updated!',
          description: 'Customer {id} updated their profile.',
          color: 3447003,
        },
      ],
    },
    null,
    2,
  ),
}

const EMPTY_FORM = {
  event_name: 'order.placed',
  webhook_url: '',
  channel_name: '',
  is_active: false,
  message_template: '',
  bot_name: '',
}

function MappingModal({
  open,
  onClose,
  editingId,
  editingMapping,
}: {
  open: boolean
  onClose: () => void
  editingId: string | null
  editingMapping: DiscordMapping | null
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const settingsQuery = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => sdk.client.fetch<DiscordSettingsResponse>('/admin/discord/settings'),
    enabled: open,
  })
  const defaultBotName = settingsQuery.data?.default_bot_name

  useEffect(() => {
    if (!open) return
    if (!editingId) {
      setForm({ ...EMPTY_FORM })
      return
    }
    if (editingMapping) {
      setForm({
        event_name: editingMapping.event_name,
        webhook_url: editingMapping.webhook_url,
        channel_name: editingMapping.channel_name || '',
        is_active: editingMapping.is_active,
        message_template: editingMapping.message_template || '',
        bot_name: editingMapping.bot_name || '',
      })
    }
  }, [open, editingId, editingMapping])

  const saveMapping = useMutation({
    mutationFn: () => {
      if (editingId) {
        return sdk.client.fetch<DiscordMutationResponse>(`/admin/discord/mappings/${editingId}`, {
          method: 'POST',
          body: form,
        })
      }
      return sdk.client.fetch<DiscordMutationResponse>('/admin/discord/mappings', {
        method: 'POST',
        body: form,
      })
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(editingId ? 'Mapping updated successfully' : 'Mapping created successfully')
        queryClient.invalidateQueries({ queryKey: MAPPINGS_QUERY_KEY })
        onClose()
      } else {
        toast.error(
          data.message || (editingId ? 'Failed to update mapping' : 'Failed to create mapping'),
        )
      }
    },
    onError: (error) => {
      toast.error('Mapping not saved', { description: errorMessage(error, 'Unknown error') })
    },
  })

  const handlePlaceholderClick = (placeholder: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      navigator.clipboard.writeText(`{${placeholder}}`)
      toast.success(`Copied {${placeholder}} to clipboard`)
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const newText = text.substring(0, start) + `{${placeholder}}` + text.substring(end)
    setForm({ ...form, message_template: newText })
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + placeholder.length + 2, start + placeholder.length + 2)
    }, 0)
  }

  const save = async () => {
    if (!form.webhook_url.trim()) {
      toast.error('Webhook URL is required')
      return
    }
    if (
      !form.webhook_url.startsWith('https://discord.com/api/webhooks/') &&
      !form.webhook_url.startsWith('https://discordapp.com/api/webhooks/')
    ) {
      toast.error('Please enter a valid Discord Webhook URL')
      return
    }

    saveMapping.mutate()
  }

  return (
    <FocusModal
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <FocusModal.Content className="overflow-y-auto">
        <FocusModal.Header>
          <div className="flex flex-col">
            <FocusModal.Title asChild>
              <Heading level="h2">
                {editingId ? 'Edit channel mapping' : 'New channel mapping'}
              </Heading>
            </FocusModal.Title>
            <FocusModal.Description className="sr-only">
              Choose a store event and the Discord channel webhook that receives a message for it.
            </FocusModal.Description>
          </div>
          <Button onClick={save} isLoading={saveMapping.isPending}>
            {editingId ? 'Save Changes' : 'Create Mapping'}
          </Button>
        </FocusModal.Header>

        <FocusModal.Body className="p-8">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
            {/* Left — Form controls */}
            <div className="space-y-5 md:col-span-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="modal-event-name">Event Trigger</Label>
                  <Select
                    value={form.event_name}
                    onValueChange={(val) => setForm({ ...form, event_name: val })}
                  >
                    <Select.Trigger id="modal-event-name">
                      <Select.Value placeholder="Select event..." />
                    </Select.Trigger>
                    <Select.Content>
                      {PRESET_EVENTS.map((evt) => (
                        <Select.Item key={evt.value} value={evt.value}>
                          {evt.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="modal-channel-name">Channel Label (Optional)</Label>
                  <Input
                    id="modal-channel-name"
                    placeholder="e.g. #orders, #signups"
                    value={form.channel_name}
                    onChange={(e) => setForm({ ...form, channel_name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="modal-bot-name">Bot name (optional)</Label>
                <Input
                  id="modal-bot-name"
                  placeholder={
                    defaultBotName
                      ? `Leave empty to use "${defaultBotName}"`
                      : 'Leave empty to use the default name'
                  }
                  value={form.bot_name}
                  onChange={(e) => setForm({ ...form, bot_name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="modal-webhook-url">Discord Webhook URL</Label>
                <Input
                  id="modal-webhook-url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={form.webhook_url}
                  onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label htmlFor="modal-message-template">Custom Message Template (Optional)</Label>
                  <div className="flex items-center gap-3">
                    <Text
                      size="xsmall"
                      className="text-ui-fg-interactive cursor-pointer transition-colors hover:underline"
                      onClick={() =>
                        setForm({
                          ...form,
                          message_template:
                            EXAMPLE_TEMPLATES[form.event_name] || EXAMPLE_TEMPLATES['order.placed'],
                        })
                      }
                    >
                      Load Example
                    </Text>
                    <span className="text-ui-fg-subtle text-[10px]">Supports Discord Markdown</span>
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  id="modal-message-template"
                  rows={7}
                  className="border-ui-border-base bg-ui-bg-component text-ui-fg-base placeholder-ui-fg-muted focus:ring-ui-border-interactive flex min-h-[160px] w-full rounded-md border px-3 py-2 font-mono text-sm focus:ring-1 focus:outline-none"
                  placeholder={
                    EXAMPLE_TEMPLATES[form.event_name] ||
                    'Leave empty to use the default rich embed layout.'
                  }
                  value={form.message_template}
                  onChange={(e) => setForm({ ...form, message_template: e.target.value })}
                />
                <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                  Leave empty for the default message. {PRIVACY_NOTE}
                </Text>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="modal-active-toggle"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label htmlFor="modal-active-toggle">Enabled</Label>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  New mappings start disabled. When enabled, every matching store event posts to
                  this channel.
                </Text>
              </div>
            </div>

            {/* Right — Placeholder reference */}
            <div className="bg-ui-bg-component border-ui-border-base flex max-h-[480px] flex-col rounded-md border p-4">
              <Heading level="h3" className="mb-1 text-sm font-semibold">
                Available Placeholders
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mb-3">
                Click to insert at cursor in the template.
              </Text>
              <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                {getSuggestedDataPathsForEvent(form.event_name).map((field) => (
                  <div
                    key={field}
                    onClick={() => handlePlaceholderClick(field)}
                    className="hover:bg-ui-bg-subtle hover:border-ui-border-base group flex cursor-pointer items-center justify-between rounded-md border border-transparent px-2.5 py-1.5 transition-all"
                  >
                    <code className="text-ui-fg-interactive font-mono text-xs">{`{${field}}`}</code>
                    <span className="text-ui-fg-muted text-[10px] opacity-0 transition-opacity group-hover:opacity-100">
                      Insert
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}

type SourceKind = 'admin' | 'host' | 'default'

type AppearanceForm = {
  default_bot_name: string
  locale: string
  avatar_url: string
  footer_text: string
}

const APPEARANCE_FIELDS: Array<keyof AppearanceForm> = [
  'default_bot_name',
  'locale',
  'avatar_url',
  'footer_text',
]

function savedForm(data?: DiscordSettingsResponse): AppearanceForm {
  const settings = data?.settings
  return {
    default_bot_name: settings?.default_bot_name || '',
    locale: settings?.locale || '',
    avatar_url: settings?.avatar_url || '',
    footer_text: settings?.footer_text || '',
  }
}

function pricePreview(locale: string): string | null {
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: 'currency',
      currency: 'EUR',
    }).format(1234.5)
  } catch {
    return null
  }
}

function hostEnvCommand(slug: string | null | undefined): string {
  const shop = slug || '<slug>'
  return `$EDITOR shops/${shop}/.env && node cli/bin/igm.mjs shop up --shop ${shop}`
}

/** "Message appearance": bot name, price format, avatar and footer. One form, one SaveBar. */
function AppearanceSection({
  data,
  form,
  setForm,
}: {
  data?: DiscordSettingsResponse
  form: AppearanceForm
  setForm: (next: AppearanceForm) => void
}) {
  const v = data?.view
  const botFallback = v?.default_bot_name.fallback ?? data?.default_bot_name ?? 'Store Bot'
  const localeFallback = v?.locale.fallback ?? 'en-US'
  const preview = pricePreview(form.locale.trim() || localeFallback)
  const command = hostEnvCommand(data?.shop_slug)
  const sourceOf = (field: keyof AppearanceForm): SourceKind =>
    form[field].trim() ? 'admin' : (v?.[field]?.fallback_source ?? 'default')

  return (
    <SettingsSection
      id="appearance"
      title="Message appearance"
      description="How messages from every mapping look in Discord. Changes apply to the next message."
    >
      <SettingRow
        label="Default bot name"
        htmlFor="discord-bot-name"
        source={sourceOf('default_bot_name')}
        help={`The sender name shown in Discord when a mapping has no bot name of its own. Leave empty to use "${botFallback}". Discord refuses names that contain "discord" or "clyde"; those words are removed.`}
        technical={
          <div className="flex flex-col gap-2">
            <Text size="xsmall" className="text-ui-fg-subtle">
              Saved here, this wins over the plugin option{' '}
              <code className="font-mono">defaultBotName</code> and the variable{' '}
              <code className="font-mono">DISCORD_DEFAULT_BOT_NAME</code>. To change that default on
              the host:
            </Text>
            <InstallerCode>{command}</InstallerCode>
          </div>
        }
        control={
          <Input
            id="discord-bot-name"
            size="small"
            maxLength={80}
            placeholder={botFallback}
            value={form.default_bot_name}
            onChange={(e) => setForm({ ...form, default_bot_name: e.target.value })}
          />
        }
      />
      <SettingRow
        label="Price format"
        htmlFor="discord-locale"
        source={sourceOf('locale')}
        help={`Language and region used to write prices in messages, such as en-US or fr-FR. Leave empty to use ${localeFallback}.`}
        technical={
          <Text size="xsmall" className="text-ui-fg-subtle">
            Saved here, this wins over the plugin option <code className="font-mono">locale</code>{' '}
            (a BCP 47 language tag passed to <code className="font-mono">Intl.NumberFormat</code>).
          </Text>
        }
        control={
          <div className="flex flex-col gap-1">
            <Input
              id="discord-locale"
              size="small"
              maxLength={35}
              placeholder={localeFallback}
              value={form.locale}
              onChange={(e) => setForm({ ...form, locale: e.target.value })}
            />
            <Text size="xsmall" className={preview ? 'text-ui-fg-subtle' : 'text-ui-fg-error'}>
              {preview
                ? `Example: ${preview}`
                : 'Not a language tag this server knows. Try en-US or fr-FR.'}
            </Text>
          </div>
        }
      />
      <SettingRow
        label="Avatar image URL"
        htmlFor="discord-avatar"
        source={sourceOf('avatar_url')}
        help="Image used as the bot's picture for every mapping. Leave empty to use Discord's default picture."
        control={
          <Input
            id="discord-avatar"
            size="small"
            placeholder="https://example.com/logo.png"
            value={form.avatar_url}
            onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
          />
        }
      />
      <SettingRow
        label="Footer text"
        htmlFor="discord-footer"
        source={sourceOf('footer_text')}
        help='Text at the bottom of the default order and customer messages. Leave empty to use "Medusa Storefront" (alerts: "Medusa Store").'
        control={
          <Input
            id="discord-footer"
            size="small"
            placeholder="Medusa Storefront"
            value={form.footer_text}
            onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
          />
        }
      />
    </SettingsSection>
  )
}

function DiscordNotificationsPage() {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingMapping, setEditingMapping] = useState<DiscordMapping | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const mappingsQuery = useQuery({
    queryKey: MAPPINGS_QUERY_KEY,
    queryFn: () => sdk.client.fetch<DiscordMappingsResponse>('/admin/discord/mappings'),
  })

  // Operator alerts (failed supplier orders, store problems) use a separate
  // webhook set on Settings > Notifications; this page only shows its state.
  // An older backend without the status route answers 404: show "unknown".
  const operatorAlertsQuery = useQuery({
    queryKey: OPERATOR_ALERTS_QUERY_KEY,
    queryFn: async (): Promise<OperatorAlertsStatus | null> => {
      try {
        return await sdk.client.fetch<OperatorAlertsStatus>('/admin/operator-alerts/status')
      } catch (error) {
        if ((error as { status?: number })?.status === 404) return null
        throw error
      }
    },
    retry: false,
  })
  const operatorAlerts = operatorAlertsQuery.data

  const settingsQuery = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => sdk.client.fetch<DiscordSettingsResponse>('/admin/discord/settings'),
  })
  const setupHelp = settingsQuery.data?.setup_help

  // Appearance form: hydrated once from the saved values, then edited locally.
  const [form, setForm] = useState<AppearanceForm>(savedForm())
  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current && settingsQuery.isSuccess) {
      setForm(savedForm(settingsQuery.data))
      hydrated.current = true
    }
  }, [settingsQuery.isSuccess, settingsQuery.data])
  const saved = savedForm(settingsQuery.data)
  const dirty =
    hydrated.current &&
    APPEARANCE_FIELDS.some((field) => form[field].trim() !== saved[field].trim())
  useUnsavedGuard(dirty)
  const localeInvalid = form.locale.trim() !== '' && pricePreview(form.locale.trim()) === null

  const saveSettings = useMutation({
    mutationFn: () =>
      sdk.client.fetch<DiscordSettingsResponse>('/admin/discord/settings', {
        method: 'POST',
        body: Object.fromEntries(
          APPEARANCE_FIELDS.map((field) => [field, form[field].trim() || null]),
        ),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, data)
      setForm(savedForm(data))
      toast.success('Message appearance saved')
    },
    onError: (error) => {
      toast.error('Settings not saved', { description: errorMessage(error, 'Unknown error') })
    },
  })

  const mappings = mappingsQuery.data?.mappings || []
  const loading = mappingsQuery.isLoading

  const deleteMappingMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<DiscordMutationResponse>(`/admin/discord/mappings/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Mapping deleted')
        queryClient.invalidateQueries({ queryKey: MAPPINGS_QUERY_KEY })
      } else {
        toast.error(data.message || 'Failed to delete mapping')
      }
    },
    onError: (error) => {
      toast.error('Mapping not deleted', { description: errorMessage(error, 'Unknown error') })
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) =>
      sdk.client.fetch<DiscordMutationResponse>(`/admin/discord/mappings/${id}`, {
        method: 'POST',
        body: { is_active: checked },
      }),
    onSuccess: (data, variables) => {
      if (data.success) {
        toast.success(variables.checked ? 'Mapping turned on' : 'Mapping turned off')
        queryClient.invalidateQueries({ queryKey: MAPPINGS_QUERY_KEY })
      } else {
        toast.error(data.message || 'Failed to toggle status')
      }
    },
    onError: (error) => {
      toast.error('Status not changed', { description: errorMessage(error, 'Unknown error') })
    },
  })

  const testWebhookMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<DiscordMutationResponse>('/admin/discord/verify', {
        method: 'POST',
        body: { id },
      }),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Sample message sent to Discord')
      } else {
        toast.error(data.message || 'Sample message not sent')
      }
    },
    onError: (error) => {
      toast.error('Sample message not sent', { description: errorMessage(error, 'Unknown error') })
    },
    onSettled: () => {
      setTestingId(null)
    },
  })

  const openAdd = () => {
    setEditingId(null)
    setEditingMapping(null)
    setModalOpen(true)
  }

  const openEdit = (m: DiscordMapping) => {
    setEditingId(m.id)
    setEditingMapping(m)
    setModalOpen(true)
  }

  const deleteMapping = async (m: DiscordMapping) => {
    const confirmed = await prompt({
      title: 'Delete this mapping?',
      description: `"${m.event_name}" events will no longer post to ${m.channel_name || 'this channel'}.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    })
    if (!confirmed) return
    deleteMappingMutation.mutate(m.id)
  }

  const testWebhook = async (m: DiscordMapping) => {
    const confirmed = await prompt({
      title: 'Send a sample message?',
      description: `Sends a sample message to ${m.channel_name || 'this Discord channel'} now. Everyone in the channel will see it. It uses made-up order data.`,
      confirmText: 'Send sample',
      cancelText: 'Cancel',
      variant: 'confirmation',
    })
    if (!confirmed) return
    setTestingId(m.id)
    testWebhookMutation.mutate(m.id)
  }

  const maskWebhookUrl = (url: string) => {
    if (!url) return ''
    try {
      const parts = url.split('/webhooks/')
      if (parts.length < 2) return url
      const [id, token] = parts[1].split('/')
      return `.../webhooks/${id.slice(0, 4)}...${id.slice(-4)}/${token.slice(0, 6)}...${token.slice(-6)}`
    } catch {
      return '.../webhooks/xxxx/xxxx'
    }
  }

  const activeCount = mappings.filter((m) => m.is_active).length

  return (
    <SettingsPage
      title="Discord notifications"
      subtitle="Optional: post a message to a Discord channel when a store event happens (a new order, a shipment, a new customer). Each mapping links one event to one channel webhook (the channel's posting address in Discord)."
      back={{ to: '/settings/apps', label: 'Apps' }}
    >
      <MappingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingId={editingId}
        editingMapping={editingMapping}
      />

      <SettingsSection id="channels" title="Which events go where" description={PRIVACY_NOTE}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            {loading
              ? 'Checking…'
              : mappingsQuery.isError
                ? 'Could not load the mappings.'
                : mappings.length === 0
                  ? 'No mappings yet: nothing is posted to Discord.'
                  : `${activeCount} of ${mappings.length} ${mappings.length === 1 ? 'mapping is' : 'mappings are'} on. Each switch saves at once.`}
          </Text>
          <div className="flex items-center gap-3">
            {mappings.length > 0 ? <SavedAutomatically /> : null}
            <Button variant="secondary" size="small" onClick={openAdd}>
              Add mapping
            </Button>
          </div>
        </div>
        {mappingsQuery.isError ? (
          <div className="px-6 py-4">
            <Text size="small" className="text-ui-fg-error">
              Could not load the mappings:{' '}
              {errorMessage(mappingsQuery.error, 'the server returned an error')}.{' '}
              <button
                type="button"
                className="text-ui-fg-interactive hover:underline"
                onClick={() => void mappingsQuery.refetch()}
              >
                Try again
              </button>
            </Text>
          </div>
        ) : loading || mappings.length === 0 ? null : (
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Event</Table.HeaderCell>
                  <Table.HeaderCell>Channel label</Table.HeaderCell>
                  <Table.HeaderCell>Webhook</Table.HeaderCell>
                  <Table.HeaderCell>On</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {mappings.map((m) => (
                  <Table.Row key={m.id}>
                    <Table.Cell>
                      <button type="button" className="text-left" onClick={() => openEdit(m)}>
                        <Badge color="blue">{m.event_name}</Badge>
                      </button>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="font-mono">
                        {m.channel_name || '—'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="text-ui-fg-subtle font-mono">
                        {maskWebhookUrl(m.webhook_url)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Switch
                          aria-label={`Post ${m.event_name} to Discord`}
                          checked={m.is_active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: m.id, checked })
                          }
                        />
                        <Text size="small" className="text-ui-fg-subtle">
                          {m.is_active ? 'On' : 'Off'}
                        </Text>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => void testWebhook(m)}
                          isLoading={testingId === m.id}
                        >
                          Send test
                        </Button>
                        <Button variant="secondary" size="small" onClick={() => openEdit(m)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="small" onClick={() => void deleteMapping(m)}>
                          Delete
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </SettingsSection>

      {settingsQuery.isError ? (
        <Container className="px-6 py-4">
          <Text size="small" className="text-ui-fg-error">
            Could not load the message settings:{' '}
            {errorMessage(settingsQuery.error, 'the server returned an error')}.{' '}
            <button
              type="button"
              className="text-ui-fg-interactive hover:underline"
              onClick={() => void settingsQuery.refetch()}
            >
              Try again
            </button>
          </Text>
        </Container>
      ) : settingsQuery.isLoading ? (
        <Container className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Checking…
          </Text>
        </Container>
      ) : (
        <AppearanceSection data={settingsQuery.data} form={form} setForm={setForm} />
      )}

      <SettingsSection
        id="alerts"
        title="Alerts for you"
        description="Alerts for problems that need you (failed supplier orders, store problems, approvals) do not use the mappings above. They have their own settings."
      >
        <SettingRow
          label="Operator alerts"
          help={
            operatorAlerts?.configured && operatorAlerts.channel
              ? `Sent to: ${operatorAlerts.channel}.`
              : !operatorAlertsQuery.isLoading && !operatorAlerts
                ? 'This backend does not report their state.'
                : undefined
          }
          control={
            <div className="flex flex-wrap items-center gap-3">
              {operatorAlertsQuery.isLoading ? (
                <Text size="small" className="text-ui-fg-subtle">
                  Checking…
                </Text>
              ) : operatorAlerts ? (
                <Badge size="2xsmall" color={operatorAlerts.configured ? 'green' : 'grey'}>
                  {operatorAlerts.configured ? 'On' : 'Off'}
                </Badge>
              ) : (
                <Badge size="2xsmall" color="grey">
                  Not checked yet
                </Badge>
              )}
              <a
                href={
                  setupHelp?.url && setupHelp.url.startsWith('/') && !setupHelp.url.startsWith('//')
                    ? setupHelp.url
                    : '/app/settings/notifications'
                }
                className="txt-compact-small-plus text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              >
                Change on Settings &gt; Notifications
              </a>
            </div>
          }
        />
      </SettingsSection>

      <SaveBar
        dirty={dirty}
        saving={saveSettings.isPending}
        disabled={localeInvalid}
        onSave={() => saveSettings.mutate()}
        onDiscard={() => setForm(savedForm(settingsQuery.data))}
      />
    </SettingsPage>
  )
}

// No sidebar label: Settings > Apps and Settings > Notifications link here, so the page has a
// single entry point. The route itself stays, so old links keep working.

export default DiscordNotificationsPage
