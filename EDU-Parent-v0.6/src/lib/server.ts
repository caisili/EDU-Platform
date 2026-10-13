import {NextRequest} from 'next/server';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
export async function parentContext(req:NextRequest){
 if(!url||!key)return {error:'Supabase not configured',status:503} as const;
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer [^ ]+$/.test(bearer))return {error:'Sign in required',status:401} as const;
 const headers={apikey:key,Authorization:bearer};
 const ur=await fetch(`${url}/auth/v1/user`,{headers,cache:'no-store'});
 const user=await ur.json().catch(()=>null);
 if(!ur.ok||!user?.id)return {error:'Invalid session',status:401} as const;
 const pr=await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,school_id,full_name`,{headers,cache:'no-store'});
 const profiles=await pr.json().catch(()=>[]);
 if(!pr.ok||!Array.isArray(profiles))return {error:'Profile lookup failed',status:503} as const;
 if(profiles[0]?.role!=='parent'||!profiles[0]?.school_id)return {error:'Verified parent account required',status:403} as const;
 return {headers,userId:user.id as string,schoolId:profiles[0].school_id as string,name:profiles[0].full_name as string||'Parent'};
}
export async function restGet(path:string,headers:Record<string,string>){const r=await fetch(`${url}/rest/v1/${path}`,{headers,cache:'no-store'});if(!r.ok)throw new Error('Data query failed');return r.json()}
