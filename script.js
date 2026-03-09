'use strict';
/* ══════════════════════════════════════════════
   HANDBALLIQ — script.js  (clean rewrite)
══════════════════════════════════════════════ */

const HALF_DURATION = 25 * 60;

const COURT_SLOTS = [
  { id:'ARQ', x:50.0, y:5.0  },
  { id:'EI',  x:10.5, y:26.0 },
  { id:'LI',  x:23.0, y:42.0 },
  { id:'CT',  x:50.0, y:50.0 },
  { id:'LD',  x:77.0, y:42.0 },
  { id:'ED',  x:89.5, y:26.0 },
  { id:'PV',  x:50.0, y:33.0 },
];

// Slot positions on the 200×280 setup court SVG (% of wrapper)
const SETUP_SLOT_POS = {
  ARQ:{ x:50, y:9  },
  EI: { x:8,  y:32 },
  LI: { x:25, y:46 },
  CT: { x:50, y:55 },
  LD: { x:75, y:46 },
  ED: { x:92, y:32 },
  PV: { x:50, y:38 },
};

const POSITIONS = ['ARQ','EI','LI','CT','LD','ED','PV','SUP','--'];

const ACTIONS = [
  { key:'goal',       label:'GOL',         icon:'⚽', cls:'goal',       onlyGK:false },
  { key:'miss',       label:'FALLO',       icon:'❌', cls:'miss',       onlyGK:false },
  { key:'save',       label:'PARADA',      icon:'🧤', cls:'save',       onlyGK:true  },
  { key:'turnover',   label:'PÉRDIDA',     icon:'🔄', cls:'turnover',   onlyGK:false },
  { key:'assist',     label:'ASISTENCIA',  icon:'🎯', cls:'assist',     onlyGK:false },
  { key:'yellow',     label:'T. AMARILLA', icon:'🟨', cls:'yellow',     onlyGK:false },
  { key:'suspension', label:'2 MIN',       icon:'⏱️', cls:'suspension', onlyGK:false },
  { key:'redcard',    label:'T. ROJA',     icon:'🟥', cls:'red',        onlyGK:false },
  { key:'steal',      label:'ROBO',        icon:'✋', cls:'steal',      onlyGK:false },
];

// ══════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════
const ls = {
  get:(k)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch(e){return null;} },
  set:(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} },
  del:(k)=>{ try{ localStorage.removeItem(k); }catch(e){} },
};
function getSquad()     { return ls.get('hiq_squad')   || { teamName:'', teamLogo:'', players:[] }; }
function saveSquad(s)   { ls.set('hiq_squad', s); }
function getHistory()   { return ls.get('hiq_history') || []; }
function saveHistory(h) { ls.set('hiq_history', h); }
function pushHistory(snap){ const h=getHistory(); h.unshift(snap); if(h.length>50)h.pop(); saveHistory(h); }
function getMatch()     { return ls.get('hiq_match'); }
function saveMatch(m)   { ls.set('hiq_match', m); }
function clearMatch()   { ls.del('hiq_match'); }

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initSquadTab();
  renderHistory();
  renderTournament();

  document.getElementById('teamLogoInput').addEventListener('change', e => {
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=ev=>{ const sq=getSquad(); sq.teamLogo=ev.target.result; saveSquad(sq); renderTeamLogo(ev.target.result); };
    r.readAsDataURL(f);
  });

  document.getElementById('squadTeamName').addEventListener('blur', ()=>{
    const sq=getSquad(); sq.teamName=document.getElementById('squadTeamName').value.trim(); saveSquad(sq);
  });

  const activeM = getMatch();
  if (activeM && !activeM.finished) {
    setTimeout(()=>{
      if(confirm('Hay un partido en curso. ¿Querés retomarlo?')) resumeMatch(activeM);
      else clearMatch();
    }, 400);
  }
});

// ══════════════════════════════════════════════
// SCREEN NAV
// ══════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id==='screen-home'){ renderHistory(); renderTournament(); renderSquadList(); }
  if(id==='screen-stats'){
    renderStatsForMatch(activeMatch,'statsBody');
    // Update back button depending on whether match is finished
    const backBtn = document.querySelector('#screen-stats .btn-back');
    if(activeMatch && activeMatch.finished){
      backBtn.textContent = '← INICIO';
      backBtn.onclick = () => showScreen('screen-home');
    } else {
      backBtn.textContent = '← PARTIDO';
      backBtn.onclick = () => showScreen('screen-match');
    }
  }
}

function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
  if(tabId==='tab-history') renderHistory();
  if(tabId==='tab-tournament') renderTournament();
}

// ══════════════════════════════════════════════
// SQUAD TAB
// ══════════════════════════════════════════════
function initSquadTab() {
  const sq=getSquad();
  document.getElementById('squadTeamName').value=sq.teamName||'';
  renderTeamLogo(sq.teamLogo);
  renderSquadList();
}

function renderTeamLogo(src) {
  const img=document.getElementById('teamLogoImg'), ph=document.getElementById('teamLogoPlaceholder');
  if(src){ img.src=src; img.style.display='block'; ph.style.display='none'; }
  else   { img.style.display='none'; ph.style.display='block'; }
}

function renderSquadList() {
  const sq=getSquad();
  const list=document.getElementById('squadList');
  const hint=document.getElementById('squadCountHint');
  hint.textContent=`${sq.players.length} jugadora${sq.players.length!==1?'s':''}`;
  list.innerHTML='';
  sq.players.forEach(p=>{
    const card=document.createElement('div');
    card.className='squad-card';
    card.innerHTML=`
      <div class="squad-card-photo">${p.photo?`<img src="${p.photo}"/>`:(p.number?'#'+p.number:initials(p.name))}</div>
      <div class="squad-card-info">
        <div class="squad-card-name">${p.name}</div>
        <div class="squad-card-pos">${[p.pos1,p.pos2].filter(x=>x&&x!=='--').join(' / ')||'Sin posición'}</div>
      </div>
      <div class="squad-card-num">${p.number?'#'+p.number:''}</div>`;
    card.onclick=()=>openSquadEditor(p.id);
    list.appendChild(card);
  });
}

// ── Squad Editor ──
let editingPlayerId=null, editorPhotoData=null;

function openSquadEditor(pid) {
  const sq=getSquad();
  const p=pid?sq.players.find(x=>x.id===pid):null;
  editingPlayerId=pid||null;
  document.getElementById('btnDeleteSquad').style.display=pid?'block':'none';
  document.getElementById('squadEditorBody').innerHTML=`
    <div class="squad-editor-photo-row">
      <div class="squad-editor-photo" id="editorPhotoThumb" onclick="triggerEditorPhoto()">
        ${p&&p.photo?`<img src="${p.photo}"/>`:'<span>📷</span>'}
      </div>
      <div style="flex:1">
        <div class="squad-editor-field">
          <label class="squad-editor-label">NÚMERO</label>
          <input class="squad-editor-input" id="editorNumber" type="number" min="1" max="99" placeholder="Nro" value="${p?.number||''}"/>
        </div>
      </div>
    </div>
    <div class="squad-editor-field">
      <label class="squad-editor-label">NOMBRE</label>
      <input class="squad-editor-input" id="editorName" type="text" maxlength="24" placeholder="Nombre de la jugadora" value="${p?.name||''}"/>
    </div>
    <div class="squad-editor-field">
      <label class="squad-editor-label">POSICIONES</label>
      <div class="squad-editor-pos-row">
        <select class="squad-editor-select" id="editorPos1">
          ${POSITIONS.filter(x=>x!=='--').map(x=>`<option value="${x}"${p?.pos1===x?' selected':''}>${x}</option>`).join('')}
        </select>
        <select class="squad-editor-select" id="editorPos2">
          <option value="--"${(!p?.pos2||p.pos2==='--')?' selected':''}>-- sin 2ª</option>
          ${POSITIONS.filter(x=>x!=='--').map(x=>`<option value="${x}"${p?.pos2===x?' selected':''}>${x}</option>`).join('')}
        </select>
      </div>
    </div>`;
  document.getElementById('squadEditorOverlay').classList.add('active');
  document.getElementById('squadEditor').classList.add('active');
}

function closeSquadEditor() {
  document.getElementById('squadEditorOverlay').classList.remove('active');
  document.getElementById('squadEditor').classList.remove('active');
  editorPhotoData=null;
}

function triggerEditorPhoto() {
  const input=document.createElement('input'); input.type='file'; input.accept='image/*';
  input.onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>{ editorPhotoData=ev.target.result; document.getElementById('editorPhotoThumb').innerHTML=`<img src="${ev.target.result}"/>`; }; r.readAsDataURL(f); };
  input.click();
}

function saveSquadPlayer() {
  const name=document.getElementById('editorName').value.trim();
  if(!name){ showToast('Ingresá el nombre'); return; }
  const sq=getSquad();
  const photo=editorPhotoData||(editingPlayerId?sq.players.find(p=>p.id===editingPlayerId)?.photo:'');
  const player={ id:editingPlayerId||('p_'+Date.now()+'_'+Math.random().toString(36).slice(2)), name, number:parseInt(document.getElementById('editorNumber').value)||null, photo:photo||'', pos1:document.getElementById('editorPos1').value, pos2:document.getElementById('editorPos2').value };
  if(editingPlayerId){ const idx=sq.players.findIndex(p=>p.id===editingPlayerId); if(idx>=0)sq.players[idx]=player; }
  else sq.players.push(player);
  saveSquad(sq); closeSquadEditor(); renderSquadList(); showToast('✅ Jugadora guardada');
}

function deleteSquadPlayer() {
  if(!editingPlayerId) return;
  if(!confirm('¿Eliminar esta jugadora?')) return;
  const sq=getSquad(); sq.players=sq.players.filter(p=>p.id!==editingPlayerId);
  saveSquad(sq); closeSquadEditor(); renderSquadList(); showToast('Jugadora eliminada');
}

// ══════════════════════════════════════════════
// MATCH SETUP — VISUAL COURT DRAG & DROP
// ══════════════════════════════════════════════
let convocadaIds=new Set();
let lineupSlotMap={};

