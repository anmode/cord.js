import type {
  ConformingDidResolutionResult,
  DidKey,
  DidResolutionResult,
  DidResourceUri,
  DidUri,
  KeyRelationship,
  ResolvedDidKey,
  ResolvedDidServiceEndpoint,
  UriFragment,
} from '@cord.network/types'
import { SDKErrors } from '@cord.network/utils'
import { ConfigService } from '@cord.network/config'

import * as Did from '../index.js'
import { toChain } from '../Did.chain.js'
import { linkedInfoFromChain } from '../Did.rpc.js'
import { getDidUri, parse } from '../Did.utils.js'
import { exportToDidDocument } from '../DidDocumentExporter/DidDocumentExporter.js'

/**
 * Resolve a DID URI to the DID document and its metadata.
 *
 * The URI can also identify a key or a service, but it will be ignored during resolution.
 *
 * @param did The subject's DID.
 * @returns The details associated with the DID subject.
 */
export async function resolve(
  did: DidUri
): Promise<DidResolutionResult | null> {
  const api = ConfigService.get('api')
  const queryFunction = api.call.did?.query

  const { section, version } = queryFunction?.meta ?? {}
  if (version > 2)
    throw new Error(
      `This version of the sdk supports runtime api '${section}' <=v2 , but the blockchain runtime implements ${version}. Please upgrade!`
    )
  const { document, didName } = await queryFunction(toChain(did))
    .then(linkedInfoFromChain)
    .catch(() => ({ document: undefined, didName: undefined }))

  if (document) {
    return {
      document,
      metadata: {
        deactivated: false,
      },
      ...(didName && { didName }),
    }
  }

  // If theDID has been deleted return the info in the resolution metadata.
  const isdidDeleted = (await api.query.did.didBlacklist(toChain(did))).isSome
  if (isdidDeleted) {
    return {
      // No canonicalId and no details are returned as we consider this DID deactivated/deleted.
      metadata: {
        deactivated: true,
      },
    }
  }

  // If a DID with same subject is present, return the resolution metadata accordingly.
  if (document) {
    return {
      metadata: {
        canonicalId: getDidUri(did),
        deactivated: false,
      },
    }
  }

  // If no DID details nor deletion info is found,
  // Metadata will simply contain `deactivated: false`.
  return {
    document: document,
    metadata: {
      deactivated: false,
    },
  }
}

/**
 * Implementation of `resolve` compliant with W3C DID specifications (https://www.w3.org/TR/did-core/#did-resolution).
 * As opposed to `resolve`, which takes a more pragmatic approach, the `didDocument` property contains a fully compliant DID document abstract data model.
 * Additionally, this function returns an id-only DID document in the case where a DID has been deleted or upgraded.
 * If a DID is invalid or has not been registered, this is indicated by the `error` property on the `didResolutionMetadata`.
 *
 * @param did The DID to resolve.
 * @returns An object with the properties `didDocument` (a spec-conforming DID document or `undefined`), `didDocumentMetadata` (equivalent to `metadata` returned by [[resolve]]), as well as `didResolutionMetadata` (indicating an `error` if any).
 */
export async function resolveCompliant(
  did: DidUri
): Promise<ConformingDidResolutionResult> {
  const result: ConformingDidResolutionResult = {
    didDocumentMetadata: {},
    didResolutionMetadata: {},
  }
  try {
    Did.validateUri(did, 'Did')
  } catch (error) {
    result.didResolutionMetadata.error = 'invalidDid'
    if (error instanceof Error) {
      result.didResolutionMetadata.errorMessage =
        error.name + error.message ? `: ${error.message}` : ''
    }
    return result
  }
  const resolutionResult = await resolve(did)
  if (!resolutionResult) {
    result.didResolutionMetadata.error = 'notFound'
    result.didResolutionMetadata.errorMessage = `DID ${did} not found (on chain)`
    return result
  }
  const { metadata, document, didName } = resolutionResult
  result.didDocumentMetadata = metadata
  result.didDocument = document
    ? exportToDidDocument(document, 'application/json')
    : { id: did }

  if (didName) {
    result.didDocument.alsoKnownAs = didName
  }

  return result
}

