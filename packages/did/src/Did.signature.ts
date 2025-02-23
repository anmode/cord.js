import { isHex } from '@polkadot/util'

import {
  DidResolveKey,
  DidResourceUri,
  DidSignature,
  DidUri,
  SignResponseData,
  VerificationKeyRelationship,
} from '@cord.network/types'
import { Crypto, SDKErrors } from '@cord.network/utils'

import { resolveKey } from './DidResolver/index.js'
import { parse, validateUri } from './Did.utils.js'

export type DidSignatureVerificationInput = {
  message: string | Uint8Array
  signature: Uint8Array
  keyUri: DidResourceUri
  expectedSigner?: DidUri
  expectedVerificationMethod?: VerificationKeyRelationship
  didResolveKey?: DidResolveKey
}

/**
 * Checks whether the input is a valid DidSignature object, consisting of a signature as hex and the uri of the signing key.
 * Does not cryptographically verify the signature itself!
 *
 * @param input Arbitrary input.
 */
function verifyDidSignatureDataStructure(input: DidSignature): void {
  const keyUri = input.keyUri
  if (!isHex(input.signature)) {
    throw new SDKErrors.SignatureMalformedError(
      `Expected signature as a hex string, got ${input.signature}`
    )
  }
  validateUri(keyUri, 'ResourceUri')
}

/**
 * Verify a DID signature given the key URI of the signature.
 * A signature verification returns false if a migrated and then deleted DID is used.
 *
 * @param input Object wrapping all input.
 * @param input.message The message that was signed.
 * @param input.signature Signature bytes.
 * @param input.keyUri DID URI of the key used for signing.
 * @param input.expectedSigner If given, verification fails if the controller of the signing key is not the expectedSigner.
 * @param input.expectedVerificationMethod Which relationship to the signer DID the key must have.
 * @param input.didResolveKey Allows specifying a custom DID key resolve. Defaults to the built-in [[resolveKey]].
 */
export async function verifyDidSignature({
  message,
  signature,
  keyUri,
  expectedSigner,
  expectedVerificationMethod,
  didResolveKey = resolveKey,
}: DidSignatureVerificationInput): Promise<void> {
  // checks if key uri points to the right did; alternatively we could check the key's controller
  const signer = parse(keyUri)
  if (expectedSigner && expectedSigner !== signer.did) {
    // check for allowable exceptions
    const expected = parse(expectedSigner)
    // NECESSARY CONDITION: subjects and versions match
    const subjectVersionMatch =
      expected.address === signer.address && expected.version === signer.version
    if (!subjectVersionMatch) {
      throw new SDKErrors.DidSubjectMismatchError(signer.did, expected.did)
    }
  }

  const { publicKey } = await didResolveKey(keyUri, expectedVerificationMethod)

  Crypto.verify(message, signature, publicKey)
}

/**
 * Type guard assuring that the input is a valid DidSignature object, consisting of a signature as hex and the uri of the signing key.
 * Does not cryptographically verify the signature itself!
 *
 * @param input Arbitrary input.
 * @returns True if validation of form has passed.
 */
export function isDidSignature(input: unknown): input is DidSignature {
  try {
    verifyDidSignatureDataStructure(input as DidSignature)
    return true
  } catch (cause) {
    return false
  }
}

/**
 * Transforms the output of a [[SignCallback]] into the [[DidSignature]] format suitable for json-based data exchange.
 *
 * @param input Signature data returned from the [[SignCallback]].
 * @param input.signature Signature bytes.
 * @param input.keyUri DID URI of the key used for signing.
 * @returns A [[DidSignature]] object where signature is hex-encoded.
 */
export function signatureToJson({
  signature,
  keyUri,
}: SignResponseData): DidSignature {
  return { signature: Crypto.u8aToHex(signature), keyUri }
}

/**
 * Deserializes a [[DidSignature]] for signature verification.
 * Handles backwards compatibility to an older version of the interface where the `keyUri` property was called `keyId`.
 *
 * @param input A [[DidSignature]] object.
 * @returns The deserialized DidSignature where the signature is represented as a Uint8Array.
 */
export function signatureFromJson(
  input: DidSignature
): Pick<SignResponseData, 'keyUri' | 'signature'> {
  const keyUri = input.keyUri
  const signature = Crypto.coToUInt8(input.signature)
  return { signature, keyUri }
}