function openMatchSetup() {
  const sq=getSquad();
  if(sq.players.length<1){ showToast('Añadí jugadoras a la plantilla primero'); return; }
  convocadaIds=new Set();
  lineupSlotMap={ARQ:null,EI:null,LI:null,CT:null,LD:null,ED:null,PV:null};
  document.getElementById('rivalTeamName').value='';
  renderSetupCourt();
  renderSetupPlayerList();
  renderSubsChips();
  showScreen('screen-match-setup');
}

function renderSetupCourt() {
  const sq=getSquad();
  const container=document.getElementById('setupCourtSlots');
  container.innerHTML='';
  COURT_SLOTS.forEach(slot=>{
    const pos=SETUP_SLOT_POS[slot.id];
    const pid=lineupSlotMap[slot.id];
    const p=pid?sq.players.find(x=>x.id===pid):null;
    const slotEl=document.createElement('div');
    slotEl.className='setup-slot'+(p?' filled':'');
    slotEl.dataset.slotId=slot.id;
    slotEl.dataset.dropSlot=slot.id;
    slotEl.style.left=pos.x+'%';
    slotEl.style.top=pos.y+'%';
    const circle=document.createElement('div');
    circle.className='setup-slot-circle';
    if(p){ circle.innerHTML=p.photo?`<img src="${p.photo}"/>`:`<span style="font-size:.7rem;font-weight:900">${initials(p.name)}</span>`; }
    else  { circle.textContent=slot.id; }
    const label=document.createElement('div');
    label.className='setup-slot-label';
    label.textContent=p?shortName(p.name):slot.id;
    slotEl.append(circle,label);
    if(p){
      const clr=document.createElement('button'); clr.className='setup-slot-clear'; clr.innerHTML='×';
      clr.onclick=e=>{ e.stopPropagation(); clearSetupSlot(slot.id); };
      circle.appendChild(clr);
    }
    slotEl.addEventListener('dragover', e=>{ e.preventDefault(); slotEl.classList.add('drag-over'); });
    slotEl.addEventListener('dragleave',()=>slotEl.classList.remove('drag-over'));
    slotEl.addEventListener('drop',     e=>{ e.preventDefault(); slotEl.classList.remove('drag-over'); handleSlotDrop(slot.id,e.dataTransfer.getData('text/plain')); });
    container.appendChild(slotEl);
  });
}

function clearSetupSlot(slotId) {
  lineupSlotMap[slotId]=null;
  renderSetupCourt(); renderSetupPlayerList(); renderSubsChips();
}

function handleSlotDrop(slotId, pid) {
  if(!pid||!convocadaIds.has(pid)) return;
  Object.keys(lineupSlotMap).forEach(s=>{ if(lineupSlotMap[s]===pid) lineupSlotMap[s]=null; });
  lineupSlotMap[slotId]=pid;
  renderSetupCourt(); renderSetupPlayerList(); renderSubsChips();
}

function renderSetupPlayerList() {
  const sq=getSquad();
  const list=document.getElementById('setupPlayerList');
  list.innerHTML='';
  const assignedPids=new Set(Object.values(lineupSlotMap).filter(Boolean));
  document.getElementById('calledCount').textContent=convocadaIds.size;
  sq.players.forEach(p=>{
    const isConvocada=convocadaIds.has(p.id);
    const isAssigned=assignedPids.has(p.id);
    const chip=document.createElement('div');
    chip.className='setup-player-chip'+(isAssigned?' assigned':(!isConvocada?' not-called':''));
    chip.dataset.pid=p.id;
    chip.innerHTML=`
      <div class="setup-chip-photo">${p.photo?`<img src="${p.photo}"/>`:(p.number?'#'+p.number:initials(p.name))}</div>
      <div class="setup-chip-name">${p.name}</div>
      <div class="setup-chip-pos">${[p.pos1,p.pos2].filter(x=>x&&x!=='--').join('/')}</div>
      ${isConvocada?'<span style="color:var(--accent-teal);font-size:.8rem;flex-shrink:0">✓</span>':''}`;
    chip.addEventListener('click',()=>toggleConvocada(p.id));
    if(isConvocada&&!isAssigned){
      chip.draggable=true;
      chip.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/plain',p.id); e.dataTransfer.effectAllowed='move'; chip.classList.add('dragging-chip'); showDragGhost(e,p); });
      chip.addEventListener('dragend',()=>{ chip.classList.remove('dragging-chip'); removeDragGhost(); });
      chip.addEventListener('touchstart',e=>startChipTouchDrag(e,p,chip),{passive:false});
    }
    list.appendChild(chip);
  });
}

function toggleConvocada(pid) {
  if(convocadaIds.has(pid)){ convocadaIds.delete(pid); Object.keys(lineupSlotMap).forEach(s=>{ if(lineupSlotMap[s]===pid) lineupSlotMap[s]=null; }); }
  else convocadaIds.add(pid);
  document.getElementById('calledCount').textContent=convocadaIds.size;
  renderSetupCourt(); renderSetupPlayerList(); renderSubsChips();
}

function renderSubsChips() {
  const sq=getSquad();
  const assignedPids=new Set(Object.values(lineupSlotMap).filter(Boolean));
  const subs=sq.players.filter(p=>convocadaIds.has(p.id)&&!assignedPids.has(p.id));
  const container=document.getElementById('subsList');
  const countEl=document.getElementById('subsCount');
  if(countEl) countEl.textContent=subs.length;
  container.innerHTML='';
  if(subs.length===0){ container.innerHTML=`<div style="font-family:'Barlow Condensed',sans-serif;font-size:.8rem;color:var(--text-muted)">Todas las convocadas son titulares</div>`; return; }
  subs.forEach(p=>{ const chip=document.createElement('div'); chip.className='sub-chip'; chip.innerHTML=`<div class="sub-chip-photo">${p.photo?`<img src="${p.photo}"/>`:(p.number?'#'+p.number:initials(p.name))}</div><div class="sub-chip-name">${p.name}</div>`; container.appendChild(chip); });
}

// ── Drag ghost ──
let ghostEl=null;
function showDragGhost(e,p){
  removeDragGhost();
  ghostEl=document.createElement('div'); ghostEl.className='drag-ghost';
  ghostEl.innerHTML=`${p.photo?`<img src="${p.photo}" style="width:22px;height:22px;border-radius:50%;object-fit:cover">`:''}${p.name}`;
  ghostEl.style.left=(e.clientX+12)+'px'; ghostEl.style.top=(e.clientY-20)+'px';
  document.body.appendChild(ghostEl);
  document.addEventListener('dragover',moveDragGhost);
}
function moveDragGhost(e){ if(ghostEl){ ghostEl.style.left=(e.clientX+12)+'px'; ghostEl.style.top=(e.clientY-20)+'px'; } }
function removeDragGhost(){ if(ghostEl){ ghostEl.remove(); ghostEl=null; } document.removeEventListener('dragover',moveDragGhost); }

// ── Touch drag ──
let touchDragPid=null, touchDragGhost=null;
function startChipTouchDrag(e,p,chip){
  if(!convocadaIds.has(p.id)) return;
  e.preventDefault();
  touchDragPid=p.id;
  touchDragGhost=document.createElement('div'); touchDragGhost.className='drag-ghost';
  touchDragGhost.innerHTML=`${p.photo?`<img src="${p.photo}" style="width:22px;height:22px;border-radius:50%;object-fit:cover">`:''}${p.name}`;
  touchDragGhost.style.left=(e.touches[0].clientX+12)+'px'; touchDragGhost.style.top=(e.touches[0].clientY-20)+'px';
  document.body.appendChild(touchDragGhost);
  chip.classList.add('dragging-chip');
  const onMove=ev=>{
    ev.preventDefault();
    const tx=ev.touches[0].clientX, ty=ev.touches[0].clientY;
    touchDragGhost.style.left=(tx+12)+'px'; touchDragGhost.style.top=(ty-20)+'px';
    touchDragGhost.style.display='none';
    const el=document.elementFromPoint(tx,ty);
    touchDragGhost.style.display='';
    document.querySelectorAll('.setup-slot').forEach(s=>s.classList.remove('drag-over'));
    const slot=el&&el.closest('[data-drop-slot]');
    if(slot) slot.classList.add('drag-over');
  };
  const onEnd=ev=>{
    ev.preventDefault();
    document.removeEventListener('touchmove',onMove);
    document.removeEventListener('touchend',onEnd);
    if(touchDragGhost){ touchDragGhost.remove(); touchDragGhost=null; }
    chip.classList.remove('dragging-chip');
    document.querySelectorAll('.setup-slot').forEach(s=>s.classList.remove('drag-over'));
    touchDragGhost&&(touchDragGhost.style.display='none');
    const touch=ev.changedTouches[0];
    const el=document.elementFromPoint(touch.clientX,touch.clientY);
    const slot=el&&el.closest('[data-drop-slot]');
    if(slot) handleSlotDrop(slot.dataset.dropSlot,touchDragPid);
    touchDragPid=null;
  };
  document.addEventListener('touchmove',onMove,{passive:false});
  document.addEventListener('touchend',onEnd,{passive:false});
}

