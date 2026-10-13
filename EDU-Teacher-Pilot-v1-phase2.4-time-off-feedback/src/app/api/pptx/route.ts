import OpenAI from 'openai';
import {NextResponse} from 'next/server';
import PptxGenJSImport from 'pptxgenjs';

export const runtime='nodejs';

type Slide={title:string; subtitle?:string; bullets?:string[]; problems?:string[]; example?:string; teacherNote?:string; section?:string; slideType?:string; visualType?:string; visualInstruction?:string; studentPrompt?:string; estimatedMinutes?:number};
type Requirements={problemCount?:number; mustFollow:boolean; sourceNote:string};

function parseRequirements(note:string,noteUse:string):Requirements{
 const text=String(note||'').trim();
 const patterns=[/(?:生成|出|创建|制作|给我|需要)\s*(\d{1,3})\s*(?:道|个)?\s*(?:题|练习题|问题)/i,/(?:generate|create|make|include)\s+(\d{1,3})\s+(?:practice\s+)?(?:problems?|questions?|exercises?)/i,/(\d{1,3})\s+(?:practice\s+)?(?:problems?|questions?|exercises?)/i];
 let problemCount: number|undefined;
 for(const re of patterns){const m=text.match(re);if(m){problemCount=Math.max(1,Math.min(200,Number(m[1])));break}}
 return {problemCount,mustFollow:noteUse==='must-follow',sourceNote:text};
}
function countProblems(slides:Slide[]){return slides.reduce((n,s)=>n+(Array.isArray(s.problems)?s.problems.length:0),0)}

const IMAGE_EXTS=new Set(['jpg','jpeg','png','webp','gif']);
const DOCUMENT_EXTS=new Set(['art','bat','brf','c','cls','css','csv','diff','doc','docx','dot','eml','epub','es','h','hs','htm','html','hwp','hwpx','ics','ifb','java','js','json','keynote','ksh','ltx','mail','markdown','md','mht','mhtml','mjs','msg','nws','odp','ods','odt','otp','ots','pages','patch','pdf','pl','pm','pot','potm','potx','ppa','pps','ppsm','ppsx','ppt','pptm','pptx','pwz','py','rst','rtf','scala','sh','shtml','srt','sty','svg','svgz','tex','text','txt','tsv','vcf','vtt','wiz','xla','xlb','xlc','xlm','xls','xlsx','xlt','xlw','xml','yaml','yml']);
function extOf(name:string){return name.toLowerCase().split('.').pop()||''}
function mimeForImage(ext:string){return ext==='jpg'||ext==='jpeg'?'image/jpeg':ext==='png'?'image/png':ext==='webp'?'image/webp':'image/gif'}

const fallback=(topic:string):Slide[]=>[
 {title:topic,subtitle:'Targeted lesson',bullets:['Learning goal: solve and explain the target skill','Today we will focus on the class priority gaps']},
 {title:'Warm-up',bullets:['Retrieve prerequisite knowledge','Explain your reasoning to a partner']},
 {title:'Worked example',bullets:['Model the first step','Explain why the step preserves equality','Check the result']},
 {title:'Guided practice',bullets:['Solve together','Name the operation before using it','Compare two solution paths']},
 {title:'Misconception check',bullets:['Find the error','Correct it','Explain what caused the error']},
 {title:'Independent practice',bullets:['Apply the method independently','Show each step clearly']},
 {title:'Exit ticket',bullets:['Solve one target problem','Explain one key idea in a sentence']}
];

