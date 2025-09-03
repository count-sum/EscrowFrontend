import { ellipsify } from '@wallet-ui/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ExplorerLink } from '@/components/cluster/cluster-ui'
import {
  useEscrowDappProgramId,
  useGetProgramAccountQuery,
  useGetOffersQuery,
  useMakeOfferMutation,
  useTakeOfferMutation,
  useRefundOfferMutation
} from './EscrowDapp-data-access'
import { useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useWalletUi } from '@wallet-ui/react'

// Types
interface OfferAccount {
  pubkey: string
  data: Uint8Array
}

interface ParsedOffer {
  id: string
  maker: string
  tokenMintA: string
  tokenMintB: string
  tokenBWantedAmount: string
  bump: number
}

// Helper function to parse offer account data
function parseOfferData(data: Uint8Array): ParsedOffer | null {
  try {
    // Skip 8 bytes discriminator, then parse the Offer struct
    const buffer = Buffer.from(data)
    if (buffer.length < 113) { // 8 discriminator + 105 offer data
      return null
    }

    let offset = 8 // Skip discriminator

    // Parse fields according to Offer struct:
    // id: u64, maker: Pubkey (32 bytes), token_mint_a: Pubkey (32), token_mint_b: Pubkey (32), 
    // token_b_wanted_amount: u64, bump: u8

    const id = buffer.readBigUInt64LE(offset)
    offset += 8

    const maker = new PublicKey(buffer.subarray(offset, offset + 32)).toString()
    offset += 32

    const tokenMintA = new PublicKey(buffer.subarray(offset, offset + 32)).toString()
    offset += 32

    const tokenMintB = new PublicKey(buffer.subarray(offset, offset + 32)).toString()
    offset += 32

    const tokenBWantedAmount = buffer.readBigUInt64LE(offset)
    offset += 8

    const bump = buffer.readUInt8(offset)

    return {
      id: id.toString(),
      maker,
      tokenMintA,
      tokenMintB,
      tokenBWantedAmount: tokenBWantedAmount.toString(),
      bump
    }
  } catch (error) {
    console.error('Error parsing offer data:', error)
    return null
  }
}

// Simple Card components (fallback if shadcn/ui card not available)
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-black border border-gray-200 rounded-lg shadow-sm ${className}`}>
    {children}
  </div>
)

const CardHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="p-6 pb-4">
    {children}
  </div>
)

const CardTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-semibold text-white-900">
    {children}
  </h3>
)

const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-6 pt-0 ${className}`}>
    {children}
  </div>
)

export function EscrowDappProgramExplorerLink() {
  const programId = useEscrowDappProgramId()
  return <ExplorerLink address={programId.toString()} label={ellipsify(programId.toString())} />
}