// ══════════════════════════════════════════════
// START MATCH
// ══════════════════════════════════════════════
function startMatch() {
  const rivalName=document.getElementById('rivalTeamName').value.trim();
  if(!rivalName){ showToast('Ingresá el nombre del rival'); return; }
  const emptySlots=COURT_SLOTS.filter(s=>!lineupSlotMap[s.id]);
  if(emptySlots.length>0){ showToast(`Asigná jugadora en: ${emptySlots.map(s=>s.id).join(', ')}`); return; }
  const sq=getSquad();
  const assignedPids=new Set(Object.values(lineupSlotMap));
  const subPids=sq.players.filter(p=>convocadaIds.has(p.id)&&!assignedPids.has(p.id)).map(p=>p.id);
  const matchPlayers=[];
  COURT_SLOTS.forEach(slot=>{
    const pid=lineupSlotMap[slot.id];
    const sqp=sq.players.find(p=>p.id===pid); if(!sqp) return;
    matchPlayers.push({ id:sqp.id, name:sqp.name, photo:sqp.photo||'', number:sqp.number||null, positions:[sqp.pos1||'CT',sqp.pos2||'--'], isStarter:true, stats:{goals:0,misses:0,saves:0,assists:0,turnovers:0,steals:0,yellowCards:0,suspensions:0,redCards:0}, timeOnCourt:0, courtEntry:0, onCourt:true });
  });
  subPids.forEach(pid=>{
    const sqp=sq.players.find(p=>p.id===pid); if(!sqp) return;
    matchPlayers.push({ id:sqp.id, name:sqp.name, photo:sqp.photo||'', number:sqp.number||null, positions:[sqp.pos1||'CT',sqp.pos2||'--'], isStarter:false, stats:{goals:0,misses:0,saves:0,assists:0,turnovers:0,steals:0,yellowCards:0,suspensions:0,redCards:0}, timeOnCourt:0, courtEntry:null, onCourt:false });
  });
  const courtLineup=COURT_SLOTS.map(slot=>({ slotId:slot.id, playerId:lineupSlotMap[slot.id]||null }));
  const match={ id:'match_'+Date.now(), date:new Date().toISOString(), myTeamName:sq.teamName||'Mi Equipo', rivalTeamName:rivalName, teamLogo:sq.teamLogo||'', players:matchPlayers, courtLineup, bench:subPids, scoreHome:0, scoreAway:0, timerSecondsLeft:HALF_DURATION, timerRunning:false, half:1, finished:false, events:[] };
  saveMatch(match);
  loadMatchToUI(match);
  showScreen('screen-match');
}

function resumeMatch(match) {
  loadMatchToUI(match);
  showScreen('screen-match');
  showToast('↩ Partido retomado');
}

// ══════════════════════════════════════════════
// MATCH UI
// ══════════════════════════════════════════════
let activeMatch=null, timerInterval=null;

function loadMatchToUI(match) {
  activeMatch=match;
  document.getElementById('homeAbbr').textContent=abbr(match.myTeamName);
  document.getElementById('awayAbbr').textContent=abbr(match.rivalTeamName);
  document.getElementById('scoreHomeNum').textContent=match.scoreHome;
  document.getElementById('scoreAwayNum').textContent=match.scoreAway;
  document.getElementById('halfLabel').textContent=match.half===1?'1ª PARTE':'2ª PARTE';
  document.querySelector('.btn-half').textContent=match.half===1?'2ª PARTE':'1ª PARTE';
  const logo=document.getElementById('homeLogoSmall');
  if(match.teamLogo){ logo.src=match.teamLogo; logo.style.display='block'; } else logo.style.display='none';
  updateTimerDisplay();
  const btn=document.getElementById('btnTimer');
  btn.textContent='▶ INICIAR'; btn.classList.remove('running');
  renderCourt(); renderBench();
}

// ── Timer ──
function toggleTimer() {
  if(!activeMatch||activeMatch.finished) return;
  activeMatch.timerRunning=!activeMatch.timerRunning;
  const btn=document.getElementById('btnTimer');
  if(activeMatch.timerRunning){
    timerInterval=setInterval(()=>{
      if(activeMatch.timerSecondsLeft>0){
        activeMatch.timerSecondsLeft--;
        updateTimerDisplay();
        const d=document.getElementById('timerDisplay');
        activeMatch.timerSecondsLeft<=60?d.classList.add('urgent'):d.classList.remove('urgent');
        if(activeMatch.timerSecondsLeft%60===0) saveMatch(activeMatch);
      } else {
        clearInterval(timerInterval); timerInterval=null;
        activeMatch.timerRunning=false;
        btn.textContent='▶ INICIAR'; btn.classList.remove('running');
        onHalfEnd();
      }
    },1000);
    btn.textContent='⏸ PAUSAR'; btn.classList.add('running');
  } else {
    clearInterval(timerInterval); timerInterval=null;
    btn.textContent='▶ REANUDAR'; btn.classList.remove('running');
    saveMatch(activeMatch);
  }
}

