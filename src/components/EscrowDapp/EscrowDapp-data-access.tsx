import { getEscrowDappProgramId } from '@project/anchor'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { useWalletUi } from '@wallet-ui/react'
import { toastTx } from '@/components/toast-tx'
import { useWalletTransactionSignAndSend } from '@/components/solana/use-wallet-transaction-sign-and-send'
import { useWalletUiSigner } from '@/components/solana/use-wallet-ui-signer'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress
} from '@solana/spl-token'
import { PublicKey, SystemProgram, Connection } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import { clusterApiUrl } from '@solana/web3.js'


// Correct discriminators from the IDL
const OFFER_ACCOUNT_DISCRIMINATOR = Buffer.from([215, 88, 60, 71, 170, 162, 73, 229])

const MAKE_OFFER_DISCRIMINATOR = Buffer.from([214, 98, 97, 35, 59, 12, 44, 178])
const REFUND_OFFER_DISCRIMINATOR = Buffer.from([171, 18, 70, 32, 244, 121, 60, 75])
const TAKE_OFFER_DISCRIMINATOR = Buffer.from([128, 156, 242, 207, 237, 192, 103, 240])

// Types
interface OfferAccount {
  pubkey: string
  data: Uint8Array
}

interface SolanaRpcAccount {
  account: {
    executable: boolean
    lamports: bigint
    owner: string
    rentEpoch: bigint
    space: bigint
    data: string // Base58 encoded
  }
  pubkey: string
}

export function useEscrowDappProgramId() {
  const { cluster } = useWalletUi()
  return useMemo(() => getEscrowDappProgramId(cluster.id), [cluster])
}

export function useGetProgramAccountQuery() {
  const { client, cluster } = useWalletUi()
  return useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => client.rpc.getAccountInfo(getEscrowDappProgramId(cluster.id)).send(),
  })
}

export function useGetOffersQuery(): {
  data: OfferAccount[] | undefined
  isLoading: boolean
  error: any
  refetch: () => void
} {
  const { client, cluster } = useWalletUi()
  const programId = useEscrowDappProgramId()

  return useQuery({
    queryKey: ['get-offers', { cluster }],
    queryFn: async () => {
      try {
        const response = await client.rpc.getProgramAccounts(programId, {
          filters: [
            {
              memcmp: {
                offset: BigInt(0),
                bytes: Buffer.from(OFFER_ACCOUNT_DISCRIMINATOR).toString('base64') as any,
                encoding: 'base64' as const
              }
            }
          ]
        }).send()

        return response.map((account: any): OfferAccount => ({
          pubkey: account.pubkey.toString(),
          data: Buffer.from(account.account.data, 'base64')
        }))
      } catch (error) {
        console.error('Error fetching offers:', error)
        return []
      }
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  })
}

interface MakeOfferParams {
  id: number
  tokenMintA: PublicKey
  tokenMintB: PublicKey
  tokenAOfferedAmount: number
  tokenBWantedAmount: number
}

export function useMakeOfferMutation() {
  const programId = useEscrowDappProgramId()
  const { account, cluster } = useWalletUi()
  const txSigner = useWalletUiSigner()
  const signAndSend = useWalletTransactionSignAndSend()

  return useMutation({
    mutationFn: async ({ id, tokenMintA, tokenMintB, tokenAOfferedAmount, tokenBWantedAmount }: MakeOfferParams) => {
      if (!account) throw new Error('Wallet not connected')

      const [offerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('offer'), new anchor.BN(id).toArrayLike(Buffer, 'le', 8)],
        new PublicKey(programId)
      )

      const makerTokenAccountA = await getAssociatedTokenAddress(
        tokenMintA,
        new PublicKey(account.publicKey),
        false,
        TOKEN_PROGRAM_ID
      )

      const vault = await getAssociatedTokenAddress(
        tokenMintA,
        offerPda,
        true,
        TOKEN_PROGRAM_ID
      )

      const connection = new Connection(clusterApiUrl())
      const accountInfo = await connection.getAccountInfo(makerTokenAccountA)

      const instructions: any[] = []

      // Create ATA if it doesn't exist
      if (!accountInfo) {
        instructions.push({
          programAddress: ASSOCIATED_TOKEN_PROGRAM_ID,
          accounts: [
            { address: new PublicKey(account.publicKey), role: 3 },
            { address: makerTokenAccountA, role: 1 },
            { address: new PublicKey(account.publicKey), role: 0 },
            { address: tokenMintA, role: 0 },
            { address: SystemProgram.programId, role: 0 },
            { address: TOKEN_PROGRAM_ID, role: 0 },
          ],
          data: Buffer.from([])
        })
      }

      // Add make offer instruction
      instructions.push({
        programAddress: programId,
        accounts: [
          { address: ASSOCIATED_TOKEN_PROGRAM_ID, role: 0 },
          { address: TOKEN_PROGRAM_ID, role: 0 },
          { address: SystemProgram.programId, role: 0 },
          { address: new PublicKey(account.publicKey), role: 3 },
          { address: tokenMintA, role: 0 },
          { address: tokenMintB, role: 0 },
          { address: makerTokenAccountA, role: 1 },
          { address: offerPda, role: 1 },
          { address: vault, role: 1 },
        ],
        data: new Uint8Array(Buffer.concat([
          MAKE_OFFER_DISCRIMINATOR,
          new anchor.BN(id).toArrayLike(Buffer, 'le', 8),
          new anchor.BN(tokenAOfferedAmount).toArrayLike(Buffer, 'le', 8),
          new anchor.BN(tokenBWantedAmount).toArrayLike(Buffer, 'le', 8),
        ]))
      })

      return await signAndSend(instructions, txSigner)
    },
    onSuccess: (signature) => {
      toast.success('Offer created successfully!')
      toastTx(signature)
    },
    onError: (error) => {
      console.error('Make offer error:', error)
      toast.error('Failed to create offer')
    },
  })
}

interface TakeOfferParams {
  offerPubkey: PublicKey
  offerId: number
  maker: PublicKey
  tokenMintA: PublicKey
  tokenMintB: PublicKey
}

export function useTakeOfferMutation() {
  const programId = useEscrowDappProgramId()
  const { account } = useWalletUi()
  const txSigner = useWalletUiSigner()
  const signAndSend = useWalletTransactionSignAndSend()

  return useMutation({
    mutationFn: async ({ offerPubkey, offerId, maker, tokenMintA, tokenMintB }: TakeOfferParams) => {
      if (!account) throw new Error('Wallet not connected')

      const takerTokenAccountA = await getAssociatedTokenAddress(
        tokenMintA,
        new PublicKey(account.publicKey),
        false,
        TOKEN_PROGRAM_ID
      )

      const takerTokenAccountB = await getAssociatedTokenAddress(
        tokenMintB,
        new PublicKey(account.publicKey),
        false,
        TOKEN_PROGRAM_ID
      )

      const makerTokenAccountB = await getAssociatedTokenAddress(
        tokenMintB,
        maker,
        false,
        TOKEN_PROGRAM_ID
      )

      const vault = await getAssociatedTokenAddress(
        tokenMintA,
        offerPubkey,
        true,
        TOKEN_PROGRAM_ID
      )

      const instruction: any = {
        programAddress: programId,
        accounts: [
          { address: ASSOCIATED_TOKEN_PROGRAM_ID.toString(), role: 0 }, // readonly
          { address: TOKEN_PROGRAM_ID.toString(), role: 0 }, // readonly
          { address: SystemProgram.programId.toString(), role: 0 }, // readonly
          { address: new PublicKey(account.publicKey).toString(), role: 3 }, // signer + writable
          { address: maker.toString(), role: 1 }, // writable
          { address: tokenMintA.toString(), role: 0 }, // readonly
          { address: tokenMintB.toString(), role: 0 }, // readonly
          { address: takerTokenAccountA.toString(), role: 1 }, // writable
          { address: takerTokenAccountB.toString(), role: 1 }, // writable
          { address: makerTokenAccountB.toString(), role: 1 }, // writable
          { address: offerPubkey.toString(), role: 1 }, // writable
          { address: vault.toString(), role: 1 }, // writable
        ],
        data: new Uint8Array(TAKE_OFFER_DISCRIMINATOR)
      }

      return await signAndSend([instruction], txSigner)
    },
    onSuccess: (signature) => {
      toast.success('Offer taken successfully!')
      toastTx(signature)
    },
    onError: (error) => {
      console.error('Take offer error:', error)
      toast.error('Failed to take offer')
    },
  })
}

interface RefundOfferParams {
  offerPubkey: PublicKey
  offerId: number
  tokenMintA: PublicKey
}

export function useRefundOfferMutation() {
  const programId = useEscrowDappProgramId()
  const { account } = useWalletUi()
  const txSigner = useWalletUiSigner()
  const signAndSend = useWalletTransactionSignAndSend()

  return useMutation({
    mutationFn: async ({ offerPubkey, offerId, tokenMintA }: RefundOfferParams) => {
      if (!account) throw new Error('Wallet not connected')

      const makerTokenAccountA = await getAssociatedTokenAddress(
        tokenMintA,
        new PublicKey(account.publicKey),
        false,
        TOKEN_PROGRAM_ID
      )

      const vault = await getAssociatedTokenAddress(
        tokenMintA,
        offerPubkey,
        true,
        TOKEN_PROGRAM_ID
      )

      const instruction: any = {
        programAddress: programId,
        accounts: [
          { address: TOKEN_PROGRAM_ID.toString(), role: 0 }, // readonly
          { address: SystemProgram.programId.toString(), role: 0 }, // readonly
          { address: new PublicKey(account.publicKey).toString(), role: 3 }, // signer + writable
          { address: tokenMintA.toString(), role: 0 }, // readonly
          { address: makerTokenAccountA.toString(), role: 1 }, // writable
          { address: offerPubkey.toString(), role: 1 }, // writable
          { address: vault.toString(), role: 1 }, // writable
        ],
        data: new Uint8Array(REFUND_OFFER_DISCRIMINATOR)
      }

      return await signAndSend([instruction], txSigner)
    },
    onSuccess: (signature) => {
      toast.success('Offer refunded successfully!')
      toastTx(signature)
    },
    onError: (error) => {
      console.error('Refund offer error:', error)
      toast.error('Failed to refund offer')
    },
  })
}