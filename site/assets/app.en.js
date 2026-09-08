
/* ============================================================
   1) CONSTANTS
   ============================================================ */
/* Character set of the tiles (Base24, without I, L, O, R). */
const B24 = "0123456789ABCDEFGHJKMNPQ";   // character set of the tiles
/* OMDP39 writes an R in the 24th position, the tiles carry a Q.
   Both denote the same value (23). Input containing R is therefore
   accepted and mapped to Q for loading. */
const ALIAS = {R:'Q'};
const ALIAS_BACK = {Q:'R'};
const EXCLUDED = "ILO";
const HINT = {I:'1', L:'1', O:'0'};
const toPlate = c => ALIAS[c] || c;                       // OMDP39 -> tile
const toOmdp  = s => s.replace(/Q/g, 'R');                // tile -> OMDP39
/* WORDS comes from assets/bip39-en.js */
const WORDIDX = new Map(WORDS.map((w,i)=>[w,i+1]));

/* Geometry taken from the CAD drawings (mm) */
const G = {
  bodyW:62, bodyH:80,
  frameW:58.1, frameH:76.1,
  slotW:25, slotH:5.85,
  colX:[0.9,32.2],
  rowY:[4.8,16.95,29.05,41.19,53.35,65.45],
  screws:[[9.05,13.8],[49.05,13.8],[9.05,62.3],[49.05,62.3]],
  centerScrew:[29.05,38.05]
};

/* ============================================================
   2) STATE
   ============================================================ */
const S = {
  mode:'base24', bipFormat:'index',
  groups:Array(24).fill(''), sources:Array(24).fill(''),
  valid:false, step:0, slot:1,
  sig:null,                                               // fingerprint of the data
  placed:Array(24).fill(false),                           // slots already loaded
  checked:Array(24).fill(false),                          // checklist: ticked slots
  screws:{front:Array(5).fill(false), back:Array(5).fill(false)},   // screws tightened
  finalPass:{front:false, back:false}                     // second pass done
};

/* Tightening order: centre first (it centres the frame), then the corners crosswise. */
const SCREW_SEQ = [
  {n:1, pos:'C', label:'Centre screw', where:'centre',            hint:'finger tight only — it centres the frame'},
  {n:2, pos:0,   label:'Top-left corner',  where:'top left',      hint:'tighten lightly'},
  {n:3, pos:3,   label:'Bottom-right corner',where:'bottom right',    hint:'diagonally opposite — tighten lightly'},
  {n:4, pos:1,   label:'Top-right corner', where:'top right',     hint:'tighten lightly'},
  {n:5, pos:2,   label:'Bottom-left corner', where:'bottom left',     hint:'diagonally opposite — tighten lightly'}
];
const screwXY = s => s.pos==='C' ? G.centerScrew : G.screws[s.pos];

/* If the input data changes, any progress made against it is void. */
function syncSignature(){
  const sig=S.groups.join('|');
  if(sig!==S.sig){
    S.sig=sig;
    S.placed=Array(24).fill(false);
    S.checked=Array(24).fill(false);
  }
}
/* Index of the next screw due, or -1 when all of them are seated */
const nextScrew = side => S.screws[side].findIndex(v=>!v);

/* Order of steps: after each loaded face the frame is screwed down straight
   away, so the tiles cannot shift when the plate is turned over. */
const STEPS = [
  {k:'S1', t:'Preparation'},
  {k:'S2', t:'Split up'},
  {k:'S3', t:'Sort tiles'},
  {k:'S4', t:'Front 01–12'},
  {k:'S5', t:'Screw down front'},
  {k:'S6', t:'Back 13–24'},
  {k:'S7', t:'Screw down back'},
  {k:'S8', t:'Label'},
  {k:'S9', t:'Verify'}
];
const FILL_FRONT=3, SCREW_FRONT=4, FILL_BACK=5, SCREW_BACK=6;

/* ============================================================
   3) PLATTEN-RENDERER
   ============================================================ */
function slotIndexFor(side,col,row){ return (side==='front'?0:12) + col*6 + row + 1; }

