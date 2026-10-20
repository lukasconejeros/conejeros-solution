/* ══ agenda.js (19-10-2026) — la reserva de la reunión de 45 minutos, compartida por dos páginas:
   · index.html: bajo el video corto, el formulario (nombre, correo y WhatsApp). Al apretar «Ver el video» revisa
     que el número tenga WhatsApp, guarda los datos, avisa a la app Conejeros (contacto) y lleva a /metodologia.
   · metodologia.html: el video largo y debajo el calendario, que reserva con los datos guardados. Si alguien
     entra directo sin datos, primero ve ahí mismo el mismo formulario.
   Lukas, 19-10-2026: «el video más corto al principio para que llenen el formulario, sácale el nombre de la
   clínica y que los lleve a la página del video más largo». Sin clínica se manda empresa:'' y la app
   Conejeros pone el nombre de la persona en el título de la reunión (agenda-web.ts, `quien`).
   Antes todo esto era la ventana «Reservar reunión» (AgendaFlow) dentro de index.html.
   19-10-2026 (2), Lukas: «sácale el puesto de la clínica»: fuera el campo cargo (la reserva manda cargo:'').
   19-10-2026 (3), Lukas: «que no diga ese es tu número, quiero que lo verifique». Se hizo con un código de 4
   números por WhatsApp y (4) el mismo día lo sacó: «es mucho enredo». Queda un solo paso: la app revisa por
   detrás que el número tenga WhatsApp, sin mandarle nada (ver REVISAR QUE EL NÚMERO TENGA WHATSAPP).
   Las horas son las mismas de la app Conejeros (SLOTS_WEB en whatsapp-conejeros/src/lib/agenda-web.ts). ══ */
