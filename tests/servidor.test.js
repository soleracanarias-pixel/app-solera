// pruebas del servidor (backend/Code.gs) con la app de prueba en memoria del arnés
var assert = require('assert'), arnes = require('./arnes');
var n = 0;
function vale(gs, tipo, lineas, extra) {
  var v = Object.assign({ id: 'v-' + (++n), tipo: tipo, obra: 'MERCADONA 2184 LOS MAJUELOS', usuario: 'JUAN', persona: 'JUAN', almacen: 'MAT', fecha: hoyISO(), hora: '09:00',
    lineas: lineas.map(function (l) { return { material: l[0], materialNombre: l[0], cantidad: l[1], marca: l[2] || '' }; }) }, extra || {});
  return gs.llamar('vale', { vale: v });
}
function compra(gs, lineas, extra) { return vale(gs, 'ENTRADA', lineas, Object.assign({ obra: '', proveedor: 'SOBRADILLO', albaran: 'ALB-' + (++n), auth: gs.auth('MATEO'), usuario: 'MATEO' }, extra || {})); }
function st(gs, cod, alm) { var m = gs.stock_().filter(function (x) { return x.codigo === cod; })[0]; return alm ? (m.porAlmacen[alm] || 0) : m.stock; }
function hoyISO() { return arnes.formatDate(new Date(), 'Atlantic/Canary', 'yyyy-MM-dd'); }
function plano(o) { return JSON.parse(JSON.stringify(o)); }   // los objetos de dentro del vm tienen otro prototipo
function ok(r) { assert.strictEqual(r.ok, true, 'el servidor dijo: ' + r.error); return r; }
function no(r, re) { assert.strictEqual(r.ok, false, 'debía fallar'); if (re) assert.ok(re.test(r.error), 'error inesperado: ' + r.error); return r; }

