/**
 * Crypto provides CORD with the utility types and methods useful for cryptographic operations, such as signing/verifying, encrypting/decrypting and hashing.
 *
 * The utility types and methods are wrappers for existing Polkadot functions and imported throughout the protocol for various cryptographic needs.
 *
 * @packageDocumentation
 */

import { decodeAddress, encodeAddress } from '@polkadot/keyring'
import type {
  CordEncryptionKeypair,
  KeyringPair,
  CordKeyringPair,
} from '@cord.network/types'
import {
  isString,
  stringToU8a,
  u8aConcat,
  u8aToHex,
  u8aToString,
  u8aToU8a,
} from '@polkadot/util'
import {
  blake2AsHex,
  blake2AsU8a,
  naclBoxPairFromSecret,
  randomAsU8a,
  signatureVerify,
} from '@polkadot/util-crypto'
import { Keyring } from '@polkadot/api'
import nacl from 'tweetnacl'
import { v4 as uuid } from 'uuid'
import type { HexString } from '@polkadot/util/types'
import jsonabc from './jsonabc.js'
import * as SDKErrors from './SDKErrors.js'
import { ss58Format } from './ss58Format.js'

export {
  naclBoxPairFromSecret,
  mnemonicGenerate,
  mnemonicToMiniSecret,
} from '@polkadot/util-crypto'

export { encodeAddress, decodeAddress, u8aToHex, u8aConcat }

/**
 * Types accepted by hashing and crypto functions.
 */
export type CryptoInput = Buffer | Uint8Array | string

export type Address = string

export type EncryptedAsymmetric = {
  box: Uint8Array
  nonce: Uint8Array
}

export type EncryptedAsymmetricString = {
  box: string
  nonce: string
}

/**
 * Creates a Uint8Array value from a Uint8Array, Buffer, string or hex input.
 *
 * @param input Input array or string. Null or undefined result in an empty array.
 * @param hexAsString Whether or not a hex string is encoded as a string instead of a number.
 * @returns A (possibly empty) Uint8Array.
 */
export function coToUInt8(
  input: CryptoInput | null | undefined,
  hexAsString = false
): Uint8Array {
  if (hexAsString && isString(input)) {
    return stringToU8a(input)
  }
  return u8aToU8a(input)
}

/**
 * Signs a message.
 *
 * @param message String or byte array to be signed.
 * @param signKeyPair KeyringPair used for signing.
 * @returns Signature over message as byte array.
 */
export function sign(
  message: CryptoInput,
  signKeyPair: KeyringPair
): Uint8Array {
  return signKeyPair.sign(coToUInt8(message), { withType: true })
}

/**
 * Signs a message. Returns signature string.
 *
 * @param message String or byte array to be signed.
 * @param signKeyPair KeyringPair used for signing.
 * @returns Signature over message as hex string.
 */
export function signStr(
  message: CryptoInput,
  signKeyPair: KeyringPair
): string {
  return u8aToHex(sign(message, signKeyPair))
}

/**
 * Verifies a signature over a message.
 *
 * @param message Original signed message to be verified.
 * @param signature Signature as hex string or byte array.
 * @param addressOrPublicKey Substrate address or public key of the signer.
 */
export function verify(
  message: CryptoInput,
  signature: CryptoInput,
  addressOrPublicKey: Address | HexString | Uint8Array
): void {
  if (signatureVerify(message, signature, addressOrPublicKey).isValid !== true)
    throw new SDKErrors.SignatureUnverifiableError()
}

export type BitLength = 64 | 128 | 256 | 384 | 512

/**
 * Create the blake2b and return the result as an u8a with the specified `bitLength`.
 *
 * @param value Value to be hashed.
 * @param bitLength Bit length of hash.
 * @returns Blake2b hash byte array.
 */
export function hash(value: CryptoInput, bitLength?: BitLength): Uint8Array {
  return blake2AsU8a(value, bitLength)
}

/**
 * Create the blake2b and return the result as a hex string.
 *
 * @param value Value to be hashed.
 * @returns Blake2b hash as hex string.
 */
export function hashStr(value: CryptoInput, bitLength?: BitLength): HexString {
  return u8aToHex(hash(value, bitLength))
}

/**
 * Stringifies numbers, booleans, and objects. Object keys are sorted to yield consistent hashing.
 *
 * @param value Object or value to be hashed.
 * @returns Stringified representation of the given object.
 */