(function(){
'use strict';

/* La agenda del diagnóstico la lleva la app de Lukas (07-08-2026), no n8n ni Google Calendar.
   GET ?date=YYYY-MM-DD -> {busy:[...]}, POST -> {ok, meet_link}. */
const APP_BASE    = 'https://waly-conejeros.bvil2a.easypanel.host';
const URL_AGENDA  = APP_BASE + '/api/agenda-web';
/* El contacto (19-10-2026, 2): al apretar «Ver el video» la app guarda a la persona, le avisa a Lukas y le programa
   dos WhatsApp (a los 3 minutos y, si no contesta ni reserva, una hora después). Ver avisarContacto(). */
const URL_CONTACTO = APP_BASE + '/api/agenda-web/contacto';

/* Dónde quedan los datos entre la portada y /metodologia. sessionStorage primero; localStorage de respaldo
   (si la persona abre el link en otra pestaña o vuelve otro día). Nunca van en la URL: el pixel de Meta y
   las estadísticas leen la URL y no deben recibir el nombre, el correo ni el teléfono. */
const CLAVE_DATOS = 'waly_datos_reunion';
const DIAS_RESPALDO = 30;

const SLOTS = [
  {start:'09:00',end:'09:45',label:'9:00 - 9:45 AM'},
  {start:'10:30',end:'11:15',label:'10:30 - 11:15 AM'},
  {start:'12:00',end:'12:45',label:'12:00 - 12:45 PM'},
  {start:'15:00',end:'15:45',label:'3:00 - 3:45 PM'},
  {start:'16:30',end:'17:15',label:'4:30 - 5:15 PM'},
  {start:'18:00',end:'18:45',label:'6:00 - 6:45 PM'}
];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DOW    = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

/* ─── Correos de mentira ─── */
const FAKE_DOMAINS = new Set([
  'yopmail.com','mailinator.com','tempmail.com','guerrillamail.com','10minutemail.com',
  'throwam.com','trashmail.com','fakeinbox.com','sharklasers.com','grr.la','spam4.me',
  'dispostable.com','maildrop.cc','mailnull.com','discard.email','wegwerfmail.de',
  'mailnesia.com','throwaway.email','getairmail.com','filzmail.com','trashmail.at',
  'tempr.email','spamfree24.org','getnada.com','trbvm.com','mintemail.com',
  'guerrillamailblock.com','spamgourmet.com','spamgourmet.net','mailbucket.org',
  'trashmail.io','tempinbox.com','throwam.net','mailtemp.info','fakemail.net'
]);
function isValidEmail(email){
  const re=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if(!re.test(email)) return {ok:false,msg:'Ese correo no está bien escrito. Ejemplo: nombre@clinica.cl'};
  const domain=email.split('@')[1].toLowerCase();
  if(FAKE_DOMAINS.has(domain)) return {ok:false,msg:'Por favor usa un correo empresarial real.'};
  return {ok:true};
}

/* ─── Teléfono ─── */
/** Solo los dígitos del número, con el 56 delante: «9 1234 5678» y «+56912345678» dan lo mismo. */
function soloDigitos(bruto){
  let n=(bruto||'').replace(/[^\d]/g,'');
  if(/^9\d{8}$/.test(n)) n='56'+n;
  return n;
}
/** ¿Es un celular chileno de verdad? La misma regla que usa la app Conejeros al recibir la reserva. */
function telefonoChilenoOk(bruto){ return /^569\d{8}$/.test(soloDigitos(bruto)); }
/** «56912345678» → «+56 9 1234 5678», para que la persona lo lea de un vistazo. */
function telefonoBonito(bruto){
  const n=soloDigitos(bruto);
  return `+56 9 ${n.slice(3,7)} ${n.slice(7)}`;
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toDateStr(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return`${y}-${m}-${dd}`;}

/* ─── Revisar los 3 datos (los mismos mensajes de la ventana vieja) ─── */
/** Devuelve la lista de errores: [[campo, mensaje], …]. Vacía = todo bien. */
function erroresDe(d){
  const e=[];
  if((d.nombre||'').trim().length<2) e.push(['nombre','Escribe tu nombre.']);
  const email=(d.email||'').trim();
  if(!email) e.push(['email','Escribe tu correo.']);
  else{const r=isValidEmail(email);if(!r.ok)e.push(['email',r.msg]);}
  const tel=(d.tel||'').trim();
  if(!tel) e.push(['tel','Escribe tu WhatsApp.']);
  else if(!telefonoChilenoOk(tel)) e.push(['tel','Ese número no es un celular chileno. Son 9 dígitos y parte con 9: +56 9 1234 5678']);
  return e;
}

/* ─── Guardar y leer los datos ─── */
let enMemoria=null; // por si el navegador no deja guardar (modo privado viejo): al menos sirve en esta página
function limpio(d){ return {nombre:String(d.nombre||'').trim(),email:String(d.email||'').trim(),tel:String(d.tel||'').trim()}; }
function guardarDatos(d){
  const datos=limpio(d);
  enMemoria=datos;
  const txt=JSON.stringify(Object.assign({guardado:Date.now()},datos));
  try{sessionStorage.setItem(CLAVE_DATOS,txt);}catch(e){}
  try{localStorage.setItem(CLAVE_DATOS,txt);}catch(e){}
  return datos;
}
/** Los datos guardados, o null si no hay o están incompletos/malos (entonces se pide el formulario). */
function leerDatos(){
  if(enMemoria) return enMemoria;
  const fuentes=[['session',()=>sessionStorage],['local',()=>localStorage]];
  for(const [tipo,st] of fuentes){
    try{
      const txt=st().getItem(CLAVE_DATOS);
      if(!txt) continue;
      const o=JSON.parse(txt);
      if(tipo==='local'&&o.guardado&&Date.now()-o.guardado>DIAS_RESPALDO*86400000) continue;
      const d=limpio(o);
      if(erroresDe(d).length===0) return d;
    }catch(e){}
  }
  return null;
}

/* ─── Avisar a la app que llegó un contacto (19-10-2026, 2) ───
   Lukas: «cuando responda el formulario unos 3 minutos después le llegue un mensaje…». La app Conejeros guarda
   el contacto y programa los mensajes (whatsapp-conejeros/src/lib/contacto-web.ts). Dos reglas:
   · NUNCA frena la ida al video: se espera como máximo ESPERA_CONTACTO_MS y, conteste o no, se sigue.
   · Una sola vez por número en esta pestaña: dos toques, volver atrás o pasar de la portada a /metodologia no lo
     repiten. Si falló (sin red, la app caída) se puede volver a intentar al confirmar otra vez; la app igual
     descarta un formulario repetido del mismo número. */
const ESPERA_CONTACTO_MS = 2500;
const CLAVE_CONTACTO = 'waly_contacto_avisado';
let avisadosMem = [];
function avisados(){
  try{ const l=JSON.parse(sessionStorage.getItem(CLAVE_CONTACTO)||'[]'); if(Array.isArray(l)) return l; }catch(e){}
  return avisadosMem;
}
function marcarAvisado(tel,si){
  const l=avisados().filter(t=>t!==tel);
  if(si) l.push(tel);
  avisadosMem=l;
  try{sessionStorage.setItem(CLAVE_CONTACTO,JSON.stringify(l));}catch(e){}
}
/** Devuelve una promesa que SIEMPRE se resuelve (true si la app lo recibió) en ESPERA_CONTACTO_MS o menos. */
function avisarContacto(d){
  const tel=soloDigitos(d.tel);
  if(avisados().includes(tel)) return Promise.resolve(true);
  marcarAvisado(tel,true); // antes del fetch: un segundo toque mientras espera no manda otro
  let envio;
  try{
    envio=fetch(URL_CONTACTO,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:d.nombre,email:d.email,whatsapp:d.tel})})
      .then(r=>{ if(!r.ok) marcarAvisado(tel,false); return r.ok; })
      .catch(()=>{ marcarAvisado(tel,false); return false; });
  }catch(e){ marcarAvisado(tel,false); envio=Promise.resolve(false); }
  const tope=new Promise(res=>setTimeout(()=>res(false),ESPERA_CONTACTO_MS));
  return Promise.race([envio,tope]);
}

