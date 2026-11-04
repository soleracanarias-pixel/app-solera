// APP SOLERA · base: estado, almacenamiento, API, login, listas, fotos, cola y arranque
// (index.html carga, por este orden: base.js, parte.js, almacen.js, inventario.js, herramientas.js, admin.js; al final, arrancar())
'use strict';

var CFG = window.SOLERA_CONFIG || {};
// número de esta versión de la app (el mismo que VERSION_SERVIDOR de Code.gs: se sube a la vez en cada publicación)
var VERSION_WEB = 33;
var $ = function (id) { return document.getElementById(id); };

// ---------------------------------------------------------------- almacenamiento local (IndexedDB)
var DB = {
  db: null,
  abrir: function () {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('solera', 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        d.createObjectStore('cola', { keyPath: 'id' });
        d.createObjectStore('hist', { keyPath: 'id' });
        d.createObjectStore('kv');
      };
      r.onsuccess = function () { DB.db = r.result; res(); };
      r.onerror = function () { rej(r.error); };
    });
  },
  op: function (store, modo, fn) {
    return new Promise(function (res, rej) {
      var t = DB.db.transaction(store, modo), s = t.objectStore(store), out = fn(s);
      t.oncomplete = function () { res(out ? out.result : undefined); };
      t.onerror = function () { rej(t.error); };
    });
  },
  put: function (store, v, k) { return DB.op(store, 'readwrite', function (s) { return k !== undefined ? s.put(v, k) : s.put(v); }); },
  del: function (store, k) { return DB.op(store, 'readwrite', function (s) { return s.delete(k); }); },
  get: function (store, k) { return DB.op(store, 'readonly', function (s) { return s.get(k); }); },
  all: function (store) { return DB.op(store, 'readonly', function (s) { return s.getAll(); }); }
};

// ---------------------------------------------------------------- estado
var S = { datos: null, usuario: null, firma: null, fotos: [], movFotos: [], pantalla: 'parte', movTipo: 'ENTRADA' };

