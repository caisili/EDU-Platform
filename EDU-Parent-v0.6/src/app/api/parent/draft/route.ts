import {NextRequest,NextResponse} from 'next/server';
import {parentContext,restGet} from '../../../../lib/server';
export async function POST(req:NextRequest){try{
 const c=await parentContext(req);if('error'in c)return NextResponse.json({error:c.error},{status:c.status});
 const {studentId,purpose,language,recipientType}=await req.json();
 if(typeof studentId!=='string'||typeof purpose!=='string'||purpose.length>400||!purpose.trim())return NextResponse.json({error:'Invalid request'},{status:400});
 const links=await restGet(`parent_student_links?parent_id=eq.${encodeURIComponent(c.userId)}&student_id=eq.${encodeURIComponent(studentId)}&status=eq.verified&select=student_id`,c.headers);
 if(!links.length)return NextResponse.json({error:'School verification required'},{status:403});
 const profiles=await restGet(`profiles?id=eq.${encodeURIComponent(studentId)}&school_id=eq.${encodeURIComponent(c.schoolId)}&select=id,full_name`,c.headers);
 if(!profiles.length)return NextResponse.json({error:'Student unavailable'},{status:404});
 const interests=await restGet(`student_interests?student_id=eq.${encodeURIComponent(studentId)}&select=interest_key&limit=12`,c.headers).catch(()=>[]);
 const growth=await restGet(`growth_events?student_id=eq.${encodeURIComponent(studentId)}&select=skill,score,created_at&order=created_at.desc&limit=12`,c.headers).catch(()=>[]);
 if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'AI not configured'},{status:503});
 const lang=language==='zh'?'Simplified Chinese':language==='es'?'Spanish':'English';
 const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.EDU_AI_MODEL||'gpt-4o-mini',temperature:0.2,max_tokens:650,response_format:{type:'json_object'},messages:[{role:'system',content:`Create a parent-approved school email DRAFT in ${lang}. Respond JSON with keys subject, body. Use ONLY provided verified evidence. Distinguish declared interests from demonstrated skill. Do not invent grades, diagnoses, teacher names or email addresses. If evidence is missing, say so. No sending. Recipient category: ${recipientType==='school'?'school office':'teacher'}. Keep warm, short, and practical.`},{role:'user',content:JSON.stringify({student:profiles[0].full_name,interests,growth,purpose})}]})});
 const d=await r.json();if(!r.ok)return NextResponse.json({error:'AI draft unavailable'},{status:502});
 const parsed=JSON.parse(d.choices?.[0]?.message?.content||'{}');
 return NextResponse.json({subject:String(parsed.subject||'').slice(0,180),body:String(parsed.body||'').slice(0,5000),sent:false});
 }catch{return NextResponse.json({error:'Unable to prepare draft'},{status:503})}}