/* ─── REVISAR QUE EL NÚMERO TENGA WHATSAPP (19-10-2026, 4) ───
   Ese mismo día Lukas sacó el código de 4 números: «no me gusta con un código. Es mucho enredo, tiene que poner su
   correo, su nombre, su número… mucho hueveo». Ahora, al apretar «Ver el video», la app Conejeros le pregunta a
   WhatsApp si ese número tiene cuenta SIN mandarle nada (whatsapp-conejeros, /api/agenda-web/revisar-numero). Tres reglas:
   · si el número no tiene WhatsApp, se le dice ahí mismo, bajo el campo, y no pasa;
   · cualquier otra cosa (la app caída o sin Implementar, el WhatsApp de la app desconectado, topes del día, sin red,
     más de ESPERA_REVISION_MS) deja pasar directo al video: un problema de la app nunca deja afuera a un cliente;
   · un número que ya se revisó en este navegador no se vuelve a revisar (volver atrás, «Cambiar mis datos»).
   Lo que esto NO pilla: un número mal escrito que igual existe (el de otra persona). Era lo que pillaba el código. */
const URL_REVISAR = APP_BASE + '/api/agenda-web/revisar-numero';
const ESPERA_REVISION_MS = 6000; // lo más que la persona ve «Revisando tu WhatsApp…» antes de pasar igual
const CADA_MS            = 700;  // cada cuánto se pregunta cómo va
const CLAVE_VERIFICADOS = 'waly_tel_verificado';
let verificadosMem = [];
function verificados(){
  for(const st of [()=>localStorage,()=>sessionStorage]){
    try{ const l=JSON.parse(st().getItem(CLAVE_VERIFICADOS)||'null'); if(Array.isArray(l)) return l; }catch(e){}
  }
  return verificadosMem;
}
function marcarVerificado(tel){
  const l=verificados().filter(t=>t!==tel); l.push(tel);
  verificadosMem=l;
  const txt=JSON.stringify(l.slice(-5));
  try{localStorage.setItem(CLAVE_VERIFICADOS,txt);}catch(e){}
  try{sessionStorage.setItem(CLAVE_VERIFICADOS,txt);}catch(e){}
}
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
/** fetch que siempre termina: {status, j} o error. Si no contesta en `ms`, se corta. */
function pedirJSON(url,opciones,ms){
  const ctrl=(typeof AbortController==='function')?new AbortController():null;
  const t=setTimeout(()=>{if(ctrl)ctrl.abort();},ms);
  return fetch(url,Object.assign({},opciones,ctrl?{signal:ctrl.signal}:{}))
    .then(r=>r.json().catch(()=>({})).then(j=>({status:r.status,j:j||{}})))
    .then(v=>{clearTimeout(t);return v;},e=>{clearTimeout(t);throw e;});
}
/** 'existe', 'no_existe' o 'no_se_sabe', en ESPERA_REVISION_MS o menos. Nunca falla. */
async function revisarNumero(tel){
  const hasta=Date.now()+ESPERA_REVISION_MS;
  const queda=()=>Math.max(1,hasta-Date.now());
  const leer=e=>e==='verificado'?'existe':(e==='no_existe'?'no_existe':null);
  let j={};
  try{ j=(await pedirJSON(URL_REVISAR,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({whatsapp:tel})},queda())).j||{}; }catch(e){}
  if(j.ok!==true) return 'no_se_sabe';
  if(leer(j.estado)) return leer(j.estado);   // ya se sabía (revisado en las últimas 24 h)
  if(!j.token) return 'no_se_sabe';
  while(hasta-Date.now()>CADA_MS){
    await dormir(CADA_MS);
    let e=null;
    try{ e=(await pedirJSON(`${URL_REVISAR}?token=${encodeURIComponent(j.token)}`,{method:'GET'},queda())).j.estado; }catch(err){}
    if(leer(e)) return leer(e);
    if(e==='fallo'||e==='vencido'||e==='bloqueado') return 'no_se_sabe';
  }
  return 'no_se_sabe';
}