export function encodeObjectAsStr(
  value: Record<string, any> | string | number | boolean
): string {
  const input =
    // eslint-disable-next-line no-nested-ternary
    typeof value === 'object' && value !== null
      ? JSON.stringify(jsonabc.sortObj(value))
      : // eslint-disable-next-line no-nested-ternary
      typeof value === 'number' && value !== null
      ? value.toString()
      : typeof value === 'boolean' && value !== null
      ? JSON.stringify(value)
      : value

  return input.normalize('NFC')
}
/**
 * Hashes numbers, booleans, and objects by stringifying them. Object keys are sorted to yield consistent hashing.
 *
 * @param value Object or value to be hashed.
 * @param nonce Optional nonce to obscure hashed values that could be guessed.
 * @returns Blake2b hash as hex string.
 */
export function hashObjectAsHexStr(
  value: Record<string, any> | string | number | boolean,
  bitLength?: BitLength,
  nonce?: string
): HexString {
  let objectAsStr = encodeObjectAsStr(value)
  if (nonce) {
    objectAsStr = nonce + objectAsStr
  }
  return hashStr(objectAsStr, bitLength)
}

/**
 * Wrapper around nacl.box. Authenticated encryption of a message for a recipient's public key.
 *
 * @param message String or byte array to be encrypted.
 * @param publicKeyA Public key of the recipient. The owner will be able to decrypt the message.
 * @param secretKeyB Private key of the sender. Necessary to authenticate the message during decryption.
 * @returns Encrypted message and nonce used for encryption.
 */
export function encryptAsymmetric(
  message: CryptoInput,
  publicKeyA: CryptoInput,
  secretKeyB: CryptoInput
): EncryptedAsymmetric {
  const nonce = nacl.randomBytes(24)
  const box = nacl.box(
    coToUInt8(message, true),
    nonce,
    coToUInt8(publicKeyA),
    coToUInt8(secretKeyB)
  )
  return { box, nonce }
}

/**
 * Wrapper around nacl.box. Authenticated encryption of a message for a recipient's public key.
 *
 * @param message String or byte array to be encrypted.
 * @param publicKeyA Public key of the recipient. The owner will be able to decrypt the message.
 * @param secretKeyB Private key of the sender. Necessary to authenticate the message during decryption.
 * @returns Encrypted message and nonce used for encryption as hex strings.
 */
export function encryptAsymmetricAsStr(
  message: CryptoInput,
  publicKeyA: CryptoInput,
  secretKeyB: CryptoInput
): EncryptedAsymmetricString {
  const encrypted = encryptAsymmetric(message, publicKeyA, secretKeyB)
  const box = u8aToHex(encrypted.box)
  const nonce = u8aToHex(encrypted.nonce)
  return { box, nonce }
}

/**
 * Wrapper around nacl.box.open. Authenticated decryption of an encrypted message.
 *
 * @param data Object containing encrypted message and nonce used for encryption.
 * @param publicKeyB Public key of the sender. Necessary to authenticate the message during decryption.
 * @param secretKeyA Private key of the recipient. Required for decryption.
 * @returns Decrypted message or false if decryption is unsuccessful.
 */
export function decryptAsymmetric(
  data: EncryptedAsymmetric | EncryptedAsymmetricString,
  publicKeyB: CryptoInput,
  secretKeyA: CryptoInput
): Uint8Array | false {
  const decrypted = nacl.box.open(
    coToUInt8(data.box),
    coToUInt8(data.nonce),
    coToUInt8(publicKeyB),
    coToUInt8(secretKeyA)
  )
  return decrypted || false
}

/**
 * Wrapper around nacl.box.open. Authenticated decryption of an encrypted message.
 *
 * @param data Object containing encrypted message and nonce used for encryption.
 * @param publicKeyB Public key of the sender. Necessary to authenticate the message during decryption.
 * @param secretKeyA Private key of the recipient. Required for decryption.
 * @returns Decrypted message as string or false if decryption is unsuccessful.
 */
export function decryptAsymmetricAsStr(
  data: EncryptedAsymmetric | EncryptedAsymmetricString,
  publicKeyB: CryptoInput,
  secretKeyA: CryptoInput
): string | false {
  const result = decryptAsymmetric(
    data,
    coToUInt8(publicKeyB),
    coToUInt8(secretKeyA)
  )
  return result !== false ? u8aToString(result) : false
}