function updateTimerDisplay() {
  const s=activeMatch?activeMatch.timerSecondsLeft:HALF_DURATION;
  document.getElementById('timerDisplay').textContent=`${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
}

function onHalfEnd() {
  saveMatch(activeMatch);
  if(activeMatch.half===1) document.getElementById('halfChangeBanner').classList.add('show');
  else finishMatchAuto();
}

function startSecondHalf() {
  document.getElementById('halfChangeBanner').classList.remove('show');
  activeMatch.half=2; activeMatch.timerSecondsLeft=HALF_DURATION;
  document.getElementById('halfLabel').textContent='2ª PARTE';
  document.querySelector('.btn-half').textContent='1ª PARTE';
  document.getElementById('timerDisplay').classList.remove('urgent');
  updateTimerDisplay(); saveMatch(activeMatch);
  showToast('▶ 2ª Parte — ¡Iniciá el cronómetro!');
}

function manualToggleHalf() {
  if(!activeMatch) return;
  if(activeMatch.half===1){ document.getElementById('halfChangeBanner').classList.add('show'); }
  else { activeMatch.half=1; activeMatch.timerSecondsLeft=HALF_DURATION; document.getElementById('halfLabel').textContent='1ª PARTE'; document.querySelector('.btn-half').textContent='2ª PARTE'; document.getElementById('timerDisplay').classList.remove('urgent'); updateTimerDisplay(); saveMatch(activeMatch); }
}

function elapsedInHalf()  { return HALF_DURATION-(activeMatch?.timerSecondsLeft||0); }
function matchElapsed()   { return (activeMatch?.half===2?HALF_DURATION:0)+elapsedInHalf(); }

// ── Court render ──
function renderCourt() {
  const container=document.getElementById('courtPlayers');
  container.innerHTML='';
  COURT_SLOTS.forEach(slot=>{
    const cl=activeMatch.courtLineup.find(c=>c.slotId===slot.id);
    const p=cl?.playerId?activeMatch.players.find(x=>x.id===cl.playerId):null;
    const left=slot.x+'%', top=slot.y+'%';
    if(p){
      const token=document.createElement('div');
      token.className='player-token'; token.style.cssText=`left:${left};top:${top}`; token.dataset.pid=p.id; token.dataset.slotId=slot.id;
      const isGK=slot.id==='ARQ';
      const photo=document.createElement('div');
      photo.className='token-photo'+(isGK?' gk-style':'');
      photo.innerHTML=p.photo?`<img src="${p.photo}" alt="${p.name}">`:(p.number?'#'+p.number:initials(p.name));
      if(p.stats.goals>0)      { const b=document.createElement('div'); b.className='badge-goals token-badge'; b.textContent=p.stats.goals; photo.appendChild(b); }
      if(p.stats.suspensions>0){ const b=document.createElement('div'); b.className='badge-suspension token-badge'; b.textContent=p.stats.suspensions; photo.appendChild(b); }
      if(p.stats.redCards>0)   { const b=document.createElement('div'); b.className='badge-red token-badge'; b.textContent='✕'; photo.appendChild(b); }
      const name=document.createElement('div'); name.className='token-name'; name.textContent=shortName(p.name);
      token.append(photo,name);
      token.onclick=()=>handleCourtTap(p.id,slot.id);
      container.appendChild(token);
    } else {
      const empty=document.createElement('div'); empty.className='empty-slot'; empty.style.cssText=`left:${left};top:${top}`; empty.textContent=slot.id; container.appendChild(empty);
    }
  });
}

function renderBench() {
  const container=document.getElementById('benchPlayers');
  container.innerHTML='';
  activeMatch.bench.forEach(pid=>{
    const p=activeMatch.players.find(x=>x.id===pid); if(!p) return;
    const token=document.createElement('div'); token.className='bench-token'; token.dataset.pid=pid;
    const photo=document.createElement('div'); photo.className='bench-photo'; photo.innerHTML=p.photo?`<img src="${p.photo}"/>`:initials(p.name);
    const name=document.createElement('div'); name.className='bench-name'; name.textContent=shortName(p.name);
    token.append(photo,name); container.appendChild(token);
  });
}

function updateScoreUI() {
  document.getElementById('scoreHomeNum').textContent=activeMatch.scoreHome;
  document.getElementById('scoreAwayNum').textContent=activeMatch.scoreAway;
}

function rivalGoal() {
  if(!activeMatch) return;
  activeMatch.scoreAway++; updateScoreUI(); saveMatch(activeMatch); showToast('⚠️ Gol rival registrado');
}

// ══════════════════════════════════════════════
// IN-MATCH PLAYER TAP → 3-OPTION MENU
// ══════════════════════════════════════════════
let activePlayerCtx=null;

function handleCourtTap(pid, slotId) {
  const p=activeMatch.players.find(x=>x.id===pid); if(!p) return;
  activePlayerCtx={pid,slotId};
  const elapsed=p.timeOnCourt+(p.courtEntry!==null?matchElapsed()-p.courtEntry:0);
  document.getElementById('playerOptionsInfo').innerHTML=`
    <div class="sheet-player-photo">${p.photo?`<img src="${p.photo}"/>`:(p.number?'#'+p.number:initials(p.name))}</div>
    <div class="sheet-player-meta">
      <div class="sheet-player-name">${p.name}</div>
      <div class="sheet-player-pos">${slotId} · ${p.positions.filter(x=>x&&x!=='--'&&x!=='SUP').join('/')}</div>
      <div class="sheet-player-stats">⚽${p.stats.goals} 🎯${p.stats.assists} ⏱${formatTime(elapsed)}</div>
    </div>`;
  document.getElementById('playerOptionsGrid').innerHTML=`
    <div class="player-option-btn opt-action" onclick="openActionsFromOptions()">
      <div class="player-option-icon">⚽</div>
      <div class="player-option-text"><div class="player-option-label">REGISTRAR ACCIÓN</div><div class="player-option-desc">Gol, asistencia, parada, fallo…</div></div>
    </div>
    <div class="player-option-btn opt-pos" onclick="openPosChange()">
      <div class="player-option-icon">🔀</div>
      <div class="player-option-text"><div class="player-option-label">CAMBIAR POSICIÓN</div><div class="player-option-desc">Mover a otro slot en cancha</div></div>
    </div>
    <div class="player-option-btn opt-sub" onclick="openSubPick()">
      <div class="player-option-icon">🔄</div>
      <div class="player-option-text"><div class="player-option-label">SUSTITUIR</div><div class="player-option-desc">Sacarla y elegir quién entra</div></div>
    </div>`;
  document.getElementById('playerOptionsOverlay').classList.add('active');
  document.getElementById('playerOptionsSheet').classList.add('active');
}

function closePlayerOptions() {
  document.getElementById('playerOptionsOverlay').classList.remove('active');
  document.getElementById('playerOptionsSheet').classList.remove('active');
}

function openActionsFromOptions() {
  closePlayerOptions();
  if(activePlayerCtx) openActionSheet(activePlayerCtx.pid,activePlayerCtx.slotId);
}

// ── Change position ──
function openPosChange() {
  closePlayerOptions();
  if(!activePlayerCtx) return;
  const {pid,slotId}=activePlayerCtx;
  const p=activeMatch.players.find(x=>x.id===pid);
  document.getElementById('posChangeTitle').textContent=`${p?.name} — Nueva posición`;
  const grid=document.getElementById('posChangeGrid'); grid.innerHTML='';
  COURT_SLOTS.forEach(slot=>{
    const occupiedBy=activeMatch.courtLineup.find(c=>c.slotId===slot.id)?.playerId;
    const isCurrent=slot.id===slotId;
    const isOccupied=occupiedBy&&occupiedBy!==pid;
    const btn=document.createElement('button');
    btn.className='pos-change-btn'+(isCurrent?' current-pos':'');
    btn.textContent=slot.id;
    if(isCurrent){ btn.disabled=true; }
    else if(isOccupied){ btn.style.opacity='.4'; btn.onclick=()=>swapPositions(slotId,slot.id); }
    else { btn.onclick=()=>moveToEmptySlot(slotId,slot.id); }
    grid.appendChild(btn);
  });
  document.getElementById('posChangeOverlay').classList.add('active');
  document.getElementById('posChangeSheet').classList.add('active');
}

function closePosChange() {
  document.getElementById('posChangeOverlay').classList.remove('active');
  document.getElementById('posChangeSheet').classList.remove('active');
}

function moveToEmptySlot(fromSlotId, toSlotId) {
  const cl=activeMatch.courtLineup.find(c=>c.slotId===fromSlotId);
  const target=activeMatch.courtLineup.find(c=>c.slotId===toSlotId);
  if(!cl||!target) return;
  target.playerId=cl.playerId; cl.playerId=null;
  closePosChange(); saveMatch(activeMatch); renderCourt(); renderBench(); showToast(`↔ Movida a ${toSlotId}`);
}

function swapPositions(slotA, slotB) {
  const clA=activeMatch.courtLineup.find(c=>c.slotId===slotA);
  const clB=activeMatch.courtLineup.find(c=>c.slotId===slotB);
  if(!clA||!clB) return;
  [clA.playerId,clB.playerId]=[clB.playerId,clA.playerId];
  closePosChange(); saveMatch(activeMatch); renderCourt(); renderBench(); showToast('↔ Posiciones intercambiadas');
}

// ── Substitute ──
let subOutPid=null, subOutSlotId=null;

function openSubPick() {
  closePlayerOptions();
  if(!activePlayerCtx) return;
  subOutPid=activePlayerCtx.pid; subOutSlotId=activePlayerCtx.slotId;
  const pOut=activeMatch.players.find(x=>x.id===subOutPid);
  document.getElementById('subPickTitle').textContent=`¿Quién entra por ${shortName(pOut?.name||'')}?`;
  const list=document.getElementById('subPickList'); list.innerHTML='';
  const benchPlayers=activeMatch.bench.map(id=>activeMatch.players.find(p=>p.id===id)).filter(Boolean);
  if(benchPlayers.length===0){ list.innerHTML=`<div style="text-align:center;color:var(--text-muted);padding:20px;font-family:'Barlow Condensed',sans-serif">No hay jugadoras en el banquillo</div>`; }
  else { benchPlayers.forEach(p=>{ const item=document.createElement('div'); item.className='picker-item'; item.innerHTML=`<div class="picker-photo">${p.photo?`<img src="${p.photo}"/>`:(p.number?'#'+p.number:initials(p.name))}</div><div class="picker-name">${p.name}</div><div class="picker-pos">${p.positions.filter(x=>x&&x!=='--'&&x!=='SUP').join('/')}</div>`; item.onclick=()=>executeSubstitution(subOutPid,subOutSlotId,p.id); list.appendChild(item); }); }
  document.getElementById('subPickOverlay').classList.add('active');
  document.getElementById('subPickSheet').classList.add('active');
}

function closeSubPick() {
  document.getElementById('subPickOverlay').classList.remove('active');
  document.getElementById('subPickSheet').classList.remove('active');
}

function executeSubstitution(outPid, slotId, inPid) {
  closeSubPick();
  const pOut=activeMatch.players.find(p=>p.id===outPid);
  const pIn=activeMatch.players.find(p=>p.id===inPid);
  if(!pOut||!pIn) return;
  if(pOut.courtEntry!==null){ pOut.timeOnCourt+=matchElapsed()-pOut.courtEntry; pOut.courtEntry=null; pOut.onCourt=false; }
  pIn.courtEntry=matchElapsed(); pIn.onCourt=true;
  const slot=activeMatch.courtLineup.find(c=>c.slotId===slotId);
  if(slot) slot.playerId=inPid;
  activeMatch.bench=activeMatch.bench.filter(id=>id!==inPid);
  activeMatch.bench.push(outPid);
  activeMatch.events.push({time:matchElapsed(),type:'substitution',outId:outPid,inId:inPid,slotId});
  saveMatch(activeMatch); renderCourt(); renderBench();
  showToast(`🔄 ${shortName(pIn.name)} entra · ${shortName(pOut.name)} sale`);
}

// ── Action Sheet ──
let activeActionPid=null, activeActionSlot=null;

function openActionSheet(pid, slotId) {
  const p=activeMatch.players.find(x=>x.id===pid); if(!p) return;
  activeActionPid=pid; activeActionSlot=slotId;
  const isGK=slotId==='ARQ';
  const elapsed=p.timeOnCourt+(p.courtEntry!==null?matchElapsed()-p.courtEntry:0);
  document.getElementById('sheetPlayerInfo').innerHTML=`
    <div class="sheet-player-photo">${p.photo?`<img src="${p.photo}"/>`:(p.number?'#'+p.number:initials(p.name))}</div>
    <div class="sheet-player-meta">
      <div class="sheet-player-name">${p.name}</div>
      <div class="sheet-player-pos">${p.positions.filter(x=>x&&x!=='--'&&x!=='SUP').join('/')||'Sin pos.'} · ${isGK?'ARQUERA':slotId}</div>
      <div class="sheet-player-stats">⚽ ${p.stats.goals} · 🎯 ${p.stats.assists} · ⏱ ${formatTime(elapsed)}</div>
    </div>`;
  const grid=document.getElementById('actionGrid'); grid.innerHTML='';
  ACTIONS.forEach(a=>{
    if(a.onlyGK&&!isGK) return;
    const btn=document.createElement('button'); btn.className=`action-btn ${a.cls}`;
    btn.innerHTML=`<span class="action-icon">${a.icon}</span><span class="action-label">${a.label}</span>`;
    btn.onclick=()=>recordAction(pid,a.key);
    grid.appendChild(btn);
  });
  document.getElementById('bottomSheetOverlay').classList.add('active');
  document.getElementById('bottomSheet').classList.add('active');
}

function closeActionSheet() {
  document.getElementById('bottomSheetOverlay').classList.remove('active');
  document.getElementById('bottomSheet').classList.remove('active');
  activeActionPid=null; activeActionSlot=null;
}

function recordAction(pid, key) {
  const p=activeMatch.players.find(x=>x.id===pid); if(!p) return;
  const tLabel=formatTime(matchElapsed());
  switch(key){
    case 'goal':       p.stats.goals++;       activeMatch.scoreHome++; updateScoreUI(); showToast(`⚽ GOL — ${shortName(p.name)} (${tLabel})`); break;
    case 'miss':       p.stats.misses++;      showToast(`❌ FALLO — ${shortName(p.name)}`); break;
    case 'save':       p.stats.saves++;       showToast(`🧤 PARADA — ${shortName(p.name)}`); break;
    case 'turnover':   p.stats.turnovers++;   showToast(`🔄 PÉRDIDA — ${shortName(p.name)}`); break;
    case 'assist':     p.stats.assists++;     showToast(`🎯 ASISTENCIA — ${shortName(p.name)}`); break;
    case 'yellow':     p.stats.yellowCards++; showToast(`🟨 T. AMARILLA — ${shortName(p.name)}`); break;
    case 'suspension':
      p.stats.suspensions++;
      if(p.stats.suspensions>=2) showModal('⚠️ ALERTA',`${p.name} lleva ${p.stats.suspensions} exclusiones. ¡Riesgo de T. ROJA!`);
      else showToast(`⏱️ EXCLUSIÓN 2 MIN — ${shortName(p.name)}`);
      break;
    case 'redcard': p.stats.redCards++; showModal('🟥 T. ROJA',`${p.name} debe abandonar el partido.`); break;
    case 'steal':   p.stats.steals++;   showToast(`✋ ROBO — ${shortName(p.name)}`); break;
  }
  activeMatch.events.push({time:matchElapsed(),playerId:pid,action:key});
  saveMatch(activeMatch); closeActionSheet(); renderCourt();
}

// ── Finish match ──
function confirmFinishMatch() {
  if(!activeMatch) return;
  if(confirm(`¿Finalizar el partido?\n${activeMatch.myTeamName} ${activeMatch.scoreHome} — ${activeMatch.scoreAway} ${activeMatch.rivalTeamName}`)) finishMatchAuto();
}

function finishMatchAuto() {
  if(!activeMatch) return;
  if(timerInterval){ clearInterval(timerInterval); timerInterval=null; }
  activeMatch.timerRunning=false; activeMatch.finished=true;
  activeMatch.players.forEach(p=>{ if(p.onCourt&&p.courtEntry!==null){ p.timeOnCourt+=matchElapsed()-p.courtEntry; p.courtEntry=null; } });

  // Calculate and store auto MVP score
  activeMatch.mvpAuto   = calcMvpAuto(activeMatch);
  activeMatch.mvpJurado = null;

  pushHistory(JSON.parse(JSON.stringify(activeMatch)));
  clearMatch();

  // Populate finished banner
  document.getElementById('finalScoreText').textContent=`${activeMatch.myTeamName} ${activeMatch.scoreHome} — ${activeMatch.scoreAway} ${activeMatch.rivalTeamName}`;
  renderMvpBanner(activeMatch);
  document.getElementById('mvpJuradoName').textContent='—';
  document.getElementById('matchFinishedBanner').classList.add('show');
}

// ── MVP calculation ──
function calcMvpAuto(match) {
  let best=null, bestScore=-1;
  match.players.forEach(p=>{
    const score = p.stats.goals*4 + p.stats.assists*3 + p.stats.saves*3 + p.stats.steals*2
                - p.stats.turnovers*2 - p.stats.yellowCards - p.stats.suspensions*2 - p.stats.redCards*4
                + Math.round(p.timeOnCourt/60)*0.1;
    p._mvpScore = Math.round(score*10)/10;
    if(score>bestScore){ bestScore=score; best=p; }
  });
  return best ? best.id : null;
}

function renderMvpBanner(match) {
  const pid = match.mvpAuto;
  const p   = pid ? match.players.find(x=>x.id===pid) : null;
  const block = document.getElementById('mvpAutoBlock');
  if(!p){ block.style.display='none'; return; }
  block.style.display='block';
  document.getElementById('mvpAutoPlayer').innerHTML=`
    <div class="mvp-photo">${p.photo?`<img src="${p.photo}"/>`:(p.number?'#'+p.number:initials(p.name))}</div>
    <div>
      <div class="mvp-name">⭐ ${p.name}</div>
      <div class="mvp-stats-line">⚽${p.stats.goals} 🎯${p.stats.assists} 🧤${p.stats.saves} ✋${p.stats.steals} · Score ${p._mvpScore}</div>
    </div>`;
}

// ── MVP Jurado picker ──
function openMvpJuradoPicker() {
  const list=document.getElementById('mvpPickerList'); list.innerHTML='';
  activeMatch.players.forEach(p=>{
    const item=document.createElement('div'); item.className='picker-item';
    item.innerHTML=`<div class="picker-photo">${p.photo?`<img src="${p.photo}"/>`:(p.number?'#'+p.number:initials(p.name))}</div><div class="picker-name">${p.name}</div><div class="picker-pos">${p.positions.filter(x=>x&&x!=='--'&&x!=='SUP').join('/')}</div>`;
    item.onclick=()=>assignMvpJurado(p.id);
    list.appendChild(item);
  });
  document.getElementById('mvpPickerOverlay').classList.add('active');
  document.getElementById('mvpPickerSheet').classList.add('active');
}
function closeMvpJuradoPicker() {
  document.getElementById('mvpPickerOverlay').classList.remove('active');
  document.getElementById('mvpPickerSheet').classList.remove('active');
}
function assignMvpJurado(pid) {
  closeMvpJuradoPicker();
  activeMatch.mvpJurado=pid;
  // Update history with mvpJurado
  const hist=getHistory(); const idx=hist.findIndex(m=>m.id===activeMatch.id);
  if(idx>=0){ hist[idx].mvpJurado=pid; saveHistory(hist); }
  const p=activeMatch.players.find(x=>x.id===pid);
  document.getElementById('mvpJuradoName').textContent=p?p.name:'—';
  showToast(`🏅 MVP del jurado: ${p?.name}`);
}

function goToFinalStats() {
  document.getElementById('matchFinishedBanner').classList.remove('show');
  document.getElementById('halfChangeBanner').classList.remove('show');
  renderStatsForMatch(activeMatch,'statsBody');
  showScreen('screen-stats');
}

function confirmBackToSetup() {
  if(!activeMatch){ showScreen('screen-home'); return; }
  if(confirm('¿Volver al inicio? El partido se guarda automáticamente.')){ if(timerInterval){ clearInterval(timerInterval); timerInterval=null; } activeMatch.timerRunning=false; saveMatch(activeMatch); showScreen('screen-home'); }
}

// ══════════════════════════════════════════════
// STATS — full enriched render
// ══════════════════════════════════════════════
function renderStatsForMatch(match, targetId) {
  if(!match) return;
  const body=document.getElementById(targetId); body.innerHTML='';
  const totalGoals  =match.players.reduce((a,p)=>a+p.stats.goals,0);
  const totalShots  =match.players.reduce((a,p)=>a+p.stats.goals+p.stats.misses,0);
  const totalAssists=match.players.reduce((a,p)=>a+p.stats.assists,0);
  const totalSaves  =match.players.reduce((a,p)=>a+p.stats.saves,0);
  const totalTO     =match.players.reduce((a,p)=>a+p.stats.turnovers,0);
  const totalSteals =match.players.reduce((a,p)=>a+p.stats.steals,0);
  const eff=totalShots>0?Math.round(totalGoals/totalShots*100):0;
  const poss=totalSteals+totalTO>0?Math.round(totalSteals/(totalSteals+totalTO)*100):0;
  const dateStr=new Date(match.date).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});

  // ── 1. Score ──
  body.innerHTML+=`<div class="stat-card" style="text-align:center;padding:20px">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:.65rem;letter-spacing:.2em;color:var(--text-muted);margin-bottom:8px">${dateStr.toUpperCase()}</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:16px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:1rem;font-weight:700">${match.myTeamName}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:2.4rem;font-weight:900;color:var(--accent-teal)">${match.scoreHome} — ${match.scoreAway}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:1rem;font-weight:700;color:var(--text-secondary)">${match.rivalTeamName}</div>
    </div>
  </div>`;

  // ── 2. MVP card ──
  body.innerHTML += buildMvpCard(match);

  // ── 3. Team overview ──
  body.innerHTML+=`<div class="stat-card">
    <div class="stat-card-title">RESUMEN DE EQUIPO</div>
    <div class="team-overview">
      ${[['GOLES',totalGoals,'teal'],['RECIBIDOS',match.scoreAway,''],['PARADAS',totalSaves,''],['ASISTENCIAS',totalAssists,''],['PÉRDIDAS',totalTO,'red'],['ROBOS',totalSteals,'teal']].map(([l,v,c])=>`<div class="overview-stat"><div class="overview-num ${c}">${v}</div><div class="overview-label">${l}</div></div>`).join('')}
    </div>
  </div>`;

  // ── 4. Position efficiency bars ──
  body.innerHTML += buildPositionMapCard(match);

  // ── 5. Efficiency bars ──
  body.innerHTML+=`<div class="stat-card">
    <div class="stat-card-title">EFICACIA EN LANZAMIENTO</div>
    <div class="efficiency-container">
      <div class="efficiency-label"><span>Goles / Lanzamientos (${totalGoals}/${totalShots})</span><span class="efficiency-pct">${eff}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${eff}%"></div></div>
    </div>
    <div class="efficiency-container" style="margin-top:12px">
      <div class="efficiency-label"><span>Posesión (Robos vs Pérdidas)</span><span class="efficiency-pct">${poss}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${poss}%"></div></div>
    </div>
  </div>`;

  // ── 7. Player stats ──
  const sorted=[...match.players].sort((a,b)=>b.stats.goals-a.stats.goals||b.stats.assists-a.stats.assists);
  body.innerHTML+=`<div class="stat-card"><div class="stat-card-title">ESTADÍSTICAS POR JUGADORA</div>
    ${sorted.map(p=>{ const t=p.timeOnCourt; const ph=p.photo?`<img src="${p.photo}"/>`:(p.number?'#'+p.number:initials(p.name)); return `<div class="player-stat-row">
      <div class="psr-photo">${ph}</div>
      <div class="psr-info"><div class="psr-name">${p.name}${p.stats.suspensions>=2?' ⚠️':''}</div><div class="psr-time">${p.positions.filter(x=>x&&x!=='--'&&x!=='SUP').join('/')||'-'} · ${formatTime(t)} en cancha</div></div>
      <div class="psr-stats">
        <div class="psr-stat"><div class="psr-stat-num">${p.stats.goals}</div><div class="psr-stat-lbl">GOL</div></div>
        <div class="psr-stat"><div class="psr-stat-num">${p.stats.assists}</div><div class="psr-stat-lbl">ASI</div></div>
        <div class="psr-stat"><div class="psr-stat-num">${p.stats.saves}</div><div class="psr-stat-lbl">PAR</div></div>
        <div class="psr-stat"><div class="psr-stat-num" style="color:${p.stats.suspensions>0?'var(--accent-yellow)':'inherit'}">${p.stats.suspensions}</div><div class="psr-stat-lbl">EXC</div></div>
      </div>
    </div>`; }).join('')}
  </div>`;

  // ── 8. Weak points ──
  body.innerHTML += buildWeakPointsCard(match);
}

// ── MVP card builder ──
function buildMvpCard(match) {
  const autoId   = match.mvpAuto   || calcMvpAuto(match);
  const juradoId = match.mvpJurado || null;
  const pAuto    = autoId   ? match.players.find(x=>x.id===autoId)   : null;
  const pJurado  = juradoId ? match.players.find(x=>x.id===juradoId) : null;
  if(!pAuto) return '';

  // Recalc scores if missing
  if(!pAuto._mvpScore) calcMvpAuto(match);
  const topPlayers=[...match.players].sort((a,b)=>(b._mvpScore||0)-(a._mvpScore||0)).slice(0,3);
  const maxScore=topPlayers[0]?._mvpScore||1;

  let html=`<div class="mvp-stat-card"><div class="mvp-stat-card-title">⭐ MVP DEL PARTIDO</div>`;

  // Auto MVP row
  html+=`<div class="mvp-row" style="margin-bottom:14px">
    <div class="mvp-photo">${pAuto.photo?`<img src="${pAuto.photo}"/>`:(pAuto.number?'#'+pAuto.number:initials(pAuto.name))}</div>
    <div style="flex:1">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:1rem;font-weight:900;color:var(--accent-teal)">${pAuto.name} <span style="font-size:.7rem;color:var(--text-muted)">AUTO</span></div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">⚽${pAuto.stats.goals} 🎯${pAuto.stats.assists} 🧤${pAuto.stats.saves} ✋${pAuto.stats.steals} 🔄${pAuto.stats.turnovers}</div>
    </div>
  </div>`;

  // Top 3 score bars
  topPlayers.forEach(p=>{
    const pct=Math.round((p._mvpScore||0)/maxScore*100);
    html+=`<div class="mvp-row">
      <div class="mvp-badge">${shortName(p.name)}</div>
      <div class="mvp-score-bar"><div class="mvp-score-fill" style="width:${pct}%"></div></div>
      <div class="mvp-score-val">${p._mvpScore||0}</div>
    </div>`;
  });

  // Jurado MVP
  if(pJurado){
    html+=`<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px">
      <div class="mvp-photo" style="border-color:var(--accent-yellow)">${pJurado.photo?`<img src="${pJurado.photo}"/>`:(pJurado.number?'#'+pJurado.number:initials(pJurado.name))}</div>
      <div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:1rem;font-weight:900;color:var(--accent-yellow)">${pJurado.name} <span style="font-size:.7rem;color:var(--text-muted)">JURADO</span></div>
        <div style="font-size:.72rem;color:var(--text-muted)">🏅 Elegida por el jurado</div>
      </div>
    </div>`;
  }
  html+=`</div>`;
  return html;
}

// ── Timeline chart builder ──
function buildTimelineCard(match) {
  // Group events into 5-min buckets (10 buckets × 2 halves = 20 total buckets but we show 10)
  const BUCKETS=10, BUCKET_SIZE=5*60; // 5 min each
  const ourBuckets  =Array(BUCKETS).fill(0);
  const rivalBuckets=Array(BUCKETS).fill(0);

  // Our goals from events
  match.events.forEach(ev=>{
    if(ev.action==='goal'){
      const bucket=Math.min(Math.floor(ev.time/BUCKET_SIZE), BUCKETS-1);
      ourBuckets[bucket]++;
    }
  });

  // Rival goals — distribute evenly if we only have the final score
  // We use events with type='rivalGoal' if present, otherwise approximate
  const rivalGoalEvents=match.events.filter(ev=>ev.type==='rivalGoal');
  if(rivalGoalEvents.length>0){
    rivalGoalEvents.forEach(ev=>{ const bucket=Math.min(Math.floor(ev.time/BUCKET_SIZE),BUCKETS-1); rivalBuckets[bucket]++; });
  } else {
    // Distribute rival goals across buckets proportionally (no events recorded)
    const perBucket=match.scoreAway/BUCKETS;
    rivalBuckets.fill(0).forEach((_,i)=>rivalBuckets[i]=Math.round(perBucket*10)/10);
  }

  const maxVal=Math.max(...ourBuckets,...rivalBuckets,1);
  const labels=['0\'','5\'','10\'','15\'','20\'','25\'','30\'','35\'','40\'','45\''];

  let barsHtml='';
  ourBuckets.forEach((v,i)=>{
    const ourH=Math.round(v/maxVal*68);
    const rivH=Math.round(rivalBuckets[i]/maxVal*68);
    barsHtml+=`<div class="timeline-bar-group">
      <div class="timeline-bar our"  style="height:${ourH}px"></div>
      <div class="timeline-bar rival" style="height:${rivH}px"></div>
    </div>`;
  });

  return `<div class="stat-card">
    <div class="stat-card-title">GOLES POR PERÍODO (5 MIN)</div>
    <div class="timeline-chart">
      <div class="timeline-bars">${barsHtml}</div>
      <div class="timeline-halftime"></div>
      <div class="timeline-halftime-label">DESCANSO</div>
    </div>
    <div class="timeline-legend">
      <span><span class="timeline-legend-dot" style="background:var(--accent-teal)"></span>${match.myTeamName}</span>
      <span><span class="timeline-legend-dot" style="background:var(--accent-red)"></span>${match.rivalTeamName}</span>
    </div>
  </div>`;
}

// ── Position map builder ──
function buildPositionMapCard(match) {
  const posData={};
  match.players.forEach(p=>{
    p.positions.filter(x=>x&&x!=='--'&&x!=='SUP').forEach(pos=>{
      if(!posData[pos]) posData[pos]={goals:0,shots:0};
      posData[pos].goals+=p.stats.goals;
      posData[pos].shots+=p.stats.goals+p.stats.misses;
    });
  });

  const positions=Object.keys(posData);
  if(positions.length===0) return '';

  let cells='';
  positions.forEach(pos=>{
    const d=posData[pos];
    const pct=d.shots>0?Math.round(d.goals/d.shots*100):0;
    const cls=pct>=60?'strong':pct>=35?'neutral':'weak';
    cells+=`<div class="pos-map-cell ${cls}">
      <div class="pos-map-pos">${pos}</div>
      <div class="pos-map-pct ${cls}">${d.shots>0?pct+'%':'—'}</div>
      <div class="pos-map-shots">${d.goals}/${d.shots} lanz.</div>
    </div>`;
  });

  return `<div class="stat-card">
    <div class="stat-card-title">EFICACIA POR POSICIÓN</div>
    <div class="pos-map-grid">${cells}</div>
    <div style="display:flex;gap:12px;margin-top:8px;font-family:'Barlow Condensed',sans-serif;font-size:.62rem;color:var(--text-muted)">
      <span style="color:var(--accent-teal)">■ FUERTE ≥60%</span>
      <span style="color:var(--accent-yellow)">■ MEDIO 35–59%</span>
      <span style="color:var(--accent-red)">■ DÉBIL &lt;35%</span>
    </div>
  </div>`;
}

// ── Weak points builder ──
function buildWeakPointsCard(match, isAccumulated=false) {
  const points=[];
  const totalShots=match.players.reduce((a,p)=>a+p.stats.goals+p.stats.misses,0);
  const totalGoals=match.players.reduce((a,p)=>a+p.stats.goals,0);
  const totalTO   =match.players.reduce((a,p)=>a+p.stats.turnovers,0);
  const totalSus  =match.players.reduce((a,p)=>a+p.stats.suspensions,0);
  const totalRed  =match.players.reduce((a,p)=>a+p.stats.redCards,0);
  const eff=totalShots>0?Math.round(totalGoals/totalShots*100):0;

  // Shooting efficiency
  if(eff<40&&totalShots>=5)      points.push({cls:'danger', icon:'🎯', title:`Baja eficacia (${eff}%)`, desc:`Solo ${totalGoals} goles en ${totalShots} lanzamientos. Trabajar definición y selección de tiro.`});
  else if(eff<55&&totalShots>=5) points.push({cls:'warning',icon:'🎯', title:`Eficacia mejorable (${eff}%)`, desc:`Margen para mejorar la selección de tiro desde cada posición.`});
  else if(totalShots>=5)         points.push({cls:'ok',     icon:'🎯', title:`Buena eficacia (${eff}%)`, desc:`El equipo convirtió bien sus oportunidades.`});

  // Turnovers
  if(totalTO>=8)      points.push({cls:'danger', icon:'🔄', title:`Demasiadas pérdidas (${totalTO})`, desc:`Alta tasa de pérdidas. Revisar la distribución bajo presión y decisiones en ataque.`});
  else if(totalTO>=5) points.push({cls:'warning',icon:'🔄', title:`Pérdidas a reducir (${totalTO})`, desc:`Cuidar mejor la pelota, especialmente en transiciones.`});

  // Discipline
  if(totalRed>0)       points.push({cls:'danger', icon:'🟥', title:`${totalRed} tarjeta${totalRed>1?'s':''} roja${totalRed>1?'s':''}`, desc:`Trabajar control emocional y decisiones bajo presión.`});
  if(totalSus>=4)      points.push({cls:'danger', icon:'⏱️', title:`Muchas exclusiones (${totalSus})`, desc:`${totalSus} exclusiones de 2 min dejan al equipo en desventaja numérica. Disciplina táctica.`});
  else if(totalSus>=2) points.push({cls:'warning',icon:'⏱️', title:`Exclusiones a reducir (${totalSus})`, desc:`Cuidar las faltas en situaciones de defensa.`});

  // Position weak spots
  const posData={};
  match.players.forEach(p=>p.positions.filter(x=>x&&x!=='--'&&x!=='SUP').forEach(pos=>{
    if(!posData[pos]) posData[pos]={goals:0,shots:0};
    posData[pos].goals+=p.stats.goals; posData[pos].shots+=p.stats.goals+p.stats.misses;
  }));
  const weakPos=Object.entries(posData).filter(([,d])=>d.shots>=2&&Math.round(d.goals/d.shots*100)<35);
  if(weakPos.length>0){
    const list=weakPos.map(([pos,d])=>`${pos} (${Math.round(d.goals/d.shots*100)}%)`).join(', ');
    points.push({cls:'warning',icon:'📍', title:`Posiciones débiles: ${list}`, desc:`Bajo porcentaje de conversión desde estas posiciones. Trabajar en entrenamiento.`});
  }

  // Conceded goals
  const conceded=match.scoreAway||0;
  if(!isAccumulated){
    if(conceded>=20)      points.push({cls:'danger', icon:'🛡️', title:`Defensa bajo presión (${conceded} goles recibidos)`, desc:`Alta cantidad de goles recibidos. Revisar sistema defensivo y cobertura.`});
    else if(conceded>=12) points.push({cls:'warning',icon:'🛡️', title:`Defensa a reforzar (${conceded} recibidos)`, desc:`Trabajar en coordinación defensiva y marcación.`});
  }

  if(points.length===0) return `<div class="stat-card"><div class="stat-card-title">🔎 ANÁLISIS TÁCTICO</div><div class="no-weak-points">✅ Sin puntos débiles detectados en este partido</div></div>`;

  return `<div class="stat-card"><div class="stat-card-title">🔎 PUNTOS A TRABAJAR</div>
    <div class="weak-points-list">
      ${points.map(pt=>`<div class="weak-point-item ${pt.cls}"><div class="weak-point-icon">${pt.icon}</div><div class="weak-point-text"><div class="weak-point-title">${pt.title}</div><div class="weak-point-desc">${pt.desc}</div></div></div>`).join('')}
    </div>
  </div>`;
}


// ══════════════════════════════════════════════
// PDF EXPORT
// ══════════════════════════════════════════════
function buildPDFHTML(match) {
  const totalGoals=match.players.reduce((a,p)=>a+p.stats.goals,0);
  const totalShots=match.players.reduce((a,p)=>a+p.stats.goals+p.stats.misses,0);
  const totalAssists=match.players.reduce((a,p)=>a+p.stats.assists,0);
  const totalSaves=match.players.reduce((a,p)=>a+p.stats.saves,0);
  const totalTO=match.players.reduce((a,p)=>a+p.stats.turnovers,0);
  const totalSteals=match.players.reduce((a,p)=>a+p.stats.steals,0);
  const totalYellow=match.players.reduce((a,p)=>a+p.stats.yellowCards,0);
  const totalSus=match.players.reduce((a,p)=>a+p.stats.suspensions,0);
  const totalRed=match.players.reduce((a,p)=>a+p.stats.redCards,0);
  const eff=totalShots>0?Math.round(totalGoals/totalShots*100):0;
  const sorted=[...match.players].sort((a,b)=>b.stats.goals-a.stats.goals||b.stats.assists-a.stats.assists);
  const dateStr=new Date(match.date).toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#fff;color:#111;padding:20px;font-size:12px}.header{text-align:center;border-bottom:3px solid #1e90ff;padding-bottom:12px;margin-bottom:16px}.header h1{font-size:22px;font-weight:900;letter-spacing:2px;color:#1e90ff}.header .date{font-size:11px;color:#666;margin-top:4px}.score-row{display:flex;align-items:center;justify-content:center;gap:20px;margin:12px 0;padding:12px;background:#f0f7ff;border-radius:8px}.score-team{font-size:14px;font-weight:700}.score-box{font-size:28px;font-weight:900;color:#1e90ff}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}.cell{text-align:center;background:#f8f9ff;border:1px solid #dde;border-radius:6px;padding:8px 4px}.cell-num{font-size:20px;font-weight:900}.cell-lbl{font-size:9px;color:#666;letter-spacing:1px;margin-top:2px}.section-title{font-size:10px;font-weight:700;letter-spacing:2px;color:#1e90ff;margin-bottom:6px;margin-top:12px;text-transform:uppercase}table{width:100%;border-collapse:collapse;font-size:10.5px}th{background:#1e90ff;color:#fff;padding:5px 4px;text-align:center;font-size:9px;letter-spacing:.5px}td{padding:5px 4px;border-bottom:1px solid #eee;text-align:center}td:first-child{text-align:left;font-weight:600}tr:nth-child(even){background:#f8faff}.disc-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.disc-cell{text-align:center;padding:8px;background:#fff8f0;border:1px solid #ffe;border-radius:6px}.footer{margin-top:16px;text-align:center;font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:8px}</style>
  </head><body>
  <div class="header"><h1>⬡ HANDBALLIQ — INFORME DE PARTIDO</h1><div class="date">${dateStr.toUpperCase()}</div></div>
  <div class="score-row"><div class="score-team">${match.myTeamName}</div><div class="score-box">${match.scoreHome} — ${match.scoreAway}</div><div class="score-team">${match.rivalTeamName}</div></div>
  <div class="section-title">RESUMEN DE EQUIPO</div>
  <div class="grid3">
    <div class="cell"><div class="cell-num" style="color:#00d4b4">${totalGoals}</div><div class="cell-lbl">GOLES</div></div>
    <div class="cell"><div class="cell-num">${match.scoreAway}</div><div class="cell-lbl">RECIBIDOS</div></div>
    <div class="cell"><div class="cell-num">${totalSaves}</div><div class="cell-lbl">PARADAS</div></div>
    <div class="cell"><div class="cell-num">${totalAssists}</div><div class="cell-lbl">ASISTENCIAS</div></div>
    <div class="cell"><div class="cell-num" style="color:#ff3b5c">${totalTO}</div><div class="cell-lbl">PÉRDIDAS</div></div>
    <div class="cell"><div class="cell-num" style="color:#00d4b4">${totalSteals}</div><div class="cell-lbl">ROBOS</div></div>
  </div>
  <div class="section-title">EFICACIA EN LANZAMIENTO: ${eff}% (${totalGoals}/${totalShots})</div>
  <div class="section-title">DISCIPLINA</div>
  <div class="disc-row">
    <div class="disc-cell"><div class="cell-num" style="color:#ffc107">${totalYellow}</div><div class="cell-lbl">T. AMARILLAS</div></div>
    <div class="disc-cell"><div class="cell-num" style="color:#ffc107">${totalSus}</div><div class="cell-lbl">EXCLUSIONES 2MIN</div></div>
    <div class="disc-cell"><div class="cell-num" style="color:#ff3b5c">${totalRed}</div><div class="cell-lbl">T. ROJAS</div></div>
  </div>
  <div class="section-title">ESTADÍSTICAS POR JUGADORA</div>
  <table><thead><tr><th>NOMBRE</th><th>POS</th><th>GOL</th><th>FALLO</th><th>ASI</th><th>PAR</th><th>PER</th><th>ROB</th><th>TA</th><th>EXC</th><th>TR</th><th>TIEMPO</th></tr></thead>
  <tbody>${sorted.map(p=>`<tr><td>${p.name}${p.number?' #'+p.number:''}</td><td>${p.positions.filter(x=>x&&x!=='--'&&x!=='SUP').join('/')}</td><td>${p.stats.goals}</td><td>${p.stats.misses}</td><td>${p.stats.assists}</td><td>${p.stats.saves}</td><td>${p.stats.turnovers}</td><td>${p.stats.steals}</td><td>${p.stats.yellowCards}</td><td>${p.stats.suspensions}</td><td>${p.stats.redCards}</td><td>${formatTime(p.timeOnCourt)}</td></tr>`).join('')}</tbody></table>
  <div class="footer">Generado por HandballIQ · ${new Date().toLocaleString('es-AR')}</div>
  </body></html>`;
}

