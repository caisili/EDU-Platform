import {NextRequest,NextResponse} from 'next/server';import {parentContext,restGet} from '../../../../lib/server';
export async function POST(req:NextRequest){try{
 const c=await parentContext(req);if('error'in c)return NextResponse.json({error:c.error},{status:c.status});
 const {studentId,question,language}=await req.json();if(typeof studentId!=='string'||typeof question!=='string'||!question.trim()||question.length>800)return NextResponse.json({error:'Invalid request'},{status:400});
 const links=await restGet(`parent_student_links?parent_id=eq.${encodeURIComponent(c.userId)}&student_id=eq.${encodeURIComponent(studentId)}&status=eq.verified&select=student_id`,c.headers);
 if(!links.length)return NextResponse.json({error:'No verified access to this student'},{status:403});
 const profiles=await restGet(`profiles?id=eq.${encodeURIComponent(studentId)}&school_id=eq.${encodeURIComponent(c.schoolId)}&select=id,full_name`,c.headers);if(!profiles.length)return NextResponse.json({error:'Student not found'},{status:404});
 const growth=await restGet(`growth_events?student_id=eq.${encodeURIComponent(studentId)}&select=skill,score,created_at&order=created_at.desc&limit=15`,c.headers).catch(()=>[]);
 const interests=await restGet(`student_interests?student_id=eq.${encodeURIComponent(studentId)}&select=interest_key&limit=12`,c.headers).catch(()=>[]);
 if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'AI not configured. Add OPENAI_API_KEY on the server.'},{status:503});
 const safeLanguage=language==='zh'?'Simplified Chinese':language==='es'?'Spanish':'English';
 const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.EDU_AI_MODEL||'gpt-4o-mini',temperature:0.3,max_tokens:450,messages:[{role:'system',content:`You are EDU Parent Copilot. Respond in ${safeLanguage} with simple, friendly, actionable language. Only use the supplied verified student evidence. Clearly say when data is missing. Never invent grades, teacher identities, diagnoses, or recommendations based on private conversations. Do not reveal student details unrelated to this parent's authorized child. If asked to draft an email, provide a polite draft, not a claim of sending.`},{role:'user',content:JSON.stringify({student:profiles[0].full_name,growth,interests,question})}]})});
 const d=await r.json();if(!r.ok)return NextResponse.json({error:'AI service unavailable'},{status:502});
 return NextResponse.json({answer:d.choices?.[0]?.message?.content||'No answer available.'});
 }catch{return NextResponse.json({error:'Unable to answer at this time'},{status:503})}}