/**
 * Converts the DID key in the format returned by `resolveKey()`, useful for own implementations of `resolveKey`.
 *
 * @param key The DID key in the SDK format.
 * @param did The DID the key belongs to.
 * @returns The key in the resolveKey-format.
 */
export function keyToResolvedKey(key: DidKey, did: DidUri): ResolvedDidKey {
  const { id, publicKey, includedAt, type } = key
  return {
    controller: did,
    id: `${did}${id}`,
    publicKey,
    type,
    ...(includedAt && { includedAt }),
  }
}

/**
 * Converts the DID key returned by the `resolveKey()` into the format used in the SDK.
 *
 * @param key The key in the resolveKey-format.
 * @returns The key in the SDK format.
 */
export function resolvedKeyToKey(key: ResolvedDidKey): DidKey {
  const { id, publicKey, includedAt, type } = key
  return {
    id: Did.parse(id).fragment as UriFragment,
    publicKey,
    type,
    ...(includedAt && { includedAt }),
  }
}

/**
 * Resolve a DID key URI to the key details.
 *
 * @param keyUri The DID key URI.
 * @param expectedVerificationMethod Optional key relationship the key has to belong to.
 * @returns The details associated with the key.
 */
export async function resolveKey(
  keyUri: DidResourceUri,
  expectedVerificationMethod?: KeyRelationship
): Promise<ResolvedDidKey> {
  const { did, fragment: keyId } = parse(keyUri)

  // A fragment (keyId) IS expected to resolve a key.
  if (!keyId) {
    throw new SDKErrors.DidError(
      `Key URI "${keyUri}" is not a valid DID resource`
    )
  }

  const resolved = await resolve(did)
  if (!resolved) {
    throw new SDKErrors.DidNotFoundError()
  }

  const {
    document,
    metadata: { canonicalId },
  } = resolved

  if (canonicalId) {
    throw new SDKErrors.DidResolveUpgradedDidError()
  }
  if (!document) {
    throw new SDKErrors.DidDeactivatedError()
  }

  const key = Did.getKey(document, keyId)
  if (!key) {
    throw new SDKErrors.DidNotFoundError('Key not found in DID')
  }

  // Check whether the provided key ID is within the keys for a given verification relationship, if provided.
  if (
    expectedVerificationMethod &&
    !document[expectedVerificationMethod]?.some(({ id }) => keyId === id)
  ) {
    throw new SDKErrors.DidError(
      `No key "${keyUri}" for the verification method "${expectedVerificationMethod}"`
    )
  }

  return keyToResolvedKey(key, did)
}

/**
 * Resolve a DID service URI to the service details.
 *
 * @param serviceUri The DID service URI.
 * @returns The details associated with the service endpoint.
 */
export async function resolveService(
  serviceUri: DidResourceUri
): Promise<ResolvedDidServiceEndpoint> {
  const { did, fragment: serviceId } = parse(serviceUri)

  // A fragment (serviceId) IS expected to resolve a key.
  if (!serviceId) {
    throw new SDKErrors.DidError(
      `Service URI "${serviceUri}" is not a valid DID resource`
    )
  }

  const resolved = await resolve(did)
  if (!resolved) {
    throw new SDKErrors.DidNotFoundError()
  }

  const {
    document,
    metadata: { canonicalId },
  } = resolved

  if (canonicalId) {
    throw new SDKErrors.DidResolveUpgradedDidError()
  }
  if (!document) {
    throw new SDKErrors.DidDeactivatedError()
  }

  const service = Did.getService(document, serviceId)
  if (!service) {
    throw new SDKErrors.DidNotFoundError('Service not found in DID')
  }

  return {
    ...service,
    id: `${did}${serviceId}`,
  }
}