function printPDF(match) {
  const win=window.open('','_blank');
  if(!win){ showToast('Habilitá los popups para el PDF'); return; }
  win.document.write(buildPDFHTML(match)); win.document.close();
  win.onload=()=>{ win.focus(); win.print(); };
}

function exportCurrentPDF() {
  if(!activeMatch) return;
  const snapshot=JSON.parse(JSON.stringify(activeMatch));
  snapshot.players.forEach(p=>{ if(p.onCourt&&p.courtEntry!==null) p.timeOnCourt+=matchElapsed()-p.courtEntry; });
  printPDF(snapshot);
}

let currentHistoryMatch=null;
function exportHistoryPDF() { if(currentHistoryMatch) printPDF(currentHistoryMatch); }

// ══════════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════════
function renderHistory() {
  const body=document.getElementById('historyList');
  const history=getHistory();
  body.innerHTML='';
  if(history.length===0){ body.innerHTML=`<div class="history-empty"><div class="history-empty-icon">📋</div><div class="history-empty-text">TODAVÍA NO HAY PARTIDOS GUARDADOS</div></div>`; return; }
  history.forEach(match=>{
    const date=new Date(match.date);
    const dateStr=date.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
    const result=match.scoreHome>match.scoreAway?'🏆 VICTORIA':match.scoreHome<match.scoreAway?'❌ DERROTA':'🤝 EMPATE';
    const totalGoals=match.players.reduce((a,p)=>a+p.stats.goals,0);
    const totalShots=match.players.reduce((a,p)=>a+p.stats.goals+p.stats.misses,0);
    const eff=totalShots>0?Math.round(totalGoals/totalShots*100):0;
    const card=document.createElement('div'); card.className='history-card';
    card.innerHTML=`
      <div class="history-card-date">${dateStr.toUpperCase()} · ${result}</div>
      <div class="history-card-score">
        <div class="history-team">${match.myTeamName}</div>
        <div class="history-score-box">${match.scoreHome} — ${match.scoreAway}</div>
        <div class="history-team away">${match.rivalTeamName}</div>
      </div>
      <div class="history-card-meta"><span>⚽ ${totalGoals} goles</span><span>🎯 ${eff}% eficacia</span><span>👥 ${match.players.length} jugadoras</span></div>
      <div class="history-card-actions">
        <button class="btn-history-action primary" onclick="openHistoryDetail('${match.id}')">📊 VER STATS</button>
        <button class="btn-history-action" onclick="downloadHistoryPDF('${match.id}')">📄 PDF</button>
        <button class="btn-history-action danger" onclick="deleteHistoryMatch('${match.id}',event)">🗑</button>
      </div>`;
    body.appendChild(card);
  });
}