function renderPlate(target,{side='front',active=null,interactive=false,showTiles=true,screwMode=false}={}){
  const pad=(G.bodyW-G.frameW)/2, padY=(G.bodyH-G.frameH)/2;
  let s=`<svg class="plate" viewBox="0 0 ${G.bodyW} ${G.bodyH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#C9CFD6"/><stop offset=".5" stop-color="#98A2AC"/>
      <stop offset="1" stop-color="#77828E"/></linearGradient>
    <linearGradient id="tiFrame" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#BFC7CF"/><stop offset="1" stop-color="#949EA8"/></linearGradient>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FBFCFD"/><stop offset="1" stop-color="#C6CDD5"/></linearGradient>
    <linearGradient id="tileOk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F0FBF5"/><stop offset="1" stop-color="#A9D9C1"/></linearGradient>
  </defs>
  <rect x=".4" y=".4" width="${G.bodyW-.8}" height="${G.bodyH-.8}" rx="1.6" fill="url(#steel)" stroke="#7B848E" stroke-width=".3"/>
  <rect x="${pad}" y="${padY}" width="${G.frameW}" height="${G.frameH}" rx="2" fill="url(#tiFrame)" stroke="#818B95" stroke-width=".25"/>`;

  for(let col=0;col<2;col++){
    for(let row=0;row<6;row++){
      const n=slotIndexFor(side,col,row);
      const x=pad+G.colX[col], y=padY+G.rowY[row];
      const filled=(S.groups[n-1]||'').length===4;
      const isAct=active===n;
      const done=filled && S.placed[n-1];       // slot already loaded -> green
      s+=`<rect class="slotRect${isAct?' active':(done?' placed':(filled?' filled':''))}" data-slot="${n}"
             x="${x}" y="${y}" width="${G.slotW}" height="${G.slotH}" rx=".6"/>`;
      s+=`<text class="slotNo${isAct?' active':(done?' placed':'')}" x="${x+2.6}" y="${y-1.15}">${String(n).padStart(2,'0')}</text>`;
      if(done && !isAct)
        s+=`<path d="M${x+G.slotW-2.6} ${y-2.05} l.7 .8 l1.35 -1.5" fill="none" stroke="#0F7A52"
               stroke-width=".45" stroke-linecap="round" stroke-linejoin="round"/>`;

      if(showTiles && filled){
        const g=S.groups[n-1], tw=G.slotW/4;
        for(let i=0;i<4;i++){
          const tx=x+i*tw;
          s+=`<rect x="${tx+.18}" y="${y+.18}" width="${tw-.36}" height="${G.slotH-.36}" rx=".5"
                 fill="url(#${done?'tileOk':'tile'})"
                 stroke="${isAct?'#E41C34':(done?'#4FA383':'#8B959F')}" stroke-width="${isAct?.3:(done?.2:.12)}"/>`;
          s+=`<text class="tileTxt" x="${tx+tw/2}" y="${y+G.slotH/2+1.25}"
                 fill="${done?'#12503A':'#1F262E'}">${g[i]}</text>`;
        }
      }
      if(interactive){
        s+=`<rect class="slotHit" data-slot="${n}" x="${x}" y="${y-2.6}" width="${G.slotW}" height="${G.slotH+2.6}"/>`;
      }
    }
  }
  if(screwMode){
    /* Screws with tightening order and state: done / next / open */
    const nx=nextScrew(side);
    SCREW_SEQ.forEach((sc,i)=>{
      const [sx,sy]=screwXY(sc), cx=pad+sx, cy=padY+sy;
      const done=S.screws[side][i], isNext=(i===nx);
      const fill = done?'#D8EEE3' : isNext?'#FBD9DE' : '#C3CAD1';
      const strk = done?'#0F7A52' : isNext?'#E41C34' : '#8B959F';
      if(isNext) s+=`<circle cx="${cx}" cy="${cy}" r="3.6" fill="none" stroke="#E41C34" stroke-width=".3" stroke-dasharray="1 .8" opacity=".9"/>`;
      s+=`<circle class="screwHit" data-screw="${i}" cx="${cx}" cy="${cy}" r="2.3"
             fill="${fill}" stroke="${strk}" stroke-width="${done||isNext?.5:.25}" style="cursor:pointer"/>`;
      s+= done
        ? `<path d="M${cx-1} ${cy} l.8 .9 l1.5 -1.7" fill="none" stroke="#0F7A52" stroke-width=".5" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`
        : `<text x="${cx}" y="${cy+.85}" text-anchor="middle" pointer-events="none"
              font-family="ui-monospace,monospace" font-size="2.4" font-weight="700"
              fill="${isNext?'#B31428':'#5C666F'}">${sc.n}</text>`;
    });
  } else {
    G.screws.concat([G.centerScrew]).forEach(([sx,sy])=>{
      s+=`<circle cx="${pad+sx}" cy="${padY+sy}" r="1.5" fill="#6E7883" stroke="#8F99A3" stroke-width=".2"/>
          <circle cx="${pad+sx}" cy="${padY+sy}" r=".55" fill="#3D4650"/>`;
    });
  }
  s+=`</svg>`;
  target.innerHTML=s;

  if(interactive){
    target.querySelectorAll('.slotHit').forEach(el=>
      el.addEventListener('click',()=>{ S.slot=+el.dataset.slot; render(); }));
  }
  if(screwMode){
    target.querySelectorAll('.screwHit').forEach(el=>
      el.addEventListener('click',()=>toggleScrew(side,+el.dataset.screw)));
  }
}

/* Select or deselect a screw. Undoing one also releases everything after it —
   otherwise the display would claim an order that never happened. */
function toggleScrew(side,i){
  const a=S.screws[side];
  if(a[i]){ for(let k=i;k<a.length;k++) a[k]=false; S.finalPass[side]=false; }
  else    { for(let k=0;k<=i;k++)       a[k]=true;  }
  render();
}
function setFinalPass(side,v){ S.finalPass[side]=v; render(); }
function resetScrews(side){ S.screws[side]=Array(5).fill(false); S.finalPass[side]=false; render(); }

/* ============================================================
   4) BASE24
   ============================================================ */
function sanitizeB24(raw){
  const up = (raw||'').toUpperCase().replace(/[^0-9A-Z]/g,'');
  let aliased = 0;
  const clean = [...up].map(c => { if(ALIAS[c]){ aliased++; return ALIAS[c]; } return c; }).join('');
  return {clean, aliased};
}

function readB24(){
  const {clean, aliased}=sanitizeB24(document.getElementById('b24').value);
  const bad=[...new Set([...clean].filter(c=>!B24.includes(c)))];
  const st=document.getElementById('b24status'), ta=document.getElementById('b24');
  let ok=false, msg='';

  if(clean.length===0){ msg=`<span class="pill">0 / 96 characters</span>`; ta.className=''; }
  else if(bad.length){
    const hints=bad.map(c=>HINT[c]?`${c} → ${HINT[c]}`:c).join(' · ');
    msg=`<span class="pill err">Invalid: ${hints}</span>
         <span class="mut small">The character set has no I, L and no O.</span>`;
    ta.className='bad';
  } else if(clean.length!==96){
    const d=96-clean.length;
    msg=`<span class="pill warn">${clean.length} / 96 characters</span>
         <span class="mut small">${d>0?`${d} more to go`:`${-d} too many`}</span>`;
    ta.className='';
  } else {
    ok=true; ta.className='good';
    msg=`<span class="pill ok">✓ 96 / 96 characters</span><span class="pill">24 groups of 4</span>
         <span class="mut small">≈ ${Math.round(96*Math.log2(24))} Bit</span>`;
  }
  if(aliased && !bad.length)
    msg+=`<span class="pill warn" title="OMDP39 writes R, the tile carries Q">
            R → Q · ${aliased} characters mapped</span>`;
  st.innerHTML=msg;

  S.valid=ok; S.groups=Array(24).fill(''); S.sources=Array(24).fill('');
  if(ok) for(let i=0;i<24;i++){
    S.groups[i]=clean.slice(i*4,i*4+4);
    S.sources[i]=`characters ${i*4+1}–${i*4+4}`;
  }
  syncSignature();
  render();
}

function formatB24(){
  const {clean:c}=sanitizeB24(document.getElementById('b24').value);
  const out=(c.match(/.{1,4}/g)||[]).reduce((a,g,i)=>a+g+((i+1)%8===0?'\n':' '),'').trim();
  document.getElementById('b24').value=out; readB24();
}

function fillDemoB24(){
  const buf=new Uint8Array(256); crypto.getRandomValues(buf);
  let s='';
  for(let i=0;i<buf.length && s.length<96;i++) if(buf[i]<240) s+=B24[buf[i]%24];
  document.getElementById('b24').value=s; formatB24();
}

/* ============================================================
   4b) 33 WORDS -> 96 CHARACTERS
   ------------------------------------------------------------
   Word position 1..2048  ->  +1000  ->  1001..3048 (always 4 digits)
   33 values concatenated      ->  132 decimal digits
   read as one number          ->  base 24  ->  96 characters

   Why it fits:  10^132 ~ 2^438.5  <  24^96 ~ 2^440.2
   The offset of 1000 makes every value four digits long — without it the
   chain could no longer be split back into 33 blocks unambiguously.
   Computed with BigInt, so exact and without rounding.
   ============================================================ */
let LAST33 = null;

function words33From(text){
  const ws=(text||'').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return ws.map(w=>({w, pos:WORDIDX.get(w)||null}));
}

