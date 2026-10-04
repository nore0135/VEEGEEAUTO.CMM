/** Authenticated, paginated traversal of the configured drawings folder.
 * Called only by dispatch_ AFTER auth_. File contents are previewed by Google Drive,
 * which enforces each viewer's own Google account permissions.
 */
function drawingList_(b,email){
 const root=props_().getProperty('DRAWINGS_FOLDER_ID');
 if(!root)throw Error('Drawings are not connected yet. The owner must set DRAWINGS_FOLDER_ID in Apps Script.');
 const cache=CacheService.getScriptCache();let scan;
 if(b.cursor){
  if(typeof b.cursor!=='string'||!/^[-\w]{10,80}$/.test(b.cursor))throw Error('Invalid drawings cursor. Refresh drawings.');
  const raw=cache.get('DRAWINGS_SCAN_'+b.cursor);if(!raw)throw Error('The drawing list expired. Use Refresh drawings.');
  scan=JSON.parse(raw);if(scan.email!==email||scan.root!==root)throw Error('Invalid drawings session. Refresh drawings.');
 }else{DriveApp.getFolderById(root).getName();scan={email,root,queue:[{id:root,path:'Drawings'}],current:null};}
 const start=Date.now(),files=[];
 while(Date.now()-start<8000&&files.length<100){
  if(!scan.current){if(!scan.queue.length)break;scan.current=scan.queue.shift();scan.current.phase='files';}
  const current=scan.current,folder=DriveApp.getFolderById(current.id);
  if(current.phase==='files'){
   const iterator=current.token?DriveApp.continueFileIterator(current.token):folder.getFiles();
   while(iterator.hasNext()&&files.length<100&&Date.now()-start<8000){
    const file=iterator.next();if(file.isTrashed()||file.getMimeType()==='application/vnd.google-apps.shortcut')continue;
    files.push({id:file.getId(),name:file.getName(),path:current.path,type:file.getMimeType(),size:file.getSize()});
   }
   if(iterator.hasNext()){current.token=iterator.getContinuationToken();break;}
   current.phase='folders';delete current.token;
  }
  if(current.phase==='folders'){
   const iterator=current.token?DriveApp.continueFolderIterator(current.token):folder.getFolders();
   while(iterator.hasNext()&&Date.now()-start<8000){const child=iterator.next();if(!child.isTrashed())scan.queue.push({id:child.getId(),path:current.path+' / '+child.getName()});if(scan.queue.length>500)throw Error('Too many nested folders to list at once. Ask the owner to use a smaller drawings root folder.');}
   if(iterator.hasNext()){current.token=iterator.getContinuationToken();break;}
   scan.current=null;
  }
 }
 let cursor='';
 if(scan.current||scan.queue.length){const data=JSON.stringify(scan);if(Utilities.newBlob(data).getBytes().length>90000)throw Error('Folder structure is too large. Use a smaller drawings root.');cursor=Utilities.getUuid();cache.put('DRAWINGS_SCAN_'+cursor,data,600);}
 return {files,cursor};
}