function openHistoryDetail(matchId) {
  const match=getHistory().find(m=>m.id===matchId); if(!match) return;
  currentHistoryMatch=match;
  const date=new Date(match.date);
  document.getElementById('historyDetailTitle').textContent=`${abbr(match.myTeamName)} vs ${abbr(match.rivalTeamName)} · ${date.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}`;
  renderStatsForMatch(match,'historyDetailBody');
  showScreen('screen-history-detail');
}

function downloadHistoryPDF(matchId) {
  const match=getHistory().find(m=>m.id===matchId); if(!match) return;
  printPDF(match);
}

function deleteHistoryMatch(matchId,e) {
  e.stopPropagation();
  if(!confirm('¿Eliminar este partido?')) return;
  saveHistory(getHistory().filter(m=>m.id!==matchId)); renderHistory();
}

// ══════════════════════════════════════════════
// TOURNAMENT
// ══════════════════════════════════════════════
function renderTournament() {
  const body=document.getElementById('tournamentBody');
  const history=getHistory(); const sq=getSquad();
  body.innerHTML='';
  if(history.length===0){ body.innerHTML=`<div class="history-empty"><div class="history-empty-icon">🏆</div><div class="history-empty-text">JUGÁ PARTIDOS PARA VER LAS ESTADÍSTICAS</div></div>`; return; }
  const wins=history.filter(m=>m.scoreHome>m.scoreAway).length;
  const losses=history.filter(m=>m.scoreHome<m.scoreAway).length;
  const draws=history.filter(m=>m.scoreHome===m.scoreAway).length;
  const playerAcc={};
  history.forEach(match=>{ match.players.forEach(p=>{ if(!playerAcc[p.id]) playerAcc[p.id]={name:p.name,photo:p.photo||'',number:p.number||null,stats:{goals:0,assists:0,saves:0,turnovers:0,steals:0,yellowCards:0,suspensions:0,redCards:0,misses:0},timeOnCourt:0,matchCount:0}; const acc=playerAcc[p.id]; Object.keys(acc.stats).forEach(k=>acc.stats[k]+=(p.stats[k]||0)); acc.timeOnCourt+=p.timeOnCourt; acc.matchCount++; }); });
  const totGoals=history.reduce((a,m)=>a+m.players.reduce((b,p)=>b+p.stats.goals,0),0);
  const totConc=history.reduce((a,m)=>a+m.scoreAway,0);
  const totAssists=Object.values(playerAcc).reduce((a,p)=>a+p.stats.assists,0);
  const totTO=Object.values(playerAcc).reduce((a,p)=>a+p.stats.turnovers,0);
  const totYellow=Object.values(playerAcc).reduce((a,p)=>a+p.stats.yellowCards,0);
  const totSus=Object.values(playerAcc).reduce((a,p)=>a+p.stats.suspensions,0);
  const totRed=Object.values(playerAcc).reduce((a,p)=>a+p.stats.redCards,0);
  const totMins=Math.round(Object.values(playerAcc).reduce((a,p)=>a+p.timeOnCourt,0)/60);
  const totShots=history.reduce((a,m)=>a+m.players.reduce((b,p)=>b+p.stats.goals+p.stats.misses,0),0);
  const teamEff=totShots>0?Math.round(totGoals/totShots*100):0;
  body.innerHTML=`
    <div class="tournament-header">
      <div class="tournament-team-name">${sq.teamName||'MI EQUIPO'}</div>
      <div class="tournament-subtitle">${history.length} PARTIDO${history.length!==1?'S':''}</div>
      <div class="tournament-record">
        <div class="tournament-record-item"><div class="tournament-record-num win">${wins}</div><div class="tournament-record-lbl">VICTORIAS</div></div>
        <div class="tournament-record-item"><div class="tournament-record-num draw">${draws}</div><div class="tournament-record-lbl">EMPATES</div></div>
        <div class="tournament-record-item"><div class="tournament-record-num loss">${losses}</div><div class="tournament-record-lbl">DERROTAS</div></div>
      </div>
    </div>
    <div class="tournament-grid">
      <div class="tournament-stat-cell"><div class="tsc-num teal">${totGoals}</div><div class="tsc-lbl">GOLES TOTALES</div></div>
      <div class="tournament-stat-cell"><div class="tsc-num">${totConc}</div><div class="tsc-lbl">RECIBIDOS</div></div>
      <div class="tournament-stat-cell"><div class="tsc-num">${teamEff}%</div><div class="tsc-lbl">EFICACIA</div></div>
      <div class="tournament-stat-cell"><div class="tsc-num">${totAssists}</div><div class="tsc-lbl">ASISTENCIAS</div></div>
      <div class="tournament-stat-cell"><div class="tsc-num red">${totTO}</div><div class="tsc-lbl">PÉRDIDAS</div></div>
      <div class="tournament-stat-cell"><div class="tsc-num">${totMins}'</div><div class="tsc-lbl">MIN. JUGADOS</div></div>
    </div>
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:14px">
      <div class="tournament-section-title">DISCIPLINA</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        <div class="tournament-stat-cell"><div class="tsc-num yellow">${totYellow}</div><div class="tsc-lbl">T. AMARILLAS</div></div>
        <div class="tournament-stat-cell"><div class="tsc-num yellow">${totSus}</div><div class="tsc-lbl">EXCLUSIONES</div></div>
        <div class="tournament-stat-cell"><div class="tsc-num red">${totRed}</div><div class="tsc-lbl">T. ROJAS</div></div>
      </div>
    </div>`;
  const sortedScorers=Object.values(playerAcc).sort((a,b)=>b.stats.goals-a.stats.goals).slice(0,5);
  if(sortedScorers[0]?.stats.goals>0){
    let h=`<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:14px"><div class="tournament-section-title">🥇 GOLEADORAS</div>`;
    sortedScorers.forEach((p,i)=>{ if(!p.stats.goals) return; h+=`<div class="top-scorer-row"><div class="tsr-rank">${i+1}</div><div class="tsr-photo">${p.photo?`<img src="${p.photo}"/>`:(p.number?'#'+p.number:initials(p.name))}</div><div class="tsr-name">${p.name}</div><div><div class="tsr-val">${p.stats.goals}</div><div class="tsr-lbl">GOLES</div></div></div>`; });
    body.innerHTML+=h+'</div>';
  }
  const sortedAsi=Object.values(playerAcc).sort((a,b)=>b.stats.assists-a.stats.assists).slice(0,3);
  if(sortedAsi[0]?.stats.assists>0){
    let h=`<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:14px"><div class="tournament-section-title">🎯 ASISTIDORAS</div>`;
    sortedAsi.forEach((p,i)=>{ if(!p.stats.assists) return; h+=`<div class="top-scorer-row"><div class="tsr-rank">${i+1}</div><div class="tsr-photo">${p.photo?`<img src="${p.photo}"/>`:(p.number?'#'+p.number:initials(p.name))}</div><div class="tsr-name">${p.name}</div><div><div class="tsr-val" style="color:var(--accent-blue)">${p.stats.assists}</div><div class="tsr-lbl">ASIST.</div></div></div>`; });
    body.innerHTML+=h+'</div>';
  }
}

