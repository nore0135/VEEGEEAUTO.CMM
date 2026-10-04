/* CMM Work Control — Google Apps Script V8 backend.
 * All caller identity and permissions are checked here, never trusted from the UI.
 * Set initial Script Properties and run setup() once; see ../README.md.
 */
const LINES = ['YTA','YTB','YED','AXLE','YY8','BOP','CCB','YMC'];
const STATUSES = ['Requested','Planned','In progress','Completed','On hold'];
const TABLES = ['jobs','documents','roster'];
const MAX_PDF = 10 * 1024 * 1024;
function props_(){ return PropertiesService.getScriptProperties(); }
function hash_(s){ return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8)); }
function str_(v,max){if(typeof v!=='string'||!v.trim()||v.length>(max||200))throw Error('Complete the required fields.');return v.trim();}
function email_(v){const s=str_(v,150).toLowerCase();if(!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(s))throw Error('Enter a valid email address.');return s;}
function listEmails_(v,max){const a=[...new Set((Array.isArray(v)?v:String(v||'').split(/[\n,;]/)).map(x=>x.trim()).filter(Boolean).map(email_))];if(a.length>max)throw Error('Too many email addresses.');return a;}
function choice_(v,arr){if(!arr.includes(v))throw Error('Select a valid option.');return v;}
function day_(v){const s=str_(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Enter a valid date.');return s;}
function id_(v){const s=str_(v,60);if(!/^[a-zA-Z0-9_-]{8,60}$/.test(s))throw Error('Invalid record ID.');return s;}
function cfg_(){const raw=props_().getProperty('CONFIG');if(!raw)throw Error('Portal setup is not complete. Ask the owner to run setup.');return JSON.parse(raw);}
function saveCfg_(c){props_().setProperty('CONFIG',JSON.stringify(c));}
function sheet_(name){if(!TABLES.includes(name))throw Error('Invalid table.');return SpreadsheetApp.openById(props_().getProperty('DATABASE_ID')).getSheetByName(name);}
function rows_(name,includeDeleted=false){const s=sheet_(name);if(s.getLastRow()<2)return [];return s.getRange(2,1,s.getLastRow()-1,2).getValues().filter(r=>r[0]).map(r=>JSON.parse(r[1])).filter(r=>includeDeleted||!r.deletedAt);}
function put_(name,record){const s=sheet_(name);const match=s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,1).createTextFinder(record.id).matchEntireCell(true).findNext():null;const values=[[record.id,JSON.stringify(record)]];if(match)s.getRange(match.getRow(),1,1,2).setValues(values);else s.getRange(s.getLastRow()+1,1,1,2).setValues(values);}
function allowed_(email,c){return email===c.owner||c.admins.includes(email)||c.viewers.includes(email);}
function role_(email,c){return email===c.owner?'owner':c.admins.includes(email)?'admin':'viewer';}
function admin_(email,c){if(!['owner','admin'].includes(role_(email,c)))throw Error('Administrator access is required.');}
function owner_(email,c){if(email!==c.owner)throw Error('Only the owner can change this setting.');}
function timingEqual_(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function sign_(v){return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(v,props_().getProperty('SESSION_SECRET'),Utilities.Charset.UTF_8));}
function session_(email,c,remember=false){const p=Utilities.base64EncodeWebSafe(JSON.stringify({email,exp:Date.now()+(remember===true?30*24:6)*3600000,version:c.authVersion}));return p+'.'+sign_(p);}
function auth_(token,c){if(typeof token!=='string'||token.length>2000)throw Error('Please sign in again.');const [p,s]=token.split('.');if(!p||!timingEqual_(sign_(p),s))throw Error('Please sign in again.');const u=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p)).getDataAsString());if(u.exp<Date.now()||u.version!==c.authVersion||!allowed_(u.email,c))throw Error('Your session expired. Please sign in again.');return u.email;}
function loginStart_(b,c){const email=email_(b.email),key='OTP_'+hash_(email);const p=props_();const now=Date.now();let old=JSON.parse(p.getProperty(key)||'null');if(old&&now-old.sent<60000)throw Error('Wait one minute before requesting another code.');const generic={message:'If this address has access, a sign-in code has been sent.'};if(!allowed_(email,c))return generic;const rateKey='LOGIN_RATE';let rate=JSON.parse(p.getProperty(rateKey)||'{}');if(rate.day!==today_())rate={day:today_(),n:0};if(rate.n>=80||MailApp.getRemainingDailyQuota()<5)throw Error('Sign-in email limit reached. Please try again later.');if(old&&old.day===today_()&&old.count>=8)throw Error('Daily sign-in limit reached for this address.');const code=Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase();p.setProperty(key,JSON.stringify({hash:hash_(code),sent:now,expires:now+10*60000,attempts:0,day:today_(),count:old&&old.day===today_()?old.count+1:1}));rate.n++;p.setProperty(rateKey,JSON.stringify(rate));MailApp.sendEmail({to:email,subject:'Your CMM portal sign-in code',body:'Your sign-in code is: '+code+'\n\nIt expires in 10 minutes. Do not share this code. If you did not request it, ignore this email.',name:c.company});return generic;}
function loginVerify_(b,c){const email=email_(b.email),key='OTP_'+hash_(email),p=props_();const stored=JSON.parse(p.getProperty(key)||'null');if(!stored||stored.expires<Date.now()||stored.attempts>=5||!allowed_(email,c))throw Error('Code expired or invalid. Request a new code.');stored.attempts++;p.setProperty(key,JSON.stringify(stored));if(!timingEqual_(stored.hash,hash_(String(b.code||'').trim().toUpperCase())))throw Error('Code expired or invalid. Request a new code.');stored.expires=0;p.setProperty(key,JSON.stringify(stored));return {token:session_(email,c,b.remember===true),expiresAt:Date.now()+(b.remember===true?30*24:6)*3600000,email,role:role_(email,c)};}
function today_(){return Utilities.formatDate(new Date(),'Asia/Kolkata','yyyy-MM-dd');}
function state_(email,c){const jobs=rows_('jobs'),jobLines=new Map(jobs.map(j=>[j.id,j.line]));return {jobs,documents:rows_('documents').map(({fileId,...d})=>({...d,line:d.jobId?(jobLines.get(d.jobId)||d.line):d.line})),roster:rows_('roster'),user:{email,role:role_(email,c)},config:email===c.owner?{...c,triggerInstalled:ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='sendOverdueDigest'),remainingEmailQuota:MailApp.getRemainingDailyQuota()}:{company:c.company,shiftTimes:c.shiftTimes,alertEnabled:c.alertEnabled,companyCalendar:c.companyCalendar||null},serverTime:new Date().toISOString()};}
function doGet(){return ContentService.createTextOutput(JSON.stringify({service:'CMM Work Control',status:'Sign-in required'})).setMimeType(ContentService.MimeType.JSON);}
function doPost(e){let lock;try{if(!e.postData||e.postData.contents.length>15*1024*1024)throw Error('Request is too large.');const b=JSON.parse(e.postData.contents);lock=LockService.getScriptLock();if(!lock.tryLock(25000))throw Error('The portal is busy. Please retry shortly.');const c=cfg_();let result;if(b.action==='loginStart')result=loginStart_(b,c);else if(b.action==='loginVerify')result=loginVerify_(b,c);else{const email=auth_(b.token,c);result=dispatch_(b,email,c);}return json_({ok:true,data:result});}catch(err){console.error(String(err));return json_({ok:false,error:String(err.message||err)});}finally{if(lock&&lock.hasLock())lock.releaseLock();}}
function json_(v){return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);}
function quantity_(v){const n=Number(v);if(!Number.isInteger(n)||n<1||n>10000)throw Error('Quantity must be between 1 and 10000.');return n;}
function version_(record,version){if((record.version||1)!==Number(version))throw Error('Another administrator changed this record. Refresh before trying again.');}
function protectLastReport_(doc){if(!doc.jobId)return;const job=rows_('jobs').find(j=>j.id===doc.jobId);if(job&&job.status==='Completed'&&!rows_('documents').some(d=>d.id!==doc.id&&d.jobId===doc.jobId&&d.kind==='Inspection report'))throw Error('This is the only report for a completed inspection. Change the inspection to In progress before deleting or moving its report.');}
function deleteRecords_(job,docs,email,deleteJob){
 const stamp=new Date().toISOString(),written=[],files=[];
 const mark=r=>({...r,deletedAt:stamp,deletedBy:email,version:(r.version||1)+1});
 try{
  for(const d of docs){const file=DriveApp.getFileById(d.fileId);files.push(file);file.setTrashed(true);written.push(['documents',d]);put_('documents',mark(d));}
  if(job){written.push(['jobs',job]);put_('jobs',deleteJob?mark(job):{...job,status:'In progress',completed:null,updated:stamp,updatedBy:email,version:(job.version||1)+1});}
 }catch(e){
  let rollbackFailed=false;
  for(const [table,record] of written.reverse()){try{put_(table,record);}catch(err){rollbackFailed=true;console.error(String(err));}}
  for(const file of files){try{file.setTrashed(false);}catch(err){rollbackFailed=true;console.error(String(err));}}
  if(rollbackFailed)throw Error('Deletion could not finish and recovery was incomplete. Ask the owner to check the database and Drive Trash before retrying.');
  throw e;
 }
}
function dispatch_(b,email,c){
 if(b.action==='state')return state_(email,c);
 if(b.action==='request'){
  const id=id_(b.id);const existing=rows_('jobs',true).find(x=>x.id===id);if(existing){if(existing.deletedAt)throw Error('This request was deleted. Create a new request.');if(existing.requester!==email)throw Error('Duplicate ID.');return {id};}
  put_('jobs',{id,part:str_(b.part),number:str_(b.number),line:choice_(b.line,LINES),checks:str_(b.checks,4000),priority:choice_(b.priority,['Normal','High','Urgent']),quantity:Math.max(1,Math.min(10000,parseInt(b.quantity)||1)),due:day_(b.due),status:'Requested',assignee:'',requester:email,created:new Date().toISOString(),version:1});return {id};
 }
 if(b.action==='download'){
  const doc=rows_('documents').find(x=>x.id===id_(b.id));if(!doc)throw Error('Report not found.');const file=DriveApp.getFileById(doc.fileId);if(file.getSize()>MAX_PDF)throw Error('This PDF exceeds the portal download limit. Contact an administrator.');return {name:doc.name,base64:Utilities.base64Encode(file.getBlob().getBytes())};
 }
 admin_(email,c);
 if(b.action==='deleteRequest'){
  const job=rows_('jobs').find(j=>j.id===id_(b.id));if(!job)throw Error('Request not found.');version_(job,b.version);
  const docs=rows_('documents').filter(d=>d.jobId===job.id);
  const signature=a=>JSON.stringify(a.map(d=>[d.id,d.version||1]).sort((a,b)=>a[0].localeCompare(b[0])));
  if(signature(docs)!==signature(Array.isArray(b.reports)?b.reports:[]))throw Error('Attached reports have changed. Refresh and confirm deletion again.');
  deleteRecords_(job,docs,email,true);return {deleted:true};
 }
 if(b.action==='deleteDocument'){
  const doc=rows_('documents').find(d=>d.id===id_(b.id));if(!doc)throw Error('Document not found.');version_(doc,b.version);
  const job=doc.jobId?rows_('jobs').find(j=>j.id===doc.jobId):null;
  const reopen=job&&job.status==='Completed'&&!rows_('documents').some(d=>d.id!==doc.id&&d.jobId===job.id&&d.kind==='Inspection report');
  deleteRecords_(reopen?job:null,[doc],email,false);return {deleted:true,reopened:!!reopen};
 }
 if(b.action==='editDocument'){
  const doc=rows_('documents').find(d=>d.id===id_(b.id));if(!doc)throw Error('Document not found.');version_(doc,b.version);
  const name=str_(b.name,200).replace(/[\r\n]/g,'');if(!name.toLowerCase().endsWith('.pdf'))throw Error('The document name must end in .pdf.');
  const date=day_(b.date),jobId=doc.kind==='Inspection report'?id_(b.jobId):'';
  const job=jobId?rows_('jobs').find(j=>j.id===jobId):null;if(jobId&&!job)throw Error('Select an existing inspection request.');
  if(jobId!==doc.jobId)protectLastReport_(doc);
  const line=job?job.line:choice_(b.line,['All lines',...LINES]);const oldFile=DriveApp.getFileById(doc.fileId);const oldName=oldFile.getName();let replacement=null;
  if(b.base64){if(typeof b.base64!=='string'||b.base64.length>14*1024*1024)throw Error('Select a PDF under 10 MB.');const bytes=Utilities.base64Decode(b.base64);if(bytes.length>MAX_PDF||bytes.length<5||String.fromCharCode.apply(null,bytes.slice(0,5))!=='%PDF-')throw Error('Select a valid PDF under 10 MB.');replacement=DriveApp.getFolderById(c.driveFolderId).createFile(Utilities.newBlob(bytes,'application/pdf',name));}
  const next={...doc,name,date,jobId,line,version:(doc.version||1)+1,updated:new Date().toISOString(),updatedBy:email};
  if(replacement){next.fileId=replacement.getId();next.size=replacement.getSize();}
  try{if(!replacement)oldFile.setName(name);put_('documents',next);}catch(e){if(replacement)replacement.setTrashed(true);else oldFile.setName(oldName);throw e;}
  if(replacement){try{oldFile.setTrashed(true);}catch(e){console.error('Replaced PDF retained in Drive: '+String(e));}}
  return {saved:true};
 }
 if(b.action==='job'){
  const job=rows_('jobs').find(x=>x.id===id_(b.id));if(!job)throw Error('Request not found.');if(job.version!==b.version)throw Error('Another administrator updated this request. Refresh before saving.');const status=choice_(b.status,STATUSES);if(status==='Completed'&&!rows_('documents').some(x=>x.jobId===job.id&&x.kind==='Inspection report'))throw Error('Upload an inspection report before marking this part complete.');const details=b.part===undefined?{}:{part:str_(b.part),number:str_(b.number),line:choice_(b.line,LINES),checks:str_(b.checks,4000),priority:choice_(b.priority,['Normal','High','Urgent']),quantity:quantity_(b.quantity)};Object.assign(job,details,{status,due:day_(b.due),assignee:String(b.assignee||'').trim().slice(0,150),version:job.version+1,updated:new Date().toISOString(),updatedBy:email,completed:status==='Completed'?(job.completed||new Date().toISOString()):null});put_('jobs',job);return {id:job.id};
 }
 if(b.action==='upload'){
  const id=id_(b.id);const previous=rows_('documents',true).find(x=>x.id===id);if(previous){if(previous.deletedAt)throw Error('This document was deleted. Start a new upload.');return {id};}const kind=choice_(b.kind,['Inspection report','Daily plan','Monthly plan']);const jobId=kind==='Inspection report'?id_(b.jobId):'';const job=jobId?rows_('jobs').find(x=>x.id===jobId):null;if(jobId&&!job)throw Error('Select an existing request.');const line=job?job.line:choice_(b.line,['All lines',...LINES]);const day=day_(b.date);const name=str_(b.name,200).replace(/[\r\n]/g,'');if(!name.toLowerCase().endsWith('.pdf'))throw Error('Only PDF files are accepted.');if(typeof b.base64!=='string'||b.base64.length>14*1024*1024)throw Error('Select a PDF under 10 MB.');const bytes=Utilities.base64Decode(b.base64);if(bytes.length>MAX_PDF||bytes.length<5||String.fromCharCode.apply(null,bytes.slice(0,5))!=='%PDF-')throw Error('Select a valid PDF under 10 MB.');const folder=DriveApp.getFolderById(c.driveFolderId);const file=folder.createFile(Utilities.newBlob(bytes,'application/pdf',name));try{put_('documents',{id,name,kind,line,date:day,jobId,fileId:file.getId(),size:bytes.length,uploader:email,created:new Date().toISOString()});}catch(e){file.setTrashed(true);throw e;}return {id};
 }
 if(b.action==='roster'){
  if(!Array.isArray(b.rows)||!b.rows.length||b.rows.length>70)throw Error('Save between 1 and 70 roster entries.');const newRows=b.rows.map(r=>{const name=str_(r.name,120),date=day_(r.date),shift=choice_(r.shift,['A','B','C','General','Holiday']);return {id:'shift_'+hash_(name.toLowerCase()+'|'+date).replace(/=/g,''),name,date,shift};});newRows.forEach(r=>put_('roster',r));return {count:newRows.length};
 }
 owner_(email,c);
 if(b.action==='settings'){
  const admins=listEmails_(b.admins,3).filter(x=>x!==c.owner),viewers=listEmails_(b.viewers,50).filter(x=>x!==c.owner&&!admins.includes(x));const folderId=str_(b.driveFolderId,200).replace(/^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\//,'').split('?')[0];if(!/^[\w-]+$/.test(folderId))throw Error('Enter a Drive folder ID or folder link.');DriveApp.getFolderById(folderId).getName();const times={};for(const s of ['A','B','C','General']){const t=b.shiftTimes&&b.shiftTimes[s];if(!t||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.end)||t.start===t.end)throw Error('Enter valid start and end times for every shift.');times[s]={start:t.start,end:t.end};}
  const next={...c,company:str_(b.company,100),admins,viewers,driveFolderId:folderId,alertEmail:b.alertEmail?email_(b.alertEmail):'',alertEnabled:!!b.alertEnabled,shiftTimes:times};if(next.alertEnabled&&!next.alertEmail)throw Error('Add the company notification email first.');saveCfg_(next);try{syncTrigger_(next);}catch(e){saveCfg_(c);throw Error('The notification schedule could not be updated. Settings were not saved.');}return {saved:true};
 }
 if(b.action==='transfer'){
  const target=email_(b.email);if(!c.admins.includes(target))throw Error('Choose one of your three existing administrators.');c.admins=c.admins.filter(x=>x!==target).concat(c.owner);c.owner=target;c.authVersion++;saveCfg_(c);return {transferred:true};
 }
 if(b.action==='revokeSessions'){c.authVersion++;saveCfg_(c);return {revoked:true};}
 throw Error('Unknown action.');
}
function syncTrigger_(c){const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='sendOverdueDigest');if(c.alertEnabled){if(!existing.length)ScriptApp.newTrigger('sendOverdueDigest').timeBased().atHour(8).everyDays(1).inTimezone('Asia/Kolkata').create();existing.slice(1).forEach(t=>ScriptApp.deleteTrigger(t));}else existing.forEach(t=>ScriptApp.deleteTrigger(t));}
function sendOverdueDigest(){const lock=LockService.getScriptLock();lock.waitLock(25000);try{const c=cfg_(),today=today_();if(!c.alertEnabled||!c.alertEmail||props_().getProperty('LAST_DIGEST')===today)return;const overdue=rows_('jobs').filter(j=>['Planned','In progress','On hold'].includes(j.status)&&j.due<today);if(!overdue.length)return;if(MailApp.getRemainingDailyQuota()<1)throw Error('Email quota exhausted.');const body=overdue.map(j=>`${j.line} | ${j.number} | ${j.part}\nDue: ${j.due} | ${j.status} | Assigned: ${j.assignee||'Unassigned'}`).join('\n\n');MailApp.sendEmail({to:c.alertEmail,subject:`CMM: ${overdue.length} overdue inspection${overdue.length===1?'':'s'} — ${today}`,body:`The following planned parts have not been completed:\n\n${body}\n\nOpen the CMM portal to update the plan. Times are India Standard Time.`,name:c.company});props_().setProperty('LAST_DIGEST',today);}finally{lock.releaseLock();}}
function setup(){const lock=LockService.getScriptLock();lock.waitLock(25000);try{const p=props_();if(p.getProperty('CONFIG'))throw Error('Already initialized. Use portal Settings for changes.');const owner=email_(p.getProperty('OWNER_EMAIL'));const folderId=str_(p.getProperty('DRIVE_FOLDER_ID'));DriveApp.getFolderById(folderId).getName();let dbId=p.getProperty('DATABASE_ID');const ss=dbId?SpreadsheetApp.openById(dbId):SpreadsheetApp.create('CMM Work Control — Database');p.setProperty('DATABASE_ID',ss.getId());TABLES.forEach(n=>{const s=ss.getSheetByName(n)||ss.insertSheet(n);if(s.getLastRow()===0)s.appendRow(['id','data']);});p.setProperty('SESSION_SECRET',Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid());saveCfg_({company:'CMM Work Control',owner,admins:listEmails_(p.getProperty('ADMIN_EMAILS'),3).filter(x=>x!==owner),viewers:listEmails_(p.getProperty('VIEWER_EMAILS'),50),driveFolderId:folderId,alertEmail:p.getProperty('ALERT_EMAIL')?email_(p.getProperty('ALERT_EMAIL')):'',alertEnabled:false,authVersion:1,shiftTimes:{A:{start:'06:00',end:'14:00'},B:{start:'14:00',end:'22:00'},C:{start:'22:00',end:'06:00'},General:{start:'09:00',end:'17:00'}}});console.log('Setup complete. Database: '+ss.getUrl());}finally{lock.releaseLock();}}
/** Run only from the new company Google owner's Apps Script editor after redeployment. */
function restoreNotificationTrigger(){syncTrigger_(cfg_());}
