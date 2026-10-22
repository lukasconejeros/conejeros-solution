/* ─── CUÁNTO DEL VIDEO VEN (21-10-2026) ───
   Pedido de Lukas antes de prender el anuncio: saber si le dan play, si llegan a la mitad y si llegan al final.
   Lo usan las dos páginas: el video corto de la portada (#landingVideo) y el largo de /metodologia (#metodologiaVideo).

   Cada hito se avisa UNA vez por pestaña a la app Conejeros (POST /api/agenda-web/video), que lo muestra en
   «Formularios». No sale nada de la persona: `visita` es un número al azar de esta pestaña.

   Los dos videos arrancan solos y sin sonido, así que se cuentan dos cosas por separado:
     · play, 25, 50, 75, 100       → segundos que corrió el video (con o sin sonido);
     · sonido, s25, s50, s75, s100 → apretó «Activar sonido» (vuelve al segundo 0) y lo que vio desde ahí.
   Se suman los segundos que de verdad corrieron (saltar con la barra no cuenta) y «100» es llegar al 97 %,
   porque el último cuadro no siempre avisa. */
(function(){
  'use strict';
  /* Modo prueba (21-10-2026, window.WALY_PRUEBA lo decide la página antes del pixel): las visitas de prueba no se
     miden, para que no se mezclen con las de la gente. */
  if(window.WALY_PRUEBA===true)return;
  var URL_VIDEO='https://waly-conejeros.bvil2a.easypanel.host/api/agenda-web/video';
  var VIDEOS={landingVideo:'intro',metodologiaVideo:'metodologia'};
  var CLAVE='waly_visita';
  var visita=null;

  function inventar(){
    var a=new Uint8Array(8),s='';
    try{(window.crypto||window.msCrypto).getRandomValues(a);}catch(e){for(var j=0;j<8;j++)a[j]=Math.floor(Math.random()*256);}
    for(var i=0;i<a.length;i++)s+=(a[i]<16?'0':'')+a[i].toString(16);
    return s;
  }
  /* La misma visita en la portada y en /metodologia (misma pestaña): así se ve quién pasó de un video al otro. */
  function miVisita(){
    if(visita)return visita;
    try{var g=sessionStorage.getItem(CLAVE);if(g&&/^[a-z0-9]{8,32}$/.test(g)){visita=g;return g;}}catch(e){}
    visita=inventar();
    try{sessionStorage.setItem(CLAVE,visita);}catch(e){}
    return visita;
  }
  /* Texto plano y keepalive: el navegador no pregunta permiso antes (sin espera) y el aviso sale aunque la persona
     cierre la pestaña justo ahí. Si la app no contesta, no pasa nada: el video sigue igual. */
  function avisar(video,hito){
    try{
      var p=fetch(URL_VIDEO,{method:'POST',mode:'cors',credentials:'omit',keepalive:true,
        headers:{'Content-Type':'text/plain'},body:JSON.stringify({visita:miVisita(),video:video,hito:hito})});
      if(p&&p.catch)p.catch(function(){});
    }catch(e){}
  }

  function medir(v,video){
    var hechos={},ultimo=null,mudo=0,sonido=0;
    function una(h){if(hechos[h])return;hechos[h]=1;avisar(video,h);}
    function conSonido(){return !v.muted&&v.volume>0;}
    v.addEventListener('playing',function(){una('play');});
    /* El de la portada arranca solo: si ya iba corriendo cuando cargó este archivo, el «playing» ya pasó. */
    if(!v.paused&&v.currentTime>0)una('play');
    v.addEventListener('volumechange',function(){if(conSonido())una('sonido');});
    /* Un salto (la barra, o «Activar sonido», que lo vuelve al 0) no suma segundos. */
    v.addEventListener('seeking',function(){ultimo=null;});
    v.addEventListener('timeupdate',function(){
      var t=v.currentTime,d=v.duration;
      if(ultimo!==null){
        var dt=t-ultimo;
        if(dt>0&&dt<1.5){if(conSonido())sonido+=dt;else mudo+=dt;}
      }
      ultimo=t;
      if(!d||!isFinite(d))return;
      [25,50,75,100].forEach(function(n){
        var meta=d*(n===100?0.97:n/100);
        if(mudo+sonido>=meta)una(String(n));
        if(sonido>=meta)una('s'+n);
      });
    });
  }

  function iniciar(){
    for(var id in VIDEOS){
      var v=document.getElementById(id);
      if(v)medir(v,VIDEOS[id]);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);
  else iniciar();
})();
