import OpenAI from 'openai';
import {NextResponse} from 'next/server';
export const runtime='nodejs';
const fallback={summary:'Add real class results before EDU personalizes mastery.',mastery:{},notes:['No verified class-level results were available.']};
const IMAGE_EXTS=new Set(['jpg','jpeg','png','webp','gif']);
function extOf(name:string){return name.toLowerCase().split('.').pop()||''}
function mimeForImage(ext:string){return ext==='jpg'||ext==='jpeg'?'image/jpeg':ext==='png'?'image/png':ext==='webp'?'image/webp':'image/gif'}
export async function POST(req:Request){
 let uploadedId='';
 try{
  const form=await req.formData();
  const file=form.get('file');
  const evidenceType=String(form.get('evidenceType')||'Assessment');
  const context=JSON.parse(String(form.get('context')||'{}'));
  if(!(file instanceof File))return NextResponse.json({error:'Choose a learning-evidence file first.'},{status:400});
  if(!process.env.OPENAI_API_KEY)return NextResponse.json({...fallback,demo:true});
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const model=process.env.OPENAI_MODEL||'gpt-5-mini';
  const prompt=`You are EDU, a Grade 6-8 Math instructional assistant. Analyze the attached ${evidenceType} as CLASS-LEVEL learning evidence. Do not identify or infer named students. Use the existing concept names exactly when possible: Integer operations, One-step equations, Distributive property, Word problems. If the file contains scores/results, estimate mastery percentages from them. If it only contains questions with no student results, do NOT pretend it proves mastery; instead make conservative suggestions and explain the limitation. Existing context: ${JSON.stringify(context)}. Return ONLY JSON: {"summary":"1-2 sentence explanation","mastery":{"Integer operations":0,"One-step equations":0,"Distributive property":0,"Word problems":0},"notes":["...","..."]}. Percentages must be integers 0-100.`;
  const ext=extOf(file.name);
  const content:any[]=[{type:'input_text',text:prompt}];
  if(IMAGE_EXTS.has(ext)){
   const bytes=Buffer.from(await file.arrayBuffer());
   content.push({type:'input_image',image_url:`data:${mimeForImage(ext)};base64,${bytes.toString('base64')}`,detail:'auto'});
  }else{
   const uploaded=await client.files.create({file,purpose:'user_data'} as any);
   uploadedId=uploaded.id;
   content.push({type:'input_file',file_id:uploaded.id});
  }
  const response=await client.responses.create({model,input:[{role:'user',content}] as any,store:false});
  const text=response.output_text.trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  let parsed:any;
  try{parsed=JSON.parse(text)}catch{throw new Error('EDU read the evidence but could not structure the analysis. Please try again.')}
  return NextResponse.json(parsed);
 }catch(err:any){return NextResponse.json({error:err?.message||'Evidence analysis failed.'},{status:500});}
 finally{if(uploadedId&&process.env.OPENAI_API_KEY){try{const c=new OpenAI({apiKey:process.env.OPENAI_API_KEY});await c.files.delete(uploadedId)}catch{}}}
}
