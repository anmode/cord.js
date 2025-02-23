import type { BN } from '@polkadot/util'

import type { CordAddress } from './Address'

// NOTICE: The following string pattern types must be kept in sync with regex patterns @cord.network/did/Utils

/**
 * A string containing a DID Uri.
 */

export type DidUri = `did:cord:${CordAddress}`

/**
 * The fragment part of the DID URI including the `#` character.
 */
export type UriFragment = `#${string}`
/**
 * URI for DID resources like keys or service endpoints.
 */
export type DidResourceUri = `${DidUri}${UriFragment}`

/**
 * DID keys are purpose-bound. Their role or purpose is indicated by the verification or key relationship type.
 */
const keyRelationshipsC = [
  'authentication',
  'capabilityDelegation',
  'assertionMethod',
  'keyAgreement',
] as const
export const keyRelationships = keyRelationshipsC as unknown as string[]
export type KeyRelationship = (typeof keyRelationshipsC)[number]

/**
 * Subset of key relationships which pertain to signing/verification keys.
 */
export type VerificationKeyRelationship = Extract<
  KeyRelationship,
  'authentication' | 'capabilityDelegation' | 'assertionMethod'
>

/**
 * Possible types for a DID verification key.
 */
const verificationKeyTypesC = ['sr25519', 'ed25519', 'ecdsa'] as const
export const verificationKeyTypes = verificationKeyTypesC as unknown as string[]
export type VerificationKeyType = (typeof verificationKeyTypesC)[number]
// `as unknown as string[]` is a workaround for https://github.com/microsoft/TypeScript/issues/26255

/**
 * Subset of key relationships which pertain to key agreement/encryption keys.
 */
export type EncryptionKeyRelationship = Extract<KeyRelationship, 'keyAgreement'>

/**
 * Possible types for a DID encryption key.
 */
const encryptionKeyTypesC = ['x25519'] as const
export const encryptionKeyTypes = encryptionKeyTypesC as unknown as string[]
export type EncryptionKeyType = (typeof encryptionKeyTypesC)[number]

/**
 * Type of a new key material to add under a DID.
 */
export type BaseNewDidKey = {
  publicKey: Uint8Array
  type: string
}

/**
 * Type of a new verification key to add under a DID.
 */
export type NewDidVerificationKey = BaseNewDidKey & {
  type: VerificationKeyType
}

/**
 * Type of a new encryption key to add under a DID.
 */
export type NewDidEncryptionKey = BaseNewDidKey & { type: EncryptionKeyType }

/**
 * The SDK-specific base details of a DID key.
 */
export type BaseDidKey = {
  /**
   * Relative key URI: `#` sign followed by fragment part of URI.
   */
  id: UriFragment
  /**
   * The public key material.
   */
  publicKey: Uint8Array
  /**
   * The inclusion block of the key, if stored on chain.
   */
  includedAt?: BN
  /**
   * The type of the key.
   */
  type: string
}

/**
 * The SDK-specific details of a DID verification key.
 */
export type DidVerificationKey = BaseDidKey & { type: VerificationKeyType }
/**
 * The SDK-specific details of a DID encryption key.
 */
export type DidEncryptionKey = BaseDidKey & { type: EncryptionKeyType }
/**
 * The SDK-specific details of a DID key.
 */
export type DidKey = DidVerificationKey | DidEncryptionKey

/**
 * The SDK-specific details of a new DID service endpoint.
 */
export type DidServiceEndpoint = {
  /**
   * Relative endpoint URI: `#` sign followed by fragment part of URI.
   */
  id: UriFragment
  /**
   * A list of service types the endpoint exposes.
   */
  type: string[]
  /**
   * A list of URIs the endpoint exposes its services at.
   */
  serviceEndpoint: string[]
}

/**
 * A signature issued with a DID associated key, indicating which key was used to sign.
 */
export type DidSignature = {
  keyUri: DidResourceUri
  signature: string
}

export interface DidDocument {
  uri: DidUri

  authentication: [DidVerificationKey]
  assertionMethod?: [DidVerificationKey]
  capabilityDelegation?: [DidVerificationKey]
  keyAgreement?: DidEncryptionKey[]

  service?: DidServiceEndpoint[]
}
