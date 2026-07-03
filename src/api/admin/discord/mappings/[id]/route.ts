import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { ok, fail } from '../../../../../shared/http'
import { deleteDiscordWebhookMappingWorkflow } from '../../../../../workflows/delete-discord-webhook-mapping'
import { updateDiscordWebhookMappingWorkflow } from '../../../../../workflows/update-discord-webhook-mapping'
import type { UpdateDiscordMappingBody } from '../../validators'

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

function isNotFoundError(err: unknown) {
  if (err instanceof MedusaError) {
    return err.type === MedusaError.Types.NOT_FOUND
  }

  if (!err || typeof err !== 'object' || !('type' in err)) {
    return false
  }

  return err.type === MedusaError.Types.NOT_FOUND
}

export async function POST(
  req: AuthenticatedMedusaRequest<UpdateDiscordMappingBody>,
  res: MedusaResponse,
) {
  const { id } = req.params

  try {
    const { result: mapping } = await updateDiscordWebhookMappingWorkflow(req.scope).run({
      input: {
        id,
        ...req.validatedBody,
      },
    })

    return ok(res, { mapping })
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      return fail(
        res,
        404,
        'NOT_FOUND',
        getErrorMessage(err, `Webhook mapping with ID ${id} not found`),
      )
    }

    return fail(res, 500, 'ERROR', getErrorMessage(err, 'Failed to update webhook mapping'))
  }
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  try {
    await deleteDiscordWebhookMappingWorkflow(req.scope).run({
      input: { id },
    })

    return ok(res, { deleted: true, id })
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      return fail(
        res,
        404,
        'NOT_FOUND',
        getErrorMessage(err, `Webhook mapping with ID ${id} not found`),
      )
    }

    return fail(res, 500, 'ERROR', getErrorMessage(err, 'Failed to delete webhook mapping'))
  }
}
