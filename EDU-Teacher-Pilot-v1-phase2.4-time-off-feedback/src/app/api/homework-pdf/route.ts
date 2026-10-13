import {NextResponse} from 'next/server';
export const runtime='nodejs';

function clean(s:string){return s.replace(/\r/g,'').replace(/^#{1,6}\s*/gm,'').replace(/\*\*/g,'').replace(/^---+\s*$/gm,'').replace(/^\\\[\s*$/gm,'').replace(/^\\\]\s*$/gm,'').replace(/\\\[/g,'').replace(/\\\]/g,'').replace(/\\\(/g,'').replace(/\\\)/g,'').replace(/\\text\{([^}]*)\}/g,'$1').replace(/\\cdot/g,'*').replace(/\\times/g,'x').replace(/\\div/g,'/').replace(/\n{3,}/g,'\n\n').trim()}
function ascii(s:string){return clean(s).normalize('NFKD').replace(/[^\x20-\x7E\n\r\t]/g,'-')}
function esc(s:string){return s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
function wrap(text:string,max=92){
 const out:string[]=[];
 for(const raw of ascii(text).replace(/\r/g,'').split('\n')){
  if(!raw.trim()){out.push('');continue}
  const words=raw.replace(/^#{1,6}\s*/, '').split(/\s+/);let line='';
  for(const w of words){const n=line?line+' '+w:w;if(n.length>max){if(line)out.push(line);line=w}else line=n}
  if(line)out.push(line)
 }
 return out;
}
function pdfBytes(title:string,content:string){
 const lines=wrap(content); const perPage=46; const pages=[] as string[][];
 for(let i=0;i<lines.length;i+=perPage)pages.push(lines.slice(i,i+perPage)); if(!pages.length)pages.push(['']);
 const objects:string[]=[]; const add=(x:string)=>{objects.push(x);return objects.length};
 const catalog=add(''); const pagesObj=add(''); const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
 const pageIds:number[]=[];
 pages.forEach((pageLines,pi)=>{
  let stream=`BT\n/F2 16 Tf\n54 756 Td\n(${esc(pi===0?ascii(title):ascii(title)+' - continued')}) Tj\n/F1 10 Tf\n0 -26 Td\n`;
  pageLines.forEach(line=>{stream+=`(${esc(line)}) Tj\n0 -15 Td\n`}); stream+='ET';
  const contentId=add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  const pageId=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${contentId} 0 R >>`); pageIds.push(pageId);
 });
 objects[catalog-1]=`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
 objects[pagesObj-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
 let pdf='%PDF-1.4\n'; const offsets=[0]; objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`});
 const xref=Buffer.byteLength(pdf); pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`; for(let i=1;i<offsets.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
 pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(pdf);
}
export async function POST(req:Request){
 try{const b=await req.json(); if(!b?.content)return NextResponse.json({error:'Generate homework before exporting PDF.'},{status:400});
  const parts=[b.topic,b.className,b.lessonDate,'Homework'].filter(Boolean).map((x:any)=>String(x).replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,''));
  const filename=(parts.join('_')||'EDU_Homework')+'.pdf'; const buf=pdfBytes(b.title||'Homework + Answer Key',b.content);
  return new NextResponse(new Uint8Array(buf),{status:200,headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store'}})
 }catch(e:any){return NextResponse.json({error:e?.message||'PDF export failed.'},{status:500})}
}
