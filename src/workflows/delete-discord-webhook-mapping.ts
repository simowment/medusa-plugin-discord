import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import {
  deleteDiscordWebhookMappingStep,
  type DeleteDiscordWebhookMappingStepInput,
} from './steps/delete-discord-webhook-mapping'

export const deleteDiscordWebhookMappingWorkflow = createWorkflow(
  'delete-discord-webhook-mapping',
  function (input: DeleteDiscordWebhookMappingStepInput) {
    const result = deleteDiscordWebhookMappingStep(input)

    return new WorkflowResponse(result)
  },
)
