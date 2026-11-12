const canvas = document.querySelector('#canvas');
const statusText = document.querySelector('#status');
const fields = {
  text: document.querySelector('#prop-text'),
  name: document.querySelector('#prop-name'),
  width: document.querySelector('#prop-width'),
  x: document.querySelector('#prop-x'),
  y: document.querySelector('#prop-y')
};
const deleteButton = document.querySelector('#delete-control');
const selectionHint = document.querySelector('#selection-hint');
let controls = [];
let selectedId = null;
let nextId = 1;
let dragOffset = { x: 0, y: 0 };
let deferredInstall = null;

const defaults = {
  button:['Button',150], label:['Label',120], input:['Enter text',160],
  checkbox:['Check me',120], window:['Window',230], image:['Image',130],
  slider:['Slider',160], progress:['Progress',150], select:['Choose...',150],
  radio:['Option',120], panel:['Panel',180]
};

function createWidget(kind, x=18, y=18) {
  const id = nextId++;
  const [text, width] = defaults[kind] || ['Widget',140];
  controls.push({id,kind,name:`${kind}${id}`,text,width,x,y});
  select(id);
  statusText.textContent = `${text} added`;
}
function makeElement(item) {
  let el;
  if (item.kind === 'input') {
    el = document.createElement('input'); el.type='text'; el.placeholder=item.text;
  } else if (item.kind === 'checkbox' || item.kind === 'radio') {
    el = document.createElement('label');
    const input=document.createElement('input'); input.type=item.kind;
    el.append(input,document.createTextNode(' '+item.text));
  } else if (item.kind === 'select') {
    el=document.createElement('select');
    const option=document.createElement('option'); option.textContent=item.text; el.append(option);
    ['Option 2','Option 3'].forEach(t=>{const o=document.createElement('option');o.textContent=t;el.append(o);});
  } else if (item.kind === 'slider') {
    el=document.createElement('input'); el.type='range'; el.value=50;
  } else if (item.kind === 'progress') {
    el=document.createElement('div'); el.innerHTML='<div class="progress-fill"></div>';
  } else if (item.kind === 'window') {
    el=document.createElement('div');
    const title=document.createElement('div'); title.className='window-title'; title.textContent=item.text;
    const body=document.createElement('div'); body.className='window-body'; body.textContent='Window contents';
    el.append(title,body);
  } else if (item.kind === 'image') {
    el=document.createElement('div'); el.textContent='▧ '+item.text;
  } else {
    el=document.createElement('div'); el.textContent=item.text;
  }
  el.classList.add('control',item.kind);
  if(item.kind==='progress') el.setAttribute('aria-label',item.text);
  el.dataset.id=item.id;
  el.style.width=item.width+'px';
  el.style.left=item.x+'px'; el.style.top=item.y+'px';
  if(item.id===selectedId) el.classList.add('selected');
  el.addEventListener('pointerdown', e=>{
    if(e.target.closest('input,select')) return;
    const rect=el.getBoundingClientRect(), area=canvas.getBoundingClientRect();
    dragOffset={x:e.clientX-rect.left,y:e.clientY-rect.top};
    select(item.id);
    el.setPointerCapture?.(e.pointerId);
    el.dataset.dragging='true';
  });
  el.addEventListener('pointermove',e=>{
    if(el.dataset.dragging!=='true') return;
    const area=canvas.getBoundingClientRect();
    item.x=Math.max(0,Math.round(e.clientX-area.left+canvas.scrollLeft-dragOffset.x));
    item.y=Math.max(0,Math.round(e.clientY-area.top+canvas.scrollTop-dragOffset.y));
    el.style.left=item.x+'px'; el.style.top=item.y+'px';
    fields.x.value=item.x; fields.y.value=item.y;
  });
  el.addEventListener('pointerup',()=>{el.dataset.dragging='false';});
  el.addEventListener('click',e=>{e.stopPropagation();select(item.id);});
  return el;
}
function render(){
  canvas.innerHTML='';
  if(!controls.length){const note=document.createElement('div');note.className='empty-note';note.textContent='Choose or drag a widget from the Toolbox to begin.';canvas.append(note);}
  controls.forEach(item=>canvas.append(makeElement(item)));
}
function select(id){
  selectedId=id;
  const item=controls.find(x=>x.id===id);
  Object.values(fields).forEach(f=>f.disabled=!item);
  deleteButton.disabled=!item;
  selectionHint.textContent=item?`Selected: ${item.name}`:'Select a widget to edit it.';
  if(item){fields.text.value=item.text;fields.name.value=item.name;fields.width.value=item.width;fields.x.value=item.x;fields.y.value=item.y;}
  render();
}
function update(key,value){
  const item=controls.find(x=>x.id===selectedId); if(!item)return;
  item[key]=['width','x','y'].includes(key)?Math.max(0,Number(value)||0):value;
  if(key==='width')item.width=Math.min(500,item.width);
  statusText.textContent=`Updated ${item.name}`; render();
}
Object.entries(fields).forEach(([key,field])=>field.addEventListener('input',()=>update(key,field.value)));
document.querySelectorAll('.tool').forEach(btn=>{
  btn.addEventListener('click',()=>createWidget(btn.dataset.kind));
  btn.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',btn.dataset.kind));
});
canvas.addEventListener('dragover',e=>e.preventDefault());
canvas.addEventListener('drop',e=>{e.preventDefault();const kind=e.dataTransfer.getData('text/plain');if(!defaults[kind])return;const r=canvas.getBoundingClientRect();createWidget(kind,Math.max(0,e.clientX-r.left+canvas.scrollLeft),Math.max(0,e.clientY-r.top+canvas.scrollTop));});
canvas.addEventListener('click',()=>select(null));
deleteButton.addEventListener('click',()=>{controls=controls.filter(x=>x.id!==selectedId);select(null);statusText.textContent='Widget deleted';});

function download(name,content,type){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
document.querySelector('#save-project').addEventListener('click',()=>{
  download('Untitled.fforge',JSON.stringify({format:'FormForge',version:2,controls},null,2),'application/json');
  statusText.textContent='Project saved';
});
document.querySelector('#load-project').addEventListener('click',()=>document.querySelector('#file-picker').click());
document.querySelector('#file-picker').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{const data=JSON.parse(await file.text());if(data.format!=='FormForge'||!Array.isArray(data.controls))throw Error();
    controls=data.controls;nextId=Math.max(0,...controls.map(x=>x.id))+1;select(null);statusText.textContent='Project opened';
  }catch{statusText.textContent='Could not open that project file';}
  e.target.value='';
});

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;document.querySelector('#install-app').hidden=false;});
document.querySelector('#install-app').addEventListener('click',async()=>{
  if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;
});
if('serviceWorker' in navigator && location.protocol!=='file:'){
  navigator.serviceWorker.register('./sw.js').then(reg=>{
    document.querySelector('#update-status').textContent='Update system active. FormForge checks for updates when reopened.';
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker.addEventListener('statechange',()=>{
      if(worker.state==='installed'&&navigator.serviceWorker.controller){
        document.querySelector('#update-status').textContent='An update is ready. Reload to apply it.';
      }
    });});
  }).catch(()=>document.querySelector('#update-status').textContent='Update system unavailable in this hosting mode.');
}
navigator.serviceWorker?.addEventListener?.('controllerchange',()=>location.reload());
render();
