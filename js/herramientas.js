// APP SOLERA · herramientas: reparaciones, andamios y ¿Dónde queda una máquina?
// (index.html carga, por este orden: base.js, parte.js, almacen.js, inventario.js, herramientas.js, admin.js; al final, arrancar())
'use strict';

// ---------------------------------------------------------------- herramientas: reparaciones y OK de altas (herramientas = SI)
function puedeHerr() {
  if (!S.usuario) return false;
  var t = ((S.datos && S.datos.trabajadores) || []).filter(function (x) { return String(x.codigo) === String(S.usuario.codigo); })[0];
  return !!(t && t.herramientas);
}
// 📷 en Herramientas: lee el código de la máquina (BAT-01), escrito o en un QR (cuando haya pegatinas)
function esCodigoMaquina(t) { return /^[A-Z]{2,4}-\d{2,}$/i.test(String(t || '').trim()); }
function pintarHerrGestion() {
  if (!puedeHerr()) return;
  var tp = ((S.datos && S.datos.herrTipos) || []).filter(function (t) { return t.estado === 'PENDIENTE'; });
  $('herrTiposPend').innerHTML = tp.length ? '<label>Tipos nuevos pendientes · ' + tp.length + '</label><div class="lista">' + tp.map(function (t) {
    return '<div class="item" data-tipo="' + esc(t.prefijo) + '"><div><b>' + esc(t.nombre) + '</b><div class="fila" style="margin-top:4px"><div style="flex:0 0 80px"><input type="text" class="tpPref" placeholder="Código" maxlength="4"></div>' +
      '<div><input type="text" class="tpNombre" placeholder="Nombre definitivo"></div><button class="btn peq verde tpOk" style="flex:0 0 auto">Aprobar</button></div></div></div>';
  }).join('') + '</div>' : '';
  var pend = herrLocal().filter(function (h) { return h.ok === 'PENDIENTE'; });
  $('herrPendOk').innerHTML = pend.length ? '<label>Máquinas pendientes de OK · ' + pend.length + '</label><div class="lista">' + pend.map(function (h) {
    return '<div class="item" data-ok="' + esc(h.codigo) + '"><div><b>' + esc(h.nombre) + '</b><small>alta de ' + esc(h.quien) + (h.desde ? ' · ' + esc(h.desde) : '') + (h.foto ? ' · <a href="' + esc(h.foto) + '" target="_blank">📷 foto</a>' : '') + '</small>' +
      '<div class="fila" style="margin-top:4px"><div><input type="text" class="motivoRech" placeholder="Motivo si se rechaza"></div><button class="btn peq verde okSi" style="flex:0 0 auto">OK</button><button class="btn peq rojo okNo" style="flex:0 0 auto">Rechazar</button></div></div></div>';
  }).join('') + '</div>' : '';
}
$('herrTiposPend').onclick = function (e) {
  var d = e.target.closest('[data-tipo]'); if (!d || !e.target.classList.contains('tpOk')) return;
  if (!navigator.onLine) return toast('Hace falta cobertura');
  authAdmin().then(function (auth) { return api('herrTipoAprobar', { auth: auth, id: d.dataset.tipo, prefijo: d.querySelector('.tpPref').value.trim(), nombre: d.querySelector('.tpNombre').value.trim() }); })
    .then(function (r) { toast('Tipo aprobado: ' + r.prefijo + ' (' + r.movimientos + ' movimiento/s pasados)', 'ok'); return cargarDatos(true); })
    .then(function () { pintarHerrGestion(); }).catch(function (er) { toast(er.message, 'err'); });
};
$('herrPendOk').onclick = function (e) {
  var d = e.target.closest('[data-ok]'); if (!d) return;
  var si = e.target.classList.contains('okSi'), no = e.target.classList.contains('okNo'); if (!si && !no) return;
  var motivo = d.querySelector('.motivoRech').value.trim();
  if (no && !motivo) return toast('Escribe el motivo del rechazo');
  if (!navigator.onLine) return toast('Hace falta cobertura');
  authAdmin().then(function (auth) { return api('herrOk', { auth: auth, codigo: d.dataset.ok, ok: si, motivo: motivo }); })
    .then(function () { toast(si ? 'Máquina validada' : 'Alta rechazada', 'ok'); return cargarDatos(true); }).then(function () { pintarHerr(); pintarHerrGestion(); })
    .catch(function (er) { toast(er.message, 'err'); });
};
$('btnRepEntregar').onclick = function () {
  var av = herrLocal().filter(function (h) { return h.estado === 'AVERIADA'; });
  $('vueltaForm').style.display = 'none'; $('repResultado').innerHTML = '';
  if (!av.length) return toast('No hay máquinas averiadas');
  $('repMaquinas').innerHTML = av.map(function (h) { return '<label><input type="checkbox" value="' + esc(h.codigo) + '" style="width:22px;height:22px"> ' + esc(h.nombre) + ' — ' + esc(h.averia || '') + '</label>'; }).join('');
  $('repReparador').innerHTML = ((S.datos && S.datos.reparadores) || []).map(function (r) { return '<option>' + esc(r.nombre) + '</option>'; }).join('');
  $('repFecha').value = hoyISO(); S.firmaRecibo = null; $('repFirmaPrev').style.display = 'none';
  $('repForm').style.display = '';
};
$('repCancelar').onclick = function () { $('repForm').style.display = 'none'; };
$('repFirmar').onclick = function () {
  S.firmaPara = function (d) { S.firmaRecibo = d; $('repFirmaPrev').style.display = ''; $('repFirmaPrev').innerHTML = '<img src="' + d + '">'; };
  abrirFirma(); $('firmaObra').textContent = 'Firma del reparador: ' + $('repReparador').value;
};
$('repGuardar').onclick = function () {
  var cods = Array.prototype.slice.call($('repMaquinas').querySelectorAll('input:checked')).map(function (i) { return i.value; });
  if (!cods.length) return toast('Marca las máquinas que se entregan');
  if (!$('repReparador').value) return toast('Falta el reparador (pestaña REPARADORES)');
  if (!navigator.onLine) return toast('Para hacer el recibo hace falta cobertura');
  toast('Haciendo el recibo…');
  authAdmin().then(function (auth) { return api('herrReparar', { auth: auth, codigos: cods, reparador: $('repReparador').value, fecha: $('repFecha').value, firma: S.firmaRecibo || '' }); })
    .then(function (r) {
      S.recibo = r; $('repForm').style.display = 'none';
      $('repResultado').innerHTML = '<div class="aviso ok">Recibo <b>' + esc(r.recibo) + '</b> hecho y guardado en Drive (HERRAMIENTAS/REPARACIONES).</div>' +
        '<button class="btn" id="repCompartir"><svg class="ico"><use href="#i-compartir"/></svg>Compartir PDF</button>' + (r.pdf_url ? '<a class="btn peq sec" style="width:100%;text-align:center;text-decoration:none" href="' + esc(r.pdf_url) + '" target="_blank">Ver en Drive</a>' : '');
      $('repCompartir').onclick = compartirRecibo;
      return cargarDatos(true);
    }).then(function () { pintarHerr(); }).catch(function (er) { toast(er.message, 'err'); });
};
// el recibo no se envía solo: se comparte desde el móvil (WhatsApp, correo…) o se descarga
function compartirRecibo() { compartirPdf(S.recibo.pdf, S.recibo.nombre, 'Recibo ' + S.recibo.recibo); }
// un PDF que manda el servidor (base64): compartir en el móvil o descargar en el ordenador
function compartirPdf(b64, nombreOrig, titulo, soloDescargar) {
  var bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  var nombre = String(nombreOrig).normalize('NFD').replace(/[\u0300-\u036f]/g, '');   // sin tildes: algunos navegadores descartan el nombre
  var f = new File([bytes], nombre, { type: 'application/pdf' });
  if (!soloDescargar && navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], title: titulo }).catch(function () {});
  var a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
