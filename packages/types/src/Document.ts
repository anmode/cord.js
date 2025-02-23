import type { HexString } from '@polkadot/util/types'
import type { DidSignature } from './DidDocument'
import type { IContent } from './Content.js'
import type { IRegistryAuthorization } from './Registry'

export type Hash = HexString

export type NonceHash = {
  hash: Hash
  nonce?: string
}

export type DocumentMetaData = {
  templates?: string[]
  labels?: string[]
}

export interface IDocument {
  identifier: string
  content: IContent
  contentHashes: Hash[]
  contentNonceMap: Record<Hash, string>
  evidenceIds: IDocument[]
  authorization: IRegistryAuthorization['identifier']
  registry: string | null
  createdAt: string
  validUntil: string
  documentHash: Hash
  issuerSignature: DidSignature
  metadata: DocumentMetaData
}

export interface IDocumentPresentation extends IDocument {
  holderSignature: DidSignature & { challenge?: string }
}