// ══════════════════════════════════════════════
// SETTINGS & BACKUP
// ══════════════════════════════════════════════
function openSettings() {
  const sq=getSquad(), hist=getHistory(), activeM=getMatch();
  const totalKB=((JSON.stringify(sq).length+JSON.stringify(hist).length)/1024).toFixed(1);
  document.getElementById('settingsStorageInfo').innerHTML=
    `👥 ${sq.players.length} jugadora${sq.players.length!==1?'s':''} en plantilla<br>`+
    `📋 ${hist.length} partido${hist.length!==1?'s':''} en historial<br>`+
    `${activeM&&!activeM.finished?'🟡 Partido en curso guardado<br>':''}`+
    `💾 ~${totalKB} KB en localStorage`;
  document.getElementById('settingsOverlay').classList.add('active');
  document.getElementById('settingsSheet').classList.add('active');
}

function closeSettings() {
  document.getElementById('settingsOverlay').classList.remove('active');
  document.getElementById('settingsSheet').classList.remove('active');
}

function exportBackup() {
  const backup={ version:2, exportedAt:new Date().toISOString(), squad:getSquad(), history:getHistory() };
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`HandballIQ_backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url); showToast('✅ Backup exportado'); closeSettings();
}

function importBackup(event) {
  const file=event.target.files[0]; if(!file) return;
  event.target.value='';
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      if(!data.squad||!data.history){ showToast('❌ Archivo inválido'); return; }
      const pc=data.squad?.players?.length||0, mc=data.history?.length||0;
      if(!confirm(`¿Importar este backup?\n\n• ${pc} jugadora${pc!==1?'s':''}\n• ${mc} partido${mc!==1?'s':''}\n\n⚠️ Reemplaza los datos actuales.`)) return;
      saveSquad(data.squad); saveHistory(data.history);
      initSquadTab(); renderHistory(); renderTournament();
      closeSettings(); showToast(`✅ Importado: ${pc} jugadoras · ${mc} partidos`);
    }catch(e){ showToast('❌ Error al leer el archivo'); }
  };
  reader.readAsText(file);
}

function confirmClearAll() {
  if(!confirm('¿Borrar TODOS los datos?\n\nSe eliminarán plantilla, historial y partido en curso.\n\n⚠️ Esta acción NO se puede deshacer.')) return;
  ls.del('hiq_squad'); ls.del('hiq_history'); ls.del('hiq_match');
  initSquadTab(); renderHistory(); renderTournament();
  closeSettings(); showToast('🗑️ Todos los datos eliminados');
}

// ══════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════
function formatTime(secs){ secs=Math.round(secs||0); return `${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`; }
function initials(name)  { return (name||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase(); }
function shortName(name) { const p=(name||'').trim().split(' '); return p.length>1?p[0][0]+'. '+p[p.length-1]:name; }
function abbr(name)      { const p=(name||'???').trim().split(' '); return (p.length>=2?p[0][0]+p[1][0]+(p[1][1]||''):name.substring(0,3)).toUpperCase(); }

function showToast(msg) {
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2400);
}
function showModal(title, body) {
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').textContent=body;
  document.getElementById('modalOverlay').classList.add('active');
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('active'); }

window.addEventListener('beforeunload',()=>{ if(activeMatch&&!activeMatch.finished) saveMatch(activeMatch); });
