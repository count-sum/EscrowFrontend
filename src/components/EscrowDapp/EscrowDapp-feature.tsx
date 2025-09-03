import { WalletButton } from '../solana/solana-provider'
import { EscrowDappProgram, EscrowDappProgramExplorerLink } from './EscrowDapp-ui'
import { AppHero } from '../app-hero'
import { useWalletUi } from '@wallet-ui/react'

export default function EscrowDappFeature() {
  const { account } = useWalletUi()

  if (!account) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="hero py-[64px]">
          <div className="hero-content text-center">
            <div className="max-w-md">
              <h1 className="text-5xl font-bold">Solana Escrow</h1>
              <p className="py-6">
                A decentralized token exchange platform. Create offers, trade tokens safely,
                and manage your trades on-chain.
              </p>
              <WalletButton />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <AppHero
        title="Solana Escrow"
        subtitle="Trade tokens safely with on-chain escrow protection"
      >
        <p className="mb-6">
          <EscrowDappProgramExplorerLink />
        </p>
        <p className="text-sm text-gray-600 max-w-2xl mx-auto">
          This escrow system allows you to create token swap offers, take existing offers,
          or refund your own offers. All transactions are secured by smart contracts on Solana.
        </p>
      </AppHero>
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <EscrowDappProgram />
      </div>
    </div>
  )
}