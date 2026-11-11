import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {Fault,sample,type BillData} from './core';
export const uid=()=>randomBytes(16).toString('hex');
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const globalDb=globalThis as unknown as {aquila?:DatabaseSync};
export function db(){
 if(globalDb.aquila)return globalDb.aquila;
 const path=process.env.DB_PATH||'.data/aquilatab.sqlite';mkdirSync(dirname(path),{recursive:true,mode:0o700});const conn=new DatabaseSync(path);chmodSync(path,0o600);
 conn.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,owner TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS bills(id TEXT PRIMARY KEY,owner TEXT NOT NULL,number INTEGER NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,locked INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS shares(id TEXT PRIMARY KEY,bill TEXT NOT NULL REFERENCES bills(id),name TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),detail TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'PENDING',reviewed INTEGER NOT NULL DEFAULT 0,verified INTEGER NOT NULL DEFAULT 0,token_hash TEXT NOT NULL,expires INTEGER NOT NULL,order_id TEXT UNIQUE,capture_id TEXT UNIQUE,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,bill TEXT NOT NULL,type TEXT NOT NULL,message TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS webhooks(id TEXT PRIMARY KEY,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);`);
 conn.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run('signing_key',randomBytes(48).toString('hex'));globalDb.aquila=conn;return conn;
}
export type BillRow={id:string,owner:string,number:number,data:string,version:number,locked:number,created:number};
export type ShareRow={id:string,bill:string,name:string,amount:number,detail:string,state:string,reviewed:number,verified:number,token_hash:string,expires:number,order_id:string|null,capture_id:string|null,updated:number};
export type EventRow={id:string,type:string,message:string,created:number};
export function transaction<T>(fn:()=>T):T{db().exec('BEGIN IMMEDIATE');try{const result=fn();db().exec('COMMIT');return result}catch(error){db().exec('ROLLBACK');throw error}}
export function event(bill:string,type:string,message:string){db().prepare('INSERT INTO events(id,bill,type,message,created) VALUES(?,?,?,?,?)').run(uid(),bill,type,message,Date.now())}
export function seed(owner:string){return transaction(()=>{const id=uid();const count=db().prepare('SELECT COUNT(*) AS n FROM bills WHERE owner=?').get(owner) as {n:number};db().prepare('INSERT INTO bills(id,owner,number,data,created) VALUES(?,?,?,?,?)').run(id,owner,7+count.n,JSON.stringify(sample),Date.now());event(id,'TABLE_OPENED','Synthetic sample bill opened');return id})}
export function bill(id:string){const row=db().prepare('SELECT * FROM bills WHERE id=?').get(id) as BillRow|undefined;if(!row)throw new Fault(404,'Table not found');return row}
export function owned(id:string,owner:string){const row=bill(id);if(row.owner!==owner)throw new Fault(403,'Merchant access required');return row}
export function shares(id:string){return db().prepare('SELECT * FROM shares WHERE bill=? ORDER BY rowid').all(id) as ShareRow[]}
export function invitationToken(id:string,expires:number){const key=(db().prepare('SELECT value FROM settings WHERE key=?').get('signing_key') as {value:string}).value;const body=id+'.'+expires;return body+'.'+createHmac('sha256',key).update(body).digest('base64url')}
export function invitation(token:string){if(token.length>200)throw new Fault(401,'Invalid invitation');const [id,expires,signature]=token.split('.');if(!id||!/^\d{13}$/.test(expires??'')||!signature)throw new Fault(401,'Invalid invitation');const expected=invitationToken(id,Number(expires));if(expected.length!==token.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(token)))throw new Fault(401,'Invalid invitation');const share=db().prepare('SELECT * FROM shares WHERE id=?').get(id) as ShareRow|undefined;if(!share||share.token_hash!==hash(token)||share.expires!==Number(expires))throw new Fault(401,'Invalid invitation');if(share.expires<Date.now())throw new Fault(410,'Invitation expired. Ask the restaurant for help.');return share}
export function rateLimit(key:string,max=30){const now=Date.now();db().prepare('DELETE FROM limits WHERE expires<?').run(now);db().prepare('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+60000);if((db().prepare('SELECT count FROM limits WHERE key=?').get(key) as {count:number}).count>max)throw new Fault(429,'Too many requests. Please wait one minute.')}
export function snapshot(row:BillRow){const data=JSON.parse(row.data) as BillData,all=shares(row.id),paid=all.filter(s=>s.verified&&s.state==='PAID').reduce((sum,s)=>sum+s.amount,0);return {id:row.id,number:row.number,version:row.version,locked:!!row.locked,data,paid,outstanding:data.receipt.total-paid,closed:all.length>0&&all.every(s=>s.verified&&s.state==='PAID')&&paid===data.receipt.total,shares:all.map(s=>({id:s.id,name:s.name,amount:s.amount,state:s.state,verified:!!s.verified,orderId:s.order_id,captureId:s.capture_id,expires:s.expires,token:invitationToken(s.id,s.expires)})),events:db().prepare('SELECT id,type,message,created FROM events WHERE bill=? ORDER BY created DESC LIMIT 40').all(row.id) as EventRow[]}}
export type Snapshot=ReturnType<typeof snapshot>;