/**
 * Signature of hashing function accepted by [[hashStatements]].
 *
 * @param value String to be hashed.
 * @param nonce Optional nonce (as string) used to obscure hashed contents.
 * @returns String representation of hash.
 */
export interface Hasher {
  (value: string, nonce?: string): HexString
}

/**
 * Additional options for [[hashStatements]].
 */
export interface HashingOptions {
  nonces?: Record<string, string>
  nonceGenerator?: (key: string) => string
  hasher?: Hasher
}

/**
 * Default hasher for [[hashStatements]].
 *
 * @param value String to be hashed.
 * @param nonce Optional nonce (as string) used to obscure hashed contents.
 * @returns 256 bit blake2 hash as hex string.
 */
export function saltedBlake2b256(value: string, nonce = ''): HexString {
  return blake2AsHex(nonce + value, 256)
}

/**
 * Configurable computation of salted over an array of statements. Can be used to validate/reproduce salted hashes
 * by means of an optional nonce map.
 *
 * @param statements An array of statement strings to be hashed.
 * @param options Optional hasher arguments.
 * @param options.nonces An optional map or array of nonces. If present, it should comprise all keys of `statements`, as those will be used map nonces to statements.
 * @param options.nonceGenerator An optional nonce generator. Will be used if `options.nonces` is not defined to generate a (new) nonce for each statement. The statement key is passed as its first argument. If no `nonces` or `nonceGenerator` are given this function returns unsalted hashes.
 * @param options.hasher The hasher to be used. Computes a hash from a statement and an optional nonce. Required but defaults to 256 bit blake2 over `${nonce}${statement}`.
 * @returns An array of objects for each statement which contain a statement, its digest, salted hash and nonce.
 */
export function hashStatements(
  statements: string[],
  options: HashingOptions = {}
): Array<{
  digest: HexString
  statement: string
  saltedHash: HexString
  nonce: string
}> {
  // apply defaults
  const defaults = {
    hasher: saltedBlake2b256,
    nonceGenerator: () => uuid(),
  }
  const hasher = options.hasher || defaults.hasher
  const nonceGenerator = options.nonceGenerator || defaults.nonceGenerator
  // set source for nonces
  const { nonces } = options
  const getNonce: HashingOptions['nonceGenerator'] =
    typeof nonces === 'object' ? (key) => nonces[key] : nonceGenerator
  // iterate over statements to produce salted hashes
  return statements.map((statement) => {
    // generate unsalted digests from statements as a first step
    const digest = hasher(statement)
    // if nonces were passed, they would be mapped to the statement via its digest
    const nonce = getNonce(digest)
    // to simplify validation, the salted hash is computed over unsalted hash (nonce key) & nonce
    const saltedHash = hasher(digest, nonce)
    return { digest, saltedHash, nonce, statement }
  })
}

/**
 * Generate typed CORD blockchain keypair from a seed or random data.
 *
 * @param seed The keypair seed, only optional in the tests.
 * @param type Optional type of the keypair.
 * @returns The keypair.
 */
export function makeKeypairFromSeed<
  KeyType extends CordKeyringPair['type'] = 'ed25519'
>(seed = randomAsU8a(32), type?: KeyType): CordKeyringPair & { type: KeyType } {
  const keyring = new Keyring({ ss58Format, type })
  return keyring.addFromSeed(seed) as CordKeyringPair & { type: KeyType }
}

/**
 * Generate typed CORD blockchain keypair from a polkadot keypair URI.
 *
 * @param uri The URI.
 * @param type Optional type of the keypair.
 * @returns The keypair.
 */
export function makeKeypairFromUri<
  KeyType extends CordKeyringPair['type'] = 'ed25519'
>(uri: string, type?: KeyType): CordKeyringPair & { type: KeyType } {
  const keyring = new Keyring({ ss58Format, type })
  return keyring.addFromUri(uri) as CordKeyringPair & { type: KeyType }
}

/**
 * Generate from a seed a x25519 keypair to be used as DID encryption key.
 *
 * @param seed The keypair seed, only optional in the tests.
 * @returns The keypair.
 */
export function makeEncryptionKeypairFromSeed(
  seed = randomAsU8a(32)
): CordEncryptionKeypair {
  return {
    ...naclBoxPairFromSecret(seed),
    type: 'x25519',
  }
}