/* ═══ FORMULARIO ═══
   formulario({contenedor, titulo, textoBoton, alConfirmar(datos)})
   Dibuja los 3 campos dentro del contenedor. Al apretar el botón revisa los datos y que el número tenga WhatsApp
   (revisarNumero). Si está todo bien guarda los datos, avisa el contacto a la app (avisarContacto, 2,5 s como máximo)
   y llama a alConfirmar. Un solo paso: sin código y sin «¿Está bien escrito?» (19-10-2026, 4).
   Cada campo lleva su etiqueta arriba (19-10-2026, 5): antes solo tenía el texto gris de adentro, que desaparece
   al escribir y casi no se leía. */
function formulario(op){
  const raiz=op.contenedor;
  const flecha='<i class="fas fa-arrow-right" aria-hidden="true"></i>';
  let textoBoton=op.textoBoton||'Continuar';
  raiz.innerHTML=`
    <div class="ag-titulo" id="agTitulo">${op.titulo||''}</div>
    <form id="agFormDatos" novalidate>
      <label class="ag-etiqueta" for="agNombre">Tu nombre y apellido</label>
      <input class="ag-campo" id="agNombre" type="text" placeholder="Ej: Carolina Rojas" autocomplete="name" maxlength="80">
      <div class="ag-error-msg" id="errNombre" role="alert"></div>
      <label class="ag-etiqueta" for="agEmail">Tu correo</label>
      <input class="ag-campo" id="agEmail" type="email" placeholder="Ej: carolina@tuclinica.cl" autocomplete="email" inputmode="email" maxlength="120">
      <div class="ag-error-msg" id="errEmail" role="alert"></div>
      <label class="ag-etiqueta" for="agTelefono">Tu WhatsApp</label>
      <input class="ag-campo" id="agTelefono" type="tel" placeholder="Ej: 9 1234 5678" autocomplete="tel" inputmode="tel" maxlength="20">
      <div class="ag-error-msg" id="errTelefono" role="alert"></div>
      <button class="ag-boton" id="agStep1Btn" type="submit">${textoBoton} ${flecha}</button>
    </form>
    <p class="ag-privado">🔒 Tus datos son privados y no se compartirán con terceros.</p>`;

  const $=id=>raiz.querySelector('#'+id);
  const CAMPOS={nombre:['agNombre','errNombre'],email:['agEmail','errEmail'],tel:['agTelefono','errTelefono']};

  function datos(){ return {nombre:$('agNombre').value,email:$('agEmail').value,tel:$('agTelefono').value}; }
  function limpiarErrores(){
    Object.values(CAMPOS).forEach(([f,m])=>{$(f).classList.remove('con-error');$(m).classList.remove('show');});
  }
  function errorEn(campo,msg){
    const [f,m]=CAMPOS[campo];
    $(f).classList.add('con-error');const el=$(m);el.textContent=msg;el.classList.add('show');
  }

  /* Mientras revisa, el botón queda tomado y los campos no se pueden cambiar: lo que se revisó es lo que se guarda.
     «vuelta» corta una revisión que quedó esperando si metodologia.html vuelve a abrir el formulario. */
  let vuelta=0, ocupado=false;
  function tomar(si,texto){
    ocupado=si;
    const btn=$('agStep1Btn');
    btn.disabled=si;
    btn.innerHTML=si?`<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ${texto}`:`${textoBoton} ${flecha}`;
    Object.values(CAMPOS).forEach(([f])=>{$(f).readOnly=si;});
  }

  /** «Ver el video»: revisa los datos y que el número tenga WhatsApp (salvo que ya se haya revisado aquí). */
  async function revisar(ev){
    if(ev)ev.preventDefault();
    if(ocupado)return;
    limpiarErrores();
    const d=datos();
    const errores=erroresDe(d);
    errores.forEach(([campo,msg])=>errorEn(campo,msg));
    if(errores.length){$(CAMPOS[errores[0][0]][0]).focus();return;}
    const tel=soloDigitos(d.tel);
    const mi=++vuelta;
    if(!verificados().includes(tel)){
      tomar(true,'Revisando tu WhatsApp…');
      const r=await revisarNumero(tel);
      if(mi!==vuelta)return;
      if(r==='no_existe'){
        tomar(false);
        errorEn('tel','Ese número no tiene WhatsApp. Revisa que esté bien escrito: son 9 dígitos y parte con 9.');
        const t=$('agTelefono');t.focus();if(t.select)t.select();
        return;
      }
      if(r==='existe')marcarVerificado(tel);
    }
    seguir(d);
  }

  /** Datos listos: se guardan, se avisa el contacto a la app y sigue la página que montó el formulario. */
  function seguir(d){
    const guardados=guardarDatos(d);
    tomar(true,'Un momento…');
    avisarContacto(guardados).then(()=>{
      tomar(false);
      if(op.alConfirmar) op.alConfirmar(guardados);
    });
  }
  $('agFormDatos').addEventListener('submit',revisar);

  return {
    /** Rellena los campos (por ejemplo con lo que dejó la persona la vez anterior). */
    rellenar(d){
      if(!d)return;
      $('agNombre').value=d.nombre||'';$('agEmail').value=d.email||'';$('agTelefono').value=d.tel||'';
    },
    /** Pone el foco en el primer campo. */
    enfocar(){ try{$('agNombre').focus({preventScroll:true});}catch(e){} },
    /** Vuelve a dejar el formulario listo para escribir (metodologia.html, «Cambiar mis datos»). */
    mostrarCampos(){ vuelta++;tomar(false);limpiarErrores(); },
    cambiarTextos(t){
      if(t.titulo!=null)$('agTitulo').innerHTML=t.titulo;
      if(t.textoBoton!=null){textoBoton=t.textoBoton;if(!ocupado)$('agStep1Btn').innerHTML=`${textoBoton} ${flecha}`;}
    }
  };
}