// avisos dentro de la app (nada de ventanas del navegador): tipo 'ok' (verde) o 'err' (rojo)
function toast(msg, tipo) {
  var t = $('toast'); t.textContent = msg; t.className = 'toast ver' + (tipo ? ' ' + tipo : '');
  clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('ver'); }, tipo ? 4500 : 2600);
}
// pregunta dentro de la app; devuelve una promesa con true (Sí) o false (No)
function preguntar(texto, si, no, conTexto) {
  return new Promise(function (res) {
    $('dlgTxt').textContent = texto; $('dlgSi').textContent = si || 'Sí'; $('dlgNo').textContent = no || 'No';
    var ent = $('dlgEntrada'); ent.value = ''; ent.style.display = conTexto ? '' : 'none'; ent.placeholder = conTexto || '';
    $('dlg').classList.add('ver');
    // con conTexto (el texto de ayuda de la casilla), "Sí" devuelve lo escrito (puede ir vacío) y "No", false
    var fin = function (v) { $('dlg').classList.remove('ver'); res(v && conTexto ? { texto: ent.value.trim() } : v); };
    $('dlgSi').onclick = function () { fin(true); }; $('dlgNo').onclick = function () { fin(false); };
  });
}
// la huella solo en móviles, no en el ordenador
// código del dueño del móvil (kv 'dueno'), que va con cada vale, movimiento y andamios como movil_de
function movilDe() { return S.duenoMovil ? String(S.duenoMovil.codigo) : ''; }
function pintarDueno() {
  var d = S.duenoMovil, u = S.usuario;
  $('duenoMovil').innerHTML = d ? 'Este móvil es de <b>' + esc(d.nombre) + '</b>' + (u && String(u.codigo) !== String(d.codigo) ? ' <button class="btn peq sec" id="esMio">Este móvil es mío</button>' : '') : '';
  var b = document.getElementById('esMio'); if (b) b.onclick = function () { S.duenoMovil = S.usuario; DB.put('kv', S.usuario, 'dueno').then(function () { pintarDueno(); toast('Ahora este móvil es de ' + S.usuario.nombre, 'ok'); }); };
}
function huellaActiva() { return !!(S.datos && S.datos.huella); }   // CONFIG HUELLA = SI
function esMovil() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)); }
// errores de validación junto al campo: en rojo, aviso debajo y scroll hasta él (el toast queda para avisos del servidor)
function limpiarErrores(caja) {
  (caja || document).querySelectorAll('.err-msg').forEach(function (x) { x.remove(); });
  (caja || document).querySelectorAll('.campo-err').forEach(function (x) { x.classList.remove('campo-err'); });
}
function errorEn(el, msg) {
  if (!el) return toast(msg, 'err');
  var det = el.closest('details'); if (det) det.open = true;
  var mf = el.closest('#movForm'); if (mf) mf.classList.add('cambiando');   // si estaba recogido (almacén y persona), se enseña
  var sitio = el.parentNode && el.parentNode.style.position === 'relative' ? el.parentNode : el;
  var viejo = sitio.nextElementSibling; if (viejo && viejo.classList.contains('err-msg')) viejo.remove();
  el.classList.add('campo-err');
  var m = document.createElement('div'); m.className = 'err-msg'; m.textContent = msg;
  sitio.parentNode.insertBefore(m, sitio.nextSibling);
  var quitar = function () { el.classList.remove('campo-err'); m.remove(); el.removeEventListener('input', quitar); el.removeEventListener('change', quitar); el.removeEventListener('click', quitar); };
  el.addEventListener('input', quitar); el.addEventListener('change', quitar); if (el.tagName === 'BUTTON' || el.tagName === 'DIV') el.addEventListener('click', quitar);
  if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
}
// tarjeta verde tras guardar (vale, máquina o andamios): se actualiza con el número cuando llega del servidor
function ocultarGuardado() { var c = document.getElementById('guardado'); if (c) c.style.display = 'none'; }
function mostrarGuardado(o) {
  var c = document.getElementById('guardado');
  if (!c) { c = document.createElement('div'); c.id = 'guardado'; c.className = 'tarjeta guardado'; }
  o.antes.parentNode.insertBefore(c, o.antes);
  c.dataset.id = o.id;
  c.innerHTML = '<div class="g-tit">✅ ' + esc(o.tipo) + ' guardado</div><div class="g-det">' + o.det.filter(Boolean).map(esc).join(' · ') + '</div>' +
    '<div class="g-est" id="guardadoEst">' + (navigator.onLine ? 'Enviando…' : 'Guardado en el móvil · se enviará solo') + '</div>' +
    '<div class="fila"><button class="btn" id="guardadoOtro">Hacer otro</button><button class="btn sec" id="guardadoVolver">Volver</button></div>';
  c.style.display = '';
  $('guardadoOtro').onclick = function () { ocultarGuardado(); o.otro(); };
  $('guardadoVolver').onclick = function () { ocultarGuardado(); window.scrollTo(0, 0); };
  c.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
// devuelve true si la tarjeta de ese envío está a la vista (entonces no hace falta el toast)
function numeroGuardado(id, txt, err) {
  var c = document.getElementById('guardado');
  if (!c || c.dataset.id !== id || c.style.display === 'none') return false;
  $('guardadoEst').textContent = txt; $('guardadoEst').classList.toggle('err', !!err); return true;
}
function lineasTxt(n, que) { return n + ' ' + (que || 'línea') + (n === 1 ? '' : 's'); }
// texto que no está en la lista: hasta 3 parecidos para elegir
function parecidos(txt, lista, n) {
  var ps = normal(txt).split(/[^a-z0-9]+/).filter(function (x) { return x.length >= 2; });
  return lista.map(function (x) {
    var t = normal(x.nombre + ' ' + (x.alias || '') + ' ' + (x.refs || '')), sc = 0;
    ps.forEach(function (w) { if (t.indexOf(w) >= 0) sc += 2; else if (w.length >= 4 && t.indexOf(w.slice(0, 4)) >= 0) sc += 1; else if (w.length >= 3 && t.indexOf(w.slice(0, 3)) >= 0) sc += 0.5; });
    return { x: x, sc: sc };
  }).filter(function (o) { return o.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, n || 3).map(function (o) { return o.x; });
}
// caja: dónde se pinta; sugs: los parecidos; elegir(x); extra: enlace pequeño ({ txt, fn })
function pintarNoLista(caja, sugs, elegir, extra) {
  caja.innerHTML = '<div class="nl-tit">No está en la lista' + (sugs.length ? ': ¿es alguno de estos?' : '.') + '</div>' +
    sugs.map(function (x, i) { return '<button type="button" data-i="' + i + '">' + esc(x.nombre) + '</button>'; }).join('') +
    (extra ? '<a href="#" class="nl-extra">' + esc(extra.txt) + '</a>' : '');
  caja.querySelectorAll('button').forEach(function (b) { b.onclick = function () { caja.innerHTML = ''; elegir(sugs[+b.dataset.i]); }; });
  var a = caja.querySelector('.nl-extra'); if (a) a.onclick = function (e) { e.preventDefault(); caja.innerHTML = ''; extra.fn(); };
}
function aviso(id, msg, tipo) { $(id).innerHTML = msg ? '<div class="aviso ' + (tipo || '') + '">' + msg + '</div>' : ''; }
// "dd/mm/aaaa hh:mm" (S.movCuando, S.dqCuando, S.andCuando) → "aaaa-mm-dd": la fecha es la de cuando se abrió el formulario
function isoDe(cuando) { var m = String(cuando || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : hoyISO(); }
function hoyISO() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function fechaES(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || ''); }
function ahoraES() { var d = new Date(), z = function (n) { return String(n).padStart(2, '0'); }; return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); }
function normal(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function uid() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
// icono SVG propio (los dibujos están en el <svg> de arriba del todo)
function ico(n) { return '<svg class="ico" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function estadoRed() {
  var e = $('estado');
  if (!navigator.onLine) { e.textContent = 'Sin conexión'; e.className = 'estado off'; }
  else { e.textContent = 'Conectado'; e.className = 'estado'; }
}

// ---------------------------------------------------------------- API
function api(action, extra) {
  var body = Object.assign({ action: action, token: CFG.TOKEN }, extra || {});
  return fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
    .then(function (r) { return r.json(); })
    .then(function (j) { if (!j.ok) { var e = new Error(j.error || 'Error del servidor'); e.servidor = true; throw e; } return j; });
}
// el servidor contestó que NO (albarán repetido, material que no existe…): no es falta de cobertura y no se arregla reintentando sola.
// Los atascos del propio servidor (lock, demasiadas llamadas) sí se reintentan solos.
function esFalloServidor(e) {
  return !!(e && e.servidor) && !/lock|timed? ?out|tiempo de espera|too many|invoked|Service|ocupad/i.test(e.message || '');
}
// lo que dijo el servidor, en lenguaje de obra
function motivoLlano(m) {
  m = String(m || '');
  var r = [
    [/Vuelve a entrar con tu PIN|PIN/i, 'Tu PIN ha cambiado o no está guardado en este móvil. Sal, vuelve a entrar con tu PIN y dale a Reintentar.'],
    [/Solo el administrador|Solo Mateo|Solo Gregorio|Solo quien|encargado puede/i, 'Esto solo lo puede hacer otra persona (Mateo o un encargado). Avisa a Mateo.'],
    [/Material no encontrado|Material no válido/i, 'Ese material ya no está en la lista de la app. Avisa a Mateo.'],
    [/Máquina no encontrada|Herramienta no encontrada/i, 'Esa máquina no está en la lista de la app. Avisa a Mateo.'],
    [/EN REPARACI|de BAJA|está AVERIADA|no está averiada|no está en reparación/i, 'La máquina está en un estado que no permite esto (' + m + '). Avisa a Mateo.'],
    [/inventario ya no está abierto|ya está cerrado|No participas/i, 'El inventario ya está cerrado o no te toca. Avisa a Mateo.'],
    [/ajustes solo/i, 'Los ajustes solo se hacen cerrando un inventario.'],
    [/Trabajador no válido/i, 'Tu código no está activo en la app. Avisa a Mateo.'],
    [/sin id|Tipo de vale no válido|Acción desconocida/i, 'La app de este móvil es antigua o el envío está roto. Actualiza la app y dale a Reintentar; si no, avisa a Mateo.']
  ];
  for (var i = 0; i < r.length; i++) if (r[i][0].test(m)) return r[i][1];
  return 'El servidor no lo ha aceptado: ' + m;
}
// apunta el fallo en el pendiente; si es del servidor, deja de reintentarse solo (sale en la banda amarilla)
function fallo(it, e, sinMarca) {
  it.error = e.message; it.errServidor = !sinMarca && esFalloServidor(e); it.intentos = (it.intentos || 0) + 1;
  return DB.put('cola', it);
}

function cargarDatos(silencioso) {
  if (!silencioso) toast('Actualizando listas…');
  return (S.usuario ? DB.get('kv', 'pin-' + S.usuario.codigo) : Promise.resolve(null)).then(function (pin) {
    return api('bootstrap', pin ? { auth: { codigo: S.usuario.codigo, pin: pin } } : {});
  }).then(function (j) {
    j.cargadoEn = ahoraES();   // "Listas actualizadas el …" (y fecha del stock que enseña el inventario)
    S.datos = j; return DB.put('kv', j, 'datos');
  }).then(function () { pintarListas(); pintarListasFecha(); if (S.usuario) pintarRol(); else pintarModo(); if (!silencioso) toast('Listas actualizadas'); })
    .catch(function (e) { if (!silencioso) toast('No se pudo actualizar: ' + e.message); });
}

// ---------------------------------------------------------------- login
var pin = '';
function pintarPin() { $('pinVista').textContent = '•'.repeat(pin.length); }
function montarPinpad() {
  var p = $('pinpad'); p.innerHTML = '';
  ['1','2','3','4','5','6','7','8','9','C','0','⌫'].forEach(function (k) {
    var b = document.createElement('button'); b.textContent = k;
    b.onclick = function () {
      if (k === 'C') pin = ''; else if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k;
      pintarPin();
    };
    p.appendChild(b);
  });
}
function entrar() {
  var codigo = $('loginTrab').value;
  if (!codigo) return aviso('loginAviso', 'Primero pulsa "Actualizar listas" con conexión.', 'err');
  if (pin.length < 4) return aviso('loginAviso', 'Escribe tu PIN de 4 cifras.', 'err');
  var btn = $('btnEntrar'); btn.disabled = true;
  var terminar = function (u) {
    S.usuario = u; S.cambiandoPersona = false; pin = ''; pintarPin();
    // el móvil queda asociado a quien entra la primera vez (su dueño); si entra otro, el dueño no cambia
    // (se cambia en Enviados: "Este móvil es mío"). Se ofrece la huella si el móvil la tiene y aún no está puesta
    DB.get('kv', 'dueno').then(function (d) { if (!d) { S.duenoMovil = u; return DB.put('kv', u, 'dueno'); } }).then(function () { S.dueno = S.duenoMovil || u; return DB.put('kv', u, 'usuario'); }).then(function () { mostrarApp(); ofrecerHuella(u); if (navigator.onLine) cargarDatos(true); });
  };
  var pinIntento = pin;
  api('login', { codigo: codigo, pin: pin }).then(function (j) { DB.put('kv', pinIntento, 'pin-' + codigo); terminar(j.trabajador); })
    .catch(function (e) {
      // sin conexión: se permite entrar si ese usuario ya entró antes en este móvil con el mismo PIN
      DB.get('kv', 'pin-' + codigo).then(function (guardado) {
        if (!navigator.onLine && guardado && guardado === pinIntento) {
          var t = (S.datos.trabajadores || []).filter(function (x) { return String(x.codigo) === String(codigo); })[0];
          terminar({ codigo: t.codigo, nombre: t.nombre, categoria: t.categoria });
        } else { pin = ''; pintarPin(); aviso('loginAviso', e.message + ' — vuelve a escribir el PIN.', 'err'); }
      });
    }).finally(function () { btn.disabled = false; });
}
function salir() {
  S.usuario = null; DB.del('kv', 'usuario');
  if (S.datos) { S.datos.stock = []; S.datos.otros = []; DB.put('kv', S.datos, 'datos'); }   // el stock no se queda en el móvil para el siguiente
  mostrarLogin(); actualizarPend();
}

// ---------------------------------------------------------------- dueño del móvil y huella
// La huella (o cara/patrón) la comprueba el propio móvil (WebAuthn); aquí solo se guarda el id de esa llave.
var huella = {
  disponible: function () {
    return window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; }) : Promise.resolve(false);
  },
  crear: function (u) {
    return navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'SOLERA' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: String(u.codigo), displayName: u.nombre },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000, attestation: 'none' } }).then(function (c) { return Array.prototype.slice.call(new Uint8Array(c.rawId)); });
  },
  comprobar: function (id) {
    return navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: new Uint8Array(id) }], userVerification: 'required', timeout: 60000 } });
  }
};
function ofrecerHuella(u) {
  Promise.all([DB.get('kv', 'huella'), DB.get('kv', 'huellaNo')]).then(function (r) {
    var h = r[0];
    if ((h && String(h.codigo) === String(u.codigo)) || r[1] === String(u.codigo)) return;   // ya puesta, o dijo que no
    if (!esMovil() || !huellaActiva()) return;
    return huella.disponible().then(function (si) {
      if (!si) return;
      return preguntar('¿Activar la huella?\nA partir de ahora entrarás como desbloqueas tu móvil (huella, cara o su PIN), sin el PIN de la app.', 'Activar', 'Ahora no').then(function (ok) {
        if (!ok) return DB.put('kv', String(u.codigo), 'huellaNo');
        return huella.crear(u).then(function (id) { return DB.put('kv', { codigo: u.codigo, id: id }, 'huella'); })
          .then(function () { toast('Huella activada', 'ok'); });
      });
    });
  }).catch(function (e) { toast('No se pudo activar la huella (' + motivo(e) + '). La app seguirá abriéndose sin pedir nada.', 'err'); });
}
function mostrarLogin() {
  $('btnSalir').style.display = 'none'; $('nav').style.display = 'none'; $('quien').textContent = '';
  aviso('loginAviso', '');
  Promise.all([DB.get('kv', 'dueno'), DB.get('kv', 'huella')]).then(function (r) {
    var d = S.cambiandoPersona ? null : r[0], h = r[1];
    S.dueno = d || null;
    $('duenoBloque').style.display = d ? '' : 'none'; $('loginLista').style.display = d ? 'none' : '';
    if (d) { $('duenoNombre').textContent = d.nombre; $('loginTrab').value = String(d.codigo); }
    var conHuella = !!(d && h && String(h.codigo) === String(d.codigo)) && esMovil() && huellaActiva();
    // con huella: se entra con la huella o el PIN del propio móvil; el PIN de la app queda como plan B
    $('huellaBloque').style.display = conHuella ? '' : 'none';
    $('pinBloque').style.display = conHuella ? 'none' : '';
    if (conHuella && !S.huellaPedida) { S.huellaPedida = true; entrarConHuella(true); }   // al abrir la app, la pide sola
  });
  cambiar('login');
}
$('cambiarPersona').onclick = function (e) { e.preventDefault(); S.cambiandoPersona = true; $('loginTrab').value = ''; mostrarLogin(); };
function entrarConHuella(automatico) {
  DB.get('kv', 'huella').then(function (h) { return huella.comprobar(h.id); }).then(function () {
    S.usuario = S.dueno; return DB.put('kv', S.usuario, 'usuario');
  }).then(function () { mostrarApp(); })
    .catch(function (e) {
      if (automatico) return;   // si el móvil no deja pedirla sola, se pulsa el botón
      aviso('loginAviso', 'No se ha podido usar la huella (' + motivo(e) + '). Prueba otra vez o entra con el PIN de la app.', 'err');
      $('pinBloque').style.display = '';
    });
}
$('btnHuella').onclick = function () { entrarConHuella(false); };
$('usarPinApp').onclick = function (e) { e.preventDefault(); $('pinBloque').style.display = ''; };
// sin huella, la app abre directamente (la protege el bloqueo del propio móvil)
$('quitarHuella').onclick = function (e) {
  e.preventDefault();
  preguntar('¿Quitar la huella?\nLa app se abrirá directamente, sin pedir nada, mientras no pulses Salir.', 'Quitar', 'Cancelar').then(function (ok) {
  if (!ok) return;
  DB.del('kv', 'huella').then(function () { return DB.put('kv', String(S.dueno.codigo), 'huellaNo'); }).then(function () { $('huellaBloque').style.display = 'none'; aviso('loginAviso', 'Huella quitada. Entra con tu PIN una vez.', 'ok'); });
  });
};
function motivo(e) { return ((e && e.name) || 'error') + (e && e.message ? ': ' + e.message : ''); }
// rol: admin / encargado / oficial (lo comprueba también el servidor; aquí solo se enseña u oculta)
function rolActual() {
  if (!S.usuario) return '';
  var t = ((S.datos && S.datos.trabajadores) || []).filter(function (x) { return String(x.codigo) === String(S.usuario.codigo); })[0];
  var r = (t && t.rol) || S.usuario.rol || 'trabajador';
  return r === 'oficial' ? 'trabajador' : r;   // 'oficial' es el nombre antiguo del rol
}
// pestaña Parte: si CONFIG PARTES_ACTIVOS = NO, solo el admin (y nunca con ?modo=almacen)
function verPartes() { return !MODO_ALMACEN && (!!(S.datos && S.datos.partes_activos) || rolActual() === 'admin'); }
function pantallaInicio() { return !esMovil() && puedeResumen() ? 'resumen' : verPartes() ? 'parte' : 'almacen'; }   // en el ordenador, el Resumen primero
// "Ver stock": admin y quien tenga ver_stock = SI
function puedeVerStock() {
  if (!S.usuario) return false;
  var t = ((S.datos && S.datos.trabajadores) || []).filter(function (x) { return String(x.codigo) === String(S.usuario.codigo); })[0];
  return rolActual() === 'admin' || !!(t && t.ver_stock);
}
// Resumen: admin, herramientas = SI o inventario = SI
function puedeResumen() {
  if (!S.usuario) return false;
  var t = ((S.datos && S.datos.trabajadores) || []).filter(function (x) { return String(x.codigo) === String(S.usuario.codigo); })[0];
  return rolActual() === 'admin' || !!(t && (t.herramientas || t.inventario));
}
function pintarModo() {
  document.body.classList.toggle('sin-partes', !verPartes());
  document.body.classList.toggle('letra-almacen', MODO_ALMACEN || !(S.datos && S.datos.partes_activos));
}
// pestaña Vales y TRASPASO: admin y encargado (el servidor lo comprueba con código + PIN)
function puedeVales() { var r = rolActual(); return r === 'admin' || r === 'encargado'; }
function pintarRol() {
  var admin = rolActual() === 'admin';
  pintarModo();
  document.body.classList.toggle('ver-stock', puedeVerStock());
  document.body.classList.toggle('ver-resumen', puedeResumen());
  if (!puedeResumen() && S.pantalla === 'resumen') cambiar(pantallaInicio());
  if (!verPartes() && S.pantalla === 'parte') cambiar('almacen');
  document.body.classList.toggle('es-admin', admin);
  document.body.classList.toggle('es-encargado', rolActual() === 'encargado');
  document.body.classList.toggle('puede-inv', verPestanaInventario());   // pestaña Inventario: Mateo, o quien participe en uno abierto
  document.body.classList.toggle('es-mateo', esMateo());
  document.body.classList.toggle('puede-herr', puedeHerr());
  document.body.classList.toggle('es-trabajador', rolActual() === 'trabajador');
  pintarPendientesEan();
  if (!puedeVales() && S.pantalla === 'vales') cambiar(pantallaInicio());
  if (!verPestanaInventario() && S.pantalla === 'inventario') cambiar('almacen');
}
function mostrarApp() {
  pintarRol();
  $('btnSalir').style.display = ''; $('nav').style.display = '';
  $('quien').textContent = S.usuario.nombre;
  cambiar(pantallaInicio()); actualizarPend();
  nuevoParte();
}
function cambiar(p) {
  S.pantalla = p;
  document.querySelectorAll('.pantalla').forEach(function (s) { s.classList.toggle('activa', s.id === 'p-' + p); });
  document.querySelectorAll('nav button').forEach(function (b) { b.classList.toggle('activa', b.dataset.p === p); });
  if (p === 'almacen') pintarStock();
  if (p === 'resumen') cargarResumen();
  if (p === 'enviados') pintarDueno();
  if (p === 'herramientas') { pintarHerr(); pintarHerrGestion(); }
  document.body.classList.toggle('ancho', p === 'vales' || p === 'inventario' || p === 'resumen' || (pantallaAncha() && (p === 'almacen' || p === 'herramientas')));
  if (p === 'inventario') abrirInventario();   // la pantalla de vales, más ancha en el ordenador
  if (p === 'vales' && !S.vales) {   // al abrirla, los últimos 30 días sin pulsar Buscar
    var d = new Date(); d.setDate(d.getDate() - 30);
    $('fDesde').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    $('fHasta').value = hoyISO(); buscarVales();
  }
  if (p === 'enviados') pintarEnviados();
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- listas
function opciones(sel, lista, valor, texto, vacio) {
  sel.innerHTML = (vacio ? '<option value="">' + vacio + '</option>' : '') +
    lista.map(function (x) { return '<option value="' + esc(x[valor]) + '">' + esc(x[texto]) + '</option>'; }).join('');
}
// pie: "web v16 · servidor 16 · esquema 17"; si web y servidor no coinciden, aviso para actualizar
function pintarVersion() {
  var sv = S.datos && S.datos.version_servidor, esq = S.datos && S.datos.esquema;
  var distinto = sv != null && Number(sv) !== VERSION_WEB;
  $('versionPie').innerHTML = 'web v' + VERSION_WEB + ' · servidor ' + (sv != null ? esc(sv) : '?') + ' · esquema ' + (esq != null ? esc(esq) : '?') +
    (distinto ? '<br><a id="actualizaApp">⚠️ actualiza la app</a>' : '');
  if (distinto) $('actualizaApp').onclick = function () {
    // web más antigua: se recarga la página nueva; si el servidor es el antiguo, al recargar se piden las listas otra vez
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update(); }).catch(function () {});
    location.reload();
  };
}
function pintarListas() {
  var d = S.datos || { trabajadores: [], obras: [], materiales: [] };
  pintarVersion();
  opcionesAlmacen('fAlm', $('fAlm').value, '<option value="">Todos</option>');
  // repinta un select conservando lo elegido si esa opción sigue existiendo
  var repintar = function (sel, lista, vacio) {
    var antes = sel.value;
    opciones(sel, lista, 'codigo', 'nombre', vacio);
    if (antes && Array.prototype.some.call(sel.options, function (o) { return o.value === antes; })) sel.value = antes;
  };
  repintar($('loginTrab'), d.trabajadores, '— elige tu nombre —');
  repintar($('obra'), d.obras, '— elige la obra —');
  repintar($('movObra'), d.obras, '— obra —');
  verObra('obra', 'obraTxt'); verObra('movObra', 'movObraTxt');
  // la pestaña Herramientas solo aparece cuando el servidor ya las maneja (Code.gs publicado)
  $('nav').querySelector('[data-p="herramientas"]').style.display = d.herramientas ? '' : 'none';
  pintarRol();
  document.querySelectorAll('#trabs .t-cod').forEach(function (s) { repintar(s, d.trabajadores, '— trabajador —'); });
}