// pegatinas (gestores): PDF en Drive (HERRAMIENTAS/PEGATINAS) y se descarga; tamaño en CONFIG PEGATINA_MM
$('btnPegatinas').onclick = function () {
  preguntar('Pegatinas con el QR de cada máquina.\nDéjalo vacío para todas, o escribe códigos o tipos.', 'Hacer PDF', 'Cancelar', 'Todas · o por ejemplo: BAT, RAD-03').then(function (r) {
    if (!r) return;
    if (!navigator.onLine) return toast('Hace falta cobertura', 'err');
    toast('Preparando las pegatinas…');
    authAdmin().then(function (auth) { return api('pegatinas', { auth: auth, filtro: r.texto }); }).then(function (j) {
      toast(j.n + (j.n === 1 ? ' pegatina' : ' pegatinas') + ' de ' + j.tam + ' mm' + (j.pdf_url ? ' · guardadas en Drive' : ''), 'ok');
      compartirPdf(j.pdf, j.nombre, 'Pegatinas', !esMovil());
    }).catch(function (e) { toast('No se pudieron hacer: ' + e.message, 'err'); });
  });
};
$('btnRepVuelta').onclick = function () {
  var en = herrLocal().filter(function (h) { return h.estado === 'EN REPARACION'; });
  $('repForm').style.display = 'none'; $('repResultado').innerHTML = '';
  if (!en.length) return toast('No hay máquinas en reparación');
  $('vuMaquina').innerHTML = en.map(function (h) { return '<option value="' + esc(h.codigo) + '">' + esc(h.nombre) + ' · ' + esc(h.reparador) + ' · ' + esc(h.recibo) + '</option>'; }).join('');
  almacenGuardado().then(function (c) { opcionesAlmacen('vuAlmacen', c); });
  $('vuResultado').value = 'REPARADA'; $('vuAlmBloque').style.display = ''; $('vuNota').value = '';
  $('vueltaForm').style.display = '';
};
$('vuResultado').onchange = function () { $('vuAlmBloque').style.display = this.value === 'BAJA' ? 'none' : ''; };
$('vuCancelar').onclick = function () { $('vueltaForm').style.display = 'none'; };
$('vuGuardar').onclick = function () {
  if (!navigator.onLine) return toast('Hace falta cobertura');
  authAdmin().then(function (auth) { return api('herrVuelta', { auth: auth, codigo: $('vuMaquina').value, resultado: $('vuResultado').value, almacen: $('vuAlmacen').value, nota: $('vuNota').value.trim() }); })
    .then(function () { toast($('vuResultado').value === 'BAJA' ? 'Máquina dada de BAJA' : 'Máquina disponible otra vez', 'ok'); $('vueltaForm').style.display = 'none'; return cargarDatos(true); })
    .then(function () { pintarHerr(); }).catch(function (er) { toast(er.message, 'err'); });
};
$('btnEntrada').onclick = function () { abrirMov('ENTRADA'); };
$('btnTraspaso').onclick = function () { abrirMov('TRASPASO'); };
$('btnSalida').onclick = function () { abrirMov('SALIDA'); };
$('btnDevolucion').onclick = function () { abrirMov('DEVOLUCION'); };
$('btnRecuperado').onclick = function () { abrirMov('RECUPERADO'); };
// ---------------------------------------------------------------- andamios (tipos de CANTIDAD)
S.andFotos = [];
function andamiosLocal() { return (S.datos && S.datos.andamios) || []; }
function pintarAndLista() {
  var modo = $('andModo').value, alm = $('andAlmacen').value, obra = $('andObra').value ? $('andObra').options[$('andObra').selectedIndex].text : '';
  var antes = {}; $('andLista').querySelectorAll('input').forEach(function (i) { antes[i.dataset.p] = i.value; });
  var tipos = ((S.datos && S.datos.herrTipos) || []).filter(function (t) { return t.control === 'CANTIDAD'; });
  $('andLista').innerHTML = tipos.map(function (t) {
    var a = andamiosLocal().filter(function (x) { return x.prefijo === t.prefijo; })[0] || { porObra: {}, porAlmacen: {} };
    var hay = modo === 'DEVOLUCION' ? (obra ? 'en la obra: ' + (a.porObra[obra] || 0) : '') : modo === 'SALIDA' ? 'en el almacén: ' + (a.porAlmacen[alm] || 0) : '';
    return '<div class="and-fila"><span>' + esc(t.nombre) + (hay ? ' <small>· ' + hay + '</small>' : '') + '</span><div class="paso"><button type="button" class="menos" aria-label="menos">−</button><input type="number" inputmode="numeric" min="0" step="1" data-p="' + esc(t.prefijo) + '" value="' + esc(antes[t.prefijo] || '') + '" placeholder="0"><button type="button" class="mas" aria-label="más">+</button></div></div>';
  }).join('') || '<div class="ayuda">No hay tipos de pieza: pulsa "+ Tipo de pieza nuevo".</div>';
}
function pintarAndModo() {
  var modo = $('andModo').value;
  $('andObraBloque').style.display = modo === 'ENTRADA' ? 'none' : '';
  $('andAlmLabel').textContent = modo === 'SALIDA' ? 'Sale del almacén' : 'Se deja en el almacén';
  $('andPersonaLabel').textContent = modo === 'DEVOLUCION' ? '¿Quién lo recoge?' : '¿Quién lo lleva?';
  pintarAndLista();
}
$('btnAndamios').onclick = function () {
  ocultarGuardado(); limpiarErrores($('andForm'));
  $('dqForm').style.display = 'none'; $('andForm').style.display = '';
  $('andTipoNuevo').style.display = puedeHerr() ? '' : 'none';
  $('andModo').value = 'SALIDA'; $('andObra').value = ''; $('andObraTxt').value = ''; $('andPersona').value = S.usuario ? S.usuario.nombre : '';
  $('andLista').innerHTML = ''; S.andFotos = []; pintarFotosEn('andFotos', S.andFotos); S.andCuando = ahoraES();
  $('andCuando').textContent = 'Fecha y hora: ' + S.andCuando;
  opciones($('andObra'), obras(), 'codigo', 'nombre', '— obra —');
  almacenGuardado().then(function (c) { opcionesAlmacen('andAlmacen', c); pintarAndModo(); });
};
$('andModo').onchange = pintarAndModo; $('andAlmacen').onchange = pintarAndLista;
buscador($('andObraTxt'), $('andObraSugs'), obras, function (o) { $('andObra').value = o ? String(o.codigo) : ''; pintarAndLista(); });
buscador($('andPersona'), $('andPersonaSugs'), function () { return (S.datos && S.datos.trabajadores) || []; }, function () {});
$('andTipoNuevo').onclick = abrirTipoNuevo;   // solo gestores (herramientas = SI): a los trabajadores no les sale
$('andFoto').onclick = function () { $('andFotoInput').click(); };
$('andFotoInput').onchange = function () { var f = this.files && this.files[0]; this.value = ''; if (f) comprimir(f).then(function (d) { if (d) { S.andFotos = [d]; pintarFotosEn('andFotos', S.andFotos); } }); };
$('andCancelar').onclick = function () { $('andForm').style.display = 'none'; };
$('andGuardar').onclick = function () {
  var modo = $('andModo').value, lineas = [];
  $('andLista').querySelectorAll('input').forEach(function (i) { var q = +i.value || 0; if (q > 0) lineas.push({ prefijo: i.dataset.p, cantidad: q }); });
  limpiarErrores($('andForm'));
  if (!lineas.length) return errorEn($('andLista').querySelector('input') || $('andLista'), 'Pon cuántas piezas de algún tipo');
  if (modo !== 'ENTRADA' && !$('andObra').value) return errorEn($('andObraTxt'), 'Elige la obra');
  if (!S.andFotos.length) return errorEn($('andFoto'), 'Haz la foto general del conjunto');
  var obra = modo === 'ENTRADA' ? '' : $('andObra').options[$('andObra').selectedIndex].text, alm = $('andAlmacen').value;
  var mov = { id: uid(), tipo: modo, obra: obra, almacen: alm, persona: modo === 'ENTRADA' ? '' : ($('andPersona').value.trim() || S.usuario.nombre), usuario: S.usuario.nombre,
    lineas: lineas, foto: S.andFotos[0], fecha: isoDe(S.andCuando), hora: S.andCuando.slice(11), movilDe: movilDe() };
  recordarAlmacen(alm);
  // cantidades del móvil hasta que llegue lo del servidor
  lineas.forEach(function (l) {
    var a = andamiosLocal().filter(function (x) { return x.prefijo === l.prefijo; })[0]; if (!a) return;
    var s = function (o, k, v) { if (k) o[k] = (o[k] || 0) + v; };
    if (modo === 'SALIDA') { s(a.porAlmacen, alm, -l.cantidad); s(a.porObra, obra, l.cantidad); }
    else if (modo === 'DEVOLUCION') { s(a.porObra, obra, -l.cantidad); s(a.porAlmacen, alm, l.cantidad); }
    else s(a.porAlmacen, alm, l.cantidad);
  });
  DB.put('kv', S.datos, 'datos');
  DB.put('cola', { id: mov.id, tipo: 'andamios', mov: mov, fecha: mov.fecha, hora: mov.hora, creadoEn: new Date().toISOString() }).then(function () {
    $('andForm').style.display = 'none'; pintarHerr(); actualizarPend();
    var piezas = lineas.reduce(function (a, l) { return a + l.cantidad; }, 0);
    mostrarGuardado({ id: mov.id, antes: $('andForm'), tipo: 'ANDAMIOS ' + ({ SALIDA: 'A OBRA', DEVOLUCION: 'RECOGIDOS', ENTRADA: 'ENTRADA' })[modo], det: [lineasTxt(lineas.length), lineasTxt(piezas, 'pieza'), obra || nombreAlmacen(alm).split(' · ')[0]], otro: function () { $('btnAndamios').onclick(); } });
    if (navigator.onLine) sincronizar();
  });
};
// Mis herramientas: las que tengo a mi cargo (CON PERSONA); "¿Dónde queda?" abre el flujo con esa máquina ya puesta
function pintarMisHerr() {
  var yo = S.usuario ? S.usuario.nombre : '', mias = herrLocal().filter(function (h) { return h.estado === 'CON PERSONA' && h.quien === yo; });
  $('misHerr').innerHTML = mias.length ? mias.map(function (h) {
    return '<div class="item"><div><b>' + esc(h.nombre) + '</b><small>desde ' + esc(h.desde || '') + (h.ok === 'PENDIENTE' ? ' · PENDIENTE DE OK' : '') + '</small></div><button class="btn peq sec dqMia" data-cod="' + esc(h.codigo) + '" style="flex:0 0 auto"><svg class="ico"><use href="#i-pin"/></svg>¿Dónde queda?</button></div>';
  }).join('') : '<div class="ayuda">No tienes ninguna a tu cargo. Si tienes una en la mano: "¿Dónde queda una máquina?" → Conmigo.</div>';
}
$('misHerr').onclick = function (e) { var b = e.target.closest('.dqMia'); if (b) abrirDq(b.dataset.cod); };

