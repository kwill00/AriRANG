import test from 'node:test'
import assert from 'node:assert/strict'
import { preparePayment, applyVerifiedSandboxEvent } from '../supabase/functions/_shared/payment-safety.ts'
const context={authenticatedUserId:'payer-fixture',ageStatus:'adult_declared',policyCurrent:true,organizerApproved:true,organizerProviderAccount:'sandbox-organizer-fixture',countryApproved:true,environment:'sandbox'}
const product={id:'donation-fixture',organizerId:'organizer-fixture',active:true,amountUsdCents:1000,providerCostUsdCents:65,kind:'donation',interval:null}
test('server preparation preserves 80/20, shows total and fees, and never represents a checkout or completed payment',()=>{
 const order=preparePayment(context,product,'fixture_order_0001')
 assert.equal(order.totalUsdCents,1000);assert.equal(order.extraBuyerFeesUsdCents,0)
 assert.equal(order.split.organizadorCentavos,800);assert.equal(order.split.netoPlataformaCentavos,135)
 assert.equal(order.status,'prepared_without_checkout');assert.equal(order.environment,'sandbox')
 assert.equal(order.checkoutUrl,undefined)
})
test('minor, parental-verified, unknown and revoked accounts cannot prepare payments',()=>{
 for(const ageStatus of ['teen_declared','pending_parent','parent_verified','unreviewed','revoked']) assert.throws(()=>preparePayment({...context,ageStatus},product,'fixture_order_0001'),/ADULT_CURRENT/)
 assert.throws(()=>preparePayment({...context,policyCurrent:false},product,'fixture_order_0001'),/ADULT_CURRENT/)
})
test('production is disabled even if country, organizer and account are otherwise ready',()=>{
 assert.throws(()=>preparePayment({...context,environment:'live'},product,'fixture_order_0001'),/LIVE_PAYMENTS_NOT_ACTIVATED/)
})
test('unapproved organizers, unavailable products, self-payments and undisclosed recurrence are rejected',()=>{
 for(const change of [{organizerApproved:false},{organizerProviderAccount:null},{countryApproved:false}]) assert.throws(()=>preparePayment({...context,...change},product,'fixture_order_0001'),/NOT_READY/)
 for(const change of [{active:false},{organizerId:context.authenticatedUserId}]) assert.throws(()=>preparePayment(context,{...product,...change},'fixture_order_0001'),/NOT_AVAILABLE/)
 assert.throws(()=>preparePayment(context,{...product,kind:'subscription',interval:null},'fixture_order_0001'),/INVALID_RECURRENCE/)
 assert.throws(()=>preparePayment(context,{...product,interval:'month'},'fixture_order_0001'),/INVALID_RECURRENCE/)
 assert.equal(preparePayment(context,{...product,kind:'subscription',interval:'month'},'fixture_order_0001').interval,'month')
})
test('negative, fractional and underfunded orders are blocked without lowering organizer share',()=>{
 for(const amountUsdCents of [-1,0,1.2,Infinity]) assert.throws(()=>preparePayment(context,{...product,amountUsdCents},'fixture_order_0001'),RangeError)
 assert.throws(()=>preparePayment(context,{...product,providerCostUsdCents:250},'fixture_order_0001'),/FUNDING_REVIEW/)
 assert.throws(()=>preparePayment(context,product,'short'),/IDEMPOTENCY/)
})
const ledger={orderId:'order-fixture',paymentId:'provider-payment-fixture',amountUsdCents:1000,state:'pending',appliedEventIds:[]}
const event={eventId:'event-fixture',orderId:ledger.orderId,paymentId:ledger.paymentId,amountUsdCents:1000,currency:'USD',environment:'sandbox',status:'paid'}
test('a duplicate verified sandbox event is idempotent; refund cannot be followed by payment resurrection',()=>{
 const paid=applyVerifiedSandboxEvent(ledger,event)
 assert.equal(paid.state,'paid');assert.equal(applyVerifiedSandboxEvent(paid,event),paid)
 const refunded=applyVerifiedSandboxEvent(paid,{...event,eventId:'refund-fixture',status:'refunded'})
 assert.equal(refunded.state,'refunded')
 assert.throws(()=>applyVerifiedSandboxEvent(refunded,{...event,eventId:'late-paid-fixture'}),/RECONCILIATION/)
 assert.equal(ledger.state,'pending')
})
test('mismatched amount, currency, recipient payment or live event cannot update the sandbox ledger',()=>{
 for(const change of [{amountUsdCents:900},{currency:'ARS'},{orderId:'other-order'},{paymentId:'other-payment'}]) assert.throws(()=>applyVerifiedSandboxEvent(ledger,{...event,...change}),/MISMATCH/)
 assert.throws(()=>applyVerifiedSandboxEvent(ledger,{...event,environment:'live'}),/LIVE_PAYMENTS/)
 assert.throws(()=>applyVerifiedSandboxEvent(ledger,{...event,status:'refunded'}),/RECONCILIATION/)
})
