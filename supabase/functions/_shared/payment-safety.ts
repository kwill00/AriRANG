import { calcularRepartoUSD } from './reparto-pagos.ts'

// Internal server preparation, not a checkout, processor adapter or settlement.
// Both context and product must be loaded by a trusted server, never from a form.
export type PaymentContext = {
  authenticatedUserId: string
  ageStatus: 'adult_declared' | 'teen_declared' | 'pending_parent' | 'parent_verified' | 'revoked' | 'unreviewed'
  policyCurrent: boolean
  organizerApproved: boolean
  organizerProviderAccount: string | null
  countryApproved: boolean
  environment: 'sandbox' | 'live'
}
export type ServerProduct = {
  id: string
  organizerId: string
  active: boolean
  amountUsdCents: number
  providerCostUsdCents: number
  kind: 'donation' | 'subscription'
  interval: 'month' | 'year' | null
}
export function preparePayment(context: PaymentContext, product: ServerProduct, idempotencyKey: string) {
  if (!context.authenticatedUserId || context.ageStatus !== 'adult_declared' || !context.policyCurrent) throw new Error('ADULT_CURRENT_ACCOUNT_REQUIRED')
  // A verified parental event does not authorize a minor to enter a financial contract.
  if (context.environment !== 'sandbox') throw new Error('LIVE_PAYMENTS_NOT_ACTIVATED')
  if (!context.organizerApproved || !context.organizerProviderAccount || !context.countryApproved) throw new Error('ORGANIZER_OR_COUNTRY_NOT_READY')
  if (!product.active || !product.id || !product.organizerId || product.organizerId === context.authenticatedUserId) throw new Error('PRODUCT_NOT_AVAILABLE')
  if (!['donation','subscription'].includes(product.kind) || (product.kind === 'donation' && product.interval !== null) || (product.kind === 'subscription' && !['month','year'].includes(product.interval ?? ''))) throw new Error('INVALID_RECURRENCE')
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey)) throw new Error('INVALID_IDEMPOTENCY_KEY')
  const split = calcularRepartoUSD(product.amountUsdCents, product.providerCostUsdCents)
  // Never create an underfunded instruction automatically.
  if (split.requiereCoberturaPlataforma) throw new Error('PLATFORM_FUNDING_REVIEW_REQUIRED')
  return {
    environment: 'sandbox' as const,
    status: 'prepared_without_checkout' as const,
    payerId: context.authenticatedUserId,
    productId: product.id,
    organizerId: product.organizerId,
    providerAccountId: context.organizerProviderAccount,
    idempotencyKey,
    kind: product.kind,
    interval: product.interval,
    totalUsdCents: product.amountUsdCents,
    extraBuyerFeesUsdCents: 0,
    split,
  }
}

export type PaymentState = 'pending' | 'paid' | 'failed' | 'refunded' | 'disputed'
export type VerifiedPaymentEvent = {
  eventId: string
  orderId: string
  paymentId: string
  amountUsdCents: number
  currency: string
  environment: 'sandbox' | 'live'
  status: Exclude<PaymentState, 'pending'>
}
export type PaymentLedger = {
  orderId: string
  paymentId: string
  amountUsdCents: number
  state: PaymentState
  appliedEventIds: string[]
}
// Call only AFTER the selected provider's signature AND server-side payment lookup
// have been verified. This pure reducer cannot authenticate a provider webhook.
export function applyVerifiedSandboxEvent(ledger: PaymentLedger, event: VerifiedPaymentEvent): PaymentLedger {
  if (event.environment !== 'sandbox') throw new Error('LIVE_PAYMENTS_NOT_ACTIVATED')
  if (!event.eventId || event.orderId !== ledger.orderId || event.paymentId !== ledger.paymentId || event.currency !== 'USD' || event.amountUsdCents !== ledger.amountUsdCents || !Number.isSafeInteger(event.amountUsdCents) || event.amountUsdCents <= 0) throw new Error('PAYMENT_EVENT_MISMATCH')
  if (ledger.appliedEventIds.includes(event.eventId)) return ledger
  const permitted: Record<PaymentState, PaymentState[]> = {
    pending: ['paid','failed'], paid: ['refunded','disputed'],
    failed: [], refunded: [], disputed: [],
  }
  if (!permitted[ledger.state]?.includes(event.status)) throw new Error('PAYMENT_RECONCILIATION_REQUIRED')
  return { ...ledger, state: event.status, appliedEventIds: [...ledger.appliedEventIds, event.eventId] }
}
