// Here we export some useful types and functions for interacting with the Anchor program.
import { address } from 'gill'
import { SolanaClusterId } from '@wallet-ui/react'
import { ESCROW_DAPP_PROGRAM_ADDRESS } from './client/js'
import EscrowDappIDL from '../target/idl/escrow.json'

// Re-export the generated IDL and type
export { EscrowDappIDL }

// This is a helper function to get the program ID for the EscrowDapp program depending on the cluster.
export function getEscrowDappProgramId(cluster: SolanaClusterId) {
  switch (cluster) {
    case 'solana:devnet':
    case 'solana:testnet':
      // This is the program ID for the EscrowDapp program on devnet and testnet.
      return address('4XLs7eTjECzLwby7D9SwWbSZa9BjFvMrDZb7zEaVNC5k')
    case 'solana:mainnet':
    default:
      return ESCROW_DAPP_PROGRAM_ADDRESS
  }
}

export * from './client/js'
