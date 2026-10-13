import {NextRequest} from 'next/server';
export const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
export const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
export async function studentAuth(req:NextRequest){
 const bearer=req.headers.get('authorization')||'';
 if(!url||!key)return {error:'Supabase not configured',status:503} as const;
 if(!/^Bearer [^ ]+$/.test(bearer))return {error:'Sign in required',status:401} as const;
 const headers={apikey:key,Authorization:bearer};
 const u=await fetch(`${url}/auth/v1/user`,{headers,cache:'no-store'});const user=await u.json().catch(()=>null);
 if(!u.ok||!user?.id)return {error:'Invalid session',status:401} as const;
 const p=await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,school_id`,{headers,cache:'no-store'});
 const rows=await p.json().catch(()=>[]);if(!p.ok)return {error:'Profile unavailable',status:503} as const;
 if(rows?.[0]?.role!=='student'||!rows[0].school_id)return {error:'Student membership required',status:403} as const;
 return {headers,userId:user.id as string,schoolId:rows[0].school_id as string};
}
