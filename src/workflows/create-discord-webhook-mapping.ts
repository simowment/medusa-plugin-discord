import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import {
  createDiscordWebhookMappingStep,
  type CreateDiscordWebhookMappingStepInput,
} from './steps/create-discord-webhook-mapping'

export const createDiscordWebhookMappingWorkflow = createWorkflow(
  'create-discord-webhook-mapping',
  function (input: CreateDiscordWebhookMappingStepInput) {
    const mapping = createDiscordWebhookMappingStep(input)

    return new WorkflowResponse(mapping)
  },
)
