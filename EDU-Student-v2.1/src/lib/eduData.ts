const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||'';
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
export const connected=Boolean(url&&key);
export async function db(path:string,init:RequestInit={}){
 if(!connected) throw new Error('EDU Data Layer not configured');
 const headers:any={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation',...(init.headers||{})};
 const r=await fetch(`${url}/rest/v1/${path}`,{...init,headers,cache:'no-store'});
 if(!r.ok) throw new Error(await r.text());
 const text=await r.text(); return text?JSON.parse(text):[];
}