export function CreateOfferForm() {
  const [formData, setFormData] = useState({
    id: '',
    tokenMintA: '',
    tokenMintB: '',
    tokenAOfferedAmount: '',
    tokenBWantedAmount: ''
  })

  const makeOfferMutation = useMakeOfferMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await makeOfferMutation.mutateAsync({
        id: parseInt(formData.id),
        tokenMintA: new PublicKey(formData.tokenMintA),
        tokenMintB: new PublicKey(formData.tokenMintB),
        tokenAOfferedAmount: parseFloat(formData.tokenAOfferedAmount) * Math.pow(10, 9), // Assuming 9 decimals
        tokenBWantedAmount: parseFloat(formData.tokenBWantedAmount) * Math.pow(10, 9)
      })
      // Reset form
      setFormData({
        id: '',
        tokenMintA: '',
        tokenMintB: '',
        tokenAOfferedAmount: '',
        tokenBWantedAmount: ''
      })
    } catch (error) {
      console.error('Error creating offer:', error)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create New Offer</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-white-700">Offer ID</label>
            <Input
              type="number"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              placeholder="Enter unique offer ID"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-white-700">Token A Mint (Offering)</label>
            <Input
              value={formData.tokenMintA}
              onChange={(e) => setFormData({ ...formData, tokenMintA: e.target.value })}
              placeholder="Token mint address"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-white-700">Token B Mint (Wanting)</label>
            <Input
              value={formData.tokenMintB}
              onChange={(e) => setFormData({ ...formData, tokenMintB: e.target.value })}
              placeholder="Token mint address"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-white-700">Amount Offering</label>
            <Input
              type="number"
              step="0.000000001"
              value={formData.tokenAOfferedAmount}
              onChange={(e) => setFormData({ ...formData, tokenAOfferedAmount: e.target.value })}
              placeholder="Amount to offer"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-white-700">Amount Wanting</label>
            <Input
              type="number"
              step="0.000000001"
              value={formData.tokenBWantedAmount}
              onChange={(e) => setFormData({ ...formData, tokenBWantedAmount: e.target.value })}
              placeholder="Amount you want"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={makeOfferMutation.isPending}
          >
            {makeOfferMutation.isPending ? 'Creating Offer...' : 'Create Offer'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function OffersList() {
  const offersQuery = useGetOffersQuery()
  const takeOfferMutation = useTakeOfferMutation()
  const refundOfferMutation = useRefundOfferMutation()
  const { account } = useWalletUi()

  if (offersQuery.isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!offersQuery.data?.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-white-500">No offers available</p>
        </CardContent>
      </Card>
    )
  }

  const handleTakeOffer = async (offer: OfferAccount, parsedOffer: ParsedOffer) => {
    try {
      await takeOfferMutation.mutateAsync({
        offerPubkey: new PublicKey(offer.pubkey),
        offerId: parseInt(parsedOffer.id),
        maker: new PublicKey(parsedOffer.maker),
        tokenMintA: new PublicKey(parsedOffer.tokenMintA),
        tokenMintB: new PublicKey(parsedOffer.tokenMintB)
      })
    } catch (error) {
      console.error('Error taking offer:', error)
    }
  }

  const handleRefundOffer = async (offer: OfferAccount, parsedOffer: ParsedOffer) => {
    try {
      await refundOfferMutation.mutateAsync({
        offerPubkey: new PublicKey(offer.pubkey),
        offerId: parseInt(parsedOffer.id),
        tokenMintA: new PublicKey(parsedOffer.tokenMintA)
      })
    } catch (error) {
      console.error('Error refunding offer:', error)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Available Offers</h3>
      {offersQuery.data.map((offer: OfferAccount, index: number) => {
        const parsedOffer = parseOfferData(offer.data)

        if (!parsedOffer) {
          return (
            <Card key={offer.pubkey} className="p-4">
              <div className="text-red-500">
                Failed to parse offer data for {ellipsify(offer.pubkey)}
              </div>
            </Card>
          )
        }

        const isMyOffer = account && parsedOffer.maker === account.publicKey.toString()

        return (
          <Card key={offer.pubkey} className="p-4">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <h4 className="font-medium text-white-900">
                    Offer #{parsedOffer.id}
                    {isMyOffer && <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Your Offer</span>}
                  </h4>
                  <p className="text-sm text-gray-600">
                    <ExplorerLink
                      address={offer.pubkey}
                      label={ellipsify(offer.pubkey)}
                    />
                  </p>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Maker:</span> <ExplorerLink address={parsedOffer.maker} label={ellipsify(parsedOffer.maker)} /></p>
                    <p><span className="font-medium">Offering Token:</span> <ExplorerLink address={parsedOffer.tokenMintA} label={ellipsify(parsedOffer.tokenMintA)} /></p>
                    <p><span className="font-medium">Wanting Token:</span> <ExplorerLink address={parsedOffer.tokenMintB} label={ellipsify(parsedOffer.tokenMintB)} /></p>
                    <p><span className="font-medium">Amount Wanted:</span> {(parseFloat(parsedOffer.tokenBWantedAmount) / Math.pow(10, 9)).toFixed(9)} tokens</p>
                  </div>
                </div>
                <div className="flex space-x-2 ml-4">
                  {!isMyOffer && (
                    <Button
                      size="sm"
                      onClick={() => handleTakeOffer(offer, parsedOffer)}
                      disabled={takeOfferMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {takeOfferMutation.isPending ? 'Taking...' : 'Take Offer'}
                    </Button>
                  )}
                  {isMyOffer && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRefundOffer(offer, parsedOffer)}
                      disabled={refundOfferMutation.isPending}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      {refundOfferMutation.isPending ? 'Refunding...' : 'Refund'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export function EscrowDappProgram() {
  const query = useGetProgramAccountQuery()

  if (query.isLoading) {
    return (
      <div className="flex justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!query.data?.value) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Program account not found
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>Make sure you have deployed the program and are on the correct cluster.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-8">
        <CreateOfferForm />
        <Card>
          <CardHeader>
            <CardTitle>How to Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-white-700">
            <p>• <strong>Create Offer:</strong> Deposit tokens and specify what you want in return</p>
            <p>• <strong>Take Offer:</strong> Accept someone's offer by providing the requested tokens</p>
            <p>• <strong>Refund Offer:</strong> Cancel your offer and get your tokens back</p>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800">
                <strong>Note:</strong> You'll need to have the tokens in your wallet before creating offers.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <OffersList />
    </div>
  )
}