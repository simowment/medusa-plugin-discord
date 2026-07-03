import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import {
  type UpdateDiscordWebhookMappingStepInput,
  updateDiscordWebhookMappingStep,
} from './steps/update-discord-webhook-mapping'

export const updateDiscordWebhookMappingWorkflow = createWorkflow(
  'update-discord-webhook-mapping',
  function (input: UpdateDiscordWebhookMappingStepInput) {
    const mapping = updateDiscordWebhookMappingStep(input)

    return new WorkflowResponse(mapping)
  },
)