module.exports = {
  // ---------------------------------------------------------------- stock
  'stock: COMPRA suma, ME LLEVO resta, DEVUELVO y ENCONTRÉ suman': function () {
    var gs = arnes.appDePrueba();
    ok(compra(gs, [['CEM', 10]]));
    assert.strictEqual(st(gs, 'CEM'), 10);
    ok(vale(gs, 'SALIDA', [['CEM', 4]]));
    assert.strictEqual(st(gs, 'CEM'), 6);
    ok(vale(gs, 'DEVOLUCION', [['CEM', 1]]));
    ok(vale(gs, 'RECUPERADO', [['CEM', 2]], { nota: 'Sobró de la obra', origen: 'OBRA' }));
    assert.strictEqual(st(gs, 'CEM'), 9);
    assert.strictEqual(st(gs, 'CEM', 'MAT'), 9);
  },
  'stock: COMPRA A OBRA no toca el almacén (y cuenta en POR_OBRA)': function () {
    var gs = arnes.appDePrueba();
    ok(vale(gs, 'COMPRA_OBRA', [['CEM', 7]], { proveedor: 'ROSALESA', albaran: 'X1', auth: gs.auth('MATEO'), usuario: 'MATEO' }));
    assert.strictEqual(st(gs, 'CEM'), 0);
    var po = gs.filas_('POR_OBRA').filter(function (f) { return f.material_codigo === 'CEM'; })[0];
    assert.ok(po && Number(po.comprado) === 7, 'POR_OBRA comprado');
  },
  'stock: TRASPASO pasa de un almacén a otro sin cambiar el total': function () {
    var gs = arnes.appDePrueba();
    ok(compra(gs, [['ADH', 10]]));
    ok(vale(gs, 'TRASPASO', [['ADH', 3]], { obra: '', almacenDestino: 'AGU', auth: gs.auth('GREGORIO'), usuario: 'GREGORIO' }));
    assert.strictEqual(st(gs, 'ADH', 'MAT'), 7); assert.strictEqual(st(gs, 'ADH', 'AGU'), 3); assert.strictEqual(st(gs, 'ADH'), 10);
    no(vale(gs, 'TRASPASO', [['ADH', 1]], { obra: '', almacenDestino: 'MAT', auth: gs.auth('MATEO') }), /otro almacén/);
  },
  'stock: por marca, y los materiales que no van al almacén no salen': function () {
    var gs = arnes.appDePrueba();
    ok(compra(gs, [['CEM', 5, 'PANDA'], ['CEM', 2, 'cemex']]));
    var m = gs.stock_().filter(function (x) { return x.codigo === 'CEM'; })[0];
    assert.deepStrictEqual(plano(m.marcas.MAT), { PANDA: 5, CEMEX: 2 });
    assert.ok(!gs.stock_().some(function (x) { return x.codigo === 'ARE'; }), 'ARENA (en_almacen = NO) no tiene stock');
  },
  'stock: lo que no está en la lista (OTRO) no cuenta': function () {
    var gs = arnes.appDePrueba();
    ok(vale(gs, 'DEVOLUCION', [['TORNILLOS RAROS', 3]]));
    var l = gs.filas_('MOVIMIENTOS').filter(function (m) { return m.material_codigo === 'OTRO'; });
    assert.strictEqual(l.length, 1); assert.strictEqual(l[0].material, 'TORNILLOS RAROS');
  },
  'stock: al anular un vale deja de contar (no se borra nada)': function () {
    var gs = arnes.appDePrueba();
    ok(compra(gs, [['CEM', 10]]));
    var r = ok(vale(gs, 'SALIDA', [['CEM', 4], ['ADH', 1]]));
    var filasAntes = gs.filas_('MOVIMIENTOS').length;
    ok(gs.llamar('anularVale', { numero: r.numero, motivo: 'prueba', auth: gs.auth('MATEO') }));
    assert.strictEqual(st(gs, 'CEM'), 10); assert.strictEqual(st(gs, 'ADH'), 0);
    assert.strictEqual(gs.filas_('MOVIMIENTOS').length, filasAntes, 'no se borra ninguna línea');
    var v = gs.filas_('VALES').filter(function (x) { return x.numero === r.numero; })[0];
    assert.strictEqual(v.anulado, 'SI'); assert.strictEqual(v.anulado_por, 'MATEO'); assert.strictEqual(v.motivo_anulacion, 'prueba');
    no(gs.llamar('anularVale', { numero: r.numero, motivo: 'otra vez', auth: gs.auth('MATEO') }), /ya estaba anulado/);
    no(gs.llamar('anularVale', { numero: 'A0001', motivo: '', auth: gs.auth('MATEO') }), /motivo/);
  },
  'stock: COMPRA solo foto no suma hasta completar las líneas': function () {
    var gs = arnes.appDePrueba();
    var r = ok(compra(gs, [], { soloFoto: true, fotos: ['data:image/jpeg;base64,' + Buffer.from('foto').toString('base64')] }));
    assert.strictEqual(st(gs, 'CEM'), 0);
    no(gs.llamar('valeCompletar', { numero: r.numero, lineas: [{ material: 'CEM', cantidad: 3 }], auth: gs.auth('JUAN') }), /administrador/);
    ok(gs.llamar('valeCompletar', { numero: r.numero, lineas: [{ material: 'CEM', cantidad: 3 }], auth: gs.auth('MATEO') }));
    assert.strictEqual(st(gs, 'CEM'), 3);
    no(gs.llamar('valeCompletar', { numero: r.numero, lineas: [{ material: 'CEM', cantidad: 3 }], auth: gs.auth('MATEO') }), /ya tiene sus líneas/);
  },
  'stock: el aviso de la cola queda anulado y no cuenta; "Me he equivocado" no cambia el stock': function () {
    var gs = arnes.appDePrueba();
    ok(compra(gs, [['CEM', 5]]));
    var a = ok(gs.llamar('avisoCola', { auth: gs.auth('JUAN'), motivo: 'Material no encontrado', texto: 'era del palé', item: { id: 'x1', tipo: 'vale', valeTipo: 'SALIDA', obra: 'OBRA DOS', almacen: 'MAT', lineas: [{ material: 'CEM', cantidad: 2 }] } }));
    assert.strictEqual(st(gs, 'CEM'), 5);
    var v = gs.filas_('VALES').filter(function (x) { return x.numero === a.numero; })[0];
    assert.strictEqual(v.anulado, 'SI'); assert.strictEqual(v.revisar, 'SI'); assert.ok(/AVISO de JUAN: era del palé/.test(v.nota_revisar));
    var r2 = ok(gs.llamar('avisoCola', { auth: gs.auth('JUAN'), item: { id: 'x1', tipo: 'vale' } }));
    assert.strictEqual(r2.repetido, true, 'el mismo aviso dos veces no se duplica');
    var s = ok(vale(gs, 'SALIDA', [['CEM', 1]]));
    ok(gs.llamar('valeRevisar', { numero: s.numero, texto: 'eran 2', auth: gs.auth('JUAN') }));
    assert.strictEqual(st(gs, 'CEM'), 4);
  },
  'stock: AJUSTE solo cerrando un inventario': function () {
    var gs = arnes.appDePrueba();
    no(vale(gs, 'AJUSTE', [['CEM', 3]], { auth: gs.auth('MATEO') }), /ajustes solo se hacen cerrando un inventario/);
  },

  // ---------------------------------------------------------------- permisos (siempre con código + PIN)
  'permisos: token incorrecto': function () {
    var gs = arnes.appDePrueba();
    var out = JSON.parse(gs.doPost({ postData: { contents: JSON.stringify({ action: 'bootstrap', token: 'MALO' }) } }).getContent());
    no(out, /Token/);
  },
  'permisos: compras solo admin (con PIN correcto)': function () {
    var gs = arnes.appDePrueba();
    no(compra(gs, [['CEM', 1]], { auth: gs.auth('JUAN') }), /administrador/);
    no(compra(gs, [['CEM', 1]], { auth: gs.auth('GREGORIO') }), /administrador/);
    no(compra(gs, [['CEM', 1]], { auth: { codigo: 999, pin: '0000' } }), /PIN/);
    no(compra(gs, [['CEM', 1]], { auth: null }), /PIN|administrador/);
    ok(compra(gs, [['CEM', 1]]));
  },
  'permisos: TRASPASO admin o encargado; anular solo admin': function () {
    var gs = arnes.appDePrueba();
    ok(compra(gs, [['CEM', 5]]));
    no(vale(gs, 'TRASPASO', [['CEM', 1]], { obra: '', almacenDestino: 'AGU', auth: gs.auth('JUAN') }), /encargado/);
    var t = ok(vale(gs, 'TRASPASO', [['CEM', 1]], { obra: '', almacenDestino: 'AGU', auth: gs.auth('GREGORIO') }));
    no(gs.llamar('anularVale', { numero: t.numero, motivo: 'x', auth: gs.auth('GREGORIO') }), /administrador/);
    no(gs.llamar('anularVale', { numero: t.numero, motivo: 'x', auth: gs.auth('JUAN') }), /administrador/);
  },
  'permisos: un trabajador dado de baja no entra': function () {
    var gs = arnes.appDePrueba();
    no(gs.llamar('login', { codigo: 13, pin: arnes.PIN.LUIS }), /no encontrado/);
    no(gs.llamar('login', { codigo: 11, pin: '9999' }), /PIN incorrecto/);
    ok(gs.llamar('login', { codigo: 11, pin: arnes.PIN.JUAN }));
  },
  'permisos: el stock solo llega a admin y ver_stock = SI': function () {
    var gs = arnes.appDePrueba();
    ok(compra(gs, [['CEM', 2]]));
    assert.strictEqual(ok(gs.llamar('bootstrap', { auth: gs.auth('JUAN') })).stock.length, 0);
    assert.ok(ok(gs.llamar('bootstrap', { auth: gs.auth('GREGORIO') })).stock.length > 0);
    assert.strictEqual(ok(gs.llamar('bootstrap', {})).stock.length, 0);
    no(gs.llamar('stock', { auth: gs.auth('JUAN') }), /ver_stock/);
  },
  'permisos: Vales — el encargado ve los de su cuadrilla y el trabajador nada': function () {
    var gs = arnes.appDePrueba();
    ok(vale(gs, 'SALIDA', [['CEM', 1]], { usuario: 'GREGORIO', persona: 'GREGORIO', obra: 'OBRA DOS' }));
    ok(vale(gs, 'SALIDA', [['CEM', 1]], { usuario: 'JUAN', persona: 'JUAN', obra: 'OBRA DOS' }));       // coincide con Gregorio: su cuadrilla
    ok(vale(gs, 'SALIDA', [['CEM', 1]], { usuario: 'PEPE', persona: 'PEPE', obra: 'MERCADONA 2184 LOS MAJUELOS' }));
    var r = ok(gs.llamar('vales', { auth: gs.auth('GREGORIO'), filtros: {} }));
    assert.deepStrictEqual(r.vales.map(function (v) { return v.usuario; }).sort(), ['GREGORIO', 'JUAN']);
    assert.strictEqual(ok(gs.llamar('vales', { auth: gs.auth('MATEO'), filtros: {} })).vales.length, 3);
    no(gs.llamar('vales', { auth: gs.auth('JUAN'), filtros: {} }), /encargado/);
  },
  '"Me he equivocado": solo quien lo anotó y solo hoy; Revisado solo admin': function () {
    var gs = arnes.appDePrueba();
    var r = ok(vale(gs, 'SALIDA', [['CEM', 1]], { usuario: 'JUAN' }));
    no(gs.llamar('valeRevisar', { numero: r.numero, auth: gs.auth('PEPE') }), /Solo quien anotó/);
    no(gs.llamar('valeRevisar', { numero: r.numero, auth: { codigo: 11, pin: '0000' } }), /PIN/);
    var viejo = ok(vale(gs, 'SALIDA', [['CEM', 1]], { usuario: 'JUAN', fecha: '2026-01-02' }));
    // el viejo llegó hoy al servidor: se finge que llegó otro día
    var vs = gs.filas_('VALES'), i = vs.map(function (v) { return v.numero; }).indexOf(viejo.numero);
    gs.ponerEnFila_('VALES', i + 2, { recibido_en: '02/01/2026 10:00', creado_en: '02/01/2026 10:00' });
    no(gs.llamar('valeRevisar', { numero: viejo.numero, auth: gs.auth('JUAN') }), /no es de hoy/);
    ok(gs.llamar('valeRevisar', { numero: r.numero, texto: 'eran 3', auth: gs.auth('JUAN') }));
    assert.strictEqual(ok(gs.llamar('vales', { auth: gs.auth('MATEO'), filtros: { revisar: true } })).vales.length, 1);
    assert.strictEqual(ok(gs.llamar('resumen', { auth: gs.auth('MATEO') })).revisar.length, 1);
    no(gs.llamar('valeRevisado', { numero: r.numero, auth: gs.auth('GREGORIO') }), /administrador/);
    ok(gs.llamar('valeRevisado', { numero: r.numero, texto: 'corregido', auth: gs.auth('MATEO') }));
    var v = gs.filas_('VALES').filter(function (x) { return x.numero === r.numero; })[0];
    assert.strictEqual(v.revisar, 'REVISADO'); assert.ok(/ERROR de JUAN .*: eran 3 \| revisado por MATEO .*: corregido/.test(v.nota_revisar), v.nota_revisar);
    assert.strictEqual(ok(gs.llamar('vales', { auth: gs.auth('MATEO'), filtros: { revisar: true } })).vales.length, 0);
  },
  'permisos: pegatinas solo herramientas = SI': function () {
    var gs = arnes.appDePrueba();
    no(gs.llamar('pegatinas', { auth: gs.auth('JUAN') }), /Gregorio, Sergio o Mateo/);
    var r = ok(gs.llamar('pegatinas', { auth: gs.auth('SERGIO'), filtro: 'BAT' }));
    assert.strictEqual(r.n, 2); assert.strictEqual(r.tam, '50x25'); assert.ok(r.pdf_url);
    no(gs.llamar('pegatinas', { auth: gs.auth('SERGIO'), filtro: 'XYZ' }), /No hay máquinas/);
  },
  'permisos: inventarios solo Mateo': function () {
    var gs = arnes.appDePrueba();
    no(gs.llamar('invGuardar', { auth: gs.auth('GREGORIO'), inventario: { almacen: 'MAT', asignacion: { CEMENTOS: '11' } } }), /administrador|Mateo/);
  },

  // ---------------------------------------------------------------- numeración
  'numeración: vales consecutivos y el reintento no duplica': function () {
    var gs = arnes.appDePrueba();
    var a = ok(compra(gs, [['CEM', 1]])), b = ok(vale(gs, 'SALIDA', [['CEM', 1]], { id: 'mismo' })), c = ok(vale(gs, 'SALIDA', [['CEM', 1]], { id: 'mismo' }));
    assert.strictEqual(a.numero, 'A0001'); assert.strictEqual(b.numero, 'A0002');
    assert.strictEqual(c.repetido, true); assert.strictEqual(c.numero, 'A0002');
    var d = ok(gs.llamar('avisoCola', { auth: gs.auth('JUAN'), item: { id: 'q', tipo: 'mov', movTipo: 'SALIDA', materialNombre: 'BAT-01' } }));
    assert.strictEqual(d.numero, 'A0003', 'el aviso usa el mismo contador');
    assert.strictEqual(gs.filas_('VALES').length, 3);
    assert.strictEqual(gs.filas_('CONFIG').filter(function (f) { return f.clave === 'SIGUIENTE_MOV'; }).length, 1, 'una sola fila del contador en CONFIG');
    assert.strictEqual(Number(gs.config_('SIGUIENTE_MOV')), 4);
  },
  'numeración: un vale que falla no gasta número': function () {
    var gs = arnes.appDePrueba();
    no(vale(gs, 'SALIDA', [], {}), /no tiene líneas/);
    no(vale(gs, 'SALIDA', [['CEM', 1]], { obra: '' }), /Falta la obra/);
    assert.strictEqual(ok(vale(gs, 'SALIDA', [['CEM', 1]])).numero, 'A0001');
  },
  'numeración: albarán repetido del mismo proveedor': function () {
    var gs = arnes.appDePrueba();
    ok(compra(gs, [['CEM', 1]], { albaran: 'AB-12' }));
    no(compra(gs, [['CEM', 1]], { albaran: 'ab 12' }), /Albarán ya registrado: vale A0001/);
    ok(compra(gs, [['CEM', 1]], { albaran: 'AB-12', proveedor: 'OTRO PROVEEDOR' }));
  },
  'ENCONTRÉ: con "Apareció en el almacén" la obra es opcional': function () {
    var gs = arnes.appDePrueba();
    no(vale(gs, 'RECUPERADO', [['CEM', 1]], { obra: '', nota: 'Sobró de la obra', origen: 'OBRA' }), /Falta la obra/);
    ok(vale(gs, 'RECUPERADO', [['CEM', 1]], { obra: '', nota: 'Apareció en el almacén', origen: 'ALMACEN' }));
    no(vale(gs, 'RECUPERADO', [['CEM', 1]], { nota: '' }), /de dónde ha salido/);
    assert.strictEqual(st(gs, 'CEM'), 1);
  },

  // ---------------------------------------------------------------- inventario
  'inventario: abrir, contar, cerrar con AJUSTE = contado − stock, y anularlo': function () {
    var gs = arnes.appDePrueba();
    ok(compra(gs, [['CEM', 10, 'PANDA'], ['ADH', 4]]));
    var inv = ok(gs.llamar('invGuardar', { auth: gs.auth('MATEO'), inventario: { almacen: 'MAT', fecha: hoyISO(), nombre: 'Inventario prueba', asignacion: { CEMENTOS: '11', ADHESIVOS: '12' } } }));
    no(gs.llamar('invGuardar', { auth: gs.auth('MATEO'), inventario: { almacen: 'MAT', asignacion: { CEMENTOS: '11' } } }), /Ya hay un inventario abierto/);
    // con el inventario abierto, los vales de ese almacén quedan marcados
    var durante = ok(vale(gs, 'SALIDA', [['CEM', 1, 'PANDA']]));
    assert.strictEqual(gs.filas_('VALES').filter(function (v) { return v.numero === durante.numero; })[0].inventario, inv.id);
    // cada uno solo cuenta lo suyo
    no(gs.llamar('invEntrega', { auth: gs.auth('JUAN'), entrega: { inventario: inv.id, lineas: [{ id: 'l0', material: 'ADH', contado: 1 }] } }), /no está en tus categorías/);
    no(gs.llamar('invEntrega', { auth: gs.auth('SERGIO'), entrega: { inventario: inv.id, lineas: [] } }), /No participas/);
    ok(gs.llamar('invEntrega', { auth: gs.auth('JUAN'), entrega: { inventario: inv.id, terminado: true, lineas: [{ id: 'l1', material: 'CEM', marca: 'PANDA', contado: 6 }, { id: 'l2', material: 'CEM', marca: 'CEMEX', contado: 2 }] } }));
    ok(gs.llamar('invEntrega', { auth: gs.auth('PEPE'), entrega: { inventario: inv.id, terminado: true, lineas: [{ id: 'l3', material: 'ADH', contado: 5 }] } }));
    // Mateo corrige una línea
    ok(gs.llamar('invCorregir', { auth: gs.auth('MATEO'), id: inv.id, lineaId: 'l3', contado: 4.5 }));
    var rev = ok(gs.llamar('invRevision', { auth: gs.auth('MATEO'), id: inv.id }));
    var cem = rev.materiales.filter(function (m) { return m.codigo === 'CEM'; })[0];
    assert.strictEqual(cem.contado, 8); assert.strictEqual(cem.stock, 9); assert.strictEqual(cem.diferencia, -1);
    var c = ok(gs.llamar('invCerrar', { auth: gs.auth('MATEO'), id: inv.id }));
    // después de cerrar, el stock es lo contado (por marca)
    assert.strictEqual(st(gs, 'CEM'), 8); assert.strictEqual(st(gs, 'ADH'), 4.5);
    var m = gs.stock_().filter(function (x) { return x.codigo === 'CEM'; })[0];
    assert.deepStrictEqual(plano(m.marcas.MAT), { PANDA: 6, CEMEX: 2 });
    var aj = gs.filas_('MOVIMIENTOS').filter(function (x) { return x.numero === c.numero; });
    assert.ok(aj.every(function (x) { return x.tipo === 'AJUSTE'; }));
    assert.deepStrictEqual(aj.map(function (x) { return x.material_codigo + ' ' + x.marca + ' ' + x.contado + ' ' + x.stock_antes + ' ' + x.cantidad; }).sort(), ['ADH  4.5 4 0.5', 'CEM CEMEX 2 0 2', 'CEM PANDA 6 9 -3']);
    no(gs.llamar('invCerrar', { auth: gs.auth('MATEO'), id: inv.id }), /ya no está abierto/);
    // el AJUSTE se anula desde Vales y el stock vuelve a lo de antes
    ok(gs.llamar('anularVale', { numero: c.numero, motivo: 'prueba', auth: gs.auth('MATEO') }));
    assert.strictEqual(st(gs, 'CEM'), 9); assert.strictEqual(st(gs, 'ADH'), 4);
  },
  'inventario: anular sin ajustar no toca el stock': function () {
    var gs = arnes.appDePrueba();
    ok(compra(gs, [['CEM', 3]]));
    var inv = ok(gs.llamar('invGuardar', { auth: gs.auth('MATEO'), inventario: { almacen: 'MAT', asignacion: { CEMENTOS: '11' } } }));
    ok(gs.llamar('invEntrega', { auth: gs.auth('JUAN'), entrega: { inventario: inv.id, lineas: [{ id: 'a', material: 'CEM', contado: 50 }] } }));
    ok(gs.llamar('invAnular', { auth: gs.auth('MATEO'), id: inv.id }));
    assert.strictEqual(st(gs, 'CEM'), 3);
    no(gs.llamar('invEntrega', { auth: gs.auth('JUAN'), entrega: { inventario: inv.id, lineas: [] } }), /cerrado/);
  },

  // ---------------------------------------------------------------- disparadores y copia
  'instalarDisparadores: resumen 18:30 y copia 23:00, sin duplicar': function () {
    var gs = arnes.appDePrueba();
    gs.instalarDisparadores(); gs.instalarDisparadores();
    var d = gs._disparadores.map(function (t) { return t.getHandlerFunction() + ' ' + t.conf.atHour + ':' + t.conf.nearMinute; }).sort();
    assert.deepStrictEqual(d, ['copiaSeguridad 23:0', 'resumenDiario 18:30']);
  },
  'copia de seguridad: una carpeta por día con un CSV por pestaña; lo viejo a la papelera': function () {
    var gs = arnes.appDePrueba();
    ok(compra(gs, [['CEM', 1]], { proveedor: 'PROVEEDOR, "EL BUENO"' }));
    var backup = gs.subcarpeta_(gs._drive.raiz, 'BACKUP APP SOLERA'), vieja = backup.createFolder('2020-01-01'), reciente = backup.createFolder(hoyISO().slice(0, 8) + '01');
    var r = gs.copiaSeguridad();
    assert.strictEqual(r.pestanas.length, Object.keys(gs.HOJAS).length);
    assert.ok(vieja.isTrashed(), 'la de 2020 a la papelera'); assert.ok(!reciente.isTrashed() || hoyISO().slice(8) > '31');
    var dia = backup.getFoldersByName(r.carpeta).next(), csv = dia.getFilesByName('VALES.csv').next()._f.contenido;
    assert.ok(/^﻿numero,fecha/.test(csv)); assert.ok(/"PROVEEDOR, ""EL BUENO"""/.test(csv));
    gs.copiaSeguridad();
    var n2 = 0, it = dia.getFiles(); while (it.hasNext()) { it.next(); n2++; }
    assert.strictEqual(n2, r.pestanas.length, 'el mismo día se reescribe, no se duplica');
    assert.ok(/pestañas/.test(gs.config_('ULTIMA_COPIA')));
  }
};