/* ═══ CALENDARIO ═══
   calendario({contenedor, datos(), alCambiarDatos(), plan})
   El mismo calendario de la ventana vieja: días hábiles, las 6 horas, las ocupadas que trae el GET y, hoy,
   solo las horas que parten en 1 hora o más. «Confirmar reunión» manda la reserva a la app Conejeros. */
function calendario(op){
  const raiz=op.contenedor;
  const plan=op.plan||'General';
  raiz.innerHTML=`
    <div id="agStep2">
      <div class="agcal-quien" id="agcalQuien"></div>
      <div class="agcal-tz-label" id="agcalTZ">🌐 Cargando zona horaria…</div>
      <div class="agcal-wrap">
        <div>
          <div class="agcal-nav">
            <button class="agcal-arrow" id="agcalPrev" type="button" aria-label="Mes anterior">&#8249;</button>
            <span class="agcal-month-label" id="agcalMonthLabel"></span>
            <button class="agcal-arrow" id="agcalNext" type="button" aria-label="Mes siguiente">&#8250;</button>
          </div>
          <div class="agcal-grid" id="agcalGrid"></div>
        </div>
        <div class="agcal-slots-section">
          <div class="agcal-date-title" id="agcalDateTitle">Elige una fecha</div>
          <div class="agcal-slots-list" id="agcalSlotsList"><p class="agcal-placeholder">👆 Selecciona un día</p></div>
        </div>
      </div>
      <button class="agcal-confirm-btn" id="agcalConfirmBtn" type="button" disabled><i class="fas fa-calendar-check" aria-hidden="true"></i> Confirmar reunión</button>
    </div>
    <div id="agStepFinal" hidden>
      <div class="agcal-success">
        <div class="agcal-success-icon">✅</div>
        <div class="agcal-success-title">¡Reunión agendada!</div>
        <div class="agcal-success-detail" id="agSuccessDetail"></div>
        <a class="ag-volver" href="/"><i class="fas fa-arrow-left" aria-hidden="true"></i> Volver al inicio</a>
      </div>
    </div>`;

  const $=id=>raiz.querySelector('#'+id);
  const now=new Date();
  let calYear=now.getFullYear(), calMonth=now.getMonth(), selDate=null, selSlot=null;
  let busyCache={}, loadingCal=false;

  function setTZ(){
    try{
      const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
      const off=new Date().toLocaleTimeString('es',{timeZoneName:'short'}).split(' ').pop();
      $('agcalTZ').textContent=`🌐 ${tz} (${off})`;
    }catch(e){$('agcalTZ').textContent='🌐 America/Santiago';}
  }
  /** «Te confirmamos la reunión al WhatsApp +56 9 … · Cambiar mis datos» */
  function pintarQuien(){
    const d=op.datos();
    const q=$('agcalQuien');
    if(!d){q.innerHTML='';return;}
    q.innerHTML=`Te confirmamos la reunión al WhatsApp <strong>${esc(telefonoBonito(d.tel))}</strong> · <button class="ag-link" type="button" id="agCambiarDatos">Cambiar mis datos</button>`;
    $('agCambiarDatos').addEventListener('click',()=>{if(op.alCambiarDatos)op.alCambiarDatos();});
  }
  function renderCal(){
    $('agcalMonthLabel').textContent=`${MONTHS[calMonth]} ${calYear}`;
    const today=new Date();today.setHours(0,0,0,0);
    const firstDOW=new Date(calYear,calMonth,1).getDay();
    const startOff=(firstDOW===0)?6:firstDOW-1;
    const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
    let html=DOW.map(d=>`<div class="agcal-dow">${d}</div>`).join('');
    for(let i=0;i<startOff;i++) html+=`<div class="agcal-day empty"></div>`;
    for(let d=1;d<=daysInMonth;d++){
      const date=new Date(calYear,calMonth,d);
      const ds=toDateStr(date);
      const isPast=date<today;
      const isToday=date.getTime()===today.getTime();
      const isWknd=date.getDay()===0||date.getDay()===6;
      let cls='agcal-day';
      if(isPast||isWknd) cls+=' past unavailable'; else cls+=' available';
      if(isToday) cls+=' today';
      if(ds===selDate) cls+=' selected';
      const attr=(!isPast&&!isWknd)?` data-dia="${ds}" role="button" tabindex="0"`:'';
      html+=`<div class="${cls}"${attr}>${d}</div>`;
    }
    $('agcalGrid').innerHTML=html;
  }
  function selectDate(ds){
    selDate=ds;selSlot=null;
    updateConfirmBtn();renderCal();
    const [y,m,d]=ds.split('-').map(Number);
    const label=new Date(y,m-1,d).toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'});
    $('agcalDateTitle').textContent=label.charAt(0).toUpperCase()+label.slice(1);
    loadSlots(ds);
  }
  async function loadSlots(ds){
    if(loadingCal)return;
    loadingCal=true;
    $('agcalSlotsList').innerHTML=`<div class="agcal-spinner-wrap"><div class="agcal-spinner"></div></div>`;
    if(busyCache[ds]!==undefined){loadingCal=false;renderSlots(ds);return;}
    try{
      const res=await fetch(`${URL_AGENDA}?date=${ds}`,{method:'GET'});
      const data=await res.json();
      busyCache[ds]=Array.isArray(data)?data:(data.busy||data.occupied||[]);
    }catch(e){busyCache[ds]=[];}
    loadingCal=false;
    // Si mientras cargaba eligió otro día, se pintan las horas del día que quedó elegido.
    if(selDate&&selDate!==ds){loadSlots(selDate);return;}
    renderSlots(ds);
  }
  /** Hoy solo se ofrecen las horas que parten en 1 hora o más (antes se podía reservar hoy una hora ya pasada). */
  function yaPaso(ds,start){
    const ahora=new Date();
    if(ds!==toDateStr(ahora))return false;
    const [hh,mm]=start.split(':').map(Number);
    return hh*60+mm < ahora.getHours()*60+ahora.getMinutes()+60;
  }
  function renderSlots(ds){
    const busy=busyCache[ds]||[];
    let html='';
    SLOTS.forEach(s=>{
      const isBusy=busy.includes(s.start)||yaPaso(ds,s.start);
      const isSel=s.start===selSlot;
      let cls='agcal-slot';
      if(isBusy) cls+=' slot-busy'; else if(isSel) cls+=' slot-sel';
      const badge=isBusy?`<span class="agcal-slot-badge">Ocupado</span>`:(isSel?`<span class="agcal-slot-badge">✓</span>`:'');
      const attr=isBusy?'':` data-hora="${s.start}" role="button" tabindex="0"`;
      html+=`<div class="${cls}"${attr}><span>${s.label}</span>${badge}</div>`;
    });
    $('agcalSlotsList').innerHTML=html||`<p class="agcal-placeholder">Sin disponibilidad</p>`;
  }
  function selectSlot(start){
    if(!selDate)return;
    if((busyCache[selDate]||[]).includes(start)||yaPaso(selDate,start))return;
    selSlot=start;renderSlots(selDate);updateConfirmBtn();
  }
  function updateConfirmBtn(){ $('agcalConfirmBtn').disabled=!(selDate&&selSlot); }

  /** «Confirmar reunión»: manda la reserva a la app Conejeros con los datos guardados. */
  async function confirm(){
    if(!selDate||!selSlot)return;
    const d=op.datos();
    if(!d){if(op.alCambiarDatos)op.alCambiarDatos();return;}
    const btn=$('agcalConfirmBtn');
    const originalHtml=btn.innerHTML;
    btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Reservando…';
    const slotObj=SLOTS.find(s=>s.start===selSlot);
    const [y,m,dd]=selDate.split('-').map(Number);
    const dateLabel=new Date(y,m-1,dd).toLocaleDateString('es-CL',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    // empresa y cargo van vacíos a propósito (19-10-2026): el formulario ya no pregunta la clínica ni el puesto.
    const payload={type:'agenda_booking',nombre:d.nombre,cargo:'',email:d.email,empresa:'',whatsapp:d.tel,fecha:selDate,fecha_label:dateLabel,hora:selSlot,hora_fin:slotObj?slotObj.end:'',hora_label:slotObj?slotObj.label:selSlot,plan:plan,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};
    try{
      const res=await fetch(URL_AGENDA,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await res.json().catch(()=>({}));
      // La agenda puede rechazar la reserva (hora recién ocupada, datos malos).
      // Sin esto se mostraba "confirmado" aunque no se hubiera agendado nada.
      if(!res.ok||data.ok===false){
        if(res.status===409&&selDate){
          if(!busyCache[selDate])busyCache[selDate]=[];
          if(!busyCache[selDate].includes(selSlot))busyCache[selDate].push(selSlot);
          selSlot=null;renderSlots(selDate);
        }
        btn.innerHTML=originalHtml;
        updateConfirmBtn();
        alert(data.error||'No se pudo reservar esa hora. Elige otra o escríbenos por WhatsApp.');
        return;
      }
      if(!busyCache[selDate])busyCache[selDate]=[];
      busyCache[selDate].push(selSlot);
      const horaTxt=esc(slotObj?slotObj.label:selSlot);
      let detail=`<strong>Fecha:</strong> ${esc(dateLabel)}<br><strong>Hora:</strong> ${horaTxt} (45 minutos)<br><br>`;
      const link=data.meet_link||data.meetLink||data.link;
      if(link){
        detail+=`<strong>Videollamada:</strong> <a href="${esc(link)}" target="_blank" rel="noopener" class="agcal-meet-link">${esc(link)}</a><br><br>`;
        detail+=`Te acabamos de enviar la confirmación con este enlace al WhatsApp <strong>${esc(telefonoBonito(d.tel))}</strong>.`;
      } else {
        detail+=`Te acabamos de enviar la confirmación al WhatsApp <strong>${esc(telefonoBonito(d.tel))}</strong>. Te llamamos por ahí a la hora acordada.`;
      }
      // El servidor avisa cuando la hora quedó guardada pero el WhatsApp no salió.
      if(data.aviso_fallido){
        detail=`<strong>Fecha:</strong> ${esc(dateLabel)}<br><strong>Hora:</strong> ${horaTxt} (45 minutos)<br><br>`
          +`<span class="agcal-aviso-malo">⚠️ Tu hora quedó reservada, pero <strong>no pudimos enviarte el mensaje de WhatsApp</strong>. `
          +`Revisa que tu número esté bien escrito: <strong>${esc(telefonoBonito(d.tel))}</strong>. Si está malo, escríbenos por WhatsApp y lo corregimos.</span>`;
      }
      $('agSuccessDetail').innerHTML=detail;
      btn.innerHTML=originalHtml;
      try{if(window.oTrack)window.oTrack('Schedule',{content_name:plan});}catch(e){}
      $('agStep2').hidden=true;
      $('agStepFinal').hidden=false;
      if(op.alReservar) op.alReservar();
    }catch(e){
      btn.innerHTML=originalHtml;
      updateConfirmBtn();
      alert('Ocurrió un error al reservar. Intenta de nuevo o escríbenos por WhatsApp.');
    }
  }

  // Clics (y Enter/espacio con el teclado) en los días y las horas: un solo escuchador por lista.
  function alActivar(el,fn){
    el.addEventListener('click',fn);
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn(e);}});
  }
  alActivar($('agcalGrid'),e=>{const c=e.target.closest('[data-dia]');if(c)selectDate(c.getAttribute('data-dia'));});
  alActivar($('agcalSlotsList'),e=>{const c=e.target.closest('[data-hora]');if(c)selectSlot(c.getAttribute('data-hora'));});
  $('agcalPrev').addEventListener('click',()=>{calMonth--;if(calMonth<0){calMonth=11;calYear--;}renderCal();});
  $('agcalNext').addEventListener('click',()=>{calMonth++;if(calMonth>11){calMonth=0;calYear++;}renderCal();});
  $('agcalConfirmBtn').addEventListener('click',confirm);

  setTZ();renderCal();pintarQuien();

  return {
    /** Vuelve a leer los datos guardados (después de «Cambiar mis datos»). */
    actualizarDatos: pintarQuien
  };
}

window.WalyAgenda={formulario,calendario,leerDatos,guardarDatos,telefonoBonito};
})();
