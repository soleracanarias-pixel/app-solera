// APP SOLERA · parte de trabajo: trabajadores, materiales, firmantes, firma y guardar
// (index.html carga, por este orden: base.js, parte.js, almacen.js, inventario.js, herramientas.js, admin.js; al final, arrancar())
'use strict';

// ---------------------------------------------------------------- parte: trabajadores y materiales
function filaTrab(datos) {
  var d = S.datos, div = document.createElement('div'); div.className = 'fila trab';
  div.innerHTML = '<div><select class="t-cod"></select></div>' +
    '<div class="corto"><input type="number" class="t-h" inputmode="decimal" step="0.5" min="0" placeholder="Horas"></div>' +
    '<div class="corto"><input type="number" class="t-x" inputmode="decimal" step="0.5" min="0" placeholder="Extra"></div>' +
    '<button class="x" title="Quitar">×</button>';
  opciones(div.querySelector('.t-cod'), d.trabajadores, 'codigo', 'nombre', '— trabajador —');
  if (datos) { div.querySelector('.t-cod').value = datos.codigo; div.querySelector('.t-h').value = datos.horas; }
  else div.querySelector('.t-h').value = 8;
  div.querySelector('.x').onclick = function () { div.remove(); totalHoras(); };
  div.querySelectorAll('input').forEach(function (i) { i.oninput = totalHoras; });
  $('trabs').appendChild(div); totalHoras();
}
// campo de texto con sugerencias al escribir ("maj" -> MERCADONA 2184 LOS MAJUELOS); la lista ya viene ordenada por uso.
// Busca en el nombre y en los alias (materiales: "panda" -> CEMENTO COLA…), sin mayúsculas ni tildes; enseña siempre el nombre.
// Con el campo vacío enseña los 10 primeros (los más usados).
// elegir(item, alEscribir) recibe el elemento elegido, o null si lo escrito no coincide con ninguno
function encaja(palabras, texto) {
  var ws = normal(texto).split(/[^a-z0-9,]+/);
  return palabras.every(function (p) { return ws.some(function (w) { return w.indexOf(p) === 0; }); });
}
function buscador(txt, caja, lista, elegir) {
  var mostrar = function () {
    var palabras = normal(txt.value).split(/[^a-z0-9,]+/).filter(Boolean);   // "bat-02", "bat 02" o "02"
    var res = lista().filter(function (x) {
      return encaja(palabras, x.nombre) || String(x.alias || '').split(',').concat(String(x.refs || '').split(',')).some(function (a) { return a.trim() && encaja(palabras, a); });
    }).slice(0, palabras.length ? 8 : 10);
    var exacto = res.filter(function (x) { return normal(x.nombre) === normal(txt.value); })[0];
    elegir(exacto || null, true);
    caja.innerHTML = res.map(function (x, i) { return '<div data-i="' + i + '">' + esc(x.nombre) + '</div>'; }).join('');
    caja.querySelectorAll('div').forEach(function (o) {
      o.onmousedown = function (e) { e.preventDefault(); var x = res[+o.dataset.i]; txt.value = x.nombre; caja.style.display = 'none'; elegir(x, false); };
    });
    caja.style.display = res.length && !exacto ? '' : 'none';
  };
  txt.oninput = txt.onfocus = mostrar;
  txt.onblur = function () { caja.style.display = 'none'; };
}
// el select oculto guarda la obra elegida; el texto visible la enseña
function verObra(sel, txt) { var s = $(sel); if (s.value && s.selectedIndex >= 0) $(txt).value = s.options[s.selectedIndex].text; }
function obras() { return (S.datos && S.datos.obras) || []; }
buscador($('obraTxt'), $('obraSugs'), obras, function (o) { $('obra').value = o ? String(o.codigo) : ''; });
buscador($('movObraTxt'), $('movObraSugs'), obras, function (o) { $('movObra').value = o ? String(o.codigo) : ''; });
buscador($('movPersonaTxt'), $('movPersonaSugs'), function () { return (S.datos && S.datos.trabajadores) || []; }, function () {});

function filaMat() {
  var div = document.createElement('div'); div.className = 'fila mat'; div.dataset.cod = '';
  div.innerHTML = '<div><input type="text" class="m-txt" placeholder="Escribe el material…" autocomplete="off"><div class="sugs" style="display:none"></div></div>' +
    '<div class="paso"><button type="button" class="menos" aria-label="menos">−</button><input type="number" class="m-c" inputmode="decimal" step="any" min="0" placeholder="Cant."><button type="button" class="mas" aria-label="más">+</button></div><button class="x">×</button>';
  buscador(div.querySelector('.m-txt'), div.querySelector('.sugs'), function () { return (S.datos && S.datos.materiales) || []; }, function (m, alEscribir) {
    div.dataset.cod = m ? m.codigo : '';
    if (m && !alEscribir) div.querySelector('.m-c').focus();
  });
  div.querySelector('.x').onclick = function () { div.remove(); };
  $('mats').appendChild(div);
}
function totalHoras() {
  var t = 0;
  document.querySelectorAll('#trabs .trab').forEach(function (f) { t += (+f.querySelector('.t-h').value || 0) + (+f.querySelector('.t-x').value || 0); });
  $('totalHoras').textContent = 'Total: ' + t + ' h';
}
function leerTrabs() {
  var mapa = {}; (S.datos.trabajadores || []).forEach(function (t) { mapa[String(t.codigo)] = t; });
  var out = [];
  document.querySelectorAll('#trabs .trab').forEach(function (f) {
    var c = f.querySelector('.t-cod').value; if (!c) return;
    var t = mapa[c] || {};
    out.push({ codigo: c, nombre: t.nombre || c, categoria: t.categoria || '', horas: +f.querySelector('.t-h').value || 0, extra: +f.querySelector('.t-x').value || 0 });
  });
  return out;
}
function leerMats() {
  var mapa = {}; (S.datos.materiales || []).forEach(function (m) { mapa[String(m.codigo)] = m; });
  var out = [];
  document.querySelectorAll('#mats .mat').forEach(function (f) {
    var nombre = f.querySelector('.m-txt').value.trim(), q = +f.querySelector('.m-c').value || 0; if (!nombre || !q) return;
    var m = mapa[f.dataset.cod] || {};
    // si no se eligió de la lista, se guarda como texto libre
    out.push({ codigo: m.codigo ? String(m.codigo) : 'OTRO', nombre: m.nombre || nombre.toUpperCase(), unidad: m.unidad || '', cantidad: q });
  });
  return out;
}

function nuevoParte() {
  $('fecha').value = hoyISO(); pintarFecha();
  $('trabs').innerHTML = ''; $('mats').innerHTML = '';
  ['trabajos', 'medios', 'observaciones', 'firmante', 'firmanteEmail'].forEach(function (i) { $(i).value = ''; });
  $('firmanteSugs').style.display = 'none'; S.emailAuto = false;
  S.fotos = []; S.firma = null; S.firmadoEn = null; pintarFotos(); pintarFirma(); aviso('parteAviso', '');
  // el que crea el parte va el primero
  if (S.usuario && S.datos) filaTrab({ codigo: S.usuario.codigo, horas: 8 });
  // última obra usada
  DB.get('kv', 'ultimaObra').then(function (o) { if (o) { $('obra').value = o; verObra('obra', 'obraTxt'); } });
}

// fecha: se enseña siempre como dd/mm/aaaa; el selector nativo queda invisible encima
function pintarFecha() { $('fechaVer').textContent = fechaES($('fecha').value || hoyISO()); }
$('fecha').onchange = $('fecha').oninput = pintarFecha;
$('fecha').onclick = function () { try { this.showPicker(); } catch (_) {} };

// ---------------------------------------------------------------- firmantes (libreta para la copia por correo)
function firmantes() { return (S.datos && S.datos.firmantes) || []; }
function elegirFirmante(f) {
  $('firmante').value = f.nombre; $('firmanteEmail').value = f.email || ''; S.emailAuto = !!f.email;
  $('firmanteSugs').style.display = 'none';
}
$('firmante').oninput = function () {
  var q = normal(this.value), caja = $('firmanteSugs');
  var exacto = firmantes().filter(function (f) { return normal(f.nombre) === q; })[0];
  if (exacto && exacto.email) { $('firmanteEmail').value = exacto.email; S.emailAuto = true; }
  else if (S.emailAuto) { $('firmanteEmail').value = ''; S.emailAuto = false; }
  var lista = q ? firmantes().filter(function (f) { return normal(f.nombre).indexOf(q) >= 0 && normal(f.nombre) !== q; }).slice(0, 6) : [];
  caja.innerHTML = lista.map(function (f, i) { return '<div data-i="' + i + '">' + esc(f.nombre) + (f.email ? '<small>' + esc(f.email) + '</small>' : '') + '</div>'; }).join('');
  caja.querySelectorAll('div').forEach(function (d) { d.onmousedown = function (e) { e.preventDefault(); elegirFirmante(lista[+d.dataset.i]); }; });
  caja.style.display = lista.length ? '' : 'none';
};
$('firmante').onblur = function () { $('firmanteSugs').style.display = 'none'; };
$('firmanteEmail').oninput = function () { S.emailAuto = false; };

