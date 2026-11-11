import {Fault,decimal,parseMoney} from './core';
import {bill,db,event,transaction,type ShareRow} from './db';
type ObjectData=Record<string,any>;
const base='https://api-m.sandbox.paypal.com';
export const paypalReady=()=>!!(process.env.PAYPAL_CLIENT_ID&&process.env.PAYPAL_CLIENT_SECRET&&process.env.PAYPAL_MERCHANT_ID);
function configured(){if(!paypalReady())throw new Fault(503,'PayPal Sandbox needs a client ID, secret and eligible test merchant ID on the server.')}
async function oauth(browser=false){
 configured();const body=new URLSearchParams({grant_type:'client_credentials'});
 if(browser){body.set('response_type','client_token');body.append('domains[]',new URL(process.env.APP_URL||'http://localhost:3000').hostname)}
 const response=await fetch(base+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(process.env.PAYPAL_CLIENT_ID+':'+process.env.PAYPAL_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Fault(502,'PayPal Sandbox authentication failed. Check the app credentials and merchant configuration.');const data=await response.json();if(typeof data.access_token!=='string')throw new Fault(502,'PayPal returned an invalid authentication response');return data.access_token as string;
}
export async function browserToken(){return {clientToken:await oauth(true)}}
export async function paypal(path:string,method='GET',body?:unknown,key?:string){
 const access=await oauth();const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+access,'Content-Type':'application/json',Prefer:'return=representation',...(key?{'PayPal-Request-Id':key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Fault(502,'PayPal could not complete this request. Retry safely or ask the restaurant to reconcile.');return await response.json() as ObjectData;
}
export function validateOrder(order:ObjectData,share:ShareRow){
 if(order.id!==share.order_id||!Array.isArray(order.purchase_units)||order.purchase_units.length!==1)throw new Fault(409,'Order does not match this invitation');
 const unit=order.purchase_units[0];if(unit.custom_id!==share.id||unit.invoice_id!==`${share.bill}-${share.id}`||unit.amount?.currency_code!=='USD'||parseMoney(unit.amount?.value??'')!==share.amount||unit.payee?.merchant_id!==process.env.PAYPAL_MERCHANT_ID)throw new Fault(409,'PayPal amount, currency, merchant or allocation mismatch');return unit;
}
export function reconcile(order:ObjectData,share:ShareRow){
 const unit=validateOrder(order,share),captures=unit.payments?.captures??[],completed=captures.filter((c:ObjectData)=>c.status==='COMPLETED');
 if(!completed.length)return false;
 const capture=completed[0];if(order.status!=='COMPLETED'||completed.length!==1||!capture.id||capture.final_capture!==true||capture.amount?.currency_code!=='USD'||parseMoney(capture.amount?.value??'')!==share.amount)throw new Fault(409,'Capture does not exactly match this share');
 transaction(()=>{const current=db().prepare('SELECT * FROM shares WHERE id=?').get(share.id) as ShareRow;if(['REFUNDED','REVERSED'].includes(current.state))throw new Fault(409,'Reversed payment requires merchant review');if(current.verified){if(current.capture_id!==capture.id)throw new Fault(409,'Duplicate capture detected');return}db().prepare("UPDATE shares SET verified=1,state='PAID',capture_id=?,updated=? WHERE id=?").run(capture.id,Date.now(),share.id);event(share.bill,'PAYMENT_VERIFIED',`${share.name} paid ${decimal(share.amount)} USD · Capture ${capture.id}`)});return true;
}
export async function createOrder(share:ShareRow){
 if(share.verified||share.state==='PAID')throw new Fault(409,'This share is already paid');if(['REFUNDED','REVERSED'].includes(share.state))throw new Fault(409,'This payment requires merchant review');configured();
 if(share.order_id){const order=await paypal('/v2/checkout/orders/'+encodeURIComponent(share.order_id));if(reconcile(order,share))throw new Fault(409,'This share is already paid');return {orderId:share.order_id}}
 const row=bill(share.bill);db().prepare("UPDATE shares SET state='CREATING',updated=? WHERE id=? AND verified=0 AND order_id IS NULL").run(Date.now(),share.id);
 const order=await paypal('/v2/checkout/orders','POST',{intent:'CAPTURE',purchase_units:[{reference_id:share.id,custom_id:share.id,invoice_id:`${share.bill}-${share.id}`,description:`The Olive Room · Table ${row.number} · ${share.name}`,payee:{merchant_id:process.env.PAYPAL_MERCHANT_ID},amount:{currency_code:'USD',value:decimal(share.amount)}}],payment_source:{paypal:{experience_context:{brand_name:'AquilaTab · The Olive Room',shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW'}}}},'aq-order-'+share.id);
 if(typeof order.id!=='string')throw new Fault(502,'PayPal returned an invalid order');db().prepare("UPDATE shares SET order_id=?,state='CHECKOUT',updated=? WHERE id=? AND verified=0 AND order_id IS NULL").run(order.id,Date.now(),share.id);event(share.bill,'CHECKOUT_STARTED',share.name+' started PayPal Sandbox checkout');return {orderId:order.id as string};
}
export async function captureOrder(share:ShareRow){
 if(share.verified)return {paid:true,captureId:share.capture_id};if(!share.order_id)throw new Fault(409,'Create and approve a PayPal order first');
 let order=await paypal('/v2/checkout/orders/'+encodeURIComponent(share.order_id));if(reconcile(order,share))return {paid:true};if(order.status!=='APPROVED')throw new Fault(409,'Approve this order in PayPal before capture');
 db().prepare("UPDATE shares SET state='APPROVED',updated=? WHERE id=? AND verified=0 AND state NOT IN ('REFUNDED','REVERSED')").run(Date.now(),share.id);
 await paypal('/v2/checkout/orders/'+encodeURIComponent(share.order_id)+'/capture','POST',{},'aq-capture-'+share.id);
 order=await paypal('/v2/checkout/orders/'+encodeURIComponent(share.order_id));if(!reconcile(order,share))throw new Fault(409,'PayPal has not confirmed a completed capture. This share remains unpaid.');return {paid:true};
}
export async function cancelOrder(share:ShareRow){
 if(share.order_id){const order=await paypal('/v2/checkout/orders/'+encodeURIComponent(share.order_id));if(reconcile(order,share))return {paid:true};if(order.status==='APPROVED'){db().prepare("UPDATE shares SET state='APPROVED',updated=? WHERE id=? AND verified=0 AND state NOT IN ('REFUNDED','REVERSED')").run(Date.now(),share.id);return {approved:true}}}
 db().prepare("UPDATE shares SET state='CANCELLED',updated=? WHERE id=? AND verified=0 AND state NOT IN ('REFUNDED','REVERSED')").run(Date.now(),share.id);event(share.bill,'CHECKOUT_CANCELLED',share.name+' cancelled checkout. No payment confirmed.');return {cancelled:true};
}
export async function verifyWebhook(req:Request,body:ObjectData){
 if(!process.env.PAYPAL_WEBHOOK_ID)throw new Fault(503,'PAYPAL_WEBHOOK_ID is not configured');const keys=['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'];if(keys.some(k=>!req.headers.get(k)))throw new Fault(401,'Missing PayPal webhook signature');
 const result=await paypal('/v1/notifications/verify-webhook-signature','POST',{auth_algo:req.headers.get(keys[0]),cert_url:req.headers.get(keys[1]),transmission_id:req.headers.get(keys[2]),transmission_sig:req.headers.get(keys[3]),transmission_time:req.headers.get(keys[4]),webhook_id:process.env.PAYPAL_WEBHOOK_ID,webhook_event:body});if(result.verification_status!=='SUCCESS')throw new Fault(401,'Invalid PayPal webhook signature');
}
export async function webhook(req:Request,body:ObjectData){
 await verifyWebhook(req,body);if(typeof body.id!=='string'||typeof body.event_type!=='string')throw new Fault(422,'Invalid webhook event');if(db().prepare('SELECT id FROM webhooks WHERE id=?').get(body.id))return {received:true,duplicate:true};
 const resource=body.resource??{},related=resource.supplementary_data?.related_ids;const orderId=related?.order_id??(body.event_type==='CHECKOUT.ORDER.APPROVED'?resource.id:undefined);
 let share=typeof orderId==='string'?db().prepare('SELECT * FROM shares WHERE order_id=?').get(orderId) as ShareRow|undefined:undefined;
 for(const captureId of [related?.capture_id,resource.id])if(!share&&typeof captureId==='string')share=db().prepare('SELECT * FROM shares WHERE capture_id=?').get(captureId) as ShareRow|undefined;
 if(!share&&body.event_type==='PAYMENT.CAPTURE.REFUNDED'){const url=resource.links?.find((link:ObjectData)=>link.rel==='up')?.href;const match=typeof url==='string'?url.match(/^https:\/\/api(?:-m)?\.sandbox\.paypal\.com\/v2\/payments\/captures\/([A-Z0-9]+)$/):null;if(match)share=db().prepare('SELECT * FROM shares WHERE capture_id=?').get(match[1]) as ShareRow|undefined}
 if(share?.order_id){
  if(body.event_type==='PAYMENT.CAPTURE.COMPLETED')reconcile(await paypal('/v2/checkout/orders/'+encodeURIComponent(share.order_id)),share);
  else if(['PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED'].includes(body.event_type)){db().prepare('UPDATE shares SET verified=0,state=?,updated=? WHERE id=?').run(body.event_type.endsWith('REFUNDED')?'REFUNDED':'REVERSED',Date.now(),share.id);event(share.bill,'PAYMENT_REVERSED',share.name+' payment requires review after refund/reversal')}
  else if(body.event_type==='PAYMENT.CAPTURE.DENIED'){db().prepare("UPDATE shares SET state='FAILED',updated=? WHERE id=? AND verified=0 AND state NOT IN ('REFUNDED','REVERSED')").run(Date.now(),share.id);event(share.bill,'PAYMENT_FAILED',share.name+' payment was denied')}
  else if(body.event_type==='CHECKOUT.ORDER.APPROVED')db().prepare("UPDATE shares SET state='APPROVED',updated=? WHERE id=? AND verified=0 AND state NOT IN ('REFUNDED','REVERSED')").run(Date.now(),share.id);
 }
 db().prepare('INSERT OR IGNORE INTO webhooks(id,created) VALUES(?,?)').run(body.id,Date.now());return {received:true};
}