function encode33(positions){
  const chain = positions.map(p=>String(p+1000)).join('');   // 132 Ziffern
  let n = BigInt(chain), out='';
  for(let i=0;i<96;i++){
    out = B24[Number(n % 24n)] + out;
    n = n / 24n;
  }
  if(n !== 0n) throw new Error('does not fit into 96 positions');
  return {chain, code:out};
}

function decode33(code){
  let n=0n;
  for(const ch of code) n = n*24n + BigInt(B24.indexOf(ch));
  const s = n.toString().padStart(132,'0');
  const out=[];
  for(let i=0;i<132;i+=4) out.push(parseInt(s.slice(i,i+4),10)-1000);
  return out;
}

function gen33(){
  const buf=new Uint32Array(33); crypto.getRandomValues(buf);
  // Avoiding modulo bias: 2048 divides 2^32 evenly, so %2048 is clean here
  document.getElementById('w33').value =
    Array.from(buf,v=>WORDS[v % 2048]).join(' ');
  convert33();
}

function convert33(){
  const items=words33From(document.getElementById('w33').value);
  const st=document.getElementById('w33status');
  const out=document.getElementById('w33out');
  const btn=document.getElementById('w33take');
  LAST33=null; btn.disabled=true;

  const bad=items.filter(i=>!i.pos);
  if(items.length===0){ st.innerHTML='<span class="pill">0 / 33 words</span>';
    out.style.display='none'; return; }
  if(bad.length){
    st.innerHTML=`<span class="pill err">Not in the BIP39 list: ${
      bad.slice(0,4).map(b=>b.w).join(', ')}${bad.length>4?' …':''}</span>`;
    out.style.display='none'; return;
  }
  if(items.length!==33){
    st.innerHTML=`<span class="pill warn">${items.length} / 33 words</span>`+
      `<span class="mut small">${items.length<33?`${33-items.length} more`:`${items.length-33} too many`}</span>`;
    out.style.display='none'; return;
  }

  const pos=items.map(i=>i.pos);
  const {chain, code} = encode33(pos);
  const ok = decode33(code).join(',') === pos.join(',');
  LAST33 = code; btn.disabled=false;

  st.innerHTML=`<span class="pill ok">✓ 33 / 33 words</span>`+
    `<span class="pill">132 digits → 96 characters</span>`+
    `<span class="pill ${ok?'ok':'err'}">Reverse check ${ok?'OK':'FEHLER'}</span>`;

  const rows=items.map((it,i)=>`<tr>
      <td class="m">${String(i+1).padStart(2,'0')}</td>
      <td class="mono">${it.w}</td>
      <td class="m" style="text-align:right">${it.pos}</td>
      <td class="m" style="text-align:right;color:var(--ink-40)">+1000</td>
      <td class="m" style="text-align:right;color:var(--red);font-weight:600">${it.pos+1000}</td>
    </tr>`).join('');

  out.style.display='';
  out.innerHTML=`
    <div class="chainStep"><span class="cn">1</span> Position + 1000</div>
    <div class="tblWrap" style="max-height:250px;overflow:auto">
      <table><thead><tr><th class="m">#</th><th>Word</th>
        <th class="m" style="text-align:right">Position</th>
        <th class="m" style="text-align:right"></th>
        <th class="m" style="text-align:right">Value</th></tr></thead>
        <tbody>${rows}</tbody></table></div>

    <div class="chainStep"><span class="cn">2</span> concatenated — 132 digits</div>
    <div class="chainBox">${chain.replace(/(.{66})/g,'$1\n')}</div>

    <div class="chainStep"><span class="cn">3</span> read as a number in base 24 — 96 characters</div>
    <div class="chainLabel">Tile notation (with <b class="mono">Q</b>) — this is what you load</div>
    <div class="chainBox accent">${code.replace(/(.{48})/g,'$1\n')}</div>
    ${code.includes('Q')?`
      <div class="chainLabel">OMDP39 notation (with <b class="mono">R</b>) — identical value</div>
      <div class="chainBox">${toOmdp(code).replace(/(.{48})/g,'$1\n')}</div>`:''}

    <div class="chainStep"><span class="cn">4</span> in 24 groups of 4</div>
    <div class="grpGrid">${Array.from({length:24},(_,i)=>
      `<span class="grpCell"><b>${String(i+1).padStart(2,'0')}</b>${code.slice(i*4,i*4+4)}</span>`).join('')}</div>`;
}

function take33(){
  if(!LAST33) return;
  setMode('base24');
  document.getElementById('b24').value=LAST33;
  formatB24();
  document.getElementById('b24').scrollIntoView({behavior:'smooth',block:'center'});
}

/* ============================================================
   5) BIP39
   ============================================================ */
function buildWordGrid(){
  document.getElementById('wordGrid').innerHTML=Array.from({length:24},(_,i)=>`
    <div class="wCell" id="wc${i}">
      <span class="i">${String(i+1).padStart(2,'0')}</span>
      <input type="text" id="w${i}" spellcheck="false" autocomplete="off" placeholder="word">
      <span class="idx" id="wi${i}">····</span>
    </div>`).join('');
  for(let i=0;i<24;i++){
    const el=document.getElementById('w'+i);
    el.addEventListener('input',readBip);
    el.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); document.getElementById('w'+Math.min(23,i+1))?.focus(); }
    });
  }
}
const pad4=n=>String(n).padStart(4,'0');

async function readBip(){
  const bulk=document.getElementById('bipBulk').value.trim();
  if(bulk){
    const ws=bulk.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    if(ws.length>1){
      for(let i=0;i<24;i++) document.getElementById('w'+i).value=ws[i]||'';
      document.getElementById('bipBulk').value='';
    }
  }
  const vals=[],idxs=[]; let filled=0,badCount=0;
  for(let i=0;i<24;i++){
    const v=(document.getElementById('w'+i).value||'').trim().toLowerCase();
    vals.push(v);
    const idx=v?WORDIDX.get(v):null; idxs.push(idx||null);
    const cell=document.getElementById('wc'+i), lab=document.getElementById('wi'+i);
    if(!v){ cell.className='wCell'; lab.textContent='····'; }
    else if(idx){ filled++; cell.className='wCell'; lab.textContent=S.bipFormat==='index'?pad4(idx):v.slice(0,4).toUpperCase(); }
    else { badCount++; cell.className='wCell bad'; lab.textContent='???'; }
  }

  S.groups=Array(24).fill(''); S.sources=Array(24).fill('');
  const ok = filled===24 && badCount===0; S.valid=ok;
  if(ok) for(let i=0;i<24;i++){
    S.groups[i]= S.bipFormat==='index' ? pad4(idxs[i]) : vals[i].slice(0,4).toUpperCase().padEnd(4,'·');
    S.sources[i]= `${vals[i]} · #${idxs[i]}`;
  }

  const st=document.getElementById('bipstatus');
  let html='';
  if(filled===0 && badCount===0) html=`<span class="pill">0 / 24 words</span>`;
  else if(badCount) html=`<span class="pill err">${badCount} word(s) not in the BIP39 list</span>`;
  else if(filled<24) html=`<span class="pill warn">${filled} / 24 words</span>`;
  else{
    const cs=await bip39Checksum(idxs);
    html=`<span class="pill ok">✓ 24 / 24 words</span>`+
      (cs===null?'':cs?`<span class="pill ok">Checksum valid</span>`
                      :`<span class="pill err">Checksum INVALID — typo?</span>`)+
      `<span class="pill">24 × 4 characters</span>`;
  }
  st.innerHTML=html;
  syncSignature();
  render();
}