function cleanSlides(value:any,topic:string):Slide[]{
 const raw=Array.isArray(value?.slides)?value.slides:[];
 const slides=raw.slice(0,80).map((s:any)=>({
  title:String(s?.title||'Lesson slide').slice(0,120),
  subtitle:s?.subtitle?String(s.subtitle).slice(0,180):undefined,
  bullets:Array.isArray(s?.bullets)?s.bullets.slice(0,10).map((x:any)=>String(x).slice(0,320)):[],
  problems:Array.isArray(s?.problems)?s.problems.slice(0,12).map((x:any)=>String(x).slice(0,320)):[],
  example:s?.example?String(s.example).slice(0,500):undefined,
  teacherNote:s?.teacherNote?String(s.teacherNote).slice(0,600):undefined,
  section:s?.section?String(s.section).slice(0,100):undefined,
  slideType:s?.slideType?String(s.slideType).slice(0,60):undefined,
  visualType:s?.visualType?String(s.visualType).slice(0,60):undefined,
  visualInstruction:s?.visualInstruction?String(s.visualInstruction).slice(0,240):undefined,
  studentPrompt:s?.studentPrompt?String(s.studentPrompt).slice(0,300):undefined,
  estimatedMinutes:Number.isFinite(Number(s?.estimatedMinutes))?Number(s.estimatedMinutes):undefined
 }));
 return slides.length>=4?slides:fallback(topic);
}

function roleInstruction(role:string){
 if(role==='follow') return 'FOLLOW CLOSELY: preserve the important content, sequence, terminology and instructional intent.';
 if(role==='pattern') return 'EXAMPLE PATTERN: analyze the examples/questions and create NEW analogous content with similar skill, structure and difficulty progression. Do not copy verbatim.';
 if(role==='gaps') return 'DIAGNOSE GAPS: treat this mainly as evidence of misconceptions, weak skills and assessment needs.';
 return 'REFERENCE: use this as supporting context while allowing EDU to design the lesson.';
}