// ---------------------------------------------------------------- fotos
function pintarFotosEn(id, fotos) {
  $(id).innerHTML = fotos.map(function (f, i) { return '<div><img src="' + f + '"><b data-i="' + i + '">×</b></div>'; }).join('');
  $(id).querySelectorAll('b').forEach(function (b) { b.onclick = function () { fotos.splice(+b.dataset.i, 1); pintarFotosEn(id, fotos); }; });
}
function pintarFotos() { pintarFotosEn('fotos', S.fotos); }
function comprimir(file, max) {
  return new Promise(function (res) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var MAX = max || 1280, w = img.width, h = img.height, k = Math.min(1, MAX / Math.max(w, h));
      var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = function () { res(null); };
    img.src = url;
  });
}
$('btnFoto').onclick = function () { $('fotoInput').click(); };
$('fotoInput').onchange = function () {
  var fs = Array.prototype.slice.call(this.files || []); this.value = '';
  Promise.all(fs.map(function (f) { return comprimir(f); })).then(function (r) { r.forEach(function (d) { if (d) S.fotos.push(d); }); pintarFotos(); });
};
$('movBtnFoto').onclick = function () { $('movFotoInput').click(); };
$('movFotoInput').onchange = function () {
  var fs = Array.prototype.slice.call(this.files || []); this.value = '';
  Promise.all(fs.map(function (f) { return comprimir(f); })).then(function (r) { r.forEach(function (d) { if (d) S.movFotos.push(d); }); pintarFotosEn('movFotos', S.movFotos); });
};

// ---------------------------------------------------------------- listas en el móvil (para ir sin cobertura)
// el lector de códigos (ZXing) se guarda en la caché del service worker desde el primer uso, para escanear sin conexión
function guardarLector() {
  if (!window.caches) return Promise.resolve();
  return caches.keys().then(function (ks) {
    var k = ks.filter(function (x) { return /^solera-/.test(x); }).sort().pop() || 'solera-lector';
    return caches.open(k).then(function (c) { return c.match('lib/zxing-0.21.3.min.js').then(function (r) { return r || c.add('lib/zxing-0.21.3.min.js'); }); });
  }).catch(function () {});
}
function pintarListasFecha() {
  var t = S.datos && S.datos.cargadoEn ? 'Listas actualizadas el ' + S.datos.cargadoEn : 'Las listas aún no se han descargado en este móvil';
  document.querySelectorAll('.listasFecha').forEach(function (d) { d.textContent = t; });
}
document.querySelectorAll('.preparar').forEach(function (b) {
  b.onclick = function () {
    if (!navigator.onLine) return toast('Sin conexión: hazlo antes de salir, con cobertura');
    toast('Descargando todo…');
    cargarDatos(true).then(function () {
      // el lector de códigos se guarda también en el móvil
      return guardarLector();
    }).then(function () {
      pintarListasFecha();
      toast(S.datos && S.datos.cargadoEn ? 'Listo para ir sin cobertura (listas del ' + S.datos.cargadoEn + ')' : 'No se pudo descargar: inténtalo otra vez', S.datos && S.datos.cargadoEn ? 'ok' : 'err');
    });
  };
});

// ---------------------------------------------------------------- sincronización
var sincronizando = false;
function actualizarPend() {
  return DB.all('cola').then(function (c) {
    var n = c.length, p = $('pendNum'); p.textContent = n; p.style.display = n ? '' : 'none';
    var malos = c.filter(function (it) { return it.errServidor; }).length, b = $('bandaCola');
    b.innerHTML = ico('aviso') + malos + (malos === 1 ? ' no se ha podido enviar' : ' no se han podido enviar') + ' · toca para ver';
    b.style.display = malos && S.usuario ? '' : 'none';
    document.documentElement.style.setProperty('--alto-cab', document.querySelector('header').offsetHeight + 'px');
    if (S.pantalla === 'enviados') pintarEnviados();
    return n;
  });
}
function sincronizar() {
  if (sincronizando || !navigator.onLine) return Promise.resolve();
  sincronizando = true;
  return DB.all('cola').then(function (cola) {
    // orden: EAN nuevos, luego partes y vales (el inventario), y al final las fotos, una a una
    var prio = function (it) { return it.tipo === 'eans' || it.tipo === 'herrTipoNuevo' ? 0 : it.tipo === 'foto' || it.tipo === 'fotoInv' ? 2 : 1; };
    cola.sort(function (a, b) { return prio(a) - prio(b) || (a.creadoEn < b.creadoEn ? -1 : a.creadoEn > b.creadoEn ? 1 : (a.n || 0) - (b.n || 0)); });
    var p = Promise.resolve(), enviados = 0, pendientes = {};
    cola.forEach(function (it) { if (it.tipo === 'vale') pendientes[it.id] = true; if (it.tipo === 'invEntrega') pendientes['inv:' + it.inventario] = true; });
    cola.forEach(function (it) {
      p = p.then(function () {
        if (it.errServidor) return;   // el servidor ya dijo que no: espera a "Reintentar" o "Avisar a Mateo"
        if (it.tipo === 'foto' && pendientes[it.valeId]) return;   // la foto espera a que llegue su vale
        if (it.tipo === 'fotoInv' && pendientes['inv:' + it.inventario]) return;
        if (it.tipo === 'andamios') return api('andamios', { mov: it.mov }).then(function (j) {
          if (!numeroGuardado(it.id, 'Nº ' + j.numero)) toast('Andamios ' + j.numero + ' guardados', 'ok');
          return DB.put('hist', { id: it.id, tipo: 'vale', fecha: it.fecha, numero: j.numero, resumen: 'Andamios · ' + ({ SALIDA: 'a obra', DEVOLUCION: 'recogidos de obra', ENTRADA: 'entrada en almacén' })[it.mov.tipo] + (it.mov.obra ? ' · ' + it.mov.obra : '') + ' · ' + it.mov.lineas.map(function (l) { return l.cantidad; }).reduce(function (a, b) { return a + b; }, 0) + ' piezas', hora: it.hora, enviadoEn: new Date().toISOString() })
            .then(function () { return DB.del('cola', it.id); });
        }).catch(function (e) {
          if (esFalloServidor(e)) { numeroGuardado(it.id, '⚠️ No se ha guardado: ' + e.message, true); toast('Los andamios no se han guardado: ' + e.message, 'err'); }
          return fallo(it, e);
        });
        if (it.tipo === 'herrTipoNuevo') return api('herrTipoNuevo', { tipo: it.tipoNuevo, auth: it.auth }).then(function () { return DB.del('cola', it.id); })
          .catch(function (e) { return fallo(it, e); });
        if (it.tipo === 'invEntrega') return api('invEntrega', { entrega: it.entrega, auth: it.auth }).then(function () {
          delete pendientes['inv:' + it.inventario]; toast('Inventario entregado: ' + it.nombre, 'ok');
          return DB.put('hist', { id: it.id, tipo: 'vale', fecha: it.fecha, numero: '', resumen: 'Inventario entregado · ' + it.nombre + ' · ' + lineasTxt(it.entrega.lineas.length, 'línea'), hora: it.hora, enviadoEn: new Date().toISOString() })
            .then(function () { return DB.del('cola', it.id); });
        }).catch(function (e) {
          if (esFalloServidor(e)) toast('El inventario no se ha entregado: ' + e.message, 'err');
          return fallo(it, e);
        });
        if (it.tipo === 'fotoInv') return api('fotoInv', { foto: { inventario: it.inventario, lineaId: it.lineaId, fotoId: it.fotoId, dato: it.dato } })
          .then(function () { return DB.del('cola', it.id).then(function () { if (S.pantalla === 'enviados') pintarEnviados(); }); })
          .catch(function (e) { return fallo(it, e, true); });
        if (it.tipo === 'eans') return api('eans', { eans: it.eans, auth: it.auth }).then(function (j) {
          var subidos = it.eans.map(function (e) { return e.ean; });
          S.eansLocal = (S.eansLocal || []).filter(function (e) { return subidos.indexOf(e.ean) < 0; });
          (j.eans || []).forEach(function (r) { if (r.estado === 'otro') toast('El código ' + r.ean + ' ya estaba asociado a otro material: se deja el primero', 'err'); });
          return DB.put('kv', S.eansLocal, 'eansLocal').then(function () { return DB.del('cola', it.id); });
        }).catch(function (e) { return fallo(it, e); });
        if (it.tipo === 'foto') return api('fotoVale', { foto: { valeId: it.valeId, clave: it.clave, fotoId: it.fotoId, dato: it.dato } })
          .then(function () { return DB.del('cola', it.id).then(function () { if (S.pantalla === 'enviados') pintarEnviados(); }); })
          .catch(function (e) { return fallo(it, e, true); });   // las fotos se reintentan solas en la siguiente vuelta
        var llamada = it.tipo === 'parte'
          ? api('crearParte', { parte: it })
          : it.tipo === 'vale'
          ? api('vale', { vale: { id: it.id, tipo: it.valeTipo, obra: it.obra, persona: it.persona, nota: it.nota, fotos: it.fotos || [], albaranArchivo: it.albaranArchivo || null,
              proveedor: it.proveedor, albaran: it.albaran, tipoDoc: it.tipoDoc || '', soloFoto: !!it.soloFoto, lineas: it.lineas, fecha: it.fecha, hora: it.hora, usuario: it.usuario, auth: it.auth || null, almacen: it.almacen || '', almacenDestino: it.almacenDestino || '',
              maquinas: it.maquinas || [], inicio: it.inicio || '', cierre: it.cierre || '', movilDe: it.movilDe || '', origen: it.origen || '' } })
          : api('movimiento', { mov: { id: it.id, tipo: it.movTipo, material: it.material, cantidad: it.cantidad, obra: it.obra, nota: it.nota, fotos: it.fotos || [], fecha: it.fecha, usuario: it.usuario, materialNombre: it.materialNombre, hora: it.hora, clase: it.clase || 'MAT', persona: it.persona || '', tipoHer: it.tipoHer || '', codigoNuevo: it.codigoNuevo || '', almacen: it.almacen || '', fotoPlaca: it.fotoPlaca || '', movilDe: it.movilDe || '' } });
        return llamada.then(function (j) {
          enviados++;
          // confirmación clara con el número
          if (it.tipo === 'vale' && !numeroGuardado(it.id, 'Vale ' + j.numero)) toast((it.valeTipo === 'AJUSTE' ? 'Inventario ' : 'Vale ') + j.numero + ' guardado', 'ok');
          if (it.tipo === 'mov') numeroGuardado(it.id, 'Nº ' + j.numero + (it.tipoHer ? ' · máquina ' + (j.herramienta || it.codigoNuevo) + (j.cambiado ? ' ⚠️ CAMBIADO: tenía ' + it.codigoNuevo + ', corrige el número en la máquina' : '') : ''));
          else if (it.tipo === 'parte') toast('Parte Nº ' + j.numero + ' guardado', 'ok');
          if (it.tipo === 'vale') delete pendientes[it.id];
          var cambiadas = (j.altas || []).filter(function (a) { return a.cambiado; });
          var h = { id: it.id, tipo: it.tipo, fecha: it.fecha, obra: it.obraNombre || it.obra, numero: j.numero || '', usuario: it.usuario || '', pdf_url: j.pdf_url || '', firmado: !!it.firma, enviadoEn: new Date().toISOString(), copia: j.copia_enviada_a || '', copiaError: j.copia_error || '', nFotos: it.nFotos || 0, resumen: it.tipo === 'vale' ? 'Vale · ' + TIPO_VALE[it.valeTipo] + ' · ' + (it.soloFoto ? 'solo foto, pendiente de leer' : it.lineas.length + (it.lineas.length === 1 ? ' línea' : ' líneas')) + (it.obra ? ' · ' + it.obra : (it.proveedor ? ' · ' + it.proveedor : ''))
              + ((j.altas || []).length ? ' · altas: ' + j.altas.map(function (a) { return a.codigo; }).join(', ') : '')
              + (cambiadas.length ? ' · ⚠️ CAMBIADO: ' + cambiadas.map(function (a) { return a.propuesto + ' → ' + a.codigo; }).join(', ') + ' (corrige el número en la máquina)' : '')
              + (j.cambios ? ' · ⚠️ el stock había cambiado: ajuste calculado con el del servidor' : '')
            : it.tipo === 'mov' ? (it.clase === 'HER'
            ? '🔧 ' + (it.movTipo === 'ENTRADA' ? 'ALTA ' : it.movTipo + ' ') + it.materialNombre + (it.tipoHer ? ' → número ' + (j.herramienta || '?') + (j.cambiado ? ' ⚠️ CAMBIADO: tenía ' + it.codigoNuevo + ', corrige el número en la máquina' : '') : '')
            : it.movTipo + ' ' + it.cantidad + ' ' + (it.materialNombre || it.material)) + (it.persona ? ' · ' + it.persona : '') : '', hora: it.hora || '' };
          return DB.put('hist', h).then(function () { return DB.del('cola', it.id); });
        }).catch(function (e) {
          // sin cobertura se queda en cola; si el servidor lo rechaza, se avisa
          if ((it.tipo === 'vale' || it.tipo === 'mov') && esFalloServidor(e)) {
            numeroGuardado(it.id, '⚠️ No se ha guardado: ' + e.message, true);
            toast((it.tipo === 'vale' ? 'El vale' : 'El movimiento') + ' no se ha guardado: ' + e.message, 'err');
          }
          return fallo(it, e);
        });
      });
    });
    return p;
  }).then(function () { sincronizando = false; return actualizarPend(); })
    .then(function (n) { if (n === 0 && navigator.onLine) cargarDatos(true); })
    .catch(function () { sincronizando = false; });
}
$('bandaCola').onclick = function () { cambiar('enviados'); };
$('btnAyuda').onclick = function () { cambiar('ayuda'); };
document.querySelector('.ayuda-indice').onclick = function (e) {
  var a = e.target.closest('a'); if (!a) return; e.preventDefault();
  var t = document.querySelector(a.getAttribute('href')); if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' });
};
// lo que no se pudo enviar: Reintentar (vuelve a la cola) o Avisar a Mateo (queda en VALES como anulado para revisar y sale de la cola)
$('colaLista').onclick = function (e) {
  var b = e.target.closest('[data-cola]'); if (!b) return;
  var id = b.dataset.id;
  DB.get('cola', id).then(function (it) {
    if (!it) return pintarEnviados();
    if (b.dataset.cola === 'reintentar') {
      if (!navigator.onLine) return toast('Sin conexión: se reintentará cuando vuelva');
      return DB.get('kv', 'pin-' + S.usuario.codigo).then(function (pin) {
        if (it.auth && pin && String(it.auth.codigo) === String(S.usuario.codigo)) it.auth.pin = pin;   // por si ha cambiado el PIN
        it.errServidor = false; it.error = '';
        return DB.put('cola', it);
      }).then(function () { toast('Reintentando…'); return actualizarPend(); }).then(sincronizar);
    }
    return preguntar('Avisar a Mateo de que esto no se ha podido enviar.\nQueda apuntado para que lo revise (no cuenta en el stock) y sale de pendientes.', 'Avisar', 'Cancelar', '¿Qué ha pasado? (opcional)').then(function (r) {
      if (!r) return;
      if (!navigator.onLine) return toast('Sin conexión: avisa cuando vuelva la cobertura', 'err');
      // sin fotos ni firma: solo los datos para que Mateo vea qué era
      var item = JSON.parse(JSON.stringify(it, function (k, v) { return ['fotos', 'albaranArchivo', 'firma', 'fotoPlaca', 'dato', 'auth', 'foto'].indexOf(k) >= 0 ? undefined : v; }));
      return authAdmin().then(function (auth) { return api('avisoCola', { auth: auth, item: item, motivo: it.error || '', texto: r.texto }); }).then(function (j) {
        var h = { id: it.id, tipo: 'vale', fecha: it.fecha, numero: j.numero, aviso: true, resumen: 'Avisado a Mateo · ' + tituloCola(it).replace(/<[^>]+>/g, '') + ' · no entra en el stock', hora: it.hora || '', enviadoEn: new Date().toISOString() };
        return DB.put('hist', h).then(function () { return DB.all('cola'); }).then(function (c) {
          var fuera = [it.id].concat(c.filter(function (x) { return (x.tipo === 'foto' && x.valeId === it.id); }).map(function (x) { return x.id; }));
          return Promise.all(fuera.map(function (x) { return DB.del('cola', x); }));
        }).then(function () { toast('Aviso enviado a Mateo · ' + j.numero, 'ok'); actualizarPend(); });
      }).catch(function (er) { toast('No se pudo avisar: ' + er.message, 'err'); });
    });
  });
};
// título de un pendiente en Enviados
function tituloCola(it) {
  if (it.tipo === 'andamios') return 'Andamios · ' + esc(({ SALIDA: 'a obra', DEVOLUCION: 'recogidos de obra', ENTRADA: 'entrada en almacén' })[it.mov.tipo]) + (it.mov.obra ? ' · ' + esc(it.mov.obra) : '');
  if (it.tipo === 'herrTipoNuevo') return 'Tipo de andamio nuevo · ' + esc(it.nombre);
  if (it.tipo === 'invEntrega') return 'Inventario · ' + esc(it.nombre) + ' · He terminado · ' + lineasTxt(it.entrega.lineas.length, 'línea');
  if (it.tipo === 'eans') return 'Código de barras nuevo · ' + esc(it.eans.map(function (e) { return e.ean + (e.marca ? ' · ' + e.marca : ''); }).join(', '));
  if (it.tipo === 'parte') return 'Parte · ' + esc(it.obraNombre);
  if (it.tipo === 'vale') return (it.valeTipo === 'AJUSTE' ? 'Inventario · ' + esc(nombreAlmacen(it.almacen).split(' · ')[0]) + ' · ' + lineasTxt(it.nFotos || 0, 'foto') : 'Vale · ' + TIPO_VALE[it.valeTipo]) + ' · ' + (it.soloFoto ? 'solo foto' : lineasTxt(it.lineas.length, 'línea')) + (it.obra ? ' · ' + esc(it.obra) : '');
  return (it.clase === 'HER' ? 'Herramientas · ' : 'Almacén · ') + esc(it.movTipo) + ' ' + it.cantidad + ' ' + esc(it.materialNombre || it.material);
}
// "Me he equivocado": solo en los vales de almacén de hoy que anotó quien ha entrado (el servidor lo vuelve a comprobar)
function puedeEquivocado(h) {
  return h.tipo === 'vale' && /^A\d+$/.test(String(h.numero || '')) && !h.aviso && !h.revisar && h.fecha === hoyISO() && !!S.usuario && (!h.usuario || h.usuario === S.usuario.nombre);
}
$('histLista').onclick = function (e) {
  var b = e.target.closest('.equivocado'); if (!b) return;
  DB.get('hist', b.dataset.id).then(function (h) {
    if (!h) return;
    preguntar('Vale ' + h.numero + ': ¿qué está mal?\nMateo lo revisa y lo corrige. No se borra nada.', 'Avisar', 'Cancelar', 'Por ejemplo: eran 3 sacos, no 5 · era otra obra (opcional)').then(function (r) {
      if (!r) return;
      if (!navigator.onLine) return toast('Hace falta cobertura', 'err');
      authAdmin().then(function (auth) { return api('valeRevisar', { auth: auth, numero: h.numero, texto: r.texto }); }).then(function () {
        h.revisar = true; return DB.put('hist', h);
      }).then(function () { toast('Avisado: Mateo revisará el vale ' + h.numero, 'ok'); pintarEnviados(); })
        .catch(function (er) { toast('No se pudo avisar: ' + er.message, 'err'); });
    });
  });
};
function pintarEnviados() {
  pintarListasFecha();
  Promise.all([DB.all('cola'), DB.all('hist')]).then(function (r) {
    var c = r[0], hist = {}; r[1].forEach(function (h) { hist[h.id] = h; });
    // las fotos van agrupadas por inventario: "Inventario A0012: 12 de 30 fotos subidas"
    var grupos = {}, fotos = c.filter(function (it) { return it.tipo === 'foto' || it.tipo === 'fotoInv'; });
    fotos.forEach(function (f) { var k = f.tipo === 'fotoInv' ? 'inv:' + f.inventario : f.valeId; (grupos[k] = grupos[k] || []).push(f); });
    var htmlFotos = Object.keys(grupos).map(function (id) {
      var g = grupos[id], total = g[0].total, h = hist[id], err = g.filter(function (f) { return f.error; })[0];
      return '<div class="item"><div><b>' + (g[0].tipo === 'fotoInv' ? esc(g[0].nombre) : 'Inventario ' + (h && h.numero ? esc(h.numero) : '(aún sin enviar)')) + ': ' + (total - g.length) + ' de ' + total + ' fotos subidas</b><small>' +
        (err ? '<span style="color:var(--rojo)">' + esc(err.error) + ' · se reintenta sola</span>' : 'se suben una a una cuando hay cobertura') + '</small></div><span class="chip pend">fotos</span></div>';
    }).join('');
    c = c.filter(function (it) { return it.tipo !== 'foto' && it.tipo !== 'fotoInv'; });
    // primero lo que el servidor no ha aceptado
    c.sort(function (x, y) { return (y.errServidor ? 1 : 0) - (x.errServidor ? 1 : 0); });
    $('colaLista').innerHTML = (c.length || htmlFotos) ? htmlFotos + c.map(function (it) {
      var cuando = fechaES(it.fecha) + (it.hora ? ' ' + esc(it.hora) : '');
      if (it.errServidor) return '<div class="item err-serv"><div><b>' + tituloCola(it) + '</b><small>' + cuando + '<span class="cola-err">⚠️ No se ha podido enviar. ' + esc(motivoLlano(it.error)) + '</span></small></div>' +
        '<div class="cola-bot"><button class="btn peq sec" data-cola="reintentar" data-id="' + esc(it.id) + '">Reintentar</button><button class="btn peq" data-cola="avisar" data-id="' + esc(it.id) + '">Avisar a Mateo</button></div></div>';
      return '<div class="item"><div><b>' + tituloCola(it) + '</b><small>' + cuando + (it.error ? ' · <span style="color:var(--gris)">no ha llegado · se reintenta solo</span>' : '') + '</small></div><span class="chip pend">pendiente</span></div>';
    }).join('') : '<div class="aviso ok">Todo enviado.</div>';
  });
  DB.all('hist').then(function (h) {
    h.sort(function (a, b) { return a.enviadoEn < b.enviadoEn ? 1 : -1; }); h = h.slice(0, 50);
    $('histLista').innerHTML = h.length ? h.map(function (it) {
      if (it.tipo === 'mov' || it.tipo === 'vale') return '<div class="item' + (puedeEquivocado(it) ? ' err-serv' : '') + '"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div><b>' + (it.numero ? 'Nº ' + esc(it.numero) + ' · ' : 'Almacén · ') + esc(it.resumen) + '</b><small>' + fechaES(it.fecha) + (it.hora ? ' ' + esc(it.hora) : '') + '</small></div>' +
        (it.aviso ? '<span class="chip pend">avisado</span>' : it.revisar ? '<span class="chip revisar">REVISAR</span>' : '<span class="chip ok">ok</span>') + '</div>' +
        (puedeEquivocado(it) ? '<div class="cola-bot"><button class="btn peq sec equivocado" data-id="' + esc(it.id) + '">Me he equivocado</button></div>' : '') + '</div>';
      return '<div class="item"><div><b>Nº ' + esc(it.numero) + ' · ' + esc(it.obra) + '</b><small>' + fechaES(it.fecha) + (it.firmado ? ' · firmado' : ' · sin firma') + (it.copia ? ' · copia enviada a ' + esc(it.copia) : '') + (it.copiaError ? ' · <span style="color:var(--rojo)">copia no enviada</span>' : '') + '</small></div>' + (it.pdf_url ? '<a class="chip ok" href="' + esc(it.pdf_url) + '" target="_blank">PDF</a>' : '<span class="chip ok">ok</span>') + '</div>';
    }).join('') : '<div class="aviso">Aún no hay partes enviados desde este móvil.</div>';
  });
}

// ---------------------------------------------------------------- arranque
$('addTrab').onclick = function () { filaTrab(); };
$('addMat').onclick = function () { filaMat(); };
$('btnEntrar').onclick = entrar;
$('btnSalir').onclick = salir;
$('btnCargar').onclick = function () { cargarDatos(); };
$('btnSync').onclick = function () { if (!navigator.onLine) return toast('Sin conexión'); sincronizar(); };
document.querySelectorAll('nav button').forEach(function (b) { b.onclick = function () { cambiar(b.dataset.p); }; });
window.addEventListener('online', function () { estadoRed(); sincronizar(); });
window.addEventListener('offline', estadoRed);
// al pasar de ancho a estrecho (o al revés) en el ordenador, "Ver stock" y las herramientas se repintan como lista o tabla
window.addEventListener('resize', function () { clearTimeout(S.resizeT); S.resizeT = setTimeout(function () { if (S.pantalla === 'almacen') pintarStock(); if (S.pantalla === 'herramientas') pintarHerr(); }, 250); });

// aviso de versión nueva: compara la página publicada con la que se cargó (no recarga sola para no perder lo que se rellena)
var paginaCargada = null;
// index.html y sus ficheros (css/app.css y js/*.js): si cambia cualquiera, hay versión nueva
var FICHEROS_APP = [location.pathname, 'css/app.css', 'js/base.js', 'js/parte.js', 'js/almacen.js', 'js/inventario.js', 'js/herramientas.js', 'js/admin.js'];
function huellaPagina() {
  return Promise.all(FICHEROS_APP.map(function (u) { return fetch(u, { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : null; }); }))
    .then(function (ts) { if (ts.some(function (t) { return t === null; })) return null; var t = ts.join('\n'), h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return t.length + ':' + h; })
    .catch(function () { return null; });
}
function mirarVersion() {
  if (!navigator.onLine) return;
  huellaPagina().then(function (h) {
    if (!h) return;
    if (!paginaCargada) paginaCargada = h;
    else if (h !== paginaCargada) $('nuevaVersion').style.display = '';
  });
}
$('nuevaVersion').onclick = function () { location.reload(); };
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') mirarVersion(); });
setInterval(mirarVersion, 10 * 60000);

// arranque: lo llama index.html cuando ya están cargados todos los ficheros (antes iba al final del único <script>)
function arrancar() {
mirarVersion();

if (MODO_ALMACEN) { document.body.classList.add('modo-almacen'); document.querySelector('header h1').textContent = 'SOLERA · ALMACÉN'; }

DB.abrir().then(function () {
  return Promise.all([DB.get('kv', 'datos'), DB.get('kv', 'usuario'), DB.get('kv', 'eansLocal')]);
}).then(function (r) {
  S.datos = r[0] || null; S.usuario = r[1] || null; S.eansLocal = r[2] || [];
  DB.get('kv', 'dueno').then(function (d) { S.duenoMovil = d || null; });
  pintarListasFecha();
  montarPinpad(); estadoRed(); pintarListas(); actualizarPend(); pintarModo();
  DB.get('kv', 'letraGrande').then(function (v) { $('letraGrande').checked = !!v; document.body.classList.toggle('letra-grande', !!v); });
  // con la huella activada, cada vez que se abre la app se pide la huella (o el PIN)
  DB.get('kv', 'huella').then(function (h) {
    if (S.usuario && S.datos && !(huellaActiva() && h && String(h.codigo) === String(S.usuario.codigo))) mostrarApp(); else mostrarLogin();
  });
  if (navigator.onLine) cargarDatos(true).then(sincronizar);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  if (navigator.onLine) setTimeout(guardarLector, 3000);
  setInterval(function () { if (navigator.onLine) sincronizar(); }, 60000);
});
}
$('letraGrande').onchange = function () { document.body.classList.toggle('letra-grande', this.checked); DB.put('kv', this.checked, 'letraGrande'); };
// − y + de las cantidades (vales, materiales del parte y andamios)
document.addEventListener('click', function (e) {
  var b = e.target.closest('.paso .menos, .paso .mas'); if (!b) return;
  var i = b.parentNode.querySelector('input'), v = +i.value || 0;
  v = b.classList.contains('mas') ? Math.floor(v) + 1 : Math.max(0, Math.ceil(v) - 1);
  i.value = v || (b.classList.contains('mas') ? 1 : ''); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true }));
});