async function bip39Checksum(idxs){
  if(!crypto?.subtle) return null;
  let bits='';
  for(const i of idxs) bits+=(i-1).toString(2).padStart(11,'0');
  const ent=bits.slice(0,256), chk=bits.slice(256);
  const bytes=new Uint8Array(32);
  for(let i=0;i<32;i++) bytes[i]=parseInt(ent.slice(i*8,i*8+8),2);
  const h=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return h[0].toString(2).padStart(8,'0')===chk;
}

function setBipFormat(f){
  S.bipFormat=f;
  document.getElementById('fmtIdx').setAttribute('aria-pressed',f==='index');
  document.getElementById('fmtLtr').setAttribute('aria-pressed',f==='letters');
  readBip();
}

function fillDemoBip(){
  document.getElementById('bipBulk').value =
    "legal winner thank year wave sausage worth useful legal winner thank year "+
    "wave sausage worth useful legal winner thank year wave sausage worth title";
  readBip();
}

function clearAll(){
  document.getElementById('b24').value='';
  document.getElementById('bipBulk').value='';
  for(let i=0;i<24;i++){const e=document.getElementById('w'+i); if(e) e.value='';}
  S.groups=Array(24).fill(''); S.sources=Array(24).fill(''); S.valid=false;
  document.getElementById('b24').className='';
  S.mode==='base24'?readB24():readBip();
}

function setMode(m){
  S.mode=m;
  document.getElementById('tabA').setAttribute('aria-selected',m==='base24');
  document.getElementById('tabB').setAttribute('aria-selected',m==='bip39');
  document.getElementById('panelA').style.display=m==='base24'?'':'none';
  document.getElementById('panelB').style.display=m==='bip39'?'':'none';
  m==='base24'?readB24():readBip();
}

/* ============================================================
   6) WIZARD
   ============================================================ */
function stepBar(){
  document.getElementById('stepBar').innerHTML=STEPS.map((s,i)=>`
    <button class="stepBtn" aria-current="${i===S.step}" data-done="${i<S.step?1:0}" onclick="goStep(${i})">
      <span class="k">${s.k}</span>${s.t}</button>`).join('');
  document.getElementById('progBar').style.width=(S.step/(STEPS.length-1)*100)+'%';
}

function goStep(i){
  const before=S.step;
  S.step=Math.max(0,Math.min(STEPS.length-1,i));
  if(S.step===FILL_FRONT) S.slot=Math.min(12,Math.max(1,S.slot));
  if(S.step===FILL_BACK)  S.slot=Math.max(13,Math.min(24,S.slot));
  render();
  /* The steps differ in height. Without this the viewport stays where the
     previous (taller) step ended — it feels like landing in the next section
     instead of in the new step. */
  if(S.step!==before) scrollToWizard();
}

function scrollToWizard(){
  const el=document.getElementById('wizard');
  if(!el) return;
  const top=el.getBoundingClientRect().top+window.scrollY-72;
  window.scrollTo({top:Math.max(0,top), behavior:'smooth'});
}
function setSlot(n,min,max){ S.slot=Math.max(min,Math.min(max,n)); render(); }
function togglePlaced(n){ S.placed[n-1]=!S.placed[n-1]; render(); }

/* Clicking on acknowledges the current slot as loaded. */
function advanceSlot(min,max){
  S.placed[S.slot-1]=true;
  if(S.slot>=max) goStep(S.step+1); else setSlot(S.slot+1,min,max);
}

function slotNav(min,max){
  const done=S.placed.slice(min-1,max).filter(Boolean).length, total=max-min+1;
  return `<div class="slotNav">
    <button class="btn sm" onclick="setSlot(${S.slot-1},${min},${max})" ${S.slot<=min?'disabled':''}>${
      S.slot<=min?'← Start':'← Slot '+String(S.slot-1).padStart(2,'0')}</button>
    <span class="slotCount">${done} / ${total} slots placed</span>
    <button class="btn sm primary" onclick="advanceSlot(${min},${max})">
      ${S.slot>=max?'Side complete →':'Placed · slot '+String(S.slot+1).padStart(2,'0')+' →'}</button>
  </div>`;
}

function fillStage(min,max){
  const n=S.slot, g=S.groups[n-1]||'';
  const ok=S.placed[n-1];
  const tiles=Array.from({length:4},(_,i)=>
    `<div class="bigTile ${g[i]?(ok?'ok':''):'pending'}"><span class="pos">P${i+1}</span>${g[i]||'·'}</div>`).join('');
  return `
  <div class="card">
    <h3><span class="num">${S.step+1}</span> ${STEPS[S.step].t}</h3>
    <p class="small mut">Place the tiles into the channel from <b>left to right</b> — P1 sits at the left edge of
      the frame window. The engraved side faces up, readable towards the slot number.</p>
    <div class="slotDetail">
      <div class="row" style="justify-content:space-between">
        <h4 style="margin:0;font-size:14px">Slot ${String(n).padStart(2,'0')}</h4>
        <div class="row" style="gap:8px">
          <span class="pill">${S.sources[n-1] || (S.mode==='base24'?'—':'word '+n)}</span>
          <button class="btn sm ${S.placed[n-1]?'ok':''}" onclick="togglePlaced(${n})">
            ${S.placed[n-1]?'✓ placed':'mark as placed'}</button>
        </div>
      </div>
      <div class="bigSlot">${tiles}</div>
      ${g?`<p class="tiny mut" style="margin:0">Order: ${[...g].map((c,i)=>`P${i+1}=<b>${c}</b>`).join(' · ')}</p>`
         :`<p class="tiny mut" style="margin:0">No data yet — enter your code or words in the <a href="#tool">tool</a> above.</p>`}
      ${slotNav(min,max)}
    </div>
    <div class="note" style="margin-top:18px">
      <b>Check after every slot:</b> four tiles, flush, no gap at the right-hand end. If there is play,
      a tile is missing or one is sitting askew.
    </div>
  </div>`;
}

