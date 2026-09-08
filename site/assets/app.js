
/* ============================================================
   1) KONSTANTEN
   ============================================================ */
/* Zeichensatz der Plättchen (Base24, ohne I, L, O, R). */
const B24 = "0123456789ABCDEFGHJKMNPQ";   // Zeichensatz der Plättchen
/* OMDP39 schreibt an der 24. Stelle ein R, die Plättchen tragen ein Q.
   Beide bezeichnen denselben Wert (23). Eingaben mit R werden deshalb
   angenommen und für die Bestückung auf Q abgebildet. */
const ALIAS = {R:'Q'};
const ALIAS_BACK = {Q:'R'};
const EXCLUDED = "ILO";
const HINT = {I:'1', L:'1', O:'0'};
const toPlate = c => ALIAS[c] || c;                       // OMDP39 -> Plättchen
const toOmdp  = s => s.replace(/Q/g, 'R');                // Plättchen -> OMDP39
/* WORDS kommt aus assets/bip39-en.js */
const WORDIDX = new Map(WORDS.map((w,i)=>[w,i+1]));

/* Geometrie aus den CAD-Zeichnungen (mm) */
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
  sig:null,                                               // Fingerabdruck der Daten
  placed:Array(24).fill(false),                           // fertig bestückte Slots
  checked:Array(24).fill(false),                          // Prüfliste: abgehakte Slots
  screws:{front:Array(5).fill(false), back:Array(5).fill(false)},   // angezogene Schrauben
  finalPass:{front:false, back:false}                     // zweiter Durchgang erledigt
};

/* Anzugsreihenfolge: Mitte zuerst (zentriert), dann die Ecken über Kreuz. */
const SCREW_SEQ = [
  {n:1, pos:'C', label:'Zentralschraube', where:'Mitte',            hint:'nur handfest ansetzen — sie zentriert den Rahmen'},
  {n:2, pos:0,   label:'Ecke links oben',  where:'oben links',      hint:'leicht anziehen'},
  {n:3, pos:3,   label:'Ecke rechts unten',where:'unten rechts',    hint:'diagonal gegenüber — leicht anziehen'},
  {n:4, pos:1,   label:'Ecke rechts oben', where:'oben rechts',     hint:'leicht anziehen'},
  {n:5, pos:2,   label:'Ecke links unten', where:'unten links',     hint:'diagonal gegenüber — leicht anziehen'}
];
const screwXY = s => s.pos==='C' ? G.centerScrew : G.screws[s.pos];

/* Ändern sich die Eingabedaten, ist jeder Fortschritt daran hinfällig. */
function syncSignature(){
  const sig=S.groups.join('|');
  if(sig!==S.sig){
    S.sig=sig;
    S.placed=Array(24).fill(false);
    S.checked=Array(24).fill(false);
  }
}
/* Index der nächsten fälligen Schraube, oder -1 wenn alle sitzen */
const nextScrew = side => S.screws[side].findIndex(v=>!v);

/* Schrittfolge: nach jeder bestückten Seite wird der Rahmen sofort verschraubt,
   damit die Plättchen beim Wenden nicht verrutschen. */