export async function POST(req:Request){
 const uploadedIds:string[]=[];
 try{
  const form=await req.formData();
  const context=JSON.parse(String(form.get('context')||'{}'));
  const materialText=String(form.get('materialText')||'');
  const materialGuidance=JSON.parse(String(form.get('materialGuidance')||'{}'));
  const incoming=form.getAll('files').filter((x):x is File=>x instanceof File);
  const topic=context.topic||'Two-Step Equations';
  const requirements=parseRequirements(materialText,materialGuidance?.noteUse||'teaching-preferences');
  let slides:Slide[]=[];

  if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing. EDU will not export a generic fallback deck because it would ignore your Teacher Note and Lesson Architecture.');
  {
   const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
   const model=process.env.OPENAI_MODEL||'gpt-5-mini';
   const architecture=Array.isArray(context.architecture)?context.architecture:[];
   const totalMinutes=architecture.reduce((sum:number,x:any)=>sum+Number(x?.minutes||0),0);
   const fileRoleText=incoming.map(f=>`• ${f.name}: ${roleInstruction(materialGuidance?.fileUse?.[f.name]||'reference')}`).join('\n')||'No files uploaded.';
   const teacherPreferenceRules = `
TEACHER PRESENTATION PREFERENCES — THESE ARE HARD DESIGN CONSTRAINTS, NOT OPTIONAL LABELS.

Selected presentation style: ${context.pptStyle || 'auto'}
Selected font: ${context.pptFont || 'auto'}
Selected content density: ${context.contentDensity || 'auto'}
Selected visual emphasis: ${context.visualEmphasis || 'auto'}
Selected deck tone: ${context.deckTone || 'auto'}

STYLE
- cute: friendly classroom feel, shorter text, approachable examples, more visual moments.
- clean: minimal layout, concise wording, strong whitespace, one clear purpose per slide.
- academic: explicit definitions, notation, reasoning, worked examples, precise mathematical language.
- modern: strong hierarchy, concise headlines, visual-first organization, avoid textbook-like walls of text.
- auto: choose based on grade, topic and lesson objective.

CONTENT DENSITY
- compact: more instructional information per slide and fewer slides where reasonable.
- balanced: moderate explanation and practice per slide.
- spacious: less text per slide; split complex ideas across more slides.
- auto: choose based on grade and lesson complexity.

VISUAL EMPHASIS
- low: visuals only when they materially improve understanding.
- medium: regularly include useful mathematical visuals.
- high: visuals are a major teaching mechanism. Prefer number lines, balance models, equation blocks, coordinate planes, fraction bars, geometry diagrams and tables.
- auto: choose based on the mathematical concept.

TONE
- playful: warm, encouraging and student-friendly without becoming childish.
- professional: calm, concise and teacher-ready.
- academic: precise mathematical vocabulary and explicit reasoning.
- energetic: active prompts, quick checks, challenges and participation.
- auto: choose an age-appropriate classroom tone.

GRADE PEDAGOGY
- Grade 6: more scaffolding, concrete visuals, smaller reasoning steps and guided practice.
- Grade 7: balance models, symbolic reasoning, discussion and independent practice.
- Grade 8: more symbolic reasoning, justification, transfer and reduced scaffolding.

IMPORTANT:
These preferences must change the actual deck, not merely appear as metadata.
Different preferences should visibly change slide structure, wording, text amount, examples, visual choices, scaffolding and pacing.
Teacher Note remains the highest-priority teacher instruction.
`;

const prompt=`${teacherPreferenceRules}\n\nYou are EDU, a Grade 6-8 math instructional designer. Create a classroom-ready PowerPoint deck for THIS specific class.

FIRST, silently reflect on the teacher's instruction, uploaded source materials, class mastery and pacing. Then design the deck. Do not output your reflection.

INSTRUCTION PRIORITY — FOLLOW IN THIS EXACT ORDER:
1. TEACHER INSTRUCTION / NOTE (highest priority)
2. Teacher-controlled Lesson Architecture and pacing
3. Uploaded materials and the teacher-selected material role
4. Real class mastery / learning evidence when present
5. Grade-level pedagogy and mathematical correctness
6. Presentation preferences (style, density, visuals, tone, font)
7. EDU defaults (lowest priority)
If two instructions conflict, obey the higher item. Never sacrifice a teacher-requested activity, sequence, problem count, or emphasis merely to make the deck prettier.

TEACHER NOTE OVERRIDES ALL OPTIONAL DESIGN CHOICES:
The TEACHER INSTRUCTION / NOTE below is the teacher's direct custom-generation request and is the HIGHEST-PRIORITY lesson-design instruction. Follow it explicitly and visibly. If it requests a specific sequence, quantity, example type, visual, wording constraint, activity, or use of uploaded material, the resulting slides must demonstrate that request. Do not merely acknowledge or summarize the note. Only mathematical correctness, safety, and impossible technical constraints may override it.

CONFIGURATION CONTRACT — DO NOT IGNORE TEACHER SETTINGS:
Every non-empty value in CLASS CONTEXT is an explicit lesson-design constraint. Grade changes pedagogy and scaffolding. Standard and learningObjective control alignment. architecture controls sequence and time. pptStyle, pptFont, contentDensity, visualEmphasis and deckTone control presentation. mastery, when present, controls instructional emphasis. uploadedFiles and their roles control how source material is used. Teacher instruction has highest priority; NOTE MODE only indicates how strongly the teacher intended the note, and must-follow is absolute unless impossible or unsafe. If learningObjective is blank, infer one that aligns to the standard and topic. Never invent class mastery when it is absent.

NON-NEGOTIABLE PACING RULE:
The teacher controls lesson pacing. Follow the lesson architecture and minutes as the source of truth. Allocate slide count, explanation depth and activity density proportionally to the minutes. Short sections should feel concise and fast. Long sections should contain deeper modeling, examples, guided practice or student work. Do not silently replace the teacher's pacing.

PRESENTATION PREFERENCES (all optional):
Visual style: ${context.pptStyle||'auto'}
Font: ${context.pptFont||'auto'}
Content density: ${context.contentDensity||'auto'}
Visual emphasis: ${context.visualEmphasis||'auto'}
Tone: ${context.deckTone||'auto'}
If any preference is 'auto', infer it from grade level, pacing, uploaded materials and teacher instruction. These preferences affect presentation design, not mathematical correctness or the teacher-controlled pacing.

MATERIAL BEHAVIOR:
${fileRoleText}

HARD REQUIREMENTS EXTRACTED BY EDU (these are machine-validated after generation):
${JSON.stringify(requirements,null,2)}
If problemCount is present, you MUST return EXACTLY that many distinct student problems across the slides[].problems arrays. Do not hide requested problems in bullets, examples, speaker notes, or summaries. Spread them across practical practice/appendix slides (normally 2-6 problems per slide depending on density). The exact total in slides[].problems must equal problemCount. Generate NEW problems from the requested/material pattern; do not merely summarize uploaded questions and do not copy them verbatim.

CLASS CONTEXT
${JSON.stringify({...context,totalArchitectureMinutes:totalMinutes},null,2)}

TEACHER INSTRUCTION / NOTE
${materialText||'None supplied.'}

NOTE MODE
${materialGuidance?.noteUse||'teaching-preferences'}

SLIDE DESIGN DIRECTION:
Design the lesson as a presentation, not a document pasted onto slides. Each slide needs one clear teaching purpose and a strong visual hierarchy. Prefer short headlines, purposeful whitespace, cards/callouts, worked-example emphasis, and meaningful mathematical visuals. Avoid long paragraphs and repetitive identical layouts. Vary slide composition according to purpose: opening/goal, explanation/model, guided practice, independent practice, misconception, and exit ticket should feel structurally different. Visuals must teach the mathematics rather than decorate it.

Return ONLY valid JSON in this exact shape:
{"slides":[{"section":"architecture section name","slideType":"goal|model|guided-practice|independent-practice|misconception|exit-ticket|practice|appendix|other","title":"...","subtitle":"optional","bullets":["..."],"problems":["problem 1","problem 2"],"example":"optional equation/example","visualType":"none|number-line|balance-scale|equation-blocks|coordinate-plane|fraction-bars|geometry|diagram","visualInstruction":"what the visual should communicate","studentPrompt":"optional prompt shown to students","estimatedMinutes":2,"teacherNote":"optional speaker note"}]}.
Use as many slides as instructionally justified by the teacher's pacing and request, normally 8-24 slides but more is allowed for a requested practice appendix. Keep core slide text concise, mathematically correct and age appropriate.`;

   const content:any[]=[{type:'input_text',text:prompt}];
   for(const f of incoming){
    const ext=extOf(f.name);
    if(IMAGE_EXTS.has(ext)){
     // Images are vision inputs, not context-stuffing documents. Passing JPEG as input_file causes a 400.
     const bytes=Buffer.from(await f.arrayBuffer());
     const dataUrl=`data:${mimeForImage(ext)};base64,${bytes.toString('base64')}`;
     content.push({type:'input_text',text:`Teacher-uploaded image: ${f.name}. Inspect this image and use it according to its material role above.`});
     content.push({type:'input_image',image_url:dataUrl,detail:'auto'});
     continue;
    }
    if(DOCUMENT_EXTS.has(ext)){
     const uploaded=await client.files.create({file:f,purpose:'user_data'} as any);
     uploadedIds.push(uploaded.id);
     content.push({type:'input_file',file_id:uploaded.id});
     continue;
    }
    throw new Error(`Unsupported lesson material: ${f.name}. Use PDF, DOCX, PPTX, TXT, CSV, XLSX, or an image (JPG/JPEG/PNG/WEBP/GIF).`);
   }
   async function createDeck(extra=''){
    const requestContent=extra?[...content,{type:'input_text',text:extra}]:content;
    const response=await client.responses.create({model,input:[{role:'user',content:requestContent}] as any,store:false});
    const text=response.output_text.trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
    const parsed=JSON.parse(text);
    const cleaned=cleanSlides(parsed,topic);
    if(!Array.isArray(parsed?.slides)||parsed.slides.length<4) throw new Error('EDU returned too few slides.');
    return cleaned;
   }
   function architectureCheck(deck:Slide[]){
    if(!architecture.length) return {passed:true,missing:[] as string[],minuteDelta:0};
    const norm=(x:any)=>String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const missing=architecture.filter((a:any)=>{const want=norm(a.title);return want&&!deck.some(s=>{const got=norm(s.section);return got===want||got.includes(want)||want.includes(got)})}).map((a:any)=>String(a.title));
    const generatedMinutes=deck.reduce((n,s)=>n+Number(s.estimatedMinutes||0),0);
    const minuteDelta=totalMinutes&&generatedMinutes?Math.abs(generatedMinutes-totalMinutes):0;
    return {passed:missing.length===0&&(!totalMinutes||!generatedMinutes||minuteDelta<=Math.max(5,totalMinutes*.2)),missing,minuteDelta,generatedMinutes};
   }
   try{
    slides=await createDeck();
    let arch=architectureCheck(slides);
    const problemBad=!!requirements.problemCount&&countProblems(slides)!==requirements.problemCount;
    if(problemBad||!arch.passed){
     const fixes=[problemBad?`The Teacher Note requires EXACTLY ${requirements.problemCount} distinct problems in slides[].problems; you returned ${countProblems(slides)}.`:'',!arch.passed?`The Lesson Architecture was not followed. Missing sections: ${arch.missing.join(', ')||'none'}. Requested total pacing: ${totalMinutes} minutes; generated estimated pacing: ${arch.generatedMinutes||'not supplied'} minutes.`:''].filter(Boolean).join('\n');
     slides=await createDeck(`VALIDATION FAILED ON THE PREVIOUS ATTEMPT. Regenerate the COMPLETE deck, not a patch. ${fixes}\nEvery architecture section must appear by name in slides[].section and the slide content/detail must visibly match that section's teacher-entered instruction. Count carefully before returning JSON.`);
     arch=architectureCheck(slides);
    }
    if(requirements.problemCount && countProblems(slides)!==requirements.problemCount) throw new Error(`Teacher Note requirement not satisfied: requested ${requirements.problemCount} problems, but EDU generated ${countProblems(slides)}. No PPTX was exported.`);
    if(!arch.passed) throw new Error(`Lesson Architecture requirement not satisfied. Missing sections: ${arch.missing.join(', ')||'none'}. No PPTX was exported.`);
   }catch(e:any){
    throw new Error(`EDU could not produce a deck that satisfies the Teacher Note. ${e?.message||''}`.trim());
   }
   // Best-effort cleanup of temporary API files.
   for(const id of uploadedIds){try{await client.files.delete(id)}catch{}}
  }

  // EDU Design Engine V2: teacher intent first, then pedagogy, then visual design.
  const pptx = new PptxGenJSImport();
  pptx.layout='LAYOUT_WIDE';
  pptx.author='EDU'; pptx.subject=`Grade ${context.grade||'7'} Math`; pptx.title=topic; pptx.company='EDU';
  const chosenFont=context.pptFont && context.pptFont!=='auto'?String(context.pptFont):'Aptos';
  pptx.theme={headFontFace:chosenFont,bodyFontFace:chosenFont};
  const style=String(context.pptStyle||'auto');
  const density=String(context.contentDensity||'auto');
  const visualEmphasis=String(context.visualEmphasis||'auto');
  const deckTone=String(context.deckTone||'auto');
  const palette=style==='cute'
    ?{bg:'FFF9F4',surface:'FFFFFF',accent:'D96C75',accent2:'F0A36A',soft:'FFF0F2',text:'352C31',muted:'796B72'}
    :style==='academic'
    ?{bg:'F8F7F2',surface:'FFFFFF',accent:'315A6B',accent2:'A77B3B',soft:'E9F0F1',text:'17242A',muted:'66767D'}
    :style==='modern'
    ?{bg:'F5F6FA',surface:'FFFFFF',accent:'5548D9',accent2:'16A39A',soft:'EDEBFF',text:'17182B',muted:'6A6C83'}
    :{bg:'F7F9FC',surface:'FFFFFF',accent:'245F9F',accent2:'2E8B78',soft:'EAF2FF',text:'162033',muted:'68758A'};
  const profile={
    title:density==='compact'?23:density==='spacious'?30:27,
    body:density==='compact'?15:density==='spacious'?20:18,
    small:density==='compact'?10:11,
    gap:density==='compact'?.12:density==='spacious'?.24:.18,
    radius:style==='cute'?.16:style==='modern'?.04:.08,
    visual:visualEmphasis==='high'||(visualEmphasis==='auto'&&String(context.grade||'7')==='6')
  };
  const tonePrefix=deckTone==='playful'?'Try this · ':deckTone==='energetic'?'Challenge · ':deckTone==='academic'?'Reason carefully · ':'';
  const addFooter=(slide:any,idx:number)=>{
    slide.addText(`EDU  •  Grade ${context.grade||'7'} Math`,{x:.72,y:7.12,w:4,h:.16,fontFace:chosenFont,fontSize:8,color:palette.muted,margin:0});
    slide.addText(`${idx+1} / ${slides.length}`,{x:11.75,y:7.12,w:.85,h:.16,fontFace:chosenFont,fontSize:8,color:palette.muted,align:'right',margin:0});
  };
  const addHeader=(slide:any,s:Slide)=>{
    if(s.section) slide.addText(s.section.toUpperCase(),{x:.75,y:.38,w:5.8,h:.2,fontFace:chosenFont,fontSize:8,bold:true,color:palette.accent,charSpacing:1.4,margin:0});
    slide.addText(s.title,{x:.72,y:.68,w:11.85,h:.62,fontFace:chosenFont,fontSize:profile.title,bold:true,color:palette.text,margin:0,fit:'shrink'} as any);
    if(s.subtitle) slide.addText(s.subtitle,{x:.75,y:1.35,w:11.5,h:.34,fontFace:chosenFont,fontSize:12,color:palette.muted,margin:0,fit:'shrink'} as any);
  };
  const addVisual=(slide:any,s:Slide,x:number,y:number,w:number,h:number)=>{
    const vt=String(s.visualType||'none');
    if(vt==='none') return;
    slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:profile.radius,fill:{color:palette.soft},line:{color:palette.soft}} as any);
    if(vt==='balance-scale'){
      slide.addShape(pptx.ShapeType.line,{x:x+w*.5,y:y+.42,w:0,h:h*.55,line:{color:palette.accent,width:2}} as any);
      slide.addShape(pptx.ShapeType.line,{x:x+w*.25,y:y+h*.38,w:w*.5,h:0,line:{color:palette.accent,width:2}} as any);
      slide.addShape(pptx.ShapeType.line,{x:x+w*.12,y:y+h*.72,w:w*.76,h:0,line:{color:palette.accent,width:2}} as any);
      slide.addText('x + 3',{x:x+.22,y:y+h*.43,w:w*.28,h:.35,fontSize:16,bold:true,color:palette.accent,align:'center',margin:0});
      slide.addText('11',{x:x+w*.60,y:y+h*.43,w:w*.22,h:.35,fontSize:16,bold:true,color:palette.accent,align:'center',margin:0});
    }else if(vt==='number-line'){
      slide.addShape(pptx.ShapeType.line,{x:x+.35,y:y+h*.55,w:w-.7,h:0,line:{color:palette.accent,width:2}} as any);
      for(let i=0;i<7;i++){const xx=x+.45+i*(w-.9)/6;slide.addShape(pptx.ShapeType.line,{x:xx,y:y+h*.48,w:0,h:.16,line:{color:palette.accent,width:1.2}} as any);slide.addText(String(i-3),{x:xx-.14,y:y+h*.65,w:.28,h:.2,fontSize:9,color:palette.muted,align:'center',margin:0});}
    }else if(vt==='coordinate-plane'){
      slide.addShape(pptx.ShapeType.line,{x:x+w*.5,y:y+.25,w:0,h:h-.5,line:{color:palette.accent,width:1.5}} as any);
      slide.addShape(pptx.ShapeType.line,{x:x+.3,y:y+h*.5,w:w-.6,h:0,line:{color:palette.accent,width:1.5}} as any);
      slide.addShape(pptx.ShapeType.line,{x:x+w*.22,y:y+h*.75,w:w*.55,h:-h*.5,line:{color:palette.accent2,width:3}} as any);
    }else if(vt==='fraction-bars'){
      for(let i=0;i<4;i++) slide.addShape(pptx.ShapeType.rect,{x:x+.45+i*(w-.9)/4,y:y+h*.38,w:(w-.9)/4,h:.55,fill:{color:i<3?palette.accent:'FFFFFF',transparency:i<3?0:100},line:{color:palette.accent,width:1}} as any);
    }else{
      const eq=s.example||'Model → Reason → Solve';
      slide.addText(eq,{x:x+.35,y:y+h*.34,w:w-.7,h:.65,fontFace:chosenFont,fontSize:20,bold:true,color:palette.accent,align:'center',valign:'mid',margin:0,fit:'shrink'} as any);
      slide.addText(s.visualInstruction||vt.replace(/-/g,' '),{x:x+.4,y:y+h-.55,w:w-.8,h:.25,fontSize:9,color:palette.muted,align:'center',margin:0,fit:'shrink'} as any);
    }
  };

  slides.forEach((s,idx)=>{
    const slide=pptx.addSlide();
    slide.background={color:palette.bg};
    const kind=String(s.slideType||'other');
    const isGoal=kind==='goal'||idx===0;
    const isPractice=kind.includes('practice')||kind==='exit-ticket'||(s.problems?.length||0)>0;
    const hasVisual=!!(s.visualType&&s.visualType!=='none');

    if(isGoal){
      // Editorial title slide: strong hierarchy, one memorable visual statement.
      slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:.22,h:7.5,fill:{color:palette.accent},line:{color:palette.accent}} as any);
      slide.addText(s.section?.toUpperCase()||'TODAY’S LESSON',{x:.85,y:.72,w:4.8,h:.24,fontFace:chosenFont,fontSize:9,bold:true,color:palette.accent,charSpacing:1.8,margin:0});
      slide.addText(s.title,{x:.82,y:1.28,w:7.1,h:1.45,fontFace:chosenFont,fontSize:34,bold:true,color:palette.text,margin:0,breakLine:false,fit:'shrink'} as any);
      if(s.subtitle) slide.addText(s.subtitle,{x:.86,y:2.9,w:6.7,h:.55,fontFace:chosenFont,fontSize:16,color:palette.muted,margin:0,fit:'shrink'} as any);
      if(s.bullets?.length) slide.addText(s.bullets.slice(0,3).map(b=>({text:b,options:{bullet:{indent:16},breakLine:true,hanging:3}})),{x:.92,y:3.75,w:6.2,h:1.75,fontFace:chosenFont,fontSize:17,color:palette.text,margin:.04,paraSpaceAfterPt:12} as any);
      addVisual(slide,{...s,visualType:hasVisual?s.visualType:'equation-blocks'} as Slide,8.35,1.15,4.15,4.9);
    }else if(isPractice){
      addHeader(slide,s);
      const probs=s.problems||[];
      const left=probs.slice(0,Math.ceil(probs.length/2)); const right=probs.slice(Math.ceil(probs.length/2));
      const addProblemCol=(arr:string[],x:number)=>arr.forEach((q,i)=>{
        const yy=1.92+i*(4.55/Math.max(arr.length,1));
        slide.addShape(pptx.ShapeType.roundRect,{x,y:yy,w:5.65,h:Math.min(.78,4.1/Math.max(arr.length,1)),rectRadius:profile.radius,fill:{color:palette.surface},line:{color:'DDE3EA',width:1}} as any);
        slide.addText(`${i+1+(x>6?left.length:0)}`,{x:x+.18,y:yy+.17,w:.38,h:.28,fontSize:11,bold:true,color:palette.accent,align:'center',margin:0});
        slide.addText(q,{x:x+.68,y:yy+.12,w:4.65,h:.42,fontFace:chosenFont,fontSize:profile.body-1,color:palette.text,margin:0,fit:'shrink'} as any);
      });
      if(probs.length){addProblemCol(left,.72);addProblemCol(right,6.65)}
      else if(s.bullets?.length) slide.addText(s.bullets.map(b=>({text:b,options:{bullet:{indent:18},breakLine:true,hanging:4}})),{x:.9,y:1.95,w:7.2,h:3.9,fontSize:profile.body,color:palette.text,margin:.05,paraSpaceAfterPt:12} as any);
      if(s.example) {slide.addShape(pptx.ShapeType.roundRect,{x:.78,y:6.25,w:11.75,h:.58,rectRadius:profile.radius,fill:{color:palette.soft},line:{color:palette.soft}} as any);slide.addText(s.example,{x:1.05,y:6.38,w:11.2,h:.3,fontSize:16,bold:true,color:palette.accent,align:'center',margin:0,fit:'shrink'} as any);}
    }else{
      addHeader(slide,s);
      const split=hasVisual||profile.visual;
      if(split){
        if(s.bullets?.length) slide.addText(s.bullets.map(b=>({text:b,options:{bullet:{indent:18},breakLine:true,hanging:4}})),{x:.82,y:1.95,w:6.1,h:3.75,fontFace:chosenFont,fontSize:profile.body,color:palette.text,margin:.04,paraSpaceAfterPt:profile.gap*60,valign:'mid'} as any);
        if(s.example){slide.addShape(pptx.ShapeType.roundRect,{x:.82,y:5.72,w:6.05,h:.72,rectRadius:profile.radius,fill:{color:palette.soft},line:{color:palette.soft}} as any);slide.addText(s.example,{x:1.05,y:5.91,w:5.6,h:.32,fontSize:17,bold:true,color:palette.accent,align:'center',margin:0,fit:'shrink'} as any);}
        addVisual(slide,{...s,visualType:hasVisual?s.visualType:'equation-blocks'} as Slide,7.35,1.9,5.15,4.55);
      }else{
        if(s.bullets?.length) slide.addText(s.bullets.map(b=>({text:b,options:{bullet:{indent:18},breakLine:true,hanging:4}})),{x:1.0,y:2.0,w:11.0,h:3.75,fontFace:chosenFont,fontSize:profile.body+1,color:palette.text,margin:.04,paraSpaceAfterPt:profile.gap*60,valign:'mid'} as any);
        if(s.example){slide.addShape(pptx.ShapeType.roundRect,{x:1.0,y:5.72,w:11.0,h:.76,rectRadius:profile.radius,fill:{color:palette.soft},line:{color:palette.soft}} as any);slide.addText(s.example,{x:1.3,y:5.91,w:10.4,h:.34,fontSize:18,bold:true,color:palette.accent,align:'center',margin:0,fit:'shrink'} as any);}
      }
    }
    if(s.studentPrompt) slide.addText(`${tonePrefix}${s.studentPrompt}`,{x:.82,y:6.68,w:10.9,h:.25,fontFace:chosenFont,fontSize:10.5,italic:true,color:palette.accent,margin:0,fit:'shrink'} as any);
    if(s.teacherNote) slide.addNotes(`${s.teacherNote}${s.visualInstruction?`\nVisual direction: ${s.visualInstruction}`:''}${s.estimatedMinutes?`\nEstimated time: ${s.estimatedMinutes} min`:''}`);
    addFooter(slide,idx);
  });
  const out=await pptx.write({outputType:'nodebuffer'}) as Buffer;
  const safe=String(topic).replace(/[^a-zA-Z0-9\-_]+/g,'-').replace(/^-|-$/g,'')||'EDU-Lesson';
  const finalArch=(()=>{const architecture=Array.isArray(context.architecture)?context.architecture:[];const norm=(x:any)=>String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();const missing=architecture.filter((a:any)=>{const want=norm(a.title);return want&&!slides.some(s=>{const got=norm(s.section);return got===want||got.includes(want)||want.includes(got)})}).map((a:any)=>String(a.title));return {passed:missing.length===0,missing};})();
  return NextResponse.json({slides,requirements,appliedContext:{teacherNote:materialText,architecture:context.architecture,pptStyle:context.pptStyle,pptFont:context.pptFont,contentDensity:context.contentDensity,visualEmphasis:context.visualEmphasis,deckTone:context.deckTone},validation:{requestedProblems:requirements.problemCount||null,generatedProblems:countProblems(slides),architecture:finalArch,passed:(!requirements.problemCount||countProblems(slides)===requirements.problemCount)&&finalArch.passed},pptxBase64:Buffer.from(out).toString('base64'),filename:`EDU-${safe}.pptx`},{status:200,headers:{'Cache-Control':'no-store'}});
 }catch(err:any){return NextResponse.json({error:err?.message||'PowerPoint generation failed.'},{status:500});}
}