/* Screwing the frame onto the body — right after each loaded face */
function screwStage(side){
  const front = side==='front';
  const cfg = front
    ? {no:5, prev:FILL_FRONT, next:FILL_BACK, frame:'upper frame', grav:'01–12',
       nextLabel:'Next → Load the back'}
    : {no:7, prev:FILL_BACK, next:7, frame:'lower frame', grav:'13–24',
       nextLabel:'Next → Labelling'};

  const st=S.screws[side], nDone=st.filter(Boolean).length, nx=nextScrew(side);
  const allDone = nDone===5 && S.finalPass[side];

  const rows = SCREW_SEQ.map((sc,i)=>{
    const done=st[i], isNext=(i===nx);
    return `<button class="screwRow ${done?'done':''} ${isNext?'next':''}"
        onclick="toggleScrew('${side}',${i})">
      <span class="sn">${done?'✓':sc.n}</span>
      <span class="sl"><b>${sc.label}</b><span class="sh">${sc.where} · ${sc.hint}</span></span>
      <span class="sa">${done?'tightened':(isNext?'next up':'open')}</span>
    </button>`;
  }).join('');

  return `
  <div class="card">
    <h3><span class="num">${cfg.no}</span> ${STEPS[S.step].t}</h3>
    <p class="small mut">As long as the frame sits loose, nothing holds the tiles in place. That is why ${front?'the front is screwed down <b>before</b> the plate is flipped'
                        :'the back is screwed down straight away too'} — not at the very end.</p>

    <div class="slotDetail">
      <p class="small" style="margin:0 0 12px;color:var(--ink-80)">
        <b>1 · Check.</b> All 12 channels full, four flush tiles each, engravings readable towards
        the slot number.<br>
        <b>2 · Place the frame.</b> Put the ${cfg.frame} with the engraving
        <span class="mono">${cfg.grav}</span> facing outwards — the windows exactly over the channels.
        The two frames are <b>not</b> interchangeable.</p>

      <div class="row" style="justify-content:space-between;margin-bottom:10px">
        <h4 style="margin:0;font-size:14px">3 · Screws in this order</h4>
        <span class="pill ${nDone===5?'ok':nDone?'warn':''}">${nDone} / 5 tightened</span>
      </div>
      <div class="screwList">${rows}</div>

      <label class="finalPass ${S.finalPass[side]?'on':''}">
        <input type="checkbox" ${S.finalPass[side]?'checked':''} ${nDone<5?'disabled':''}
               onchange="setFinalPass('${side}',this.checked)">
        <span><b>4 · Second pass.</b> Final tightening in the same order, the centre screw last.
          Countersunk heads must sit flush and must not protrude.</span>
      </label>

      <div class="row" style="margin-top:12px;justify-content:space-between">
        <span class="tiny mut">5 · Shake test: tilt and shake the plate — no rattling, no shifting.</span>
        <button class="btn sm" onclick="resetScrews('${side}')">Reset</button>
      </div>
    </div>

    <div class="note warn" style="margin-top:16px">
      <b>Torque.</b> M2 in titanium does not forgive overtightening — finger tight plus an eighth
      of a turn is enough. A stripped thread ruins the housing and the plate can no longer be closed
      securely.
    </div>
    ${front?`<div class="note" style="margin-top:12px">
      <b>Only now flip it.</b> Turn the plate about its <u>long</u> axis and then go strictly by
      the engraved numbers — slot 13 is not where slot 1 was.
    </div>`:''}

    <div class="row" style="margin-top:16px">
      <button class="btn" onclick="goStep(${cfg.prev})">← Back</button>
      <button class="btn ${allDone?'primary':''}" onclick="goStep(${cfg.next})">${cfg.nextLabel}</button>
      ${allDone?'':'<span class="tiny mut">Not all screws confirmed yet</span>'}
    </div>
  </div>`;
}