const STEPS = [
  {k:'S1', t:'Vorbereitung'},
  {k:'S2', t:'Zerlegen'},
  {k:'S3', t:'Plättchen sortieren'},
  {k:'S4', t:'Vorderseite 01–12'},
  {k:'S5', t:'Vorderseite verschrauben'},
  {k:'S6', t:'Rückseite 13–24'},
  {k:'S7', t:'Rückseite verschrauben'},
  {k:'S8', t:'Kennzeichnen'},
  {k:'S9', t:'Verifizieren'}
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
      const done=filled && S.placed[n-1];       // Slot bereits bestückt → grün
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
    /* Schrauben mit Anzugsreihenfolge und Status: erledigt / als nächstes / offen */
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

/* Schraube an-/abwählen. Der Reihenfolge halber wird beim Zurücknehmen
   alles danach ebenfalls gelöst — sonst behauptet die Anzeige eine Reihenfolge,
   die so nie stattgefunden hat. */
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

  if(clean.length===0){ msg=`<span class="pill">0 / 96 Zeichen</span>`; ta.className=''; }
  else if(bad.length){
    const hints=bad.map(c=>HINT[c]?`${c} → ${HINT[c]}`:c).join(' · ');
    msg=`<span class="pill err">Ungültig: ${hints}</span>
         <span class="mut small">Der Zeichensatz kennt kein I, L und kein O.</span>`;
    ta.className='bad';
  } else if(clean.length!==96){
    const d=96-clean.length;
    msg=`<span class="pill warn">${clean.length} / 96 Zeichen</span>
         <span class="mut small">${d>0?`noch ${d} Zeichen`:`${-d} Zeichen zu viel`}</span>`;
    ta.className='';
  } else {
    ok=true; ta.className='good';
    msg=`<span class="pill ok">✓ 96 / 96 Zeichen</span><span class="pill">24 Gruppen à 4</span>
         <span class="mut small">≈ ${Math.round(96*Math.log2(24))} Bit</span>`;
  }
  if(aliased && !bad.length)
    msg+=`<span class="pill warn" title="OMDP39 schreibt R, das Plättchen trägt Q">
            R → Q · ${aliased} Zeichen übernommen</span>`;
  st.innerHTML=msg;

  S.valid=ok; S.groups=Array(24).fill(''); S.sources=Array(24).fill('');
  if(ok) for(let i=0;i<24;i++){
    S.groups[i]=clean.slice(i*4,i*4+4);
    S.sources[i]=`Zeichen ${i*4+1}–${i*4+4}`;
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
   4b) 33 WÖRTER -> 96 ZEICHEN
   ------------------------------------------------------------
   Wortposition 1..2048  ->  +1000  ->  1001..3048 (immer 4-stellig)
   33 Werte stumpf aneinander  ->  132 Dezimalziffern
   als eine Zahl gelesen       ->  Basis 24  ->  96 Zeichen

   Dass das aufgeht:  10^132 ~ 2^438,5  <  24^96 ~ 2^440,2
   Der Versatz um 1000 sorgt dafür, dass jeder Wert vier Stellen hat —
   sonst wäre die Kette nicht mehr eindeutig in 33 Blöcke zerlegbar.
   Gerechnet mit BigInt, also exakt und ohne Rundung.
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
  if(n !== 0n) throw new Error('passt nicht in 96 Stellen');
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
  // Modulo-Bias vermeiden: 2048 teilt 2^32 glatt, deshalb ist %2048 hier sauber
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
  if(items.length===0){ st.innerHTML='<span class="pill">0 / 33 Wörter</span>';
    out.style.display='none'; return; }
  if(bad.length){
    st.innerHTML=`<span class="pill err">Nicht in der BIP39-Liste: ${
      bad.slice(0,4).map(b=>b.w).join(', ')}${bad.length>4?' …':''}</span>`;
    out.style.display='none'; return;
  }
  if(items.length!==33){
    st.innerHTML=`<span class="pill warn">${items.length} / 33 Wörter</span>`+
      `<span class="mut small">${items.length<33?`noch ${33-items.length}`:`${items.length-33} zu viel`}</span>`;
    out.style.display='none'; return;
  }

  const pos=items.map(i=>i.pos);
  const {chain, code} = encode33(pos);
  const ok = decode33(code).join(',') === pos.join(',');
  LAST33 = code; btn.disabled=false;

  st.innerHTML=`<span class="pill ok">✓ 33 / 33 Wörter</span>`+
    `<span class="pill">132 Ziffern → 96 Zeichen</span>`+
    `<span class="pill ${ok?'ok':'err'}">Rückprobe ${ok?'OK':'FEHLER'}</span>`;

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
      <table><thead><tr><th class="m">#</th><th>Wort</th>
        <th class="m" style="text-align:right">Position</th>
        <th class="m" style="text-align:right"></th>
        <th class="m" style="text-align:right">Wert</th></tr></thead>
        <tbody>${rows}</tbody></table></div>

    <div class="chainStep"><span class="cn">2</span> aneinandergehängt — 132 Ziffern</div>
    <div class="chainBox">${chain.replace(/(.{66})/g,'$1\n')}</div>

    <div class="chainStep"><span class="cn">3</span> als Zahl zur Basis 24 — 96 Zeichen</div>
    <div class="chainLabel">Schreibweise der Plättchen (mit <b class="mono">Q</b>) — so wird bestückt</div>
    <div class="chainBox accent">${code.replace(/(.{48})/g,'$1\n')}</div>
    ${code.includes('Q')?`
      <div class="chainLabel">Schreibweise in OMDP39 (mit <b class="mono">R</b>) — identischer Wert</div>
      <div class="chainBox">${toOmdp(code).replace(/(.{48})/g,'$1\n')}</div>`:''}

    <div class="chainStep"><span class="cn">4</span> in 24 Gruppen zu 4</div>
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
      <input type="text" id="w${i}" spellcheck="false" autocomplete="off" placeholder="wort">
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
  if(filled===0 && badCount===0) html=`<span class="pill">0 / 24 Wörter</span>`;
  else if(badCount) html=`<span class="pill err">${badCount} Wort(e) nicht in der BIP39-Liste</span>`;
  else if(filled<24) html=`<span class="pill warn">${filled} / 24 Wörter</span>`;
  else{
    const cs=await bip39Checksum(idxs);
    html=`<span class="pill ok">✓ 24 / 24 Wörter</span>`+
      (cs===null?'':cs?`<span class="pill ok">Prüfsumme gültig</span>`
                      :`<span class="pill err">Prüfsumme UNGÜLTIG — Tippfehler?</span>`)+
      `<span class="pill">24 × 4 Zeichen</span>`;
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
  /* Die Schritte sind unterschiedlich hoch. Ohne das hier bleibt das Fenster
     stehen, wo der vorige (längere) Schritt aufhörte — man landet gefühlt
     im nächsten Abschnitt statt im neuen Schritt. */
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

/* Weiterklicken quittiert den aktuellen Slot als bestückt. */
function advanceSlot(min,max){
  S.placed[S.slot-1]=true;
  if(S.slot>=max) goStep(S.step+1); else setSlot(S.slot+1,min,max);
}

function slotNav(min,max){
  const done=S.placed.slice(min-1,max).filter(Boolean).length, total=max-min+1;
  return `<div class="slotNav">
    <button class="btn sm" onclick="setSlot(${S.slot-1},${min},${max})" ${S.slot<=min?'disabled':''}>${
      S.slot<=min?'← Anfang':'← Slot '+String(S.slot-1).padStart(2,'0')}</button>
    <span class="slotCount">${done} / ${total} Slots gesetzt</span>
    <button class="btn sm primary" onclick="advanceSlot(${min},${max})">
      ${S.slot>=max?'Seite fertig →':'Gesetzt · Slot '+String(S.slot+1).padStart(2,'0')+' →'}</button>
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
    <p class="small mut">Lege die Plättchen von <b>links nach rechts</b> in den Kanal — P1 liegt an der
      linken Kante der Rahmenöffnung. Die gravierte Seite zeigt nach oben, lesbar in Richtung der Slot-Nummer.</p>
    <div class="slotDetail">
      <div class="row" style="justify-content:space-between">
        <h4 style="margin:0;font-size:14px">Slot ${String(n).padStart(2,'0')}</h4>
        <div class="row" style="gap:8px">
          <span class="pill">${S.sources[n-1] || (S.mode==='base24'?'—':'Wort '+n)}</span>
          <button class="btn sm ${S.placed[n-1]?'ok':''}" onclick="togglePlaced(${n})">
            ${S.placed[n-1]?'✓ gesetzt':'als gesetzt markieren'}</button>
        </div>
      </div>
      <div class="bigSlot">${tiles}</div>
      ${g?`<p class="tiny mut" style="margin:0">Reihenfolge: ${[...g].map((c,i)=>`P${i+1}=<b>${c}</b>`).join(' · ')}</p>`
         :`<p class="tiny mut" style="margin:0">Noch keine Daten — gib oben im <a href="#tool">Tool</a> deinen Code bzw. deine Wörter ein.</p>`}
      ${slotNav(min,max)}
    </div>
    <div class="note" style="margin-top:18px">
      <b>Kontrolle nach jedem Slot:</b> vier Plättchen, bündig, kein Spalt am rechten Ende. Bleibt Luft,
      fehlt ein Plättchen oder eines liegt schief.
    </div>
  </div>`;
}

/* Rahmen auf dem Body verschrauben — direkt nach jeder bestückten Seite */
function screwStage(side){
  const front = side==='front';
  const cfg = front
    ? {no:5, prev:FILL_FRONT, next:FILL_BACK, frame:'oberen Rahmen', grav:'01–12',
       nextLabel:'Weiter → Rückseite bestücken'}
    : {no:7, prev:FILL_BACK, next:7, frame:'unteren Rahmen', grav:'13–24',
       nextLabel:'Weiter → Kennzeichnen'};

  const st=S.screws[side], nDone=st.filter(Boolean).length, nx=nextScrew(side);
  const allDone = nDone===5 && S.finalPass[side];

  const rows = SCREW_SEQ.map((sc,i)=>{
    const done=st[i], isNext=(i===nx);
    return `<button class="screwRow ${done?'done':''} ${isNext?'next':''}"
        onclick="toggleScrew('${side}',${i})">
      <span class="sn">${done?'✓':sc.n}</span>
      <span class="sl"><b>${sc.label}</b><span class="sh">${sc.where} · ${sc.hint}</span></span>
      <span class="sa">${done?'angezogen':(isNext?'als Nächstes':'offen')}</span>
    </button>`;
  }).join('');

  return `
  <div class="card">
    <h3><span class="num">${cfg.no}</span> ${STEPS[S.step].t}</h3>
    <p class="small mut">Solange der Rahmen lose aufliegt, hält nichts die Plättchen an ihrem Platz.
      Deshalb wird ${front?'die Vorderseite verschraubt, <b>bevor</b> die Platte gewendet wird'
                        :'auch die Rückseite sofort verschraubt'} — nicht erst am Ende.</p>

    <div class="slotDetail">
      <p class="small" style="margin:0 0 12px;color:var(--ink-80)">
        <b>1 · Kontrolle.</b> Alle 12 Kanäle voll, je vier Plättchen bündig, Gravuren lesbar in Richtung
        der Slot-Nummer.<br>
        <b>2 · Rahmen auflegen.</b> Den ${cfg.frame} mit der Gravur
        <span class="mono">${cfg.grav}</span> nach außen — die Fenster deckungsgleich über den Kanälen.
        Die beiden Rahmen sind <b>nicht</b> tauschbar.</p>

      <div class="row" style="justify-content:space-between;margin-bottom:10px">
        <h4 style="margin:0;font-size:14px">3 · Schrauben in dieser Reihenfolge</h4>
        <span class="pill ${nDone===5?'ok':nDone?'warn':''}">${nDone} / 5 angezogen</span>
      </div>
      <div class="screwList">${rows}</div>

      <label class="finalPass ${S.finalPass[side]?'on':''}">
        <input type="checkbox" ${S.finalPass[side]?'checked':''} ${nDone<5?'disabled':''}
               onchange="setFinalPass('${side}',this.checked)">
        <span><b>4 · Zweiter Durchgang.</b> In derselben Reihenfolge final nachziehen, zum Schluss die
          Zentralschraube. Senkköpfe müssen bündig in der Ansenkung sitzen und dürfen nicht überstehen.</span>
      </label>

      <div class="row" style="margin-top:12px;justify-content:space-between">
        <span class="tiny mut">5 · Rütteltest: Platte kippen und schütteln — kein Klappern, kein Wandern.</span>
        <button class="btn sm" onclick="resetScrews('${side}')">Zurücksetzen</button>
      </div>
    </div>

    <div class="note warn" style="margin-top:16px">
      <b>Drehmoment.</b> M2 in Titan verzeiht kein Überdrehen — fingerfest plus eine Achtelumdrehung
      genügt. Ein ausgerissenes Gewinde macht das Gehäuse unbrauchbar, die Platte ist dann nicht mehr
      sicher verschlossen.
    </div>
    ${front?`<div class="note" style="margin-top:12px">
      <b>Erst jetzt wenden.</b> Drehe die Platte um die <u>lange</u> Achse und richte dich danach
      ausschließlich an den gravierten Nummern aus — Slot 13 liegt nicht dort, wo Slot 1 war.
    </div>`:''}

    <div class="row" style="margin-top:16px">
      <button class="btn" onclick="goStep(${cfg.prev})">← Zurück</button>
      <button class="btn ${allDone?'primary':''}" onclick="goStep(${cfg.next})">${cfg.nextLabel}</button>
      ${allDone?'':'<span class="tiny mut">Noch nicht alle Schrauben quittiert</span>'}
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
    <thead><tr><th class="m">Slot</th><th>Quelle</th><th>4 Plättchen</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function stageHTML(){
  switch(S.step){
    case 0: return `
      <div class="card">
        <h3><span class="num">1</span> Vorbereitung</h3>
        <ul class="small" style="padding-left:18px;color:var(--ink-80)">
          <li><b>Air-Gap:</b> Rechner offline, keine Kamera, keine Smart-Devices im Raum.</li>
          <li><b>Arbeitsfläche:</b> hell, matt, mit Rand — Plättchen sind 0,5 mm dünn und springen weit.</li>
          <li><b>Werkzeug:</b> Pinzette mit Kunststoffspitze, Schraubendreher für M2 × 0,4, Lupe.</li>
          <li><b>Teile prüfen:</b> Body, oberer Rahmen (01–12), unterer Rahmen (13–24),
              Senkschrauben M2 × 0,4 (5 je Seite), 96 Plättchen.</li>
          <li><b>Kodierung festlegen:</b> Base24 oder BIP39-Index — steht später nicht mehr zur Debatte.</li>
        </ul>
        <div class="note warn" style="margin-top:14px">
          Nimm für den ersten Durchgang den Demo-Datensatz. Erst wenn der Ablauf sitzt, arbeitest du mit
          echten Daten.
        </div>
        <div class="row" style="margin-top:16px"><button class="btn primary" onclick="goStep(1)">Weiter → Zerlegen</button></div>
      </div>`;

    case 1: return `
      <div class="card">
        <h3><span class="num">2</span> In 24 Gruppen à 4 Zeichen zerlegen</h3>
        <p class="small mut">${S.mode==='base24'
          ? 'Der 96-Zeichen-Code wird strikt von links nach rechts in 24 Blöcke geschnitten. Block 1 → Slot 01, Block 24 → Slot 24.'
          : (S.bipFormat==='index'
             ? 'Jedes Wort wird durch seine Position in der BIP39-Wortliste ersetzt, führend auf vier Ziffern aufgefüllt. Wort 1 → Slot 01.'
             : 'Jedes Wort wird auf seine ersten vier Buchstaben gekürzt — BIP39-Wörter sind darüber eindeutig. Wort 1 → Slot 01.')}</p>
        ${S.valid?'':`<div class="note">Noch keine gültigen Daten. Springe kurz hoch zum <a href="#tool">Tool</a>.</div>`}
        <div style="margin-top:16px">${groupsTable()}</div>
        <div class="row" style="margin-top:16px">
          <button class="btn" onclick="goStep(0)">← Zurück</button>
          <button class="btn primary" onclick="goStep(2)">Weiter → Sortieren</button>
        </div>
      </div>`;

    case 2: return `
      <div class="card">
        <h3><span class="num">3</span> Plättchen sortieren</h3>
        <p class="small mut">Lege pro Zeichen ein kleines Häufchen an — in der Reihenfolge des Zeichensatzes.
          Zähle jedes Häufchen einmal gegen die Stückliste. Zwei Minuten hier sparen dir zwanzig beim
          Fehlersuchen.</p>
        <div id="stageInv" class="inv" style="margin-top:14px"></div>
        <div class="note" style="margin-top:16px">
          <b>Kritische Paare beim Sortieren:</b> ${S.mode==='base24'
            ? '<span class="mono">0 / Q</span> und <span class="mono">0 / D</span>, <span class="mono">8 / B</span> — der Satz enthält bewusst kein I, L und kein O. Ein <span class="mono">R</span> aus dem OMDP39-Code liegt als <span class="mono">Q</span>-Plättchen im Slot.'
            : '<span class="mono">6 / 9</span> — Ziffern-Plättchen sind gedreht mehrdeutig. Immer an der Slot-Nummer ausrichten.'}
        </div>
        <div class="row" style="margin-top:16px">
          <button class="btn" onclick="goStep(1)">← Zurück</button>
          <button class="btn primary" onclick="goStep(3)">Weiter → Vorderseite bestücken</button>
        </div>
      </div>`;

    case FILL_FRONT: return fillStage(1,12);
    case SCREW_FRONT: return screwStage('front');
    case FILL_BACK:  return fillStage(13,24);
    case SCREW_BACK: return screwStage('back');

    case 7: return `
      <div class="card">
        <h3><span class="num">8</span> Kennzeichnen</h3>
        <p class="small mut">Beide Seiten sind bestückt und verschraubt. Bevor die Platte eingelagert wird,
          bekommt sie noch die Angabe, <b>wie</b> ihr Inhalt zu lesen ist.</p>
        <ol class="small" style="padding-left:18px;color:var(--ink-80)">
          <li>Punze oder Gravur auf der Schmalseite:
              <span class="mono">${S.mode==='base24'?'BASE24':'BIP39-IDX'}</span> plus Datum.</li>
          ${S.mode==='base24'?`<li>Enthält die Platte <span class="mono">Q</span>-Plättchen: Sie
              entsprechen dem <span class="mono">R</span> im OMDP39-Code. Ein Vermerk
              <span class="mono">Q=R</span> auf dem Gehäuse erspart späteres Rätselraten.</li>`:''}
          <li>Bei mehreren Platten aus einem OMDP39-Set zusätzlich die Share-Nummer
              (<span class="mono">1/3</span>, <span class="mono">2/3</span> …).</li>
          <li>Platte kippen und schütteln: nichts darf klappern oder wandern.</li>
        </ol>
        <div class="note warn" style="margin-top:14px">
          <b>Ohne diese Angabe ist das Backup ein Rätsel.</b> In fünf Jahren ist nicht mehr erkennbar, ob
          <span class="mono">1020</span> ein Wortindex oder ein Base24-Block ist — und ob das Zeichen
          <span class="mono">Q</span> überhaupt zum verwendeten Satz gehört.
        </div>
        <div class="row" style="margin-top:16px">
          <button class="btn" onclick="goStep(6)">← Zurück</button>
          <button class="btn primary" onclick="goStep(8)">Weiter → Verifizieren</button>
        </div>
      </div>`;

    default: return `
      <div class="card">
        <h3><span class="num">9</span> Verifizieren</h3>
        <p class="small mut">Der letzte Schritt entscheidet, ob das Backup etwas wert ist. Lies die Platte
          <b>rückwärts</b> aus — von der Platte auf Papier, nicht vom Bildschirm auf die Platte.</p>
        <ol class="small" style="padding-left:18px;color:var(--ink-80)">
          <li>Alle 24 Slots ablesen und notieren, ohne auf die Vorlage zu schauen.</li>
          <li>Notat gegen die Prüfliste unten vergleichen — Slot für Slot.</li>
          <li>${S.mode==='base24'
              ? 'Base24-Code in OMDP39 zurückwandeln und den Share verifizieren lassen — dabei jedes abgelesene <span class="mono">Q</span> als <span class="mono">R</span> eingeben.'
              : 'Indizes zurück in Wörter übersetzen und die BIP39-Prüfsumme kontrollieren.'}</li>
          <li>Erst nach erfolgreicher Wiederherstellung in der Wallet gilt das Backup als gültig.</li>
          <li>Notat und Ausdrucke vernichten. Platte einlagern.</li>
        </ol>
        <div class="note" style="margin-top:14px">
          <b>Wiederherstellungstest.</b> Setze die Wallet einmal komplett neu auf und stelle sie
          ausschließlich aus der Platte wieder her. Ein ungetestetes Backup ist kein Backup.
        </div>
        <div class="row" style="margin-top:16px">
          <button class="btn" onclick="goStep(7)">← Zurück</button>
          <a class="btn" href="#checkliste">Zur Prüfliste ↓</a>
        </div>
      </div>`;
  }
}

/* ============================================================
   7) INVENTAR + CHECKLISTE
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
  t.textContent=`${total} / 96 Plättchen`;
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
          aria-label="Slot ${i+1} geprüft" onchange="markRow(${i},this.checked)"></td></tr>`;
  };
  document.getElementById('chkA').innerHTML=Array.from({length:12},(_,i)=>row(i)).join('');
  document.getElementById('chkB').innerHTML=Array.from({length:12},(_,i)=>row(i+12)).join('');
  updateChkCount();
}

/* Zeile abhaken → grün markieren (ohne Full-Render, damit der Fokus bleibt) */
function markRow(i,on){
  S.checked[i]=on;
  document.getElementById('chkrow'+i)?.classList.toggle('done',on);
  updateChkCount();
}

function updateChkCount(){
  const n=S.checked.filter(Boolean).length;
  const el=document.getElementById('chkCount');
  if(el){
    el.textContent=`${n} / 24 geprüft`;
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
  document.getElementById('plateTitle').textContent = side==='front'?'Vorderseite':'Rückseite';
  document.getElementById('sideTag').textContent = side==='front'?'Slots 01–12':'Slots 13–24';
  renderPlate(document.getElementById('mainPlate'),{side,active,interactive:inter,screwMode});
  document.getElementById('plateLegend').innerHTML = screwMode
    ? `<span><i style="background:#C3CAD1"></i>offen</span>
       <span><i style="background:#FBD9DE;border-color:#E41C34"></i>als Nächstes</span>
       <span><i style="background:#D8EEE3;border-color:#0F7A52"></i>angezogen</span>`
    : `<span><i style="background:#20262D"></i>leer</span>
       <span><i style="background:#C6CDD5"></i>offen</span>
       <span><i style="background:#A9D9C1;border-color:#0F7A52"></i>gesetzt</span>
       <span><i style="background:#E41C34;border-color:#E41C34"></i>aktueller Slot</span>`;
  document.getElementById('plateHint').innerHTML = screwMode
    ? 'Klicke eine Schraube an, um sie als angezogen zu quittieren.'
    : 'Klicke einen Slot an, um direkt dorthin zu springen. <span style="white-space:nowrap">Tastatur: <kbd>←</kbd> <kbd>→</kbd></span>';
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
        ${c==='R'?'title="OMDP39 schreibt R — auf der Platte liegt ein Q"':''}>${c}</div>`).join('');

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
   11) HELL / DUNKEL
   ------------------------------------------------------------
   Ohne Auswahl richtet sich die Seite nach der Systemeinstellung.
   Sobald bewusst umgeschaltet wird, merkt sich der Browser das in
   einem zweiten Eintrag im lokalen Speicher — in der
   Datenschutzerklaerung aufgefuehrt.
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
   10) HINWEIS-DIALOGE
   ------------------------------------------------------------
   Zwei Stufen beim ersten Aufruf:
     1. Cookie-/Speicherhinweis  2. Klarstellung zum Zweck des Tools
   Gespeichert wird - nur nach Zustimmung - ein einziger Schluessel.
   Faellt localStorage aus (Privatmodus, gesperrt), laufen die Dialoge
   trotzdem; sie erscheinen dann bei jedem Aufruf erneut.
   ============================================================ */
const LS_KEY = 'omegaseedphrase.hinweise.v1';

function lsGet(){ try { return localStorage.getItem(LS_KEY); } catch(e){ return null; } }
function lsSet(v){ try { localStorage.setItem(LS_KEY, v); } catch(e){ /* egal */ } }

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

(function initDialoge(){
  if(lsGet() === '1'){ return; }            // schon quittiert
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
