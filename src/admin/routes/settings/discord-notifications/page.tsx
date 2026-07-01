import { defineRouteConfig } from '@medusajs/admin-sdk'
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
  Tabs,
} from '@medusajs/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { sdk } from '../../../lib/sdk'
import { getSuggestedDataPathsForEvent } from '../../../../shared/discord-fields'

const SETTINGS_QUERY_KEY = ['discord-settings']
const MAPPINGS_QUERY_KEY = ['discord-mappings']

type DiscordSettings = {
  avatar_url?: string | null
  footer_text?: string | null
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
}

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
    value: 'fulfillment.shipment_created',
    label: 'Shipment Created (fulfillment.shipment_created)',
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
          description: 'An order was just placed by **{email}**.',
          color: 3447003,
          fields: [
            { name: 'Total Amount', value: '**{total}**', inline: true },
            { name: 'Payment Status', value: '{payment_status}', inline: true },
            { name: 'Items', value: '{items}', inline: false },
          ],
          thumbnail: { url: '{thumbnail}' },
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
  'fulfillment.shipment_created': JSON.stringify(
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
          description: '**{first_name} {last_name}** ({email}) just registered.',
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
          description: 'Customer **{email}** updated their profile.',
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
  is_active: true,
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
    onError: () => {
      toast.error('Something went wrong while saving')
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
          <div className="flex items-center gap-3">
            <Heading level="h2">
              {editingId ? 'Edit Webhook Mapping' : 'New Webhook Mapping'}
            </Heading>
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
                <Label htmlFor="modal-bot-name">Bot Name</Label>
                <Input
                  id="modal-bot-name"
                  placeholder="Leave empty to use global fallback"
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
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="modal-active-toggle"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label htmlFor="modal-active-toggle">Enabled</Label>
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

function SettingsTab() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ avatar_url: '', footer_text: '' })
  const hasHydratedSettings = useRef(false)

  const settingsQuery = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => sdk.client.fetch<DiscordSettingsResponse>('/admin/discord/settings'),
  })

  useEffect(() => {
    if (!hasHydratedSettings.current && settingsQuery.isSuccess) {
      const settings = settingsQuery.data?.settings
      setForm({
        avatar_url: settings?.avatar_url || '',
        footer_text: settings?.footer_text || '',
      })
      hasHydratedSettings.current = true
    }
  }, [settingsQuery.data?.settings, settingsQuery.isSuccess])

  useEffect(() => {
    if (settingsQuery.isError) {
      toast.error('Failed to load settings')
    }
  }, [settingsQuery.isError])

  const saveSettings = useMutation({
    mutationFn: () =>
      sdk.client.fetch('/admin/discord/settings', {
        method: 'POST',
        body: form,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      toast.success('Settings saved successfully')
    },
    onError: () => {
      toast.error('Failed to save settings')
    },
  })

  const handleSave = () => {
    saveSettings.mutate()
  }

  if (settingsQuery.isLoading)
    return (
      <div className="p-6">
        <Text>Loading settings...</Text>
      </div>
    )

  return (
    <Container className="p-6">
      <Heading level="h2" className="mb-4">
        Global Settings
      </Heading>
      <div className="flex max-w-lg flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Default Avatar URL</Label>
          <Input
            placeholder="https://example.com/logo.png"
            value={form.avatar_url}
            onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
          />
          <Text size="small" className="text-ui-fg-subtle">
            The icon URL to use for the Discord bot avatar if no custom bot name/avatar is provided
            in the mappings. Leave empty to use Discord's default.
          </Text>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Default Footer Text</Label>
          <Input
            placeholder="Medusa Storefront"
            value={form.footer_text}
            onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
          />
          <Text size="small" className="text-ui-fg-subtle">
            The footer text displayed at the bottom of the rich embeds for orders and customers.
          </Text>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={handleSave} isLoading={saveSettings.isPending}>
            Save Settings
          </Button>
        </div>
      </div>
    </Container>
  )
}

function DiscordNotificationsPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingMapping, setEditingMapping] = useState<DiscordMapping | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const mappingsQuery = useQuery({
    queryKey: MAPPINGS_QUERY_KEY,
    queryFn: () => sdk.client.fetch<DiscordMappingsResponse>('/admin/discord/mappings'),
  })

  const mappings = mappingsQuery.data?.mappings || []
  const loading = mappingsQuery.isLoading

  useEffect(() => {
    if (mappingsQuery.isError) {
      toast.error('Failed to load webhook mappings')
    }
  }, [mappingsQuery.isError])

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
    onError: () => {
      toast.error('Failed to delete mapping')
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
        toast.success(variables.checked ? 'Webhook enabled' : 'Webhook disabled')
        queryClient.invalidateQueries({ queryKey: MAPPINGS_QUERY_KEY })
      } else {
        toast.error(data.message || 'Failed to toggle status')
      }
    },
    onError: () => {
      toast.error('Failed to toggle mapping status')
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
        toast.success('Test notification sent successfully!')
        queryClient.invalidateQueries({ queryKey: MAPPINGS_QUERY_KEY })
      } else {
        toast.error(data.message || 'Webhook test failed')
      }
    },
    onError: () => {
      toast.error('Test request failed')
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

  const deleteMapping = (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook mapping?')) return
    deleteMappingMutation.mutate(id)
  }

  const toggleActive = (m: DiscordMapping, checked: boolean) => {
    toggleActiveMutation.mutate({ id: m.id, checked })
  }

  const testWebhook = (id: string) => {
    setTestingId(id)
    testWebhookMutation.mutate(id)
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">Discord Notifications</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-0.5">
            Route events from your Medusa store directly to your Discord channels using webhooks.
          </Text>
        </div>
        <Button variant="secondary" onClick={openAdd}>
          Add Mapping
        </Button>
      </div>

      <MappingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingId={editingId}
        editingMapping={editingMapping}
      />

      <Tabs defaultValue="webhooks">
        <Tabs.List>
          <Tabs.Trigger value="webhooks">Webhooks</Tabs.Trigger>
          <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="webhooks" className="mt-4">
          <Container className="border-ui-border-base overflow-hidden rounded-lg border p-0">
            {loading ? (
              <div className="p-6">
                <Text>Loading mappings...</Text>
              </div>
            ) : mappings.length === 0 ? (
              <div className="p-6 text-center">
                <Text className="text-ui-fg-muted">No webhook mappings configured yet.</Text>
              </div>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Event Name</Table.HeaderCell>
                    <Table.HeaderCell>Channel Label</Table.HeaderCell>
                    <Table.HeaderCell>Webhook URL</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {mappings.map((m) => (
                    <Table.Row key={m.id}>
                      <Table.Cell>
                        <Badge color="blue">{m.event_name}</Badge>
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
                            checked={m.is_active}
                            onCheckedChange={(checked) => toggleActive(m, checked)}
                          />
                          <Badge color={m.is_active ? 'green' : 'grey'}>
                            {m.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => testWebhook(m.id)}
                            isLoading={testingId === m.id}
                          >
                            Test
                          </Button>
                          <Button variant="secondary" size="small" onClick={() => openEdit(m)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="small" onClick={() => deleteMapping(m.id)}>
                            Delete
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </Container>
        </Tabs.Content>
        <Tabs.Content value="settings" className="mt-4">
          <SettingsTab />
        </Tabs.Content>
      </Tabs>
    </div>
  )
}

export const config = defineRouteConfig({
  label: 'Discord Notifications',
})

export default DiscordNotificationsPage
