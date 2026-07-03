import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import {
  type UpsertDiscordSettingsStepInput,
  upsertDiscordSettingsStep,
} from './steps/upsert-discord-settings'

export const upsertDiscordSettingsWorkflow = createWorkflow(
  'upsert-discord-settings',
  function (input: UpsertDiscordSettingsStepInput) {
    const settings = upsertDiscordSettingsStep(input)

    return new WorkflowResponse(settings)
  },
)
