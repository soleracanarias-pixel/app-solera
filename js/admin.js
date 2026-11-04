// APP SOLERA · admin: vales y resumen
// (index.html carga, por este orden: base.js, parte.js, almacen.js, inventario.js, herramientas.js, admin.js; al final, arrancar())
'use strict';

// ---------------------------------------------------------------- vales (solo admin; el servidor comprueba el rol)
function authAdmin() {
  return DB.get('kv', 'pin-' + S.usuario.codigo).then(function (pin) {
    if (!pin) throw new Error('Sal y vuelve a entrar con tu PIN (con cobertura)');
    return { codigo: S.usuario.codigo, pin: pin };
  });
}
function buscarVales() {
  if (!navigator.onLine) return toast('Los vales se ven con conexión');
  $('valesLista').innerHTML = '<div class="aviso">Buscando…</div>';
  authAdmin().then(function (auth) {
    return api('vales', { auth: auth, filtros: { desde: $('fDesde').value, hasta: $('fHasta').value, trabajador: $('fTrab').value.trim(), tipo: $('fTipo').value, almacen: $('fAlm').value, obra: $('fObra').value.trim(), buscar: $('fBuscar').value.trim(), revisar: $('fRevisar').checked } });
  }).then(function (j) {
    S.vales = j.vales; S.valesAdmin = j.admin !== false;
    // encargado: solo sus vales y los de su cuadrilla (quienes coincidieron con él en vales en los últimos 30 días)
    $('valesAyuda').style.display = S.valesAdmin ? 'none' : '';
    $('valesAyuda').textContent = S.valesAdmin ? '' : 'Ves tus vales y los de tu cuadrilla (' + (j.cuadrilla || []).join(', ') + '). Para anular uno, díselo a Mateo.';
    pintarVales();
  }).catch(function (e) { $('valesLista').innerHTML = '<div class="aviso err">' + esc(e.message) + '</div>'; });
}
// dónde va o de dónde sale cada vale: almacén, obra o los dos (las compras dicen su destino)
function lugarVale(x) {
  var alm = function (c) { return esc(nombreAlmacen(c).split(' · ')[0]); };
  if (x.tipo === 'COMPRA_OBRA') return 'Destino: obra ' + esc(x.obra);
  if (x.tipo === 'ENTRADA') return 'Destino: ' + alm(x.almacen);
  if (x.tipo === 'TRASPASO') return alm(x.almacen) + ' → ' + alm(x.almacen_destino);
  return (x.almacen ? alm(x.almacen) : '') + (x.obra ? (x.almacen ? ' · ' : '') + esc(x.obra) : '');
}
function pintarVales() {
  var v = S.vales || [];
  $('valesLista').innerHTML = v.length ? v.map(function (x, i) {
    return '<div class="item toca vale-item' + (x.anulado ? ' anulado' : '') + '" data-i="' + i + '"><div><b>Nº ' + esc(x.numero) + ' · ' + esc(TIPO_VALE[x.tipo] || x.tipo) + ' · ' + esc(x.fecha) + ' ' + esc(x.hora) + '</b><small>' +
      lugarVale(x) + (x.proveedor ? ' · ' + esc(x.proveedor) : '') + (x.persona ? ' · ' + esc(x.persona) : '') + ' · anotado por ' + esc(x.usuario) + (x.movil_de ? ' <i>desde el móvil de ' + esc(x.movil_de) + '</i>' : '') + ' · ' + lineasTxt(x.n_lineas, 'línea') + (x.fotos.length ? ' · 📷 ' + x.fotos.length : '') + '</small>' +
      (x.lineas.length ? '<div class="vale-l1">' + esc(x.lineas[0].material) + (x.lineas[0].marca ? ' · ' + esc(x.lineas[0].marca) : '') + ' · ' + esc(x.lineas[0].cantidad) + ' ' + esc(x.lineas[0].unidad || '') + (x.lineas.length > 1 ? ' <small>(+' + (x.lineas.length - 1) + ' más)</small>' : '') + '</div>' : '') + '</div>' +
      '<span class="chips-vale">' + (x.revisar === 'SI' ? '<span class="chip revisar">REVISAR</span>' : '') +
      (x.anulado ? '<span class="chip anul">ANULADO</span>' : x.estado === 'PENDIENTE_LEER' ? '<span class="chip pend">PENDIENTE DE LEER</span>' : '') + '</span></div>';
  }).join('') : '<div class="aviso">No hay vales con esos filtros.</div>';
}
$('btnBuscarVales').onclick = buscarVales;
$('fBuscar').onkeydown = function (e) { if (e.key === 'Enter') buscarVales(); };
$('fRevisar').onchange = buscarVales;
$('valesLista').onclick = function (e) {
  if (e.target.closest('.det')) return;
  var it = e.target.closest('.vale-item'); if (!it) return;
  var sig = it.nextElementSibling;
  if (sig && sig.classList.contains('det')) { sig.remove(); return; }
  var x = S.vales[+it.dataset.i], d = document.createElement('div'); d.className = 'det vale-item';
  d.innerHTML = '<table>' + x.lineas.map(function (l) {
      return '<tr' + (l.anulado ? ' class="anulado"' : '') + '><td>' + l.linea + '</td><td><b>' + esc(l.material) + '</b>' + (l.material_codigo === 'OTRO' ? ' <span class="chip pend">OTRO</span>' : '') + (l.marca ? ' · ' + esc(l.marca) : '') + (l.fotos || []).map(function (u) { return ' <a href="' + esc(u) + '" target="_blank">📷</a>'; }).join('') +
        '</td><td>' + (l.contado !== '' && l.contado != null ? 'contado ' + esc(l.contado) + (l.stock_antes !== '' && l.stock_antes != null ? ' · había ' + esc(l.stock_antes) : '') + ' · dif. ' + (l.cantidad > 0 ? '+' : '') + esc(l.cantidad) : esc(l.cantidad)) + ' ' + esc(l.unidad || '') + '</td></tr>';
    }).join('') + '</table>' +
    (x.tipo === 'AJUSTE' ? '<div>Inventario de <b>' + esc(nombreAlmacen(x.almacen).split(' · ')[0]) + '</b> por ' + esc(x.usuario) + (x.inicio ? ' · empezado ' + esc(x.inicio) : '') + (x.cierre ? ' · cerrado ' + esc(x.cierre) : '') + '</div>' : '') +
    ((x.maquinas || []).length ? '<div>Máquinas: ' + x.maquinas.map(function (m) { return esc(m.tipo) + ' ' + m.total + ' (bien ' + m.bien + ', regular ' + m.regular + ', averiada ' + m.averiada + ')' + (m.altas ? ' · altas ' + esc(m.altas) : ''); }).join(' · ') + '</div>' : '') +
    (x.proveedor ? '<div>Proveedor: <b>' + esc(x.proveedor) + '</b> · ' + (x.tipo_doc === 'TICKET' ? 'Ticket' : 'Albarán') + ': <b>' + esc(x.albaran) + '</b>' + (x.estado ? ' · ' + esc(x.estado === 'PENDIENTE_LEER' ? 'pendiente de leer' : x.estado) : '') + '</div>' : '') +
    (x.estado === 'PENDIENTE_LEER' && !x.anulado && S.valesAdmin ? '<div class="completar"><label>Líneas del albarán</label><div class="compLineas"></div><button class="btn sec peq compOtra">+ otra línea</button><button class="btn verde peq compGuardar" style="margin-left:8px">Completar líneas</button></div>' : '') +
    (x.nota ? '<div>Comentario: ' + esc(x.nota) + '</div>' : '') +
    (x.nota_revisar ? '<div class="nota-revisar' + (x.revisar === 'SI' ? ' abierta' : '') + '"><b>' + (x.revisar === 'SI' ? 'Para revisar' : 'Revisado') + ':</b> ' + esc(x.nota_revisar).split(' | ').join('<br>') + '</div>' : '') +
    (x.revisar === 'SI' && S.valesAdmin ? '<div class="fila" style="margin-top:6px"><div><input type="text" class="notaRevisado" placeholder="Qué se ha hecho (opcional)"></div><button class="btn peq verde revisado" style="flex:0 0 auto">Revisado</button></div>' : '') +
    (x.movil_de ? '<div>Anotado por ' + esc(x.usuario) + ' desde el móvil de <b>' + esc(x.movil_de) + '</b></div>' : '') +
    (x.fotos.length ? '<div>' + x.fotos.map(function (u, i) { return '<a href="' + esc(u) + '" target="_blank">📎 adjunto ' + (i + 1) + '</a>'; }).join(' · ') + '</div>' : '') +
    (x.anulado ? '<div style="color:var(--rojo)">ANULADO por ' + esc(x.anulado_por) + ' el ' + esc(x.anulado_en) + ': ' + esc(x.motivo_anulacion) + '</div>'
      : S.valesAdmin ? '<div class="fila" style="margin-top:6px"><div><input type="text" class="motivo" placeholder="Motivo de la anulación (obligatorio)"></div><button class="btn peq rojo anular" style="flex:0 0 auto">ANULAR</button></div>' : '');
  it.after(d);
  // compra "solo foto": meter las líneas aquí; al guardarlas pasa a CONFIRMADA y entra en el stock
  var comp = d.querySelector('.completar');
  if (comp) {
    var caja = comp.querySelector('.compLineas'), todos = function () { return (S.datos && S.datos.materiales) || []; };
    var listaMat = x.tipo === 'COMPRA_OBRA' ? todos : function () { return todos().filter(function (m) { return m.en_almacen !== 'NO'; }); };
    filaVale(caja, listaMat);
    comp.querySelector('.compOtra').onclick = function () { filaVale(caja, listaMat); };
    comp.querySelector('.compGuardar').onclick = function () {
      limpiarErrores(comp);
      var lineas = leerLineasVale(caja);
      if (!lineas) return errorEn(S.campoFalta, S.campoFalta && S.campoFalta.classList.contains('v-c') ? 'Pon la cantidad' : 'Escribe el material');
      if (!lineas.length) return errorEn(caja.querySelector('.v-txt'), 'Añade al menos un material con su cantidad');
      if (!navigator.onLine) return toast('Hace falta cobertura', 'err');
      var otros = lineas.filter(function (l) { return l.material === 'OTRO'; });
      (otros.length ? preguntar('Hay ' + otros.length + ' línea(s) que no están en la lista (' + otros.map(function (l) { return l.materialNombre; }).join(', ') + '). Irán como OTRO y no cuentan en el stock. ¿Guardar igualmente?', 'Guardar', 'Revisar') : Promise.resolve(true)).then(function (ok) {
        if (!ok) return;
        return authAdmin().then(function (auth) { return api('valeCompletar', { auth: auth, numero: x.numero, lineas: lineas }); })
          .then(function (r) { toast('Vale ' + r.numero + ' completado: ' + lineasTxt(r.n_lineas) + ', ya cuenta en el stock', 'ok'); buscarVales(); cargarDatos(true); })
          .catch(function (e) { toast('No se pudo completar: ' + e.message, 'err'); });
      });
    };
  }
  var rv = d.querySelector('.revisado');
  if (rv) rv.onclick = function () {
    if (!navigator.onLine) return toast('Hace falta cobertura', 'err');
    authAdmin().then(function (auth) { return api('valeRevisado', { auth: auth, numero: x.numero, texto: d.querySelector('.notaRevisado').value.trim() }); })
      .then(function () { toast('Vale ' + x.numero + ' revisado', 'ok'); buscarVales(); })
      .catch(function (e) { toast('No se pudo marcar: ' + e.message, 'err'); });
  };
  var b = d.querySelector('.anular');
  if (b) b.onclick = function () {
    var motivo = d.querySelector('.motivo').value.trim();
    if (!motivo) return toast('Escribe el motivo');
    preguntar('¿Anular el vale ' + x.numero + '?\nNo se borra: queda marcado como anulado y deja de contar en el stock.', 'Anular', 'Cancelar').then(function (si) {
    if (!si) return;
    authAdmin().then(function (auth) { return api('anularVale', { auth: auth, numero: x.numero, motivo: motivo }); })
      .then(function () { toast('Vale ' + x.numero + ' anulado', 'ok'); buscarVales(); cargarDatos(true); })
      .catch(function (e) { toast('No se pudo anular: ' + e.message, 'err'); });
    });
  };
};

