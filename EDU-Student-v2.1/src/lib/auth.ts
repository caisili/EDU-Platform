export type EduSession={access_token:string;refresh_token?:string;user?:any};
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'';
export const authConfigured=Boolean(url&&key);
const H={'apikey':key,'Content-Type':'application/json'};
export function getSession():EduSession|null{if(typeof window==='undefined')return null;try{return JSON.parse(localStorage.getItem('edu-auth-session')||'null')}catch{return null}}
export function getAccessToken(){return getSession()?.access_token||''}
function tokenExpired(token:string){try{const part=token.split('.')[1];if(!part)return true;const normalized=part.replace(/-/g,'+').replace(/_/g,'/');const padded=normalized+'='.repeat((4-normalized.length%4)%4);const payload=JSON.parse(atob(padded));return !payload?.exp || payload.exp*1000 < Date.now()+30000}catch{return true}}
export async function ensureSession():Promise<EduSession|null>{const current=getSession();if(!current)return null;if(!tokenExpired(current.access_token))return current;if(!current.refresh_token){saveSession(null);return null}try{const d=await authFetch('token?grant_type=refresh_token',{refresh_token:current.refresh_token});saveSession(d);return d}catch{saveSession(null);return null}}
export function saveSession(s:EduSession|null){if(typeof window==='undefined')return;if(s)localStorage.setItem('edu-auth-session',JSON.stringify(s));else localStorage.removeItem('edu-auth-session')}
async function authFetch(path:string,body:any){const r=await fetch(`${url}/auth/v1/${path}`,{method:'POST',headers:H,body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d?.msg||d?.message||d?.error_description||'Authentication failed');return d}
export async function signIn(email:string,password:string){const d=await authFetch('token?grant_type=password',{email,password});saveSession(d);return d}
export async function signUp(email:string,password:string,fullName:string){const d=await authFetch('signup',{email,password,data:{full_name:fullName}});if(d.access_token)saveSession(d);return d}
export async function rpc(name:string,args:any,token?:string){const r=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{...H,Authorization:`Bearer ${token||getAccessToken()}`},body:JSON.stringify(args)});const text=await r.text();if(!r.ok)throw new Error(text||'Account setup failed');return text?JSON.parse(text):null}
export function signOut(){saveSession(null);location.reload()}
