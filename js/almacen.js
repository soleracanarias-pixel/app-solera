// APP SOLERA · almacén: vales, stock y códigos de barras
// (index.html carga, por este orden: base.js, parte.js, almacen.js, inventario.js, herramientas.js, admin.js; al final, arrancar())
'use strict';

// ---------------------------------------------------------------- almacén
// almacenes físicos (La Matanza, Agüimes…): en la app "ALMACÉN LA MATANZA · C/ Chamiana 21"; el código solo en la hoja
function almacenes() {
  var l = (S.datos && S.datos.almacenes) || [];
  return l.length ? l : [{ codigo: 'MAT', nombre: 'ALMACÉN LA MATANZA', direccion: 'C/ Chamiana 21', por_defecto: true }];
}
function nombreAlmacen(cod) {
  var a = almacenes().filter(function (x) { return x.codigo === cod; })[0];
  return a ? a.nombre + (a.direccion ? ' · ' + a.direccion.split(',')[0] : '') : (cod || '');
}
function opcionesAlmacen(sel, valor, extra) {
  $(sel).innerHTML = (extra || '') + almacenes().map(function (a) { return '<option value="' + esc(a.codigo) + '">' + esc(nombreAlmacen(a.codigo)) + '</option>'; }).join('');
  if (valor != null) $(sel).value = valor;
}
// cada móvil recuerda el último almacén que usó su dueño; si no, el que va por defecto (La Matanza)
function almacenGuardado() {
  var def = (almacenes().filter(function (a) { return a.por_defecto; })[0] || almacenes()[0]).codigo;
  return DB.get('kv', 'almacen-' + (S.usuario ? S.usuario.codigo : '')).then(function (c) {
    return c && almacenes().some(function (a) { return a.codigo === c; }) ? c : def;
  });
}
function recordarAlmacen(c) { if (S.usuario) DB.put('kv', c, 'almacen-' + S.usuario.codigo); }
function stockLocal() { return (S.datos && S.datos.stock) || []; }
function stockEn(m, alm) { return alm ? ((m.porAlmacen || {})[alm] || 0) : m.stock; }
// "Ver stock": almacén y buscador arriba; por categoría (plegadas), negativos en rojo, luego con stock y "A cero (n)" plegado
S.stockAbiertas = {};
function textoBusquedaMat(m, mat) {
  var eans = ((S.datos && S.datos.eans) || []).concat(S.eansLocal || []).filter(function (e) { return e.material === m.codigo; });
  return [m.nombre, m.codigo].concat(String(mat.alias || '').split(','), String(mat.refs || '').split(','), eans.map(function (e) { return e.ean; }), eans.map(function (e) { return e.ref || ''; }));
}
// ---- tablas en el ordenador (>900 px): ordenables al tocar la cabecera y "Copiar tabla" (tabulado, para pegar en Excel). En el móvil no cambia nada.
function pantallaAncha() { return !!(window.matchMedia && window.matchMedia('(min-width:901px)').matches); }
S.tablaOrden = {};
// cols: [{ k, t, num }]; filas: [{ v: { k: valor }, html: { k: html opcional }, clase, attrs }]; repintar(): vuelve a pintar al cambiar el orden
function pintarTabla(caja, clave, cols, filas, repintar) {
  var o = S.tablaOrden[clave] || { k: cols[0].k, asc: true }; S.tablaOrden[clave] = o;
  var col = cols.filter(function (c) { return c.k === o.k; })[0] || cols[0];
  var orden = filas.slice().sort(function (a, b) {
    var x = a.v[col.k], y = b.v[col.k], r = col.num ? (Number(x) || 0) - (Number(y) || 0) : String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), 'es');
    return o.asc ? r : -r;
  });
  caja.innerHTML = '<div class="tabla-cab"><span>' + orden.length + ' fila(s) · toca una cabecera para ordenar</span><button type="button" class="btn peq sec copiar">Copiar tabla</button></div>' +
    '<table class="tabla"><thead><tr>' + cols.map(function (c) { return '<th data-k="' + esc(c.k) + '" class="' + (c.num ? 'n' : '') + (c.k === col.k ? ' activa' : '') + '">' + esc(c.t) + (c.k === col.k ? (o.asc ? ' ▲' : ' ▼') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
    orden.map(function (f) { return '<tr class="' + (f.clase || '') + '"' + (f.attrs || '') + '>' + cols.map(function (c) { return '<td class="' + (c.num ? 'n' : '') + '">' + (f.html && f.html[c.k] != null ? f.html[c.k] : esc(f.v[c.k] == null ? '' : f.v[c.k])) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  caja.querySelectorAll('th').forEach(function (th) { th.onclick = function () { if (o.k === th.dataset.k) o.asc = !o.asc; else { o.k = th.dataset.k; o.asc = true; } repintar(); }; });
  caja.querySelector('.copiar').onclick = function () {
    var txt = [cols.map(function (c) { return c.t; }).join('\t')].concat(orden.map(function (f) { return cols.map(function (c) { return String(f.v[c.k] == null ? '' : f.v[c.k]).replace(/[\t\n]+/g, ' '); }).join('\t'); })).join('\n');
    copiarTexto(txt).then(function () { toast('Tabla copiada: pégala en Excel', 'ok'); }, function () { toast('No se pudo copiar', 'err'); });
  };
}
function copiarTexto(txt) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt);
  return new Promise(function (res, rej) {
    var t = document.createElement('textarea'); t.value = txt; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} t.remove(); ok ? res() : rej();
  });
}
function pintarStockTabla(lista, mats, alm) {
  var alms = almacenes();
  var cols = [{ k: 'categoria', t: 'Categoría' }, { k: 'nombre', t: 'Material' }, { k: 'codigo', t: 'Código' }, { k: 'unidad', t: 'Ud.' }];
  if (alm) cols.push({ k: 'stock', t: 'Stock', num: true });
  else { alms.forEach(function (a) { cols.push({ k: 'a_' + a.codigo, t: a.nombre.replace(/^ALMACÉN /, ''), num: true }); }); cols.push({ k: 'stock', t: 'Total', num: true }); }
  cols.push({ k: 'stock_min', t: 'Mínimo', num: true }, { k: 'aviso', t: 'Aviso' });
  var filas = lista.map(function (m) {
    var n = stockEn(m, alm), v = { categoria: (mats[m.codigo] || {}).categoria || 'OTROS', nombre: m.nombre, codigo: m.codigo, unidad: m.unidad, stock: n, stock_min: m.stock_min || '', aviso: m.stock_min > 0 && m.stock <= m.stock_min ? 'PEDIR' : (n < 0 ? 'NEGATIVO' : '') };
    alms.forEach(function (a) { v['a_' + a.codigo] = (m.porAlmacen || {})[a.codigo] || 0; });
    return { v: v, clase: 'toca' + (n < 0 ? ' neg' : ''), attrs: ' data-cod="' + esc(m.codigo) + '"' };
  });
  if (!S.tablaOrden.stock) S.tablaOrden.stock = { k: 'stock', asc: true };   // los negativos arriba
  pintarTabla($('stockLista'), 'stock', cols, filas, pintarStock);
  $('stockLista').insertAdjacentHTML('afterbegin', otrosPendHtml());
}
// admin: materiales metidos como OTRO que habría que dar de alta en MATERIALES (plegado)
function otrosPendHtml() {
  var otros = (S.datos && S.datos.otros) || [];
  if (rolActual() !== 'admin' || !otros.length) return '';
  return '<details class="aviso otro-pend"><summary><b>Pendientes de dar de alta en MATERIALES (' + otros.length + ')</b></summary>' +
    otros.map(function (o) { return esc(o.nombre) + ' <small style="display:inline">(' + o.veces + ' vez/veces' + (o.ultimo ? ', último vale ' + esc(o.ultimo) : '') + ')</small>'; }).join('<br>') + '</details>';
}
function pintarStock() {
  var q = normal($('buscarMat').value).split(/[^a-z0-9,]+/).filter(Boolean), alm = $('stockAlmacen').value;
  var mats = {}; ((S.datos && S.datos.materiales) || []).forEach(function (m) { mats[m.codigo] = m; });
  var lista = stockLocal().filter(function (m) {
    return !q.length || textoBusquedaMat(m, mats[m.codigo] || {}).some(function (t) { return t && encaja(q, String(t)); });
  });
  if (pantallaAncha() && lista.length) return pintarStockTabla(lista, mats, alm);
  var cats = {};
  lista.forEach(function (m) { var c = (mats[m.codigo] || {}).categoria || 'OTROS'; (cats[c] = cats[c] || []).push(m); });
  var linea = function (m) {
    var n = stockEn(m, alm), bajo = m.stock_min > 0 && m.stock <= m.stock_min;   // "pedir": sobre el total y con mínimo puesto
    return '<div class="item toca' + (n < 0 ? ' neg' : '') + '" data-cod="' + esc(m.codigo) + '"><div><b>' + esc(m.nombre) + '</b>' + (bajo ? ' <small style="display:inline;color:var(--rojo)">· pedir</small>' : '') + '</div>' +
      '<div class="stock">' + n + ' <small style="display:inline">' + esc(m.unidad) + '</small></div></div>';
  };
  var h = Object.keys(cats).sort(function (a, b) { return a.localeCompare(b, 'es'); }).map(function (c) {
    var l = cats[c].slice().sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
    var neg = l.filter(function (m) { return stockEn(m, alm) < 0; }), pos = l.filter(function (m) { return stockEn(m, alm) > 0; }), cero = l.filter(function (m) { return !stockEn(m, alm); });
    var abierta = q.length > 0 || S.stockAbiertas[c];
    return '<details class="cat-stock" data-cat="' + esc(c) + '"' + (abierta ? ' open' : '') + '><summary><span>' + esc(c) + '</span><small>' + pos.length + ' con stock' + (neg.length ? ' · <span style="color:var(--rojo)">' + neg.length + ' en negativo</span>' : '') + '</small></summary>' +
      neg.map(linea).join('') + pos.map(linea).join('') +
      (cero.length ? '<details class="ceros"' + (q.length ? ' open' : '') + '><summary>A cero · ' + cero.length + '</summary>' + cero.map(linea).join('') + '</details>' : '') + '</details>';
  }).join('');
  $('stockLista').innerHTML = h || '<div class="aviso">' + (q.length ? 'Ningún material con ese nombre o código.' : 'Sin materiales. Pulsa "Actualizar listas" en Enviados.') + '</div>';
  $('stockLista').insertAdjacentHTML('afterbegin', otrosPendHtml());
}
$('stockLista').addEventListener('toggle', function (e) {
  var d = e.target; if (d.classList && d.classList.contains('cat-stock') && !$('buscarMat').value.trim()) S.stockAbiertas[d.dataset.cat] = d.open;
}, true);
$('buscarMat').oninput = pintarStock;
$('stockAlmacen').onchange = pintarStock;
$('verStock').onclick = function () {
  var b = $('stockBloque'), ver = b.style.display === 'none'; b.style.display = ver ? '' : 'none';
  if (!ver) return;
  // LA MATANZA (el de por defecto), AGÜIMES… o Todos
  if (!$('stockAlmacen').options.length) opcionesAlmacen('stockAlmacen', (almacenes().filter(function (a) { return a.por_defecto; })[0] || almacenes()[0]).codigo);
  var antes = $('stockAlmacen').value;
  $('stockAlmacen').innerHTML = almacenes().map(function (a) { return '<option value="' + esc(a.codigo) + '">' + esc(a.nombre.replace(/^ALMACÉN /, '')) + '</option>'; }).join('') + '<option value="">Todos</option>';
  $('stockAlmacen').value = antes; pintarStock();
};
$('verHerr').onclick = function () { var b = $('herrBloque'), ver = b.style.display === 'none'; b.style.display = ver ? '' : 'none'; if (ver) pintarHerr(); };
// número para una herramienta nueva: se da en el momento para escribirlo con rotulador y que salga en la foto
function siguienteNumero(prefijo) {
  var max = 0;
  herrLocal().map(function (h) { return h.codigo; }).concat(S.numerosPendientes || []).forEach(function (c) {
    var p = String(c).split('-'); if (p[0] === prefijo) max = Math.max(max, Number(p[1]) || 0);
  });
  return prefijo + '-' + ('0' + (max + 1)).slice(-2);
}
// herramientas una a una (BAT-01…): dónde está cada una y quién la tiene (al tocarla, sus últimos movimientos)
function herrLocal() { return (S.datos && S.datos.herramientas) || []; }
// "¿Dónde están?" para admin y gestores: por persona, por obra y por almacén (con los andamios por cantidad)
function puedeHistorial() {
  if (!S.usuario) return false;
  var t = ((S.datos && S.datos.trabajadores) || []).filter(function (x) { return String(x.codigo) === String(S.usuario.codigo); })[0];
  return !!(t && t.historial);
}
// botón "Historial" (solo historial = SI): de una máquina, o de un tipo de andamio en un almacén u obra
function botonHist(d) {
  if (!puedeHistorial()) return '';
  return ' <a class="hist" href="#"' + (d.cod ? ' data-cod="' + esc(d.cod) + '"' : '') + (d.pref ? ' data-pref="' + esc(d.pref) + '" data-sitio="' + esc(d.sitio) + '"' : '') + '>Historial</a>';
}
function pintarHerrAgrupado(q) {
  var alm = function (c) { return nombreAlmacen(c).split(' · ')[0].replace(/^ALMACÉN /, ''); };
  var g = { 'Con personas': {}, 'En obras': {}, 'En almacenes': {}, 'Averiadas, en reparación o de baja': {} };
  var pon = function (grupo, sitio, txt, d) { if (!q || normal(sitio + ' ' + txt).indexOf(q) >= 0) (g[grupo][sitio] = g[grupo][sitio] || []).push('<div class="hent">' + esc(txt) + botonHist(d) + '</div>'); };
  herrLocal().forEach(function (h) {
    var e = h.estado || 'DISPONIBLE', ok = h.ok === 'PENDIENTE' ? ' (pendiente de OK)' : '', d = { cod: h.codigo };
    if (e === 'CON PERSONA') pon('Con personas', h.quien || h.donde, h.nombre + ok, d);
    else if (e === 'EN OBRA') pon('En obras', h.donde, h.nombre + ok, d);
    else if (e === 'DISPONIBLE') pon('En almacenes', alm(h.almacen), h.nombre + ok, d);
    else pon('Averiadas, en reparación o de baja', e === 'EN REPARACION' ? 'En reparación' : e === 'AVERIADA' ? 'Averiadas' : 'Baja', h.nombre + (h.averia ? ': ' + h.averia : '') + (h.reparador ? ' · ' + h.reparador : ''), d);
  });
  ((S.datos && S.datos.andamios) || []).forEach(function (a) {
    Object.keys(a.porObra).forEach(function (o) { if (a.porObra[o]) pon('En obras', o, a.tipo + ': ' + a.porObra[o], { pref: a.prefijo, sitio: o }); });
    Object.keys(a.porAlmacen).forEach(function (c) { if (a.porAlmacen[c]) pon('En almacenes', alm(c), a.tipo + ': ' + a.porAlmacen[c], { pref: a.prefijo, sitio: c }); });
  });
  return Object.keys(g).map(function (k) {
    var sitios = Object.keys(g[k]).sort(function (a, b) { return a.localeCompare(b, 'es'); }); if (!sitios.length) return '';
    return '<details class="cat-stock" open><summary><span>' + esc(k) + '</span><small>' + sitios.length + '</small></summary>' + sitios.map(function (st) {
      return '<div class="item"><div><b>' + esc(st) + '</b><small>' + g[k][st].join('') + '</small></div></div>';
    }).join('') + '</details>';
  }).join('') || '<div class="aviso">Nada con ese nombre.</div>';
}
function pintarHerrTabla(q) {
  var alm = function (c) { return nombreAlmacen(c).split(' · ')[0].replace(/^ALMACÉN /, ''); }, filas = [];
  herrLocal().forEach(function (h) {
    var e = h.estado || 'DISPONIBLE', donde = e === 'EN OBRA' ? h.donde : e === 'DISPONIBLE' || e === 'AVERIADA' ? alm(h.almacen) : e === 'CON PERSONA' ? h.quien : e === 'EN REPARACION' ? 'Reparador ' + (h.reparador || '') : 'Baja';
    var v = { codigo: h.codigo, tipo: h.tipo, estado: e === 'EN REPARACION' ? 'EN REPARACIÓN' : e, donde: donde, quien: h.quien || '', desde: h.desde || '', cantidad: 1,
      averia: h.averia || '', recibo: h.recibo || '', ok: h.ok === 'PENDIENTE' ? 'PENDIENTE' : 'OK' };
    if (q && normal(Object.keys(v).map(function (k) { return v[k]; }).join(' ')).indexOf(q) < 0) return;
    filas.push({ v: v, html: { codigo: '<b>' + esc(h.codigo) + '</b>' + botonHist({ cod: h.codigo }) }, clase: e === 'AVERIADA' || e === 'BAJA' ? 'neg' : '' });
  });
  ((S.datos && S.datos.andamios) || []).forEach(function (a) {
    var pon = function (sitio, n, d) { var v = { codigo: a.prefijo, tipo: a.tipo, estado: 'ANDAMIOS', donde: sitio, quien: '', desde: '', cantidad: n, averia: '', recibo: '', ok: a.pendiente ? 'PENDIENTE' : 'OK' };
      if (q && normal(a.tipo + ' ' + sitio).indexOf(q) < 0) return;
      filas.push({ v: v, html: { codigo: '<b>' + esc(a.prefijo) + '</b>' + botonHist(d) } }); };
    Object.keys(a.porObra).forEach(function (o) { if (a.porObra[o]) pon(o, a.porObra[o], { pref: a.prefijo, sitio: o }); });
    Object.keys(a.porAlmacen).forEach(function (c) { if (a.porAlmacen[c]) pon(alm(c), a.porAlmacen[c], { pref: a.prefijo, sitio: c }); });
  });
  if (!filas.length) { $('herrLista').innerHTML = '<div class="aviso">Nada con ese nombre.</div>'; return; }
  pintarTabla($('herrLista'), 'herr', [{ k: 'codigo', t: 'Código' }, { k: 'tipo', t: 'Máquina' }, { k: 'estado', t: 'Estado' }, { k: 'donde', t: 'Dónde' }, { k: 'cantidad', t: 'Cant.', num: true },
    { k: 'quien', t: 'Quién' }, { k: 'desde', t: 'Desde' }, { k: 'averia', t: 'Avería' }, { k: 'recibo', t: 'Recibo' }, { k: 'ok', t: 'OK' }], filas, pintarHerr);
}
function pintarHerr() {
  var q = normal($('buscarHerr').value);
  pintarMisHerr();
  if (puedeHerr() || rolActual() === 'admin') {
    if (pantallaAncha()) return pintarHerrTabla(q);
    $('herrLista').innerHTML = pintarHerrAgrupado(q); return;
  }
  var lista = herrLocal().filter(function (h) { return !q || normal(h.nombre + ' ' + h.donde + ' ' + h.quien + ' ' + (h.estado || '') + ' ' + (h.reparador || '')).indexOf(q) >= 0; });
  var alm = function (c) { return esc(nombreAlmacen(c).split(' · ')[0].replace(/^ALMACÉN /, '')); };
  $('herrLista').innerHTML = lista.length ? lista.map(function (h) {
    var e = h.estado || (h.donde && h.donde !== 'ALMACÉN' ? 'EN OBRA' : 'DISPONIBLE');
    var txt = e === 'EN OBRA' ? '📍 ' + esc(h.donde) : e === 'CON PERSONA' ? '👤 con ' + esc(h.quien) : e === 'AVERIADA' ? '⚠️ AVERIADA en ' + alm(h.almacen) + (h.averia ? ': ' + esc(h.averia) : '')
      : e === 'EN REPARACION' ? '🔧 EN REPARACIÓN con ' + esc(h.reparador) + (h.recibo ? ' · recibo ' + esc(h.recibo) : '') : e === 'BAJA' ? 'BAJA' : 'En almacén ' + alm(h.almacen);
    var chip = e === 'AVERIADA' || e === 'BAJA' ? '<span class="chip est">' + e + '</span>' : e === 'EN REPARACION' ? '<span class="chip rep">EN REPARACIÓN</span>' : h.ok === 'PENDIENTE' ? '<span class="chip okp">PENDIENTE DE OK</span>' : '';
    return '<div class="item"><div><b>' + esc(h.nombre) + '</b>' + botonHist({ cod: h.codigo }) + '<small>' + txt +
      (e !== 'EN REPARACION' && h.quien ? ' · ' + esc(h.quien) : '') + (h.desde ? ' · ' + esc(h.desde) : '') + (h.ok === 'PENDIENTE' && chip.indexOf('okp') < 0 ? ' · PENDIENTE DE OK' : '') + '</small></div>' + chip + '</div>';
  }).join('') : '<div class="aviso">Todavía no hay ninguna numerada. Se numeran en "¿Dónde queda una máquina?" → "No tiene número → darle uno".</div>';
}
$('buscarHerr').oninput = pintarHerr;
// al tocar un material: sus últimos 10 movimientos (se piden al servidor)
// "Ver stock" → al tocar un material: cuánto hay de cada marca (en el almacén elegido o en todos)
function desgloseMarcas(cod) {
  var m = stockLocal().filter(function (x) { return x.codigo === cod; })[0]; if (!m || !m.marcas) return '';
  var alm = $('stockAlmacen').value, suma = {};
  Object.keys(m.marcas).forEach(function (a) { if (alm && a !== alm) return; Object.keys(m.marcas[a]).forEach(function (mc) { suma[mc] = (suma[mc] || 0) + m.marcas[a][mc]; }); });
  var ks = Object.keys(suma).filter(function (mc) { return suma[mc]; });
  if (!ks.length) return '<div>Sin marcas apuntadas.</div>';
  return '<div><b>Por marca</b></div>' + ks.sort().map(function (mc) { return '<div class="marca"><span>' + esc(mc || 'sin marca') + '</span><b>' + suma[mc] + ' ' + esc(m.unidad) + '</b></div>'; }).join('');
}
function verHistorial(e) {
  var it = e.target.closest('.item.toca, tr.toca'); if (!it) return;
  var sig = it.nextElementSibling;
  if (sig && sig.classList.contains('historial')) { sig.remove(); return; }
  var h;
  if (it.tagName === 'TR') {   // en la tabla del ordenador: una fila debajo con el historial
    var tr = document.createElement('tr'); tr.className = 'historial'; tr.innerHTML = '<td colspan="' + it.children.length + '"></td>'; it.after(tr); h = tr.firstChild; h.className = 'historial';
  } else { h = document.createElement('div'); h.className = 'historial'; it.after(h); }
  h.textContent = 'Cargando movimientos…';
  var marcas = it.dataset.clase === 'HER' ? '' : desgloseMarcas(it.dataset.cod);
  if (marcas) h.innerHTML = marcas + '<div>Cargando movimientos…</div>';
  if (!navigator.onLine) { h.textContent = 'Sin conexión: el historial se ve con cobertura.'; return; }
  api('movimientos', { material: it.dataset.cod, clase: it.dataset.clase || 'MAT' }).then(function (j) {
    h.innerHTML = marcas + (j.movimientos.length ? j.movimientos.map(function (m) {
      var etiqueta = it.dataset.clase === 'HER' ? m.tipo : (TIPO_VALE[m.tipo] || m.tipo);
      return '<div' + (m.anulado ? ' class="anulado"' : '') + '><b>' + (m.numero ? (m.linea ? 'Vale ' : '') + 'Nº ' + esc(m.numero) + ' · ' : '') + esc(m.fecha) + (m.hora ? ' ' + esc(m.hora) : '') + ' · ' + esc(etiqueta) + ' ' + esc(m.cantidad) + ' ' + esc(m.unidad || '') + '</b>' + (m.anulado ? ' · <span style="color:var(--rojo)">ANULADO</span>' : '') +
        (m.almacen && almacenes().length > 1 ? ' · ' + esc(nombreAlmacen(m.almacen).split(' · ')[0]) : '') +
        (m.obra ? ' · ' + esc(m.obra) : '') +
        (m.persona ? ' · ' + (m.tipo === 'DEVOLUCION' ? 'lo devuelve ' : 'se lo lleva ') + esc(m.persona) : '') +
        (m.usuario ? ' · anotado por ' + esc(m.usuario) : '') + (m.nota ? ' · ' + esc(m.nota) : '') +
        (m.fotos || []).map(function (u, i) { return ' · <a href="' + esc(u) + '" target="_blank">📷 foto' + (m.fotos.length > 1 ? ' ' + (i + 1) : '') + '</a>'; }).join('') + '</div>';
    }).join('') : 'Sin movimientos todavía.');
  }).catch(function (e) { h.innerHTML = marcas + '<div>No se pudo cargar: ' + esc(e.message) + '</div>'; });
}
$('stockLista').onclick = verHistorial;
// historial de herramientas: fecha y hora, quién, de dónde y a dónde (nada se borra; lo anulado sale tachado)
$('herrLista').onclick = function (e) {
  var a = e.target.closest('.hist'); if (!a) return;
  e.preventDefault();
  var sig = a.nextElementSibling;
  if (sig && sig.classList.contains('historial')) { sig.remove(); return; }
  var h = document.createElement('div'); h.className = 'historial'; h.textContent = 'Cargando historial…'; a.after(h);
  if (!navigator.onLine) { h.textContent = 'Sin conexión: el historial se ve con cobertura.'; return; }
  var nombres = { ENTRADA: 'ALTA / ENTRADA', SALIDA: 'A OBRA', DEVOLUCION: 'DEVUELTA', ASIGNAR: 'LA TIENE', AVERIA: 'AVERÍA', REPARACION: 'AL REPARADOR', VUELTA: 'REPARADA', BAJA: 'BAJA', AJUSTE: 'AJUSTE INVENTARIO' };
  authAdmin().then(function (auth) { return api('herrHistorial', { auth: auth, codigo: a.dataset.cod || a.dataset.pref, cantidad: !!a.dataset.pref, sitio: a.dataset.sitio || '' }); })
    .then(function (j) {
      h.innerHTML = j.historial.length ? j.historial.map(function (m) {
        return '<div' + (m.anulado ? ' class="anulado"' : '') + '><b>' + esc(m.fecha) + (m.hora ? ' ' + esc(m.hora) : '') + ' · ' + esc(nombres[m.tipo] || m.tipo) + (m.cantidad !== '' ? ' ' + esc(m.cantidad) : '') + '</b>' +
          (m.quien ? ' · ' + esc(m.quien) : '') + (m.movil_de ? ' · <i>anotado desde el móvil de ' + esc(m.movil_de) + '</i>' : '') + ' · ' + esc(m.de || '—') + ' → ' + esc(m.a || '—') + (m.numero ? ' · Nº ' + esc(m.numero) : '') + (m.nota ? ' · ' + esc(m.nota) : '') + (m.anulado ? ' · ANULADO' : '') + '</div>';
      }).join('') : 'Sin movimientos.';
    }).catch(function (er) { h.textContent = er.message; });
};
function abrirMov(tipo) {
  ocultarGuardado(); limpiarErrores($('movForm'));
  $('movSitioMAT').appendChild($('movForm'));   // el formulario se abre justo debajo de los botones
  S.movTipo = tipo; $('movForm').style.display = '';
  $('movNota').value = ''; S.movCuando = ahoraES(); S.otroOk = false;
  $('movCuando').textContent = 'Fecha y hora: ' + S.movCuando + ' · el nº se asigna al enviarlo';
  S.movFotos = []; pintarFotosEn('movFotos', S.movFotos);
  // un formulario = un vale con varias líneas
  $('compraBloque').style.display = tipo === 'ENTRADA' ? '' : 'none';
  // almacén arriba del formulario (por defecto el último de este usuario); en el traspaso, también el de destino
  $('almBloque').style.display = '';
  $('almLabel').textContent = tipo === 'TRASPASO' ? 'Sale del almacén' : 'Almacén';
  $('destinoBloque').style.display = tipo === 'TRASPASO' ? '' : 'none';
  $('movObraBloque').style.display = tipo === 'ENTRADA' || tipo === 'TRASPASO' ? 'none' : '';
  $('movObra').value = ''; $('movObraTxt').value = '';
  almacenGuardado().then(function (c) {
    opcionesAlmacen('valeAlmacen', c); opcionesAlmacen('valeAlmDestino'); pintarResumen();
    var otro = almacenes().filter(function (a) { return a.codigo !== c; })[0]; if (otro) $('valeAlmDestino').value = otro.codigo;
  });
  $('personaBloque').style.display = '';
  $('valeDestino').value = '';
  // ME LLEVO, DEVUELVO y ENCONTRÉ: material, cantidad, obra y GUARDAR; almacén y persona puestos y discretos; lo demás en "Más"
  var simple = ['SALIDA', 'DEVOLUCION', 'RECUPERADO'].indexOf(tipo) >= 0;
  $('movForm').classList.toggle('simple', simple); $('movForm').classList.remove('cambiando');
  $('invEnCurso').style.display = 'none';
  $('valeResumen').style.display = simple ? '' : 'none';
  $('movMas').open = !simple;
  // ENCONTRÉ: tres botones en vez del comentario obligatorio (con "Apareció en el almacén" la obra es opcional)
  S.origen = ''; $('origenBloque').style.display = tipo === 'RECUPERADO' ? '' : 'none'; pintarOrigen();
  $('movMasTxt').textContent = 'Más: comentario y fotos';
  if (simple) DB.get('kv', 'ultimaObraVale-' + S.usuario.codigo).then(function (o) {   // la última obra usada, ya puesta (se puede cambiar)
    if (o && obras().some(function (x) { return String(x.codigo) === String(o); })) { $('movObra').value = String(o); verObra('movObra', 'movObraTxt'); }
  });
  $('valeLineas').innerHTML = ''; filaVale();
  $('valeProveedor').value = ''; $('valeAlbaran').value = ''; $('valeTipoDoc').value = 'ALBARAN'; S.albaranArchivo = null; $('valeAlbaranNombre').textContent = '';
  $('valeSoloFoto').checked = false; pintarSoloFoto();
  $('movTitulo').textContent = TIPO_VALE[tipo] + ' · ' + (tipo === 'SALIDA' ? 'salida a obra' : tipo === 'DEVOLUCION' ? 'vuelve al almacén' : tipo === 'RECUPERADO' ? 'material que aparece sin albarán' : tipo === 'TRASPASO' ? 'de un almacén a otro' : 'entrada con albarán o ticket');
  $('movObraLabel').textContent = 'Obra';
  $('movPersonaLabel').textContent = { SALIDA: '¿Quién se lo lleva?', DEVOLUCION: '¿Quién lo devuelve?', RECUPERADO: '¿Quién lo encontró?' }[tipo] || '';
  $('movPersonaTxt').value = S.usuario ? S.usuario.nombre : ''; pintarNombres();
  $('movNotaLabel').textContent = tipo === 'RECUPERADO' ? 'Comentario · opcional' : 'Comentario';
  $('movBtnFoto').innerHTML = ico('camara') + 'Foto · opcional';
  if (tipo === 'ENTRADA') pintarDestino();
}
var TIPO_VALE = { SALIDA: 'ME LLEVO', DEVOLUCION: 'DEVUELVO', RECUPERADO: 'ENCONTRÉ MATERIAL', ENTRADA: 'COMPRA', COMPRA_OBRA: 'COMPRA A OBRA', AJUSTE: 'AJUSTE · inventario', TRASPASO: 'TRASPASO', TRASPASO_SALE: 'TRASPASO · sale', TRASPASO_ENTRA: 'TRASPASO · entra', AVISO: 'AVISO' };
$('valeAlmacen').onchange = function () { recordarAlmacen(this.value); pintarResumen(); };
// en los vales solo lo que pasa por el almacén (en_almacen = NO va directo a obra y solo sale en los partes)
function matsAlmacen() {
  var todos = (S.datos && S.datos.materiales) || [];
  if (compraAObra()) return todos;   // la compra que va directa a obra puede llevar cualquier material activo
  return todos.filter(function (m) { return m.en_almacen !== 'NO'; });
}
function compraAObra() { return S.movTipo === 'ENTRADA' && $('valeDestino').value === 'OBRA'; }
// compra: destino ALMACÉN (selector de almacén) u OBRA (buscador de obra)
function pintarInvEnCurso() {
  var tipos = ['SALIDA', 'DEVOLUCION', 'RECUPERADO', 'ENTRADA', 'TRASPASO'];
  var alm = $('valeAlmacen').value, dest = S.movTipo === 'TRASPASO' ? $('valeAlmDestino').value : '';
  var ver = tipos.indexOf(S.movTipo) >= 0 && !compraAObra() && (!!inventarioEn(alm) || (dest && !!inventarioEn(dest)));
  $('invEnCurso').style.display = ver ? '' : 'none';
}
function pintarResumen() {
  pintarInvEnCurso();
  var quien = { SALIDA: 'se lo lleva', DEVOLUCION: 'lo devuelve', RECUPERADO: 'lo encontró' }[S.movTipo] || '';
  $('valeResumenTxt').textContent = nombreAlmacen($('valeAlmacen').value).split(' · ')[0] + (quien ? ' · ' + quien + ' ' + ($('movPersonaTxt').value.trim() || (S.usuario && S.usuario.nombre) || '') : '');
}
$('valeCambiar').onclick = function (e) { e.preventDefault(); $('movForm').classList.add('cambiando'); pintarNombres(); $('personaBloque').scrollIntoView({ block: 'center' }); };
$('movPersonaTxt').addEventListener('input', function () { pintarResumen(); pintarNombres(); });
// "Lo apunto por un compañero": los nombres como botones, primero yo y los de mi cuadrilla (coincidieron en vales en 30 días)
function pintarNombres() {
  if (!S.usuario) return;
  var yo = S.usuario.nombre, cuad = ((S.datos && S.datos.companeros) || {})[yo] || [], actual = $('movPersonaTxt').value.trim();
  var todos = ((S.datos && S.datos.trabajadores) || []).map(function (t) { return t.nombre; }).filter(function (n) { return n && n !== yo; });
  var primero = cuad.filter(function (n) { return todos.indexOf(n) >= 0; }), resto = todos.filter(function (n) { return primero.indexOf(n) < 0; }).sort();
  var lista = [yo].concat(primero, resto);
  $('movPersonaBotones').innerHTML = lista.map(function (n, i) {
    return '<button type="button" data-n="' + esc(n) + '" class="' + (n === actual ? 'elegido' : i > 0 && i <= primero.length ? 'cuadrilla' : '') + '">' + (n === yo ? 'Yo · ' : '') + esc(n) + '</button>';
  }).join('');
}
$('movPersonaBotones').onclick = function (e) {
  var b = e.target.closest('[data-n]'); if (!b) return;
  $('movPersonaTxt').value = b.dataset.n; $('movPersonaSugs').style.display = 'none'; pintarNombres(); pintarResumen();
};
var ORIGEN = { OBRA: 'Sobró de la obra', MERCADONA: 'Lo dejó Mercadona', ALMACEN: 'Apareció en el almacén' };
function pintarOrigen() {
  document.querySelectorAll('#origenBotones button').forEach(function (b) { b.className = b.dataset.o === S.origen ? 'elegido' : ''; });
  $('movObraLabel').textContent = S.movTipo === 'RECUPERADO' && S.origen === 'ALMACEN' ? 'Obra · opcional' : 'Obra';
}
$('origenBotones').onclick = function (e) {
  var b = e.target.closest('[data-o]'); if (!b) return;
  S.origen = b.dataset.o; limpiarErrores($('origenBloque')); pintarOrigen();
};
function pintarDestino() {
  if (S.movTipo !== 'ENTRADA') return;
  var d = $('valeDestino').value;
  $('almBloque').style.display = d === 'ALMACEN' ? '' : 'none';
  $('movObraBloque').style.display = d === 'OBRA' ? '' : 'none';
  $('personaBloque').style.display = 'none';
  $('movTitulo').textContent = d === 'OBRA' ? 'COMPRA A OBRA · no entra en el almacén' : 'COMPRA · entrada con albarán o ticket';
}
$('valeDestino').onchange = function () { pintarDestino(); pintarInvEnCurso(); };
// compra "solo foto": sin líneas; queda PENDIENTE_LEER y el admin las mete después desde Vales ("Completar líneas")
function soloFoto() { return S.movTipo === 'ENTRADA' && $('valeSoloFoto').checked; }
function pintarSoloFoto() {
  var sf = soloFoto();
  $('valeLineasBloque').style.display = sf ? 'none' : '';
  $('valeSoloFotoAyuda').style.display = sf ? '' : 'none';
}
$('valeSoloFoto').onchange = pintarSoloFoto;
$('valeAlmDestino').onchange = pintarInvEnCurso;
// una línea de material (vale, compra o "Completar líneas"); caja: dónde va (por defecto el formulario del vale); lista: qué materiales valen
function filaVale(caja, lista) {
  caja = caja || $('valeLineas'); lista = lista || matsAlmacen;
  var div = document.createElement('div'); div.className = 'fila vlin'; div.dataset.cod = '';
  div.innerHTML = '<div><div style="position:relative"><input type="text" class="v-txt" placeholder="Material…" autocomplete="off"><div class="sugs" style="display:none"></div></div>' +
    '<input type="text" class="v-marca" placeholder="Marca (opcional)" autocomplete="off"><small class="v-info"></small><div class="nolista"></div></div>' +
    '<button class="cam" title="Escanear el código de barras"><svg class="ico"><use href="#i-camara"/></svg></button>' +
    '<div class="paso"><button type="button" class="menos" aria-label="menos">−</button><input type="number" class="v-c" inputmode="decimal" step="any" min="0" placeholder="Cant."><button type="button" class="mas" aria-label="más">+</button></div><button class="x">×</button>';
  div.querySelector('.cam').onclick = function () { escanearLinea(div); };
  var txt = div.querySelector('.v-txt'), nl = div.querySelector('.nolista');
  buscador(txt, div.querySelector('.sugs'), lista, function (m, alEscribir) {
    div.dataset.cod = m ? m.codigo : '';
    if (m) nl.innerHTML = '';
    if (m && !alEscribir) div.querySelector('.v-c').focus();
  });
  txt.addEventListener('input', function () { div.dataset.otro = ''; });
  // al salir del campo sin elegir de la lista: hasta 3 parecidos o "Guardar tal cual (OTRO)"
  txt.addEventListener('blur', function () {
    if (!txt.value.trim() || div.dataset.cod || div.dataset.otro) { if (!txt.value.trim()) nl.innerHTML = ''; return; }
    pintarNoLista(nl, parecidos(txt.value, lista()), function (m) {
      txt.value = m.nombre; div.dataset.cod = m.codigo; div.dataset.otro = ''; limpiarErrores(div); div.querySelector('.v-c').focus();
    }, { txt: 'Guardar tal cual (OTRO)', fn: function () { div.dataset.otro = '1'; } });
  });
  div.querySelector('.x').onclick = function () { div.remove(); };
  caja.appendChild(div);
  return div;
}
$('valeOtraLinea').onclick = function () { filaVale(); };
// albarán de la compra: foto o fichero desde el PC (jpg, png o pdf)
$('valeBtnAlbaran').onclick = function () { $('valeAlbaranInput').click(); };
$('valeAlbaranInput').onchange = function () {
  var f = this.files && this.files[0]; this.value = ''; if (!f) return;
  var listo = function (d) { S.albaranArchivo = d; $('valeAlbaranNombre').textContent = d ? '📎 ' + f.name : 'No se pudo leer el fichero'; };
  if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
    if (f.size > 15 * 1024 * 1024) return toast('El PDF pasa de 15 MB');
    var r = new FileReader(); r.onload = function () { listo(String(r.result).replace(/^data:[^;]*;/, 'data:application/pdf;')); }; r.onerror = function () { listo(null); }; r.readAsDataURL(f);
  } else comprimir(f).then(listo);
};
function leerLineasVale(caja) {
  var mapa = {}; ((S.datos && S.datos.materiales) || []).forEach(function (m) { mapa[String(m.codigo)] = m; });
  var out = [], falta = false;
  (caja || $('valeLineas')).querySelectorAll('.vlin').forEach(function (f) {
    var nombre = f.querySelector('.v-txt').value.trim(), q = +f.querySelector('.v-c').value || 0;
    if (!nombre && !q) return;
    if (!nombre || !(q > 0)) { if (!falta) S.campoFalta = !nombre ? f.querySelector('.v-txt') : f.querySelector('.v-c'); falta = true; return; }
    var m = mapa[f.dataset.cod];
    // si no se eligió de la lista, va como OTRO (no cuenta en el stock hasta darlo de alta en MATERIALES)
    out.push({ material: m ? String(m.codigo) : 'OTRO', materialNombre: m ? m.nombre : nombre.toUpperCase(), unidad: m ? m.unidad : '', cantidad: q,
      marca: f.querySelector('.v-marca').value.trim().toUpperCase(), ean: f.dataset.ean || '' });
  });
  return falta ? null : out;
}
function guardarVale() {
  limpiarErrores($('movForm'));
  if (S.movTipo === 'ENTRADA' && !$('valeDestino').value) return errorEn($('valeDestino'), 'Elige el destino de la compra: almacén u obra');
  var tipo = compraAObra() ? 'COMPRA_OBRA' : S.movTipo, sf = soloFoto(), lineas = sf ? [] : leerLineasVale();
  if (!lineas) return errorEn(S.campoFalta, S.campoFalta && S.campoFalta.classList.contains('v-c') ? 'Pon la cantidad' : 'Escribe el material');
  if (!sf && !lineas.length) return errorEn(document.querySelector('#valeLineas .v-txt') || $('valeOtraLinea'), 'Añade al menos un material con su cantidad');
  var conObra = tipo !== 'ENTRADA' && tipo !== 'TRASPASO', nota = $('movNota').value.trim();
  var almacen = tipo === 'COMPRA_OBRA' ? '' : $('valeAlmacen').value, destino = tipo === 'TRASPASO' ? $('valeAlmDestino').value : '';
  if (!almacen && tipo !== 'COMPRA_OBRA') return errorEn($('valeAlmacen'), 'Elige el almacén');
  if (tipo === 'TRASPASO' && (!destino || destino === almacen)) return errorEn($('valeAlmDestino'), 'Elige otro almacén de destino');
  if (tipo === 'RECUPERADO' && !S.origen) return errorEn($('origenBotones'), 'Elige de dónde ha salido');
  var obraOpcional = tipo === 'RECUPERADO' && S.origen === 'ALMACEN';
  if (conObra && !obraOpcional && !$('movObra').value) return errorEn($('movObraTxt'), 'Elige la obra');
  if (tipo === 'RECUPERADO') nota = ORIGEN[S.origen] + (nota ? ' · ' + nota : '');
  var proveedor = $('valeProveedor').value.trim(), albaran = $('valeAlbaran').value.trim(), compra = tipo === 'ENTRADA' || tipo === 'COMPRA_OBRA';
  if (compra && !proveedor) return errorEn($('valeProveedor'), 'Escribe el proveedor');
  if (compra && !albaran) return errorEn($('valeAlbaran'), 'Escribe el nº de albarán o ticket');
  if (sf && !S.albaranArchivo && !S.movFotos.length) return errorEn($('valeBtnAlbaran'), 'Haz la foto del albarán (o adjunta el fichero)');
  // líneas que no están en la lista: van como OTRO (no cuentan en el stock); se pide confirmación
  var otros = lineas.filter(function (l) { return l.material === 'OTRO'; });
  if (otros.length && !S.otroOk) return preguntar((otros.length === 1 ? 'Hay 1 línea que no está' : 'Hay ' + otros.length + ' líneas que no están') + ' en la lista de materiales (' +
    otros.map(function (l) { return l.materialNombre; }).join(', ') + '). Irán como OTRO y no cuentan en el stock. ¿Guardar igualmente?', 'Guardar', 'Revisar').then(function (ok) {
    if (ok) { S.otroOk = true; guardarVale(); }
  });
  S.otroOk = false;
  var obraSel = $('movObra'), obraTxt = conObra && obraSel.value && obraSel.selectedIndex >= 0 ? obraSel.options[obraSel.selectedIndex].text : '';
  var vale = { id: uid(), tipo: 'vale', valeTipo: tipo, obra: obraTxt, persona: conObra && !compra ? ($('movPersonaTxt').value.trim() || S.usuario.nombre) : '',
    nota: nota, fotos: S.movFotos.slice(), albaranArchivo: compra ? S.albaranArchivo : null, proveedor: compra ? proveedor : '',
    origen: tipo === 'RECUPERADO' ? S.origen : '', albaran: compra ? albaran : '', tipoDoc: compra ? $('valeTipoDoc').value : '', soloFoto: sf, lineas: lineas, fecha: isoDe(S.movCuando), hora: S.movCuando.slice(11), usuario: S.usuario.nombre, creadoEn: new Date().toISOString(), movilDe: movilDe(),
    almacen: almacen, almacenDestino: destino };
  if (almacen) recordarAlmacen(almacen);
  if (conObra && tipo !== 'COMPRA_OBRA' && $('movObra').value) DB.put('kv', $('movObra').value, 'ultimaObraVale-' + S.usuario.codigo);
  // la compra y el traspaso van con el código y PIN de quien los hace: el servidor comprueba que es admin
  var conPin = compra || tipo === 'TRASPASO';
  (conPin ? DB.get('kv', 'pin-' + S.usuario.codigo) : Promise.resolve(null)).then(function (pin) {
    if (conPin) {
          if (!pin) return toast('Para registrar compras o traspasos, sal y vuelve a entrar con tu PIN', 'err');
      vale.auth = { codigo: S.usuario.codigo, pin: pin };
    }
    // stock del móvil hasta que llegue el del servidor: total y por almacén
    var suma = function (m, alm, q) { m.porAlmacen = m.porAlmacen || {}; m.porAlmacen[alm] = (m.porAlmacen[alm] || 0) + q; };
    stockLocal().forEach(function (m) {
      lineas.forEach(function (l) {
        if (l.material !== m.codigo || tipo === 'COMPRA_OBRA') return;
        if (tipo === 'TRASPASO') { suma(m, almacen, -l.cantidad); suma(m, destino, l.cantidad); return; }
        var q = tipo === 'SALIDA' ? -l.cantidad : l.cantidad; m.stock += q; suma(m, almacen, q);
      });
    });
    DB.put('kv', S.datos, 'datos');
    return DB.put('cola', vale).then(function () {
      $('movForm').style.display = 'none'; pintarStock(); actualizarPend();
      var deNuevo = S.movTipo;
      mostrarGuardado({ id: vale.id, antes: $('movForm'), tipo: TIPO_VALE[tipo], det: [sf ? 'solo foto · pendiente de leer' : lineasTxt(lineas.length), obraTxt || (compra ? proveedor : '') || nombreAlmacen(destino || almacen).split(' · ')[0]], otro: function () { abrirMov(deNuevo); } });
      if (navigator.onLine) sincronizar();
    });
  });
}
// ---------------------------------------------------------------- códigos de barras (EAN)
// Lector: BarcodeDetector si el navegador lo trae (Android); si no (iPhone), ZXing, que va DENTRO de la app (lib/), para
// que funcione sin conexión. También se puede escribir el número a mano.
var Scan = { stream: null, timer: null };
function eanValido(c) {
  if (!/^(\d{8}|\d{12,14})$/.test(c)) return false;
  var d = c.split('').map(Number), control = d.pop(), suma = 0;
  d.reverse().forEach(function (n, i) { suma += n * (i % 2 === 0 ? 3 : 1); });
  return (10 - suma % 10) % 10 === control;
}
function cargarZXing() {
  if (window.ZXing) return Promise.resolve();
  return new Promise(function (res, rej) {
    var s = document.createElement('script'); s.src = 'lib/zxing-0.21.3.min.js';
    s.onload = function () { res(); }; s.onerror = function () { rej(new Error('No se pudo cargar el lector')); };
    document.head.appendChild(s);
  });
}
function lectorZXing() {
  return cargarZXing().then(function () {
    var Z = window.ZXing, hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.QR_CODE]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    var r = new Z.MultiFormatReader(); r.setHints(hints);
    return function (lienzo) {
      try { return Promise.resolve(r.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(lienzo)))).getText()); }
      catch (e) { return Promise.resolve(null); }
    };
  });
}
function prepararLector() {
  if (!('BarcodeDetector' in window)) return lectorZXing();
  return BarcodeDetector.getSupportedFormats().then(function (sop) {
    var f = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'].filter(function (x) { return sop.indexOf(x) >= 0; });
    if (!f.length) return lectorZXing();
    var d = new BarcodeDetector({ formats: f });
    return function (lienzo) { return d.detect(lienzo).then(function (r) { return r.length ? r[0].rawValue : null; }, function () { return null; }); };
  }).catch(function () { return lectorZXing(); });
}
function pararScan() {
  clearInterval(Scan.timer); Scan.timer = null;
  if (Scan.stream) Scan.stream.getTracks().forEach(function (t) { t.stop(); });
  Scan.stream = null; $('scanVideo').srcObject = null;
}
// abre la cámara y devuelve el código leído (o null si se cancela)
// valida: qué código se acepta (por defecto EAN; en Herramientas, el código de la máquina, que algún día irá en un QR: BAT-01)
function escanear(valida) {
  return new Promise(function (res) {
    var hecho = false;
    var fin = function (c) { if (hecho) return; hecho = true; pararScan(); $('modalScan').classList.remove('activa'); res(c); };
    $('scanManual').value = ''; $('scanMsg').textContent = 'Apunta a las barras, con la línea roja cruzándolas.';
    $('modalScan').classList.add('activa');
    $('scanCancelar').onclick = function () { fin(null); };
    $('scanOk').onclick = function () {
      var v = $('scanManual').value.replace(/\D/g, ''), t = $('scanManual').value.trim();
      if (valida) return valida(t) ? fin(t.toUpperCase()) : toast('No es el código de una máquina (por ejemplo BAT-01)');
      if (eanValido(v)) return fin(v);
      var e = t && eanConocido(t);   // también vale la referencia del fabricante
      if (e) return fin(e.ean);
      toast('Ese número no es un código de barras válido ni una referencia conocida: revísalo');
    };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('scanMsg').textContent = 'Aquí no se puede usar la cámara: escribe el número.'; return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }).then(function (st) {
      if (hecho) { st.getTracks().forEach(function (t) { t.stop(); }); return null; }
      Scan.stream = st; var v = $('scanVideo'); v.srcObject = st; return v.play().then(prepararLector);
    }).then(function (leer) {
      if (!leer || hecho) return;
      var v = $('scanVideo'), c = document.createElement('canvas'), cx = c.getContext('2d', { willReadFrequently: true }), ocupado = false;
      Scan.timer = setInterval(function () {
        if (ocupado || !v.videoWidth) return; ocupado = true;
        var w = v.videoWidth, h = v.videoHeight, alto = Math.round(h * 0.45);   // franja central, donde está la línea roja
        c.width = w; c.height = alto; cx.drawImage(v, 0, (h - alto) / 2, w, alto, 0, 0, w, alto);
        leer(c).then(function (cod) {
          ocupado = false;
          if (cod && (valida ? valida(cod) : eanValido(cod))) { if (navigator.vibrate) navigator.vibrate(80); fin(valida ? String(cod).trim().toUpperCase() : cod); }
        });
      }, 220);
    }).catch(function (e) { $('scanMsg').textContent = 'No se pudo abrir la cámara (' + motivo(e) + '). Escribe el número.'; });
  });
}
// EAN conocidos: los de la hoja EANS y los asociados en este móvil que aún no se han subido
function refNormal(r) { return String(r || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function eanConocido(c) {
  var r = refNormal(c);
  return (S.eansLocal || []).concat((S.datos && S.datos.eans) || []).filter(function (e) { return e.ean === c || (e.ref && refNormal(e.ref) === r); })[0] || null;
}
function puedeInventario() {
  if (!S.usuario) return false;
  var t = ((S.datos && S.datos.trabajadores) || []).filter(function (x) { return String(x.codigo) === String(S.usuario.codigo); })[0];
  return !!(t && t.inventario);
}
function materialesActivos() { return (S.datos && S.datos.materiales) || []; }
function asociarEan(c, sugerido) {
  return new Promise(function (res) {
    var elegido = materialesActivos().filter(function (m) { return m.codigo === sugerido; })[0] || null;
    $('eanTxt').textContent = 'El código ' + c + ' no está en la lista. ¿Qué material es? ¿Qué marca?';
    $('eanMatTxt').value = elegido ? elegido.nombre : ''; $('eanMarca').value = ''; $('eanEnvase').value = '';
    buscador($('eanMatTxt'), $('eanMatSugs'), materialesActivos, function (m) { elegido = m; });
    $('modalEan').classList.add('activa');
    $('eanCancelar').onclick = function () { $('modalEan').classList.remove('activa'); res(null); };
    $('eanGuardar').onclick = function () {
      if (!elegido) return toast('Elige el material de la lista');
      DB.get('kv', 'pin-' + S.usuario.codigo).then(function (pin) {
        if (!pin) return toast('Para asociar códigos, sal y vuelve a entrar con tu PIN');
        var e = { ean: c, material: String(elegido.codigo), marca: $('eanMarca').value.trim().toUpperCase(), envase: $('eanEnvase').value.trim() };
        S.eansLocal = (S.eansLocal || []).concat([e]);
        if (S.datos && S.datos.eansPendientes) S.datos.eansPendientes = S.datos.eansPendientes.filter(function (p) { return p.ean !== c; });
        // se guarda en el móvil y se sube cuando haya cobertura (lo primero de la cola)
        return DB.put('kv', S.eansLocal, 'eansLocal').then(function () {
          return DB.put('cola', { id: uid(), tipo: 'eans', eans: [e], auth: { codigo: S.usuario.codigo, pin: pin }, fecha: hoyISO(), hora: ahoraES().slice(11), creadoEn: new Date().toISOString() });
        }).then(function () {
          $('modalEan').classList.remove('activa'); actualizarPend(); toast('Código guardado', 'ok'); res(e);
          if (navigator.onLine) sincronizar();
        });
      });
    };
  });
}
// vales y compras: 📷 al lado de cada material (siempre opcional, se puede seguir escribiendo).
// Código conocido: material y marca, cantidad 1; si ese producto ya está en otra línea, le suma 1.
// Código desconocido: se elige el material a mano y el código queda "pendiente de asociar" (Mateo o Gregorio, en Inventario).
function lineasVale() { return Array.prototype.slice.call(document.querySelectorAll('#valeLineas .vlin')); }
function infoLinea(f, txt, nuevo) { var i = f.querySelector('.v-info'); i.textContent = txt || ''; i.classList.toggle('nuevo', !!nuevo); }
function lineaVaciaAlFinal() {
  var l = lineasVale(), u = l[l.length - 1];
  if (!u || u.querySelector('.v-txt').value.trim()) filaVale();
}
function escanearLinea(div) {
  escanear().then(function (c) {
    if (!c) return;
    var e = eanConocido(c);
    if (!e) {
      div.dataset.ean = c; infoLinea(div, 'Código ' + c + ' nuevo: elige el material (queda pendiente de asociar)', true);
      toast('Código no conocido: elige el material'); div.querySelector('.v-txt').focus();
      return;
    }
    var m = matsAlmacen().filter(function (x) { return x.codigo === e.material; })[0];
    if (!m) return toast('Ese material no va en este vale (va directo a obra o está dado de baja)');
    var mc = String(e.marca || '').toUpperCase();
    var ya = lineasVale().filter(function (f) { return f.dataset.cod === m.codigo && f.querySelector('.v-marca').value.trim().toUpperCase() === mc; })[0];
    if (ya) { var q = ya.querySelector('.v-c'); q.value = (+q.value || 0) + 1; toast(m.nombre + (mc ? ' · ' + mc : '') + ': ' + q.value, 'ok'); }
    else {
      var f = div.querySelector('.v-txt').value.trim() ? (filaVale(), lineasVale().pop()) : div;
      f.querySelector('.v-txt').value = m.nombre; f.dataset.cod = m.codigo; f.dataset.ean = ''; f.querySelector('.nolista').innerHTML = '';
      f.querySelector('.v-marca').value = mc; f.querySelector('.v-c').value = 1; infoLinea(f, mc ? 'Marca ' + mc : '');
    }
    lineaVaciaAlFinal();
  });
}