// ---------------------------------------------------------------- Resumen
function cargarResumen() {
  if (!navigator.onLine) { $('resTarjetas').innerHTML = '<div class="aviso">El resumen se ve con conexión.</div>'; return; }
  authAdmin().then(function (auth) { return api('resumen', { auth: auth }); }).then(function (j) { S.resumen = j; pintarResumenAdmin(); })
    .catch(function (e) { $('resTarjetas').innerHTML = '<div class="aviso err">' + esc(e.message) + '</div>'; });
}
var TIPO_RES = { SALIDA: 'Salida', DEVOLUCION: 'Devolución', RECUPERADO: 'Encontrado', ENTRADA: 'Entrada', COMPRA_OBRA: 'Compra a obra', AJUSTE: 'Ajuste', TRASPASO_SALE: 'Traspaso', ASIGNAR: 'Con persona', AVERIA: 'Avería', REPARACION: 'Al reparador', VUELTA: 'Reparada', BAJA: 'Baja' };
function pintarResumenAdmin() {
  var j = S.resumen, lista = function (xs, f) { return xs.slice(0, 3).map(f).join(' · ') + (xs.length > 3 ? ' …' : ''); };
  var T = [
    { k: 'negativos', t: 'Stock en negativo', n: j.negativos.length, mal: true, d: lista(j.negativos, function (m) { return m.nombre + ' ' + m.stock; }) },
    { k: 'bajos', t: 'Bajo mínimo', n: j.bajos.length, d: lista(j.bajos, function (m) { return m.nombre + ' ' + m.stock + '/' + m.stock_min; }) },
    { k: 'otros', t: 'OTRO sin dar de alta', n: j.otros.length, d: lista(j.otros, function (o) { return o.nombre || o.material || ''; }) },
    { k: 'revisar', t: 'Para revisar', n: (j.revisar || []).length, mal: true, d: lista(j.revisar || [], function (v) { return v.numero + ' ' + v.usuario; }) },
    { k: 'albaranes', t: 'Albaranes pendientes de leer', n: (j.albaranes || []).length, d: lista(j.albaranes || [], function (a) { return a.proveedor + ' ' + a.albaran; }) },
    { k: 'eans', t: 'Códigos pendientes', n: j.eans.length, d: lista(j.eans, function (e) { return e.ean; }) },
    { k: 'ok', t: 'Máquinas pendientes de OK', n: j.pendientesOk.length, d: lista(j.pendientesOk, function (h) { return h.codigo; }) },
    { k: 'averiadas', t: 'Averiadas', n: j.averiadas.length, mal: true, d: lista(j.averiadas, function (h) { return h.codigo + (h.averia ? ': ' + h.averia : ''); }) },
    { k: 'reparacion', t: 'En reparación', n: j.reparacion.length, d: lista(j.reparacion, function (h) { return h.codigo + ' · ' + (h.dias === '' ? '?' : h.dias) + ' día' + (h.dias === 1 ? '' : 's'); }) },
    { k: 'inventarios', t: 'Inventarios abiertos', n: j.inventarios.length, d: lista(j.inventarios, function (i) { return i.nombre; }) }
  ];
  $('resTarjetas').innerHTML = T.map(function (x) {
    return '<button type="button" class="res-t' + (x.n ? (x.mal ? ' mal' : ' hay') : '') + '" data-k="' + x.k + '"><b>' + x.n + '</b><span>' + esc(x.t) + '</span>' + (x.d ? '<small>' + esc(x.d) + '</small>' : '') + '</button>';
  }).join('');
  $('resMovs').innerHTML = j.movimientos.length ? '<table class="res-movs"><thead><tr><th>Hora</th><th>Tipo</th><th>Material o máquina</th><th>Cant.</th><th>Obra o almacén</th><th>Persona</th><th>Anotado por</th></tr></thead><tbody>' +
    j.movimientos.map(function (m) {
      return '<tr' + (m.anulado ? ' class="anulado"' : '') + '><td>' + esc(m.fecha.slice(0, 5)) + ' ' + esc(m.hora) + '</td><td>' + (m.clase === 'HER' ? '🔧 ' : '') + esc(TIPO_RES[m.tipo] || m.tipo) + (m.numero ? ' <small>' + esc(m.numero) + '</small>' : '') + '</td><td>' + esc(m.material) + '</td><td>' + esc(m.cantidad) + ' ' + esc(m.unidad) +
        '</td><td>' + esc(m.donde) + '</td><td>' + esc(m.persona) + '</td><td>' + esc(m.usuario) + (m.movil_de ? ' <i>(móvil de ' + esc(m.movil_de) + ')</i>' : '') + '</td></tr>';
    }).join('') + '</tbody></table>' : '<div class="ayuda">Sin movimientos todavía.</div>';
}
$('resumenActualizar').onclick = cargarResumen;
// cada tarjeta lleva a su pantalla
$('resTarjetas').onclick = function (e) {
  var b = e.target.closest('[data-k]'); if (!b) return;
  var k = b.dataset.k, abrirStock = function () { cambiar('almacen'); if ($('stockBloque').style.display === 'none') $('verStock').onclick(); $('stockAlmacen').value = ''; pintarStock(); $('stockBloque').scrollIntoView({ block: 'start' }); };
  if (k === 'negativos' || k === 'bajos' || k === 'otros') return abrirStock();
  if (k === 'eans') { cambiar('almacen'); return $('eanPendientes').scrollIntoView({ block: 'start' }); }
  if (k === 'revisar') {
    if (!puedeVales()) return toast('Los vales para revisar los ve Mateo');
    S.vales = S.vales || []; cambiar('vales'); ['fTipo', 'fDesde', 'fHasta', 'fTrab', 'fObra', 'fBuscar', 'fAlm'].forEach(function (id) { $(id).value = ''; }); $('fRevisar').checked = true; return buscarVales();
  }
  if (k === 'albaranes') { S.vales = S.vales || []; cambiar('vales'); $('fTipo').value = 'PENDIENTE_LEER'; $('fDesde').value = ''; $('fHasta').value = ''; return buscarVales(); }
  if (k === 'inventarios') { if (verPestanaInventario()) cambiar('inventario'); else toast('Los inventarios los lleva Mateo'); return; }
  cambiar('herramientas');
  if (k === 'ok') return $('herrGestion').scrollIntoView({ block: 'start' });
  if ($('herrBloque').style.display === 'none') $('verHerr').onclick();
  $('buscarHerr').value = k === 'averiadas' ? 'averiada' : 'reparacion'; pintarHerr();
  $('herrBloque').scrollIntoView({ block: 'start' });
};
// acceso para las pruebas automáticas (no cambia nada de la app)
window.SOLERA_TEST = { S: S, DB: DB, salir: salir, lectorZXing: lectorZXing };