function groupsTable(){
  const rows=S.groups.map((g,i)=>`
    <tr><td class="m">${String(i+1).padStart(2,'0')}</td>
        <td class="small mut">${S.sources[i]||'—'}</td>
        <td><div class="grpChars">${Array.from({length:4},(_,k)=>
            `<span class="gc ${g[k]?'':'empty'}">${g[k]||'·'}</span>`).join('')}</div></td></tr>`).join('');
  return `<div class="tblWrap"><table>
    <thead><tr><th class="m">Slot</th><th>Source</th><th>4 tiles</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function stageHTML(){
  switch(S.step){
    case 0: return `
      <div class="card">
        <h3><span class="num">1</span> Preparation</h3>
        <ul class="small" style="padding-left:18px;color:var(--ink-80)">
          <li><b>Air gap:</b> machine offline, no camera, no smart devices in the room.</li>
          <li><b>Work surface:</b> bright, matte, with a rim — tiles are 0.5 mm thin and bounce far.</li>
          <li><b>Tools:</b> plastic-tipped tweezers, a screwdriver for M2 × 0.4, a magnifier.</li>
          <li><b>Check the parts:</b> body, upper frame (01–12), lower frame (13–24), countersunk
              M2 × 0.4 screws (five per side), 96 tiles.</li>
          <li><b>Decide the encoding:</b> Base24 or BIP39 index — not up for debate later.</li>
        </ul>
        <div class="note warn" style="margin-top:14px">
          Use the demo data for your first run. Only once the process is second nature should you
          work with real data.
        </div>
        <div class="row" style="margin-top:16px"><button class="btn primary" onclick="goStep(1)">Next → Split up</button></div>
      </div>`;

    case 1: return `
      <div class="card">
        <h3><span class="num">2</span> Split into 24 groups of 4</h3>
        <p class="small mut">${S.mode==='base24'
          ? 'The 96-character code is cut strictly left to right into 24 blocks. Block 1 → slot 01, block 24 → slot 24.'
          : (S.bipFormat==='index'
             ? 'Each word is replaced by its position in the BIP39 word list, zero-padded to four digits. Word 1 → slot 01.'
             : 'Each word is shortened to its first four letters — BIP39 words are unique that way. Word 1 → slot 01.')}</p>
        ${S.valid?'':`<div class="note">No valid data yet. Jump up to the <a href="#tool">tool</a> for a moment.</div>`}
        <div style="margin-top:16px">${groupsTable()}</div>
        <div class="row" style="margin-top:16px">
          <button class="btn" onclick="goStep(0)">← Back</button>
          <button class="btn primary" onclick="goStep(2)">Next → Sorting</button>
        </div>
      </div>`;

    case 2: return `
      <div class="card">
        <h3><span class="num">3</span> Sort the tiles</h3>
        <p class="small mut">Make one small pile per character, in the order of the character set. Count each pile
          once against the parts list. Two minutes here save you twenty of hunting for mistakes.</p>
        <div id="stageInv" class="inv" style="margin-top:14px"></div>
        <div class="note" style="margin-top:16px">
          <b>Pairs to watch when sorting:</b> ${S.mode==='base24'
            ? '<span class="mono">0 / Q</span> and <span class="mono">0 / D</span>, <span class="mono">8 / B</span> — the set deliberately has no I, L and no O. An <span class="mono">R</span> from the OMDP39 code sits in the slot as a <span class="mono">Q</span> tile.'
            : '<span class="mono">6 / 9</span> — digit tiles are ambiguous when rotated. Always align them to the slot number.'}
        </div>
        <div class="row" style="margin-top:16px">
          <button class="btn" onclick="goStep(1)">← Back</button>
          <button class="btn primary" onclick="goStep(3)">Next → Load the front</button>
        </div>
      </div>`;

    case FILL_FRONT: return fillStage(1,12);
    case SCREW_FRONT: return screwStage('front');
    case FILL_BACK:  return fillStage(13,24);
    case SCREW_BACK: return screwStage('back');

    case 7: return `
      <div class="card">
        <h3><span class="num">8</span> Labelling</h3>
        <p class="small mut">Both sides are loaded and screwed down. Before the plate goes into storage it needs one
          more thing: the note of <b>how</b> its content is to be read.</p>
        <ol class="small" style="padding-left:18px;color:var(--ink-80)">
          <li>Stamp or engrave on the narrow edge:
              <span class="mono">${S.mode==='base24'?'BASE24':'BIP39-IDX'}</span> plus the date.</li>
          ${S.mode==='base24'?`<li>If the plate contains <span class="mono">Q</span> tiles: they correspond to the
              <span class="mono">R</span> in the OMDP39 code. A <span class="mono">Q=R</span> note
              on the housing saves guesswork later.</li>`:''}
          <li>For several plates from one OMDP39 set, add the share number
              (<span class="mono">1/3</span>, <span class="mono">2/3</span> …).</li>
          <li>Tilt and shake the plate: nothing may rattle or shift.</li>
        </ol>
        <div class="note warn" style="margin-top:14px">
          <b>Without it the backup is a riddle.</b> In five years no one can tell whether
          <span class="mono">1020</span> is a word index or a Base24 block — or whether the character
          <span class="mono">Q</span> even belongs to the set used.
        </div>
        <div class="row" style="margin-top:16px">
          <button class="btn" onclick="goStep(6)">← Back</button>
          <button class="btn primary" onclick="goStep(8)">Next → Verification</button>
        </div>
      </div>`;

    default: return `
      <div class="card">
        <h3><span class="num">9</span> Verification</h3>
        <p class="small mut">The last step decides whether the backup is worth anything. Read the plate
          <b>backwards</b> — from the plate onto paper, not from the screen onto the plate.</p>
        <ol class="small" style="padding-left:18px;color:var(--ink-80)">
          <li>Read all 24 slots and write them down without looking at the source.</li>
          <li>Compare your notes against the checklist below — slot by slot.</li>
          <li>${S.mode==='base24'
              ? 'Convert the Base24 code back in OMDP39 and let it verify the share — entering every <span class="mono">Q</span> you read as an <span class="mono">R</span>.'
              : 'Translate the indices back into words and check the BIP39 checksum.'}</li>
          <li>The backup only counts as valid after a successful restore in your wallet.</li>
          <li>Destroy notes and printouts. Put the plate into storage.</li>
        </ol>
        <div class="note" style="margin-top:14px">
          <b>Restore test.</b> Set the wallet up from scratch once and restore it solely from the
          plate. An untested backup is not a backup.
        </div>
        <div class="row" style="margin-top:16px">
          <button class="btn" onclick="goStep(7)">← Back</button>
          <a class="btn" href="#checklist">To the checklist ↓</a>
        </div>
      </div>`;
  }
}

/* ============================================================
   7) INVENTORY + CHECKLIST
   ============================================================ */
function inventoryHTML(){
  const set = S.mode==='base24' ? [...B24]
            : (S.bipFormat==='index' ? [...'0123456789'] : [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']);
  const cnt={}; set.forEach(c=>cnt[c]=0);
  let total=0, max=0;
  S.groups.forEach(g=>[...g].forEach(c=>{ if(c in cnt){cnt[c]++;total++; if(cnt[c]>max)max=cnt[c];} }));
  const cells=set.map(c=>`<div class="invCell ${cnt[c]?(cnt[c]===max&&max>0?'hot':''):'zero'}">
      <div class="c">${c}</div><div class="n">×${cnt[c]}</div></div>`).join('');
  return {cells,total};
}

function renderInventory(){
  const {cells,total}=inventoryHTML();
  document.getElementById('invBox').innerHTML=cells;
  const t=document.getElementById('invTotal');
  t.textContent=`${total} / 96 tiles`;
  t.className='pill'+(total===96?' ok':total?' warn':'');
  const si=document.getElementById('stageInv'); if(si) si.innerHTML=cells;
}

function renderChecklist(){
  const row=i=>{
    const g=S.groups[i]||'';
    const on=S.checked[i];
    return `<tr class="${on?'done':''}" id="chkrow${i}">
      <td class="m">${String(i+1).padStart(2,'0')}</td>
      <td class="small mut">${S.sources[i]||'—'}</td>
      <td><div class="grpChars">${Array.from({length:4},(_,k)=>
          `<span class="gc ${g[k]?'':'empty'}">${g[k]||'·'}</span>`).join('')}</div></td>
      <td class="chk noprint"><input type="checkbox" ${on?'checked':''}
          aria-label="Slot ${i+1} checked" onchange="markRow(${i},this.checked)"></td></tr>`;
  };
  document.getElementById('chkA').innerHTML=Array.from({length:12},(_,i)=>row(i)).join('');
  document.getElementById('chkB').innerHTML=Array.from({length:12},(_,i)=>row(i+12)).join('');
  updateChkCount();
}

/* Ticking a row marks it green (no full render, so focus is kept) */
function markRow(i,on){
  S.checked[i]=on;
  document.getElementById('chkrow'+i)?.classList.toggle('done',on);
  updateChkCount();
}

function updateChkCount(){
  const n=S.checked.filter(Boolean).length;
  const el=document.getElementById('chkCount');
  if(el){
    el.textContent=`${n} / 24 checked`;
    el.className='pill'+(n===24?' ok':n?' warn':'');
  }
  const done=document.getElementById('chkDone');
  if(done) done.style.display = n===24 ? '' : 'none';
}

function resetChecklist(){ S.checked=Array(24).fill(false); renderChecklist(); }

/* ============================================================
   8) RENDER
   ============================================================ */
function render(){
  stepBar();
  document.getElementById('stageBody').innerHTML=stageHTML();
  const side = (S.step===FILL_BACK||S.step===SCREW_BACK) ? 'back' : 'front';
  const active = (S.step===FILL_FRONT||S.step===FILL_BACK) ? S.slot : null;
  const inter  = (S.step===FILL_FRONT||S.step===FILL_BACK);
  const screwMode = (S.step===SCREW_FRONT||S.step===SCREW_BACK);
  document.getElementById('plateTitle').textContent = side==='front'?'Front':'Back';
  document.getElementById('sideTag').textContent = side==='front'?'Slots 01–12':'Slots 13–24';
  renderPlate(document.getElementById('mainPlate'),{side,active,interactive:inter,screwMode});
  document.getElementById('plateLegend').innerHTML = screwMode
    ? `<span><i style="background:#C3CAD1"></i>open</span>
       <span><i style="background:#FBD9DE;border-color:#E41C34"></i>next up</span>
       <span><i style="background:#D8EEE3;border-color:#0F7A52"></i>tightened</span>`
    : `<span><i style="background:#20262D"></i>empty</span>
       <span><i style="background:#C6CDD5"></i>open</span>
       <span><i style="background:#A9D9C1;border-color:#0F7A52"></i>placed</span>
       <span><i style="background:#E41C34;border-color:#E41C34"></i>current slot</span>`;
  document.getElementById('plateHint').innerHTML = screwMode
    ? 'Click a screw to confirm it as tightened.'
    : 'Click a slot to jump straight to it. <span style="white-space:nowrap">Keyboard: <kbd>←</kbd> <kbd>→</kbd></span>';
  renderPlate(document.getElementById('heroPlate'),{side:'front'});
  renderInventory();
  renderChecklist();
}

/* ============================================================
   9) INIT
   ============================================================ */
document.getElementById('alphaBox').innerHTML =
  [...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(c=>
    `<div class="ch ${c==='R'?'alias':(c==='Q'?'neu':(B24.includes(c)?'':'off'))}"
        ${c==='R'?'title="OMDP39 writes R — the plate carries a Q"':''}>${c}</div>`).join('');

document.getElementById('b24').addEventListener('input',readB24);
document.getElementById('bipBulk').addEventListener('input',readBip);
buildWordGrid();

document.addEventListener('keydown',e=>{
  if(S.step!==FILL_FRONT && S.step!==FILL_BACK) return;
  if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
  const front=S.step===FILL_FRONT;
  const min=front?1:13, max=front?12:24;
  if(e.key==='ArrowLeft') setSlot(S.slot-1,min,max);
  if(e.key==='ArrowRight') setSlot(S.slot+1,min,max);
});


/* ============================================================
   11) LIGHT / DARK
   ------------------------------------------------------------
   Without a choice the page follows the system setting. As soon as it is
   switched deliberately, the browser remembers that in a second entry in
   local storage — listed in the privacy policy.
   ============================================================ */
const THEME_KEY = 'omegaseedphrase.theme';

function applyTheme(t){ document.documentElement.setAttribute('data-theme', t); }

function currentTheme(){
  try { const v = localStorage.getItem(THEME_KEY); if(v) return v; } catch(e){}
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function toggleTheme(){
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch(e){}
}

applyTheme(currentTheme());
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  let gesetzt = null;
  try { gesetzt = localStorage.getItem(THEME_KEY); } catch(err){}
  if(!gesetzt) applyTheme(e.matches ? 'dark' : 'light');
});

readB24();


/* ============================================================
   10) NOTICE DIALOGS
   ------------------------------------------------------------
   Two stages on the first visit:
     1. cookie / storage notice   2. clarification of the purpose
   Only after consent is a single key stored. If localStorage is
   unavailable (private mode, blocked), the dialogs still work;
   they simply reappear on every visit.
   ============================================================ */
const LS_KEY = 'omegaseedphrase.hinweise.v1';

function lsGet(){ try { return localStorage.getItem(LS_KEY); } catch(e){ return null; } }
function lsSet(v){ try { localStorage.setItem(LS_KEY, v); } catch(e){ /* never mind */ } }

function show(id, on){
  const el = document.getElementById(id);
  if(el) el.classList.toggle('on', !!on);
  document.body.style.overflow =
    document.querySelector('.overlay.on') ? 'hidden' : '';
}

function ckAccept(){ lsSet('1'); show('ovCookie', false); show('ovPurpose', true); }
function ckDecline(){ show('ovCookie', false); show('ovPurpose', true); }
function puToggle(){ document.getElementById('puBtn').disabled = !document.getElementById('ackBox').checked; }
function puAccept(){ show('ovPurpose', false); }
function showPurpose(force){
  if(force){ event?.preventDefault?.(); }
  document.getElementById('ackBox').checked = true;
  puToggle();
  show('ovPurpose', true);
}

(function initDialogs(){
  if(lsGet() === '1'){ return; }            // already acknowledged
  show('ovCookie', true);
})();


/* ============================================================
   12) MENUE
   ------------------------------------------------------------
   Eine Navigation fuer alle Breiten. Gebaut aus dem, was auf der
   Seite steht: Anker aus der Kopfnavigation, Rechtslinks aus dem
   Fuss. Die Offline-Datei hat keinen Fuss — dort bleibt es bei
   den Abschnitten, und die Sprachwahl entfaellt.
   ============================================================ */
(function siteMenu(){
  var bar = document.querySelector('header .hbar');
  if(!bar || document.getElementById('mdrawer')) return;

  var lang = (document.documentElement.getAttribute('lang') || 'de').slice(0,2);
  var EN = lang === 'en';
  var T = EN
    ? {open:'Open menu', close:'Close menu', nav:'Navigation', legal:'Legal',
       set:'Settings', theme:'Appearance', light:'Light', dark:'Dark'}
    : {open:'Men\u00fc \u00f6ffnen', close:'Men\u00fc schlie\u00dfen', nav:'Navigation',
       legal:'Rechtliches', set:'Einstellungen', theme:'Darstellung',
       light:'Hell', dark:'Dunkel'};

  /* Zeichen statt Bilder: keine zusaetzliche Datei, skaliert mit der Schrift */
  var ICON = {
    grundlagen:'?', basics:'?', kodierung:'\u21dd', encoding:'\u21dd',
    tool:'\u2302', wizard:'\u2713', inventar:'\u25c8', inventory:'\u25c8',
    checkliste:'\u2261', checklist:'\u2261', offline:'\u2193', hinweise:'!',
    'impressum.html':'\u00a7', 'legal-notice.html':'\u00a7',
    'datenschutz.html':'\u25ce', 'privacy.html':'\u25ce',
    'agb.html':'\u2261', 'terms.html':'\u2261',
    'changelog.html':'\u21ba', 'index.html':'\u2302'
  };
  function iconFor(href){
    href = href || '';
    var hash = href.indexOf('#');
    if(hash >= 0){
      var k = href.slice(hash + 1);
      if(ICON[k]) return ICON[k];
    }
    var file = href.split('#')[0].split('/').pop();
    return ICON[file] || '\u00b7';
  }

  var svgOpen = '<svg class="ic-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  var svgClose = '<svg class="ic-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var burger = document.createElement('button');
  burger.className = 'burger';
  burger.type = 'button';
  burger.setAttribute('aria-label', T.open);
  burger.setAttribute('aria-expanded', 'false');
  burger.innerHTML = svgOpen + svgClose;
  document.body.appendChild(burger);

  /* --- Linksammlung ------------------------------------------------ */
  var navLinks = [].slice.call(document.querySelectorAll('header nav.main a'));
  var anchors = navLinks.filter(function(a){ return (a.getAttribute('href')||'').charAt(0) === '#'; });
  var foot = document.querySelector('footer');
  var uls = foot ? foot.querySelectorAll('.fcols ul') : [];
  var grp1, grp2 = [];

  if(anchors.length){
    grp1 = anchors;                                   /* Werkzeugseite */
  } else if(uls.length){
    grp1 = [].slice.call(uls[0].querySelectorAll('a'));
    if(navLinks.length && (navLinks[0].getAttribute('href')||'').indexOf('index.html') === 0){
      grp1 = [navLinks[0]].concat(grp1);              /* Rechtsseite: zurueck zum Tool */
    }
  } else {
    grp1 = navLinks;
  }
  if(uls.length > 1) grp2 = [].slice.call(uls[uls.length - 1].querySelectorAll('a'));

  /* --- Karte ------------------------------------------------------- */
  var drawer = document.createElement('div');
  drawer.className = 'mdrawer';
  drawer.id = 'mdrawer';
  drawer.innerHTML = '<div class="mbg"></div><nav class="mpanel" aria-label="' + T.nav + '"></nav>';
  var panel = drawer.querySelector('.mpanel');

  function group(label, list, sep){
    if(!list.length) return;
    if(sep){
      var s = document.createElement('div');
      s.className = 'msep';
      panel.appendChild(s);
    }
    var h = document.createElement('div');
    h.className = 'mgrp';
    h.textContent = label;
    panel.appendChild(h);
    list.forEach(function(a){
      var c = a.cloneNode(true);
      var href = a.getAttribute('href') || '';
      c.className = 'mlink';
      c.innerHTML = '<span class="ic">' + iconFor(href) + '</span><span>'
        + c.textContent.trim() + '</span>';
      panel.appendChild(c);
    });
  }

  group(T.nav, grp1, false);
  group(T.legal, grp2, true);

  /* --- Darstellung -------------------------------------------------- */
  if(typeof toggleTheme === 'function'){
    var s2 = document.createElement('div');
    s2.className = 'msep';
    panel.appendChild(s2);
    var h2 = document.createElement('div');
    h2.className = 'mgrp';
    h2.textContent = T.set;
    panel.appendChild(h2);

    var row = document.createElement('button');
    row.type = 'button';
    row.className = 'mlink';
    function paint(){
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      row.innerHTML = '<span class="ic">' + (dark ? '\u263e' : '\u2600') + '</span>'
        + '<span>' + T.theme + '</span>'
        + '<span class="val">' + (dark ? T.dark : T.light) + '</span>';
    }
    paint();
    row.addEventListener('click', function(e){
      e.stopPropagation();
      toggleTheme();
      paint();
    });
    panel.appendChild(row);
  }

  /* --- Sprache und Version ------------------------------------------ */
  var sw = document.querySelector('header .langSw');
  var vp = document.querySelector('header .vpill') || document.querySelector('footer .vpill');
  if(sw){
    var other = (sw.textContent || '').trim().toUpperCase();
    var foo = document.createElement('div');
    foo.className = 'mfoot';
    foo.innerHTML =
      '<span class="mlang cur">' + lang.toUpperCase() + '</span>' +
      '<a class="mlang" href="' + sw.getAttribute('href') + '" hreflang="' + other.toLowerCase()
      + '">' + other + '</a>';
    panel.appendChild(foo);
  }
  if(vp){
    var v = document.createElement('div');
    v.className = 'mver';
    v.textContent = vp.textContent.trim();
    panel.appendChild(v);
  }
  document.body.appendChild(drawer);

  /* --- Karte unter dem Knopf ausrichten ------------------------------ */
  function place(){
    var r = burger.getBoundingClientRect();
    var top = Math.round(r.bottom + 12);
    panel.style.left = Math.round(r.left) + 'px';
    panel.style.top = top + 'px';
    /* Die Karte haengt am Knopf — die Hoehe muss daran haengen, sonst
       ragt sie unten aus dem Bild. */
    panel.style.maxHeight = Math.max(220, innerHeight - top - 16) + 'px';
  }

  /* --- Auf und zu ---------------------------------------------------- */
  function open(on){
    if(on) place();
    drawer.classList.toggle('on', on);
    burger.classList.toggle('on', on);
    document.body.classList.toggle('mopen', on);
    burger.setAttribute('aria-expanded', on ? 'true' : 'false');
    burger.setAttribute('aria-label', on ? T.close : T.open);
  }
  burger.addEventListener('click', function(){ open(!drawer.classList.contains('on')); });
  drawer.querySelector('.mbg').addEventListener('click', function(){ open(false); });
  panel.addEventListener('click', function(e){
    if(e.target.closest('a.mlink')) open(false);
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && drawer.classList.contains('on')) open(false);
  });
  addEventListener('resize', function(){ if(drawer.classList.contains('on')) place(); });
  addEventListener('scroll', function(){ if(drawer.classList.contains('on')) place(); }, {passive:true});

  /* --- aktuellen Eintrag markieren ------------------------------------ */
  var links = [].slice.call(panel.querySelectorAll('a.mlink'));
  if(anchors.length && 'IntersectionObserver' in window){
    var byId = {};
    links.forEach(function(l){
      var h = l.getAttribute('href') || '';
      if(h.charAt(0) === '#') byId[h.slice(1)] = l;
    });
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          links.forEach(function(l){ l.classList.remove('cur'); });
          var l = byId[en.target.id];
          if(l) l.classList.add('cur');
        }
      });
    }, {rootMargin:'-45% 0px -50% 0px'});
    Object.keys(byId).forEach(function(id){
      var s = document.getElementById(id);
      if(s) io.observe(s);
    });
  } else {
    var here = location.pathname.split('/').pop() || 'index.html';
    links.forEach(function(l){
      var h = (l.getAttribute('href') || '').split('#')[0];
      if(h && h === here) l.classList.add('cur');
    });
  }
})();
