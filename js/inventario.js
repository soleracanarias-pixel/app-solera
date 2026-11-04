// APP SOLERA · inventario como evento
// (index.html carga, por este orden: base.js, parte.js, almacen.js, inventario.js, herramientas.js, admin.js; al final, arrancar())
'use strict';

// ---------------------------------------------------------------- inventario como evento
// Mateo (999) lo abre con un almacén, fecha, nombre y quién cuenta cada categoría (y las máquinas); solo mientras
// está abierto, cada participante ve la pestaña Inventario con SUS categorías, sin el stock de la app.
// Lo contado se guarda en el móvil (borrador) y se entrega con "He terminado" (también sin cobertura: se envía solo).
// Al cerrar, Mateo revisa, corrige si hace falta y "Cerrar y ajustar" crea el vale AJUSTE en el servidor.
function esMateo() { return !!S.usuario && String(S.usuario.codigo) === '999'; }
function inventariosAbiertos() { return (S.datos && S.datos.inventarios) || []; }
function misInventarios() {
  var yo = S.usuario ? String(S.usuario.codigo) : '';
  return inventariosAbiertos().filter(function (i) { return Object.keys(i.asignacion).some(function (c) { return String(i.asignacion[c]) === yo; }); });
}
function misCategorias(ev) { var yo = String(S.usuario.codigo); return Object.keys(ev.asignacion).filter(function (c) { return String(ev.asignacion[c]) === yo; }); }
function inventarioEn(alm) { return inventariosAbiertos().filter(function (i) { return i.almacen === alm; })[0] || null; }
function verPestanaInventario() { return esMateo() || misInventarios().length > 0; }
// códigos pendientes de asociar (en Almacén, para Mateo y Gregorio)
function pintarPendientesEan() {
  var l = ((S.datos && S.datos.eansPendientes) || []).filter(function (p) { return !eanConocido(p.ean); });
  var nombre = function (c) { var m = materialesActivos().filter(function (x) { return x.codigo === c; })[0]; return m ? m.nombre : (c || ''); };
  var ver = puedeInventario() && l.length > 0;
  $('eanPendientes').style.display = ver ? '' : 'none';
  if (!ver) return;
  $('eanPendientes').innerHTML = '<h2>Códigos pendientes de asociar · ' + l.length + '</h2><div class="lista">' + l.map(function (p) {
    return '<div class="item"><div><b>' + esc(p.ean) + '</b><small>' + (p.sugerido ? 'eligieron ' + esc(nombre(p.sugerido)) : '') + (p.visto_en ? ' · ' + esc(p.visto_en) : '') + '</small></div>' +
      '<button class="btn peq" data-ean="' + esc(p.ean) + '" data-sug="' + esc(p.sugerido) + '">Asociar</button></div>';
  }).join('') + '</div>';
}
$('eanPendientes').onclick = function (e) {
  var b = e.target.closest('[data-ean]'); if (!b) return;
  asociarEan(b.dataset.ean, b.dataset.sug).then(function (r) { if (r) pintarPendientesEan(); });
};
function abrirInventario() {
  if (!verPestanaInventario()) return cambiar('almacen');
  pintarListasFecha();
  if (esMateo()) pintarGestion();
  var mis = misInventarios();
  $('invNada').style.display = !mis.length && !esMateo() ? '' : 'none';
  $('invContar').style.display = mis.length ? '' : 'none';
  if (!mis.length) return Promise.resolve();
  $('invEvento').style.display = mis.length > 1 ? '' : 'none';
  $('invEvento').innerHTML = mis.map(function (i) { return '<option value="' + esc(i.id) + '">' + esc(i.nombre) + '</option>'; }).join('');
  if (S.inv && mis.some(function (i) { return i.id === S.inv.evento; })) $('invEvento').value = S.inv.evento;
  return cargarInv();
}
$('invEvento').onchange = function () { guardarInv().then(cargarInv); };
// ---- contar (participante)
S.inv = null;
function eventoActual() { var id = $('invEvento').value; return misInventarios().filter(function (i) { return i.id === id; })[0] || misInventarios()[0]; }
function claveInv(ev) { return 'inv-ev-' + ev + '-' + (S.usuario ? S.usuario.codigo : ''); }
function cargarInv() {
  var ev = eventoActual();
  return DB.get('kv', claveInv(ev.id)).then(function (b) {
    S.inv = b && b.mats ? b : { evento: ev.id, inicio: '', mats: {}, maq: {}, otros: [], fotos: [], fotosEnviadas: [], terminado: '' };
    S.invEv = ev; S.invCats = misCategorias(ev);
    $('invTitulo').textContent = ev.nombre;
    var mat = S.invCats.some(function (c) { return c !== 'MAQUINAS'; }), maq = S.invCats.indexOf('MAQUINAS') >= 0;
    $('invPestanas').style.display = mat && maq ? '' : 'none';
    $('invOtro').style.display = mat ? '' : 'none';
    if (mat) $('invTabMat').onclick(); else $('invTabMaq').onclick();
    $('invBuscar').value = '';
    pintarInv(); pintarMaq(); pintarOtros(); pintarFotosEn('invFotosGen', S.inv.fotos); infoInv();
  });
}
function tocarInv() {
  if (!S.inv.inicio) { S.inv.inicio = ahoraES(); toast('Inventario empezado. No borres los datos del navegador hasta enviarlo.'); }
  S.inv.terminado = '';   // si se cambia algo después de terminar, hay que volver a pulsar "He terminado"
  infoInv();
  clearTimeout(S.invT); S.invT = setTimeout(guardarInv, 300);
  // con cobertura, lo contado va llegando al servidor (sin fotos) para que Mateo vea cómo va
  clearTimeout(S.invEnvioT); S.invEnvioT = setTimeout(envioParcial, 20000);
}
function guardarInv() { return S.inv ? DB.put('kv', S.inv, claveInv(S.inv.evento)) : Promise.resolve(); }
function entregaInv(terminado) {
  var i = S.inv, lineas = [];
  Object.keys(i.mats).forEach(function (cod) {
    i.mats[cod].forEach(function (e) { if (e.contado !== '' && e.contado != null && +e.contado >= 0) lineas.push({ id: e.id, material: cod, marca: String(e.marca || '').trim().toUpperCase(), contado: +e.contado, contadoEn: e.contadoEn || '', ean: e.ean || '' }); });
  });
  return { inventario: i.evento, terminado: !!terminado, lineas: lineas,
    otros: i.otros.map(function (o) { return { id: o.id, nombre: o.nombre, unidad: o.unidad, contado: o.cantidad, marca: o.marca, contadoEn: o.contadoEn || '' }; }),
    maquinas: Object.keys(i.maq).map(function (p) { var m = i.maq[p]; return { id: m.id, prefijo: p, bien: +m.bien || 0, regular: +m.regular || 0, averiada: +m.averiada || 0, contadoEn: m.contadoEn || '' }; }) };
}
function envioParcial() {
  if (!S.inv || S.inv.terminado || !navigator.onLine) return;
  DB.get('kv', 'pin-' + S.usuario.codigo).then(function (pin) {
    if (pin) api('invEntrega', { entrega: entregaInv(false), auth: { codigo: S.usuario.codigo, pin: pin } }).catch(function () {});
  });
}
function contadosInv() {
  var n = 0; Object.keys(S.inv.mats).forEach(function (c) { if (S.inv.mats[c].some(function (e) { return e.contado !== '' && e.contado != null; })) n++; });
  return n;
}
function infoInv() {
  var i = S.inv, maq = Object.keys(i.maq).filter(function (p) { var m = i.maq[p]; return (+m.bien || 0) + (+m.regular || 0) + (+m.averiada || 0) > 0; }).length;
  $('invInfo').textContent = 'Te toca: ' + S.invCats.map(function (c) { return c === 'MAQUINAS' ? 'MÁQUINAS' : c; }).join(', ') + ' · ' + nombreAlmacen(S.invEv.almacen).split(' · ')[0] +
    (i.inicio ? ' · empezado el ' + i.inicio + ' · ' + contadosInv() + ' material(es), ' + maq + ' tipo(s) de máquina, ' + i.otros.length + ' a mano · borrador guardado en el móvil' : '');
  $('invEstado').innerHTML = i.terminado ? '<div class="aviso ok">✅ Entregado (' + esc(i.terminado) + '). Si cambias algo, vuelve a pulsar "He terminado".</div>' : '';
}
function matsInv() { return materialesActivos().filter(function (m) { return m.en_almacen !== 'NO' && S.invCats.indexOf(m.categoria || '') >= 0; }); }
function entradas(cod) { return S.inv.mats[cod] && S.inv.mats[cod].length ? S.inv.mats[cod] : [{ id: uid(), marca: '', contado: '' }]; }
function htmlMat(m) {
  var en = entradas(m.codigo), lleno = en.some(function (e) { return e.contado !== '' && e.contado != null; });
  // sin el stock de la app, para no condicionar el recuento
  return '<div class="inv-mat' + (lleno ? ' inv-lleno' : '') + '" data-cod="' + esc(m.codigo) + '"><div class="inv-cab"><b>' + esc(m.nombre) + '</b><small>' + esc(m.unidad) + '</small></div>' +
    en.map(function (e, i) {
      return '<div class="inv-ent" data-i="' + i + '"><input type="text" class="inv-marca" placeholder="Marca (opcional)" value="' + esc(e.marca || '') + '" autocomplete="off">' +
        '<input type="number" class="inv-c" inputmode="decimal" step="any" min="0" placeholder="Contado" value="' + esc(e.contado == null ? '' : e.contado) + '">' +
        (e.foto ? '<span class="inv-mini"><img src="' + e.foto + '" data-quitar="1" title="Quitar foto"></span>' : '<button class="inv-foto" title="Foto"><svg class="ico"><use href="#i-camara"/></svg></button>') + '</div>';
    }).join('') + '<button class="inv-mas">+ otra marca</button></div>';
}
function pintarInv() {
  var q = normal($('invBuscar').value).split(/[^a-z0-9,]+/).filter(Boolean), cat = null, h = '';
  matsInv().filter(function (m) {
    return !q.length || encaja(q, m.nombre) || String(m.alias || '').split(',').concat(String(m.refs || '').split(',')).some(function (a) { return a.trim() && encaja(q, a); });
  }).slice().sort(function (a, b) { return (a.categoria || 'ZZ').localeCompare(b.categoria || 'ZZ') || a.nombre.localeCompare(b.nombre); }).forEach(function (m) {
    if ((m.categoria || 'OTROS') !== cat) { cat = m.categoria || 'OTROS'; h += '<div class="inv-cat">' + esc(cat) + '</div>'; }
    h += htmlMat(m);
  });
  $('invLista').innerHTML = h || '<div class="aviso">Ningún material con ese nombre en tus categorías. Si no está en la lista, usa "+ material que no está en la lista".</div>';
}
function repintarMat(cod) {
  var d = $('invLista').querySelector('.inv-mat[data-cod="' + cod + '"]'), m = matsInv().filter(function (x) { return x.codigo === cod; })[0];
  if (d && m) d.outerHTML = htmlMat(m);
}
$('invBuscar').oninput = pintarInv;
$('invLista').oninput = function (e) {
  var d = e.target.closest('.inv-mat'), ent = e.target.closest('.inv-ent'); if (!d || !ent) return;
  var cod = d.dataset.cod, i = +ent.dataset.i;
  S.inv.mats[cod] = entradas(cod).slice(); S.inv.mats[cod][i] = Object.assign({}, S.inv.mats[cod][i], { contadoEn: ahoraES() });   // quién y cuándo: este móvil, ahora
  if (e.target.classList.contains('inv-c')) S.inv.mats[cod][i].contado = e.target.value;
  if (e.target.classList.contains('inv-marca')) S.inv.mats[cod][i].marca = e.target.value;
  d.classList.toggle('inv-lleno', S.inv.mats[cod].some(function (x) { return x.contado !== '' && x.contado != null; }));
  tocarInv();
};
$('invLista').onclick = function (e) {
  var d = e.target.closest('.inv-mat'); if (!d) return;
  var cod = d.dataset.cod, ent = e.target.closest('.inv-ent');
  if (e.target.classList.contains('inv-mas')) { S.inv.mats[cod] = entradas(cod).concat([{ id: uid(), marca: '', contado: '' }]); repintarMat(cod); tocarInv(); return; }
  if (e.target.classList.contains('inv-foto')) { S.invFotoPara = { cod: cod, i: +ent.dataset.i }; $('invFotoInput').click(); return; }
  if (e.target.dataset.quitar) preguntar('¿Quitar esta foto?', 'Quitar', 'Dejarla').then(function (ok) {
    if (!ok) return; S.inv.mats[cod] = entradas(cod).slice(); S.inv.mats[cod][+ent.dataset.i] = Object.assign({}, S.inv.mats[cod][+ent.dataset.i], { foto: null, fotoId: null }); repintarMat(cod); tocarInv();
  });
};
// fotos: una por línea y generales, comprimidas a ~1600 px
$('invFotoInput').onchange = function () {
  var f = this.files && this.files[0], para = S.invFotoPara; this.value = ''; if (!f || !para) return;
  comprimir(f, 1600).then(function (d) {
    if (!d) return toast('No se pudo leer la foto');
    if (para.otro) { S.inv.otros.forEach(function (o) { if (o.id === para.otro) { o.foto = d; o.fotoId = uid(); } }); pintarOtros(); }
    else if (para.general) { S.inv.fotos.push(d); pintarFotosEn('invFotosGen', S.inv.fotos); }
    else { S.inv.mats[para.cod] = entradas(para.cod).slice(); S.inv.mats[para.cod][para.i] = Object.assign({}, S.inv.mats[para.cod][para.i], { foto: d, fotoId: uid() }); repintarMat(para.cod); }
    tocarInv();
  });
};
$('invFotoGen').onclick = function () { S.invFotoPara = { general: true }; $('invFotoInput').click(); };
$('invFotosGen').onclick = function () { setTimeout(tocarInv, 0); };
$('invTabMat').onclick = function () { this.classList.add('activa'); $('invTabMaq').classList.remove('activa'); $('invBloqueMat').style.display = ''; $('invBloqueMaq').style.display = 'none'; };
$('invTabMaq').onclick = function () { this.classList.add('activa'); $('invTabMat').classList.remove('activa'); $('invBloqueMat').style.display = 'none'; $('invBloqueMaq').style.display = ''; };
// escanear: va al material, a la línea de esa marca, y salta al contado. Código desconocido: se elige el material
// (Mateo y Gregorio pueden asociarlo en ese momento; si no, queda pendiente de asociar)
$('invEscanear').onclick = function () {
  escanear().then(function (c) {
    if (!c) return null;
    var e = eanConocido(c);
    if (e) return e;
    return puedeInventario() ? asociarEan(c) : elegirMaterialEan(c, matsInv);
  }).then(function (e) {
    if (!e) return;
    var m = matsInv().filter(function (x) { return x.codigo === e.material; })[0];
    if (!m) return toast('Ese material no está en tus categorías de este inventario');
    var en = entradas(m.codigo).slice(), mc = (e.marca || '').toUpperCase(), i = -1;
    en.forEach(function (x, j) { if (i < 0 && String(x.marca || '').trim().toUpperCase() === mc) i = j; });
    if (i < 0) { var vacia = en.length === 1 && !en[0].marca && (en[0].contado === '' || en[0].contado == null); if (vacia) { en[0] = Object.assign({}, en[0], { marca: mc }); i = 0; } else { en.push({ id: uid(), marca: mc, contado: '' }); i = en.length - 1; } }
    if (e.pendiente) en[i] = Object.assign({}, en[i], { ean: e.ean });
    S.inv.mats[m.codigo] = en; tocarInv();
    $('invTabMat').onclick(); $('invBuscar').value = m.nombre; pintarInv();
    var inp = $('invLista').querySelector('.inv-mat[data-cod="' + m.codigo + '"] .inv-ent[data-i="' + i + '"] .inv-c');
    if (inp) { inp.focus(); if (inp.select) inp.select(); }
  });
};
// máquinas: por tipo, cuántas bien / regular / averiadas
function pintarMaq() {
  var tipos = (S.datos && S.datos.herrTipos) || [];
  $('invMaqLista').innerHTML = tipos.map(function (t) {
    var m = S.inv.maq[t.prefijo] || {};
    var c = function (k) { return '<input type="number" inputmode="numeric" min="0" step="1" data-p="' + esc(t.prefijo) + '" data-k="' + k + '" value="' + esc(m[k] == null ? '' : m[k]) + '">'; };
    // andamios (CANTIDAD): una sola casilla, cuántos hay de ese tipo
    if (t.control === 'CANTIDAD') return '<div class="maq"><div><b>' + esc(t.nombre) + '</b><small>' + esc(t.prefijo) + ' · cantidad</small></div><div style="grid-column:span 3">' + c('bien').replace('<input', '<input placeholder="Cuántos"') + '</div></div>';
    return '<div class="maq"><div><b>' + esc(t.nombre) + '</b><small>' + esc(t.prefijo) + '</small></div>' + c('bien') + c('regular') + c('averiada') + '</div>';
  }).join('') || '<div class="aviso">No hay tipos de máquina en HERR_TIPOS.</div>';
}
$('invMaqLista').oninput = function (e) {
  var p = e.target.dataset.p; if (!p) return;
  S.inv.maq[p] = Object.assign({ id: uid() }, S.inv.maq[p], { contadoEn: ahoraES() }); S.inv.maq[p][e.target.dataset.k] = e.target.value; tocarInv();
};
// a mano: material que no está en la lista (queda como OTRO)
function pintarOtros() {
  $('invOtros').innerHTML = S.inv.otros.length ? '<div class="inv-cat">A mano (no están en la lista)</div>' + S.inv.otros.map(function (o) {
    return '<div class="inv-mat" data-otro="' + esc(o.id) + '"><div class="inv-cab"><b>' + esc(o.nombre) + '</b><small>' + esc(o.cantidad) + ' ' + esc(o.unidad) + (o.marca ? ' · ' + esc(o.marca) : '') + '</small></div>' +
      '<div class="inv-ent">' + (o.foto ? '<span class="inv-mini"><img src="' + o.foto + '"></span>' : '<button class="otro-foto"><svg class="ico"><use href="#i-camara"/></svg></button>') + '<button class="otro-quitar" style="color:var(--rojo)">×</button></div></div>';
  }).join('') : '';
}
$('invOtros').onclick = function (e) {
  var d = e.target.closest('[data-otro]'); if (!d) return;
  if (e.target.classList.contains('otro-foto')) { S.invFotoPara = { otro: d.dataset.otro }; $('invFotoInput').click(); }
  if (e.target.classList.contains('otro-quitar')) preguntar('¿Quitar este material?', 'Quitar', 'Dejarlo').then(function (ok) {
    if (ok) { S.inv.otros = S.inv.otros.filter(function (o) { return o.id !== d.dataset.otro; }); pintarOtros(); tocarInv(); }
  });
};
$('invOtro').onclick = function () {
  $('otroNombre').value = ''; $('otroCant').value = ''; $('otroMarca').value = ''; $('otroUnidad').value = 'ud';
  $('modalOtro').classList.add('activa'); $('otroNombre').focus();
};
$('otroCancelar').onclick = function () { $('modalOtro').classList.remove('activa'); };
$('otroGuardar').onclick = function () {
  var n = $('otroNombre').value.trim(), q = $('otroCant').value;
  if (!n) return toast('Escribe el nombre'); if (q === '' || !(+q >= 0)) return toast('Escribe la cantidad');
  S.inv.otros.push({ id: uid(), nombre: n.toUpperCase(), unidad: $('otroUnidad').value, cantidad: +q, marca: $('otroMarca').value.trim().toUpperCase(), foto: null, contadoEn: ahoraES() });
  $('modalOtro').classList.remove('activa'); pintarOtros(); tocarInv();
};
// "He terminado": la entrega y las fotos van a la cola (se envían solas al volver la cobertura, primero lo contado y luego las fotos)
$('invTerminar').onclick = function () {
  var ent = entregaInv(true), i = S.inv;
  if (!ent.lineas.length && !ent.otros.length && !ent.maquinas.some(function (m) { return m.bien + m.regular + m.averiada > 0; })) return toast('No has contado nada todavía');
  var fotos = [];
  Object.keys(i.mats).forEach(function (cod) { i.mats[cod].forEach(function (e) { if (e.foto && e.contado !== '' && e.contado != null) fotos.push({ lineaId: e.id, fotoId: e.fotoId || e.id, dato: e.foto }); }); });
  i.otros.forEach(function (o) { if (o.foto) fotos.push({ lineaId: o.id, fotoId: o.fotoId || o.id, dato: o.foto }); });
  i.fotos.forEach(function (d, n) { fotos.push({ lineaId: '', fotoId: i.evento + '-g' + n + '-' + d.length, dato: d }); });
  fotos = fotos.filter(function (f) { return i.fotosEnviadas.indexOf(f.fotoId) < 0; });
  preguntar('¿Has terminado tu parte?\n' + ent.lineas.length + ' línea(s) de material, ' + ent.otros.length + ' a mano, ' + ent.maquinas.length + ' tipo(s) de máquina y ' + fotos.length + ' foto(s) nueva(s).\nSe enviará solo cuando haya cobertura.', 'He terminado', 'Seguir contando').then(function (ok) {
    if (!ok) return;
    return DB.get('kv', 'pin-' + S.usuario.codigo).then(function (pin) {
      if (!pin) return toast('Para entregar el inventario, sal y vuelve a entrar con tu PIN (con cobertura)');
      var ahora = new Date().toISOString(), auth = { codigo: S.usuario.codigo, pin: pin };
      var items = [{ id: uid(), tipo: 'invEntrega', inventario: i.evento, nombre: S.invEv.nombre, entrega: ent, auth: auth, fecha: hoyISO(), hora: ahoraES().slice(11), creadoEn: ahora, nFotos: fotos.length }]
        .concat(fotos.map(function (f, n) { return { id: uid(), tipo: 'fotoInv', inventario: i.evento, nombre: S.invEv.nombre, lineaId: f.lineaId, fotoId: f.fotoId, dato: f.dato, n: n + 1, total: fotos.length, fecha: hoyISO(), creadoEn: ahora }; }));
      return items.reduce(function (p, it) { return p.then(function () { return DB.put('cola', it); }); }, Promise.resolve()).then(function () {
        i.fotosEnviadas = i.fotosEnviadas.concat(fotos.map(function (f) { return f.fotoId; }));
        i.terminado = ahoraES(); return guardarInv();
      }).then(function () {
        infoInv(); actualizarPend();
        toast(navigator.onLine ? 'Entregando…' : 'Guardado en el móvil: se enviará solo cuando haya cobertura', 'ok');
        if (navigator.onLine) sincronizar();
      });
    });
  });
};
// código desconocido (quien no asocia): solo se elige el material; el código queda pendiente de asociar
function elegirMaterialEan(c, lista) {
  return new Promise(function (res) {
    var elegido = null;
    $('eanTxt').textContent = 'Código no conocido. Elige el material (el código quedará pendiente de asociar).';
    $('eanMatTxt').value = ''; $('eanMarcaBloque').style.display = 'none';
    buscador($('eanMatTxt'), $('eanMatSugs'), lista, function (m) { elegido = m; });
    $('modalEan').classList.add('activa');
    var fin = function (r) { $('modalEan').classList.remove('activa'); $('eanMarcaBloque').style.display = ''; res(r); };
    $('eanCancelar').onclick = function () { fin(null); };
    $('eanGuardar').onclick = function () { if (!elegido) return toast('Elige el material de la lista'); fin({ ean: c, material: elegido.codigo, marca: '', pendiente: true }); };
  });
}
// ---- Mateo: abrir, repartir, revisar y cerrar
function pintarGestion() {
  var l = inventariosAbiertos();
  $('invAbiertos').innerHTML = l.length ? l.map(function (i) {
    return '<div class="aviso"><b>' + esc(i.nombre) + '</b> · ' + esc(nombreAlmacen(i.almacen).split(' · ')[0]) + '<br>' +
      i.participantes.map(function (p) { return (i.terminados[p.codigo] ? '✅ ' : '⏳ ') + esc(p.nombre); }).join(' · ') +
      '<div class="fila"><button class="btn peq" data-rev="' + esc(i.id) + '">Revisar y cerrar</button><button class="btn peq sec" data-edit="' + esc(i.id) + '">Cambiar reparto</button></div></div>';
  }).join('') : '<div class="ayuda">No hay ningún inventario abierto.</div>';
}
$('invAbiertos').onclick = function (e) {
  var r = e.target.closest('[data-rev]'), ed = e.target.closest('[data-edit]');
  if (r) revisarInv(r.dataset.rev);
  if (ed) formInventario(inventariosAbiertos().filter(function (i) { return i.id === ed.dataset.edit; })[0]);
};
function categoriasInventario() {
  var c = {}; materialesActivos().forEach(function (m) { if (m.en_almacen !== 'NO') c[m.categoria || 'OTROS'] = true; });
  return Object.keys(c).sort().concat(['MAQUINAS']);
}
function formInventario(ev) {
  S.invEditando = ev || null;
  $('invNuevo').style.display = ''; $('invNuevoBtn').style.display = 'none'; $('invRevision').style.display = 'none';
  opcionesAlmacen('nvAlmacen', ev ? ev.almacen : (almacenes().filter(function (a) { return a.por_defecto; })[0] || almacenes()[0]).codigo);
  $('nvAlmacen').disabled = !!ev; $('nvFecha').disabled = !!ev;
  $('nvFecha').value = hoyISO(); $('nvNombre').value = ev ? ev.nombre : ''; S.nvNombreAuto = !ev; if (!ev) nombreAuto();
  var trabs = ((S.datos && S.datos.trabajadores) || []);
  $('nvAsig').innerHTML = categoriasInventario().map(function (c) {
    var actual = ev ? String(ev.asignacion[c] || '') : '';
    return '<div class="fila" style="align-items:center;margin-top:6px"><div><b>' + (c === 'MAQUINAS' ? 'MÁQUINAS' : esc(c)) + '</b></div><div><select data-cat="' + esc(c) + '"><option value="">— nadie —</option>' +
      trabs.map(function (t) { return '<option value="' + esc(t.codigo) + '"' + (String(t.codigo) === actual ? ' selected' : '') + '>' + esc(t.nombre) + '</option>'; }).join('') + '</select></div></div>';
  }).join('');
  $('nvGuardar').textContent = ev ? 'Guardar reparto' : 'Abrir inventario';
}
function nombreAuto() {
  if (!S.nvNombreAuto) return;
  var a = nombreAlmacen($('nvAlmacen').value).split(' · ')[0].replace(/^ALMACÉN /, '').toLowerCase().replace(/(^|\s)\S/g, function (x) { return x.toUpperCase(); });
  $('nvNombre').value = 'Inventario ' + a + ' ' + fechaES($('nvFecha').value);
}
$('nvAlmacen').onchange = nombreAuto; $('nvFecha').onchange = nombreAuto; $('nvNombre').oninput = function () { S.nvNombreAuto = false; };
$('invNuevoBtn').onclick = function () { formInventario(null); };
$('nvCancelar').onclick = function () { $('invNuevo').style.display = 'none'; $('invNuevoBtn').style.display = ''; };
$('nvGuardar').onclick = function () {
  var asig = {}; $('nvAsig').querySelectorAll('select').forEach(function (s) { if (s.value) asig[s.dataset.cat] = s.value; });
  if (!Object.keys(asig).length) return toast('Asigna al menos una categoría a alguien');
  if (!navigator.onLine) return toast('Para abrir el inventario hace falta cobertura');
  authAdmin().then(function (auth) {
    return api('invGuardar', { auth: auth, inventario: { id: S.invEditando ? S.invEditando.id : '', almacen: $('nvAlmacen').value, fecha: $('nvFecha').value, nombre: $('nvNombre').value.trim(), asignacion: asig } });
  }).then(function () {
    toast(S.invEditando ? 'Reparto guardado' : 'Inventario abierto: a cada participante le sale la pestaña Inventario al actualizar las listas', 'ok');
    $('invNuevo').style.display = 'none'; $('invNuevoBtn').style.display = '';
    return cargarDatos(true).then(abrirInventario);
  }).catch(function (e) { toast(e.message, 'err'); });
};
function revisarInv(id) {
  if (!navigator.onLine) return toast('Para revisar y cerrar hace falta cobertura');
  var r = $('invRevision'); r.style.display = ''; r.innerHTML = 'Cargando…'; S.revId = id;
  authAdmin().then(function (auth) { return api('invRevision', { auth: auth, id: id }); }).then(pintarRevision)
    .catch(function (e) { r.innerHTML = '<div class="aviso err">' + esc(e.message) + '</div>'; });
}
function pintarRevision(j) {
  var inv = j.inventario, h = '<h2>Revisar: ' + esc(inv.nombre) + '</h2>';
  if (j.pendientes.length) h += '<div class="aviso err">⏳ Sin terminar: ' + j.pendientes.map(function (p) { return 'pendiente: ' + esc(p); }).join(' · ') + '</div>';
  h += '<div class="lista">' + j.categorias.map(function (c) {
    return '<div class="item"><div><b>' + (c.categoria === 'MAQUINAS' ? 'MÁQUINAS' : esc(c.categoria)) + '</b><small>' + esc(c.quien) + (c.terminado ? ' · ✅ terminado ' + esc(c.terminado) : ' · ⚠️ sin terminar' + (c.ultimo_envio ? ' (último envío ' + esc(c.ultimo_envio) + ')' : ' (aún no ha enviado nada)')) +
      (c.categoria !== 'MAQUINAS' ? ' · ' + c.contados + ' de ' + c.materiales + ' materiales contados' : '') + '</small></div></div>';
  }).join('') + '</div>';
  var cat = null;
  h += '<table class="rev"><tr><th>Material</th><th>Contado (quién)</th><th>App</th><th>Dif.</th></tr>' + j.materiales.map(function (m) {
    var cab = m.categoria !== cat ? (cat = m.categoria, '<tr><td colspan="4" class="inv-cat">' + esc(cat) + '</td></tr>') : '';
    return cab + '<tr><td><b>' + esc(m.material) + '</b></td><td>' + m.lineas.map(function (l) {
      return '<div>' + (l.marca ? esc(l.marca) + ': ' : '') + '<input type="number" class="rev-c" data-l="' + esc(l.id) + '" value="' + esc(l.valor) + '" step="any" min="0"> <small>' + esc(l.quien) + (l.contado_en ? ' ' + esc(l.contado_en) : '') +
        (l.corregido !== '' ? ' · corregido por ' + esc(l.corregido_por) + ' (contó ' + esc(l.contado) + ')' : '') + '</small>' + l.fotos.map(function (u) { return ' <a href="' + esc(u) + '" target="_blank">📷</a>'; }).join('') + '</div>';
    }).join('') + '</td><td>' + esc(m.stock) + ' ' + esc(m.unidad) + '</td><td class="' + (m.diferencia ? 'dif' : '') + '">' + (m.diferencia > 0 ? '+' : '') + esc(m.diferencia) + '</td></tr>';
  }).join('') + '</table>';
  if (j.otros.length) h += '<label>OTRO nuevos · a mano</label>' + j.otros.map(function (o) { return '<div>⚠️ ' + esc(o.material) + ' · ' + esc(o.valor) + ' ' + esc(o.unidad) + (o.marca ? ' · ' + esc(o.marca) : '') + ' · ' + esc(o.quien) + '</div>'; }).join('');
  if (j.maquinas.length) h += '<label>Máquinas</label>' + j.maquinas.map(function (q) {
    var faltan = Math.max(0, q.contado - q.en_almacen);
    return '<div>' + esc(q.material) + ': ' + q.contado + ' (bien ' + q.bien + ', regular ' + q.regular + ', averiada ' + q.averiada + ') · en la app ' + q.en_almacen + (faltan ? ' · <b>' + faltan + ' alta(s) nueva(s)</b>' : '') + ' · ' + esc(q.quien) + '</div>';
  }).join('');
  if (j.vales.length) h += '<label>Vales hechos durante el inventario · revisar</label>' + j.vales.map(function (v) { return '<div' + (v.anulado ? ' class="anulado"' : '') + '>⚠️ Nº ' + esc(v.numero) + ' · ' + esc(TIPO_VALE[v.tipo] || v.tipo) + ' · ' + esc(v.fecha) + ' ' + esc(v.hora) + ' · ' + esc(v.obra || '') + ' · ' + esc(v.usuario) + '</div>'; }).join('');
  h += '<button class="btn verde" id="revCerrar">Cerrar y ajustar</button><button class="btn peq sec" id="revAnular" style="width:100%">Anular este inventario (sin ajustar)</button>';
  $('invRevision').innerHTML = h;
  $('revCerrar').onclick = function () {
    preguntar('¿Cerrar "' + inv.nombre + '" y ajustar el stock?' + (j.pendientes.length ? '\n⚠️ Aún hay gente sin terminar: lo que no hayan enviado no contará.' : '') + '\nEl ajuste se calcula con el stock de ahora.', 'Cerrar y ajustar', 'Todavía no').then(function (ok) {
      if (!ok) return;
      authAdmin().then(function (auth) { return api('invCerrar', { auth: auth, id: inv.id }); }).then(function (r) {
        var altas = r.altas || [];
        $('invRevision').innerHTML = '<h2>Inventario cerrado</h2><div class="aviso ok">Vale AJUSTE ' + esc(r.numero) + ' con ' + r.n_lineas + ' línea(s). Se puede anular desde Vales.</div>' +
          (altas.length ? '<label>Números para rotular en las máquinas nuevas</label><div class="numeros">' + altas.map(function (a) { return esc(a.codigo); }).join(', ') + '</div><div class="ayuda">✍️ Escríbelos con el rotulador.</div>' : '');
        cargarDatos(true).then(function () { pintarGestion(); });
      }).catch(function (e) { toast(e.message, 'err'); });
    });
  };
  $('revAnular').onclick = function () {
    preguntar('¿Anular "' + inv.nombre + '"? No se ajusta nada y a los participantes les desaparece la pestaña.', 'Anular', 'No').then(function (ok) {
      if (!ok) return;
      authAdmin().then(function (auth) { return api('invAnular', { auth: auth, id: inv.id }); }).then(function () {
        $('invRevision').style.display = 'none'; toast('Inventario anulado'); cargarDatos(true).then(pintarGestion);
      }).catch(function (e) { toast(e.message, 'err'); });
    });
  };
}
// corregir una cantidad antes de cerrar (queda anotado quién la cambió)
$('invRevision').addEventListener('change', function (e) {
  if (!e.target.classList.contains('rev-c')) return;
  authAdmin().then(function (auth) { return api('invCorregir', { auth: auth, id: S.revId, lineaId: e.target.dataset.l, contado: e.target.value }); })
    .then(function () { toast('Corregido', 'ok'); revisarInv(S.revId); }).catch(function (er) { toast(er.message, 'err'); });
});
