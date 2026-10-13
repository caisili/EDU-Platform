import OpenAI from 'openai';
import {NextResponse} from 'next/server';

export const runtime = 'nodejs';

function demoMaterial(type:string, context:any){
 const topic=context.topic || 'Math Practice';
 const blocks:any={homework:{title:'Homework + Answer Key',content:`STUDENT COPY\nStudent Name: ____________________    Class: ____________________    Date: ____________________\n\n1. Solve: 2x + 9 = 23\n\nWork:\n________________________________________\n\nAnswer: ____________________\n\nTEACHER ANSWER KEY\n1. x = 7`}};
 return blocks[type] || {title:`${topic} — Generated Material`,content:'Add an OpenAI API key to generate this material.'};
}

function extractMaxProblems(note:string){
 const s=(note||'').toLowerCase();
 const patterns=[/not\s+more\s+than\s+(\d+)\s+(?:problems?|questions?)/i,/no\s+more\s+than\s+(\d+)\s+(?:problems?|questions?)/i,/max(?:imum)?\s+(?:of\s+)?(\d+)\s+(?:problems?|questions?)/i,/at\s+most\s+(\d+)\s+(?:problems?|questions?)/i,/不超过\s*(\d+)\s*题/i,/最多\s*(\d+)\s*题/i];
 for(const p of patterns){const m=s.match(p);if(m)return Number(m[1]);}
 return null;
}
function extractExactProblems(note:string){
 const s=note||''; const patterns=[/exactly\s+(\d+)\s+(?:problems?|questions?)/i,/create\s+(\d+)\s+(?:problems?|questions?)/i,/generate\s+(\d+)\s+(?:problems?|questions?)/i,/正好\s*(\d+)\s*题/i,/生成\s*(\d+)\s*题/i];
 for(const p of patterns){const m=s.match(p);if(m)return Number(m[1]);} return null;
}
function studentCopy(text:string){return (text||'').split(/TEACHER\s+ANSWER\s+KEY/i)[0]||text||'';}
function countProblems(text:string){
 const s=studentCopy(text); const nums=[...s.matchAll(/^\s*(\d+)[.)]\s+/gm)].map(m=>Number(m[1]));
 return nums.length?new Set(nums).size:0;
}
function teacherRules(note:string){
 const max=extractMaxProblems(note), exact=extractExactProblems(note);
 return {max,exact};
}
function passes(text:string,r:{max:number|null,exact:number|null}){
 const count=countProblems(text); if(r.exact!==null&&count!==r.exact)return false; if(r.max!==null&&count>r.max)return false; return true;
}

export async function POST(req:Request){
 try{
  const {type='slides',context={},materialText='',materialGuidance={}}=await req.json();
  const teacherCommand=String(materialText||'').trim();
  if(!process.env.OPENAI_API_KEY) return NextResponse.json({...demoMaterial(type,context),demo:true});
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const model=process.env.OPENAI_MODEL || 'gpt-5-mini';
  const labels:any={slides:'teacher lecture slides',practice:'guided practice set',worksheet:'student worksheet plus answer key',exit:'exit ticket plus teacher key',homework:'student homework followed by a complete teacher answer key'};
  const rules=teacherRules(teacherCommand);
  const commandBlock=`PRIORITY 1 — TEACHER COMMAND (HIGHEST PRIORITY)\n${teacherCommand||'No custom teacher command was provided.'}\n\nThe Teacher Command overrides EDU defaults, class mastery recommendations, uploaded-material suggestions, lesson architecture, homework section defaults, and presentation preferences whenever they conflict. Treat it like the latest direct message from the teacher in a chat. Follow both the meaning and numeric constraints literally. Never silently add extra questions, sections, examples, or activities that violate it. Only mathematical correctness, safety, or a truly impossible technical constraint may override it.`;
  const homeworkRules=`HOMEWORK OUTPUT RULES:\n- Create a simple printable worksheet, not a lesson plan or presentation.\n- Ignore context.architecture completely unless the Teacher Command explicitly requests a structure from it.\n- STUDENT COPY must contain only student-facing questions and working space. Never put answers or solutions in STUDENT COPY.\n- After STUDENT COPY, create a separate TEACHER ANSWER KEY matching the student questions exactly.\n- Use plain text math only. NEVER output LaTeX or Markdown math commands such as \\underline, \\hspace, \\[ , \\], $$, \\frac, or \\text. Use ordinary symbols and underscore lines instead.\n- If the Teacher Command specifies a maximum or exact number of problems/questions, that count applies to the ENTIRE STUDENT COPY across every section combined. Reflection prompts count as questions unless the teacher explicitly excludes them.\n- Do not add default Warm-Up, Reflection, Challenge, or other sections when doing so would violate the Teacher Command.\n- If context.homeworkStudentFields is true, include Student Name, Class, and Date blanks.`;
  const prompt=`You are EDU, a Grade 6-8 math instructional designer.\n\n${commandBlock}\n\nPRIORITY 2 — UPLOADED MATERIALS + FILE ROLES\n${materialText ? 'Use uploaded materials according to their assigned roles, but never let them override the Teacher Command.' : 'No uploaded material text supplied.'}\n${JSON.stringify(materialGuidance,null,2)}\n\nPRIORITY 3 — REAL CLASS MASTERY DATA\nUse it only when present and only when consistent with the Teacher Command.\n\nPRIORITY 4 — LESSON CONTEXT\n${JSON.stringify(context,null,2)}\n\nPRIORITY 5 — EDU DEFAULTS\nDefaults fill gaps only; they never override the Teacher Command.\n\n${type==='homework'?homeworkRules:'Create the requested teacher material. Teacher Command remains highest priority.'}\n\nCreate ${labels[type]||labels.slides}. Return a clear title followed by the complete material in plain text.`;
  let response=await client.responses.create({model,input:prompt,store:false});
  let content=response.output_text||'';
  let corrected=false;
  if(type==='homework'&&!passes(content,rules)){
    const count=countProblems(content);
    const violation=rules.exact!==null?`Teacher required exactly ${rules.exact} total student problems/questions, but the draft has ${count}.`:`Teacher required no more than ${rules.max} total student problems/questions, but the draft has ${count}.`;
    const repair=`${commandBlock}\n\nVALIDATION FAILED\n${violation}\nThe previous draft is below. Rewrite it now so the Teacher Command is satisfied exactly. Preserve mathematical quality, but DELETE extra questions/sections as needed. The total numbered questions in STUDENT COPY must satisfy the teacher's numeric constraint. Keep a matching TEACHER ANSWER KEY. Use plain text only; no LaTeX.\n\nPREVIOUS DRAFT\n${content}`;
    response=await client.responses.create({model,input:repair,store:false}); content=response.output_text||''; corrected=true;
  }
  if(type==='homework'&&!passes(content,rules)){
    const count=countProblems(content); return NextResponse.json({error:`Teacher Command validation failed. EDU generated ${count} student questions and refused to export a result that violates the teacher's instruction.`},{status:422});
  }
  return NextResponse.json({title:labels[type]||'Generated material',content,teacherCommandApplied:!!teacherCommand,validation:{passed:true,problemCount:type==='homework'?countProblems(content):null,maxProblems:rules.max,exactProblems:rules.exact,autoCorrected:corrected}});
 }catch(err:any){return NextResponse.json({error:err?.message||'Material generation failed.'},{status:500});}
}