// ---------------------------------------------------------------- firma
var lienzo = $('lienzo'), ctx, dibujando = false, hayTrazo = false;
function abrirFirma() {
  var m = $('modalFirma'); m.classList.add('activa');
  var ob = $('obra'); $('firmaObra').textContent = ob.options[ob.selectedIndex] ? ob.options[ob.selectedIndex].text : '';
  requestAnimationFrame(function () {
    var r = lienzo.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    lienzo.width = r.width * dpr; lienzo.height = r.height * dpr;
    ctx = lienzo.getContext('2d'); ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#343434';
    hayTrazo = false;
  });
}
function pos(e) { var r = lienzo.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; return [p.clientX - r.left, p.clientY - r.top]; }
lienzo.addEventListener('pointerdown', function (e) { dibujando = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p[0], p[1]); lienzo.setPointerCapture(e.pointerId); });
lienzo.addEventListener('pointermove', function (e) { if (!dibujando) return; var p = pos(e); ctx.lineTo(p[0], p[1]); ctx.stroke(); hayTrazo = true; });
['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { lienzo.addEventListener(ev, function () { dibujando = false; }); });
$('firmaLimpiar').onclick = function () { ctx.clearRect(0, 0, lienzo.width, lienzo.height); hayTrazo = false; };
$('firmaCancelar').onclick = function () { S.firmaPara = null; $('modalFirma').classList.remove('activa'); };
$('firmaOk').onclick = function () {
  if (!hayTrazo) return toast('No hay firma');
  // recortar al trazo
  var w = lienzo.width, h = lienzo.height, d = lienzo.getContext('2d').getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  var c = document.createElement('canvas'), m = 10; c.width = x1 - x0 + m * 2; c.height = y1 - y0 + m * 2;
  var cc = c.getContext('2d'); cc.fillStyle = '#fff'; cc.fillRect(0, 0, c.width, c.height);
  cc.drawImage(lienzo, x0 - m, y0 - m, c.width, c.height, 0, 0, c.width, c.height);
  if (S.firmaPara) { var f = S.firmaPara; S.firmaPara = null; f(c.toDataURL('image/png')); }   // firma del reparador (recibo)
  else { S.firma = c.toDataURL('image/png'); S.firmadoEn = ahoraES(); pintarFirma(); }
  $('modalFirma').classList.remove('activa');
};
function pintarFirma() { $('firmaPrev').innerHTML = S.firma ? '<img src="' + S.firma + '">' : 'Sin firma'; }
$('btnFirmar').onclick = abrirFirma;
$('btnBorrarFirma').onclick = function () { S.firma = null; S.firmadoEn = null; pintarFirma(); };

// ---------------------------------------------------------------- guardar parte (cola)
$('btnGuardarParte').onclick = function () {
  var obra = $('obra').value, trabs = leerTrabs();
  aviso('parteAviso', ''); limpiarErrores($('p-parte'));
  if (!obra) return errorEn($('obraTxt'), 'Elige la obra');
  if (!trabs.length) return errorEn($('addTrab'), 'Añade al menos un trabajador con sus horas');
  if (!$('trabajos').value.trim()) return errorEn($('trabajos'), 'Escribe los trabajos realizados');
  var email = $('firmanteEmail').value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorEn($('firmanteEmail'), 'El correo para la copia no es válido');
  if (!S.firma && !S.sinFirmaOk) return preguntar('El parte va SIN FIRMA del cliente. ¿Guardar igualmente?', 'Guardar sin firma', 'Volver').then(function (ok) {
    if (ok) { S.sinFirmaOk = true; $('btnGuardarParte').onclick(); }
  });
  S.sinFirmaOk = false;
  var obraTxt = $('obra').options[$('obra').selectedIndex].text;
  var parte = {
    id: uid(), tipo: 'parte', fecha: $('fecha').value || hoyISO(), obra: obra, obraNombre: obraTxt,
    trabajadores: trabs, trabajos: $('trabajos').value.trim(), materiales: leerMats(),
    medios: $('medios').value.trim(), observaciones: $('observaciones').value.trim(),
    firma: S.firma, firmante: $('firmante').value.trim(), firmanteEmail: email, firmadoEn: S.firma ? S.firmadoEn : '', fotos: S.fotos.slice(),
    creadoPor: S.usuario.nombre, creadoEn: new Date().toISOString()
  };
  // la libreta local se actualiza ya, para tenerla aunque no haya cobertura
  if (parte.firmante && S.datos) {
    var lf = S.datos.firmantes = firmantes(), ya = lf.filter(function (f) { return normal(f.nombre) === normal(parte.firmante); })[0];
    if (ya) { if (email) ya.email = email; } else lf.push({ nombre: parte.firmante, email: email });
    DB.put('kv', S.datos, 'datos');
  }
  DB.put('cola', parte).then(function () { return DB.put('kv', obra, 'ultimaObra'); }).then(function () {
    toast('Parte guardado. Enviando…'); nuevoParte(); actualizarPend(); sincronizar();
  });
};
