const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||'';
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
export const connected=Boolean(url&&key);
export async function db(path:string,init:RequestInit={},userToken?:string){
 if(!connected) throw new Error('EDU Data Layer not configured');
 const bearer=userToken||key;
 const headers:any={apikey:key,Authorization:`Bearer ${bearer}`,'Content-Type':'application/json',Prefer:'return=representation',...(init.headers||{})};
 const r=await fetch(`${url}/rest/v1/${path}`,{...init,headers,cache:'no-store'});
 if(!r.ok) throw new Error(await r.text());
 const text=await r.text(); return text?JSON.parse(text):[];
}
export function bearer(req:Request){const h=req.headers.get('authorization')||'';return h.toLowerCase().startsWith('bearer ')?h.slice(7):''}

export function jwtSubject(token:string){try{const part=token.split('.')[1];if(!part)return '';const normalized=part.replace(/-/g,'+').replace(/_/g,'/');const padded=normalized+'='.repeat((4-normalized.length%4)%4);return JSON.parse(Buffer.from(padded,'base64').toString('utf8'))?.sub||''}catch{return ''}}