// ---------------------------------------------------------------- ¿Dónde queda una máquina? (control UNIDAD)
// Un solo flujo: se elige o escanea la máquina (o se le da número: alta) y dónde queda.
// Conmigo / A un compañero → ASIGNAR · En obra → SALIDA · En almacén → DEVOLUCION (ENTRADA si es nueva) · Averiada → AVERIA
var DQ_ICO = { YO: 'persona', OBRA: 'obra', ALM: 'casa', AVERIA: 'aviso', COMP: 'personas' };
var DQ = { YO: 'Conmigo', OBRA: 'En obra', ALM: 'En almacén', AVERIA: 'Averiada', COMP: 'A un compañero' };
var DQ_TIT = { YO: 'CONMIGO', OBRA: 'EN OBRA', ALM: 'EN ALMACÉN', AVERIA: 'AVERÍA', COMP: 'A UN COMPAÑERO' };
function tipoHerr(p) { return ((S.datos && S.datos.herrTipos) || []).filter(function (t) { return t.prefijo === p; })[0]; }
function tiposUnidad() { return ((S.datos && S.datos.herrTipos) || []).filter(function (t) { return t.control !== 'CANTIDAD'; }); }
// las que se pueden mover desde aquí; averiadas y en reparación las llevan los gestores (Reparaciones y altas)
function maquinasMovibles() {
  return herrLocal().filter(function (h) { var t = tipoHerr(String(h.codigo).split('-')[0]); return (!t || t.control !== 'CANTIDAD') && ['DISPONIBLE', 'EN OBRA', 'CON PERSONA'].indexOf(h.estado || 'DISPONIBLE') >= 0; });
}
function dondeEsta(h) {
  var e = h.estado || 'DISPONIBLE';
  return e === 'CON PERSONA' ? '👤 con ' + h.quien : e === 'EN OBRA' ? '🏗️ en obra · ' + h.donde : e === 'DISPONIBLE' ? '🏠 en ' + (h.almacen ? nombreAlmacen(h.almacen).split(' · ')[0] : 'el almacén') : e;
}
// compañeros: primero los que coincidieron conmigo en vales (misma obra y día) en los últimos 30 días
function companeros() {
  var yo = S.usuario ? S.usuario.nombre : '', c = ((S.datos && S.datos.companeros) || {})[yo] || [];
  var pos = function (n) { var i = c.indexOf(n); return i < 0 ? 9999 : i; };
  return ((S.datos && S.datos.trabajadores) || []).filter(function (t) { return t.nombre !== yo; })
    .sort(function (a, b) { return pos(a.nombre) - pos(b.nombre) || String(a.nombre).localeCompare(String(b.nombre)); });
}
function abrirDq(codigo) {
  ocultarGuardado(); limpiarErrores($('dqForm'));
  $('andForm').style.display = 'none';
  S.dqMaq = null; S.dqAlta = null; S.dqDestino = ''; S.dqFotos = []; S.dqPlaca = []; S.dqCodigoNuevo = ''; S.dqCuando = ahoraES();
  $('dqCuando').textContent = 'Fecha y hora: ' + S.dqCuando;
  ['dqMaqTxt', 'dqNota', 'dqPersonaTxt', 'dqObraTxt'].forEach(function (k) { $(k).value = ''; });
  $('dqNoLista').innerHTML = ''; $('dqEstado').textContent = '';
  opciones($('dqObra'), obras(), 'codigo', 'nombre', '— obra —');
  opciones($('dqTipo'), tiposUnidad(), 'prefijo', 'nombre', '— elige el tipo —');
  pintarFotosEn('dqFotos', S.dqFotos); pintarFotosEn('dqPlaca', S.dqPlaca);
  $('dqMaqBloque').style.display = ''; $('dqAltaBloque').style.display = 'none'; $('dqNumero').style.display = 'none';
  $('dqForm').style.display = '';
  var h = codigo && herrLocal().filter(function (x) { return x.codigo === codigo; })[0];
  if (h) { $('dqMaqTxt').value = h.nombre; S.dqMaq = h; }
  pintarDq();
  $('dqForm').scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function dqVaCon() {
  var p = S.dqAlta ? S.dqAlta.prefijo : S.dqMaq ? String(S.dqMaq.codigo).split('-')[0] : '';
  return (tipoHerr(p) || {}).va_con || 'OBRA';
}
function pintarDq() {
  var hay = !!(S.dqMaq || S.dqAlta), d = S.dqDestino;
  $('dqEstado').textContent = S.dqMaq ? 'Ahora: ' + dondeEsta(S.dqMaq) : '';
  $('dqDondeBloque').style.display = hay ? '' : 'none';
  // el habitual según va_con, relleno de color; los demás con borde; ninguno bloqueado
  var habitual = dqVaCon() === 'PERSONA' ? 'YO' : 'OBRA';
  $('dqBotones').innerHTML = Object.keys(DQ).map(function (k) {
    return '<button type="button" data-d="' + k + '" class="' + (k === d ? 'elegido' : k === habitual ? 'habitual' : '') + '">' + ico(DQ_ICO[k]) + DQ[k] + (k === d ? ico('ok') : '') + '</button>';
  }).join('');
  $('dqObraBloque').style.display = d === 'OBRA' ? '' : 'none';
  $('dqAlmBloque').style.display = d === 'ALM' ? '' : 'none';
  $('dqAveriaBloque').style.display = d === 'AVERIA' ? '' : 'none';
  $('dqCompBloque').style.display = d === 'COMP' ? '' : 'none';
  $('dqFinBloque').style.display = d ? '' : 'none';
  // foto obligatoria solo en el alta y en la avería
  $('dqFoto').innerHTML = ico('camara') + (S.dqAlta ? 'Foto de la máquina con el número · obligatoria' : d === 'AVERIA' ? 'Foto de la máquina y de la avería · obligatoria' : 'Foto · opcional');
}
$('btnDondeQueda').onclick = function () { abrirDq(); };
$('dqCancelar').onclick = function () { $('dqForm').style.display = 'none'; };
buscador($('dqMaqTxt'), $('dqMaqSugs'), maquinasMovibles, function (h) { S.dqMaq = h; if (h) $('dqNoLista').innerHTML = ''; pintarDq(); });
// al salir del campo sin elegir: parecidas, o darle número
$('dqMaqTxt').addEventListener('blur', function () {
  var t = $('dqMaqTxt').value.trim(); if (!t || S.dqMaq) return;
  var c = t.toUpperCase(), h = herrLocal().filter(function (x) { return x.codigo === c; })[0];
  if (h) { $('dqNoLista').innerHTML = '<div class="nl-tit">' + esc(h.codigo) + ' está ' + esc(h.estado) + ': la llevan los gestores en Reparaciones y altas.</div>'; return; }
  pintarNoLista($('dqNoLista'), parecidos(t, maquinasMovibles()), function (x) { $('dqMaqTxt').value = x.nombre; S.dqMaq = x; pintarDq(); },
    { txt: 'No tiene número → darle uno', fn: function () { $('dqSinNum').onclick(); } });
});
$('dqCam').onclick = function () {
  escanear(esCodigoMaquina).then(function (c) {
    if (!c) return;
    c = String(c).trim().toUpperCase();
    var h = maquinasMovibles().filter(function (x) { return x.codigo === c; })[0], otra = herrLocal().filter(function (x) { return x.codigo === c; })[0];
    if (!h) return errorEn($('dqMaqTxt'), otra ? c + ' está ' + otra.estado + ': la llevan los gestores en Reparaciones y altas' : 'No hay ninguna máquina ' + c);
    $('dqMaqTxt').value = h.nombre; $('dqNoLista').innerHTML = ''; S.dqMaq = h; pintarDq();
  });
};
// "No tiene número → darle uno": alta (se elige el tipo y el móvil propone el número)
$('dqSinNum').onclick = function (e) {
  if (e) e.preventDefault();
  S.dqMaq = null; $('dqMaqTxt').value = ''; $('dqNoLista').innerHTML = '';
  $('dqMaqBloque').style.display = 'none'; $('dqAltaBloque').style.display = ''; $('dqTipo').value = ''; S.dqAlta = null; $('dqNumero').style.display = 'none';
  pintarDq();
};
$('dqConNum').onclick = function (e) { e.preventDefault(); S.dqAlta = null; S.dqCodigoNuevo = ''; $('dqAltaBloque').style.display = 'none'; $('dqMaqBloque').style.display = ''; pintarDq(); };
$('dqTipo').onchange = function () {
  S.dqAlta = tiposUnidad().filter(function (t) { return t.prefijo === $('dqTipo').value; })[0] || null;
  S.dqCodigoNuevo = S.dqAlta ? siguienteNumero(S.dqAlta.prefijo) : '';
  $('dqNumero').style.display = S.dqAlta ? '' : 'none';
  $('dqNumero').innerHTML = S.dqAlta ? 'Número para esta máquina: <b style="font-size:22px">' + esc(S.dqCodigoNuevo) + '</b><br>✍️ Escríbelo con el rotulador en la máquina y haz la foto donde se vea.' : '';
  pintarDq();
};
$('dqPlacaBtn').onclick = function () { $('dqPlacaInput').click(); };
$('dqPlacaInput').onchange = function () { var f = this.files && this.files[0]; this.value = ''; if (f) comprimir(f, 1600).then(function (d) { if (d) { S.dqPlaca = [d]; pintarFotosEn('dqPlaca', S.dqPlaca); } }); };
$('dqFoto').onclick = function () { $('dqFotoInput').click(); };
$('dqFotoInput').onchange = function () { var f = this.files && this.files[0]; this.value = ''; if (f) comprimir(f).then(function (d) { if (d) { S.dqFotos = [d]; pintarFotosEn('dqFotos', S.dqFotos); } }); };
buscador($('dqObraTxt'), $('dqObraSugs'), obras, function (o) { $('dqObra').value = o ? String(o.codigo) : ''; });
buscador($('dqPersonaTxt'), $('dqPersonaSugs'), companeros, function () {});
// cada botón pide solo su dato, ya relleno con lo último usado
$('dqBotones').onclick = function (e) {
  var b = e.target.closest('[data-d]'); if (!b) return;
  S.dqDestino = b.dataset.d; limpiarErrores($('dqForm')); pintarDq();
  var d = S.dqDestino, yo = S.usuario.codigo;
  if (d === 'OBRA' && !$('dqObra').value) DB.get('kv', 'ultimaObraHer-' + yo).then(function (o) { return o || DB.get('kv', 'ultimaObraVale-' + yo); }).then(function (o) {
    if (o && obras().some(function (x) { return String(x.codigo) === String(o); })) { $('dqObra').value = String(o); verObra('dqObra', 'dqObraTxt'); }
  });
  if (d === 'ALM') almacenGuardado().then(function (c) { opcionesAlmacen('dqAlmacen', c); });
  if (d === 'AVERIA') $('dqNota').focus();
  if (d === 'COMP') $('dqPersonaTxt').focus();
};
$('dqGuardar').onclick = function () {
  limpiarErrores($('dqForm'));
  var d = S.dqDestino, alta = !!S.dqAlta, h = S.dqMaq, yo = S.usuario.nombre;
  if (!alta && !h) return errorEn($('dqAltaBloque').style.display === 'none' ? $('dqMaqTxt') : $('dqTipo'), $('dqAltaBloque').style.display === 'none' ? 'Elige la máquina de la lista o escanéala' : 'Elige el tipo de máquina');
  if (!d) return errorEn($('dqBotones'), 'Elige dónde queda');
  var tipo = d === 'YO' || d === 'COMP' ? 'ASIGNAR' : d === 'OBRA' ? 'SALIDA' : d === 'AVERIA' ? 'AVERIA' : alta ? 'ENTRADA' : 'DEVOLUCION';
  var persona = yo, obra = '', almacen = '', nota = $('dqNota').value.trim(), donde = '';
  if (d === 'COMP') {
    var t = companeros().filter(function (x) { return normal(x.nombre) === normal($('dqPersonaTxt').value); })[0];
    if (!t) return errorEn($('dqPersonaTxt'), 'Elige el compañero de la lista');
    persona = t.nombre; donde = t.nombre;
  }
  if (d === 'OBRA') {
    if (!$('dqObra').value) return errorEn($('dqObraTxt'), 'Elige la obra');
    obra = $('dqObra').options[$('dqObra').selectedIndex].text; donde = obra;
    DB.put('kv', $('dqObra').value, 'ultimaObraHer-' + S.usuario.codigo);
  }
  if (d === 'ALM') {
    almacen = $('dqAlmacen').value; if (!almacen) return errorEn($('dqAlmacen'), 'Elige el almacén');
    recordarAlmacen(almacen); donde = nombreAlmacen(almacen).split(' · ')[0];
    if (h && h.estado === 'EN OBRA') obra = h.donde;   // de qué obra vuelve
  }
  if (d === 'AVERIA') {
    if (!nota) return errorEn($('dqNota'), 'Escribe qué le pasa');
    almacen = almacenes().some(function (a) { return a.codigo === 'QUI'; }) ? 'QUI' : '';   // se deja en QUIQUIRÁ
  }
  if ((alta || d === 'AVERIA') && !S.dqFotos.length) return errorEn($('dqFoto'), alta ? 'Haz la foto de la máquina con el número' : 'Haz la foto de la máquina y de la avería');
  var nombre = alta ? S.dqCodigoNuevo + ' · ' + S.dqAlta.nombre : h.nombre;
  var mov = { id: uid(), tipo: 'mov', clase: 'HER', persona: tipo === 'ENTRADA' ? '' : persona, movTipo: tipo, material: alta ? '' : String(h.codigo), materialNombre: alta ? S.dqAlta.nombre : h.nombre,
    tipoHer: alta ? S.dqAlta.prefijo : '', codigoNuevo: alta ? S.dqCodigoNuevo : '', almacen: almacen, fotoPlaca: alta && S.dqPlaca[0] || '', hora: S.dqCuando.slice(11), cantidad: 1,
    obra: tipo === 'SALIDA' || tipo === 'DEVOLUCION' ? obra : '', nota: nota, fotos: S.dqFotos.slice(), fecha: isoDe(S.dqCuando), usuario: yo, creadoEn: new Date().toISOString(), movilDe: movilDe() };
  // el móvil ya la enseña donde queda, hasta que llegue lo del servidor
  var estado = { ASIGNAR: 'CON PERSONA', SALIDA: 'EN OBRA', AVERIA: 'AVERIADA' }[tipo] || 'DISPONIBLE';
  var pon = function (x) {
    x.estado = estado; x.donde = tipo === 'SALIDA' ? obra : tipo === 'ASIGNAR' ? persona : 'ALMACÉN'; x.quien = persona; x.desde = S.dqCuando; x.almacen = tipo === 'ASIGNAR' || tipo === 'SALIDA' ? '' : almacen;
    if (tipo === 'AVERIA') x.averia = nota;
  };
  if (alta) {   // la nueva entra ya en la lista del móvil, para no repetir su número
    (S.numerosPendientes = S.numerosPendientes || []).push(S.dqCodigoNuevo);
    var nueva = { codigo: S.dqCodigoNuevo, tipo: S.dqAlta.nombre, nombre: nombre, ok: 'PENDIENTE' }; pon(nueva); herrLocal().push(nueva);
  } else herrLocal().forEach(function (x) { if (x.codigo === h.codigo) pon(x); });
  DB.put('kv', S.datos, 'datos');
  DB.put('cola', mov).then(function () {
    $('dqForm').style.display = 'none'; pintarHerr(); actualizarPend();
    mostrarGuardado({ id: mov.id, antes: $('dqForm'), tipo: DQ_TIT[d], det: [nombre, donde || (d === 'YO' ? yo : '')], otro: function () { abrirDq(); } });
    if (navigator.onLine) sincronizar();
  });
};
// tipo de andamio nuevo: se guarda en el móvil y se sube primero (antes que sus movimientos)
S.tnFotos = [];
function abrirTipoNuevo() {
  $('tnMaterial').value = 'ALUMINIO'; $('tnDef').value = ''; S.tnFotos = []; pintarFotosEn('tnFotos', S.tnFotos);
  $('modalTipoNuevo').classList.add('activa');
}
$('tnFoto').onclick = function () { $('tnFotoInput').click(); };
$('tnFotoInput').onchange = function () { var f = this.files && this.files[0]; this.value = ''; if (f) comprimir(f).then(function (d) { if (d) { S.tnFotos = [d]; pintarFotosEn('tnFotos', S.tnFotos); } }); };
$('tnCancelar').onclick = function () { $('modalTipoNuevo').classList.remove('activa'); };
$('tnGuardar').onclick = function () {
  var def = $('tnDef').value.trim();
  if (!def) return toast('Escribe qué es'); if (!S.tnFotos.length) return toast('Haz la foto');
  if (!puedeHerr()) return toast('Solo los gestores dan de alta tipos de pieza');
  DB.get('kv', 'pin-' + S.usuario.codigo).then(function (pin) {
  if (!pin) return toast('Sal y vuelve a entrar con tu PIN');
  var id = 'NUEVO-' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  var nombre = 'ANDAMIO ' + $('tnMaterial').value + ' · ' + def.toUpperCase() + ' (PENDIENTE)';
  var it = { id: uid(), tipo: 'herrTipoNuevo', tipoNuevo: { id: id, material: $('tnMaterial').value, definicion: def, foto: S.tnFotos[0], usuario: S.usuario.nombre }, auth: { codigo: S.usuario.codigo, pin: pin }, nombre: nombre, fecha: hoyISO(), creadoEn: new Date().toISOString() };
  S.datos.herrTipos = (S.datos.herrTipos || []).concat([{ prefijo: id, nombre: nombre, va_con: 'OBRA', control: 'CANTIDAD', estado: 'PENDIENTE' }]);
  S.datos.andamios = (S.datos.andamios || []).concat([{ prefijo: id, tipo: nombre, pendiente: true, porObra: {}, porAlmacen: {} }]);
  DB.put('kv', S.datos, 'datos'); DB.put('cola', it).then(actualizarPend);
  $('modalTipoNuevo').classList.remove('activa');
  pintarAndLista(); var inp = $('andLista').querySelector('input[data-p="' + id + '"]'); if (inp) inp.focus();
  if (navigator.onLine) sincronizar();
  });
};
$('movCancelar').onclick = function () { $('movForm').style.display = 'none'; };
$('movGuardar').onclick = function () { guardarVale(); };
