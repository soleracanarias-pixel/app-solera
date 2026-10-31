/**
 * APP SOLERA — backend (Google Apps Script)
 * Hoja de cálculo "APP SOLERA" + carpeta de Drive para los PDF de los partes.
 *
 * INSTALACIÓN (una sola vez):
 *  1. Crear una hoja de Google Sheets nueva llamada "APP SOLERA".
 *  2. Extensiones > Apps Script. Borrar lo que haya y pegar este fichero entero.
 *  3. Ejecutar la función  instalar  (menú de arriba: elegir "instalar" y pulsar ▶). Aceptar permisos.
 *     Crea todas las pestañas de HOJAS (más abajo), rellena el ROL de TRABAJADORES donde esté vacío
 *     y rehace las fórmulas de STOCK. Hay que volver a ejecutarlo cuando cambia ESQUEMA.
 *  4. Rellenar TRABAJADORES (código, nombre, categoría, PIN), OBRAS y MATERIALES.
 *     En CONFIG poner CARPETA_PARTES_ID = id de la carpeta de Drive donde irán los PDF
 *     (el id es lo que va después de /folders/ en la dirección de la carpeta).
 *     Opcional: CARPETA_CSV_ID = id de la carpeta CLIENTES\PARTES\APP (ahí se rehace "PARTES APP 2026.csv";
 *     va aparte del maestro para no mezclar los datos de la app con los reales)
 *     y AVISOS_EMAIL = correo que recibe los avisos de stock mínimo.
 *  5. Implementar > Nueva implementación > Aplicación web:
 *        Ejecutar como: Yo      ·      Quién tiene acceso: Cualquier usuario
 *     Copiar la URL (acaba en /exec) y ponerla en web/config.js junto con el TOKEN de CONFIG.
 *  Cada vez que se cambie este código: Implementar > Gestionar implementaciones > ✎ > Versión nueva.
 */

var MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
var HOJAS = {
  CONFIG: ['clave','valor'],
  TRABAJADORES: ['codigo','nombre','categoria','pin','activo','encargado','rol'],   // rol: admin / encargado / oficial
  OBRAS: ['codigo','nombre','cliente','activa'],
  MATERIALES: ['codigo','nombre','unidad','stock_min','activo','orden','categoria'],
  PARTES: ['id','numero','fecha','obra_codigo','obra','cliente','creado_por','trabajadores','total_horas','trabajos','materiales','medios','observaciones','firmado','firmante','pdf_url','fotos','creado_en','origen','firmado_en','copia_enviada_a','copia_enviada_en','copia_error'],
  PARTES_LINEAS: ['id','numero','fecha','obra','trabajador_codigo','trabajador','categoria','horas','horas_extra','firmado'],
  MOVIMIENTOS: ['id','fecha','tipo','material_codigo','material','cantidad','unidad','obra','parte_numero','usuario','nota','creado_en','fotos','numero','hora','persona','linea','anulado'],
  // un vale de almacén = una fila aquí + sus líneas en MOVIMIENTOS (mismo numero, linea 1, 2, 3…)
  VALES: ['numero','fecha','hora','tipo','obra','usuario','persona','nota','fotos','proveedor','albaran','n_lineas','anulado','anulado_por','anulado_en','motivo_anulacion','creado_en','id','tipo_doc','estado'],   // estado: PENDIENTE_LEER / CONFIRMADA
  STOCK: ['codigo','nombre','unidad','entradas','salidas','stock','stock_min','aviso'],
  FIRMANTES: ['nombre','email','obra_ultima','veces','actualizado_en'],
  POR_OBRA: ['obra','material_codigo','material','unidad','salido','devuelto','gastado','recuperado'],
  // herramientas una a una: cada máquina con su número (BAT-01…), que se marca en la propia máquina
  HERR_TIPOS: ['prefijo','tipo','orden'],
  HERRAMIENTAS: ['codigo','tipo','activo','alta_fecha','alta_por'],
  HERR_MOV: ['id','fecha','tipo','herramienta_codigo','herramienta','cantidad','unidad','obra','usuario','nota','creado_en','fotos','numero','hora','persona'],
  HERR_DONDE: ['codigo','herramienta','donde','quien','desde','ultimo_mov','foto']
};
// almacén de materiales (MAT) y de herramientas (HER): mismo funcionamiento, hojas y numeración separadas
var CLASES = {
  MAT: { catalogo: 'MATERIALES', mov: 'MOVIMIENTOS', prefijo: 'A', contador: 'SIGUIENTE_MOV', carpeta: 'ALMACEN', resumen: 'POR_OBRA', cod: 'material_codigo', nom: 'material' },
  HER: { catalogo: 'HERRAMIENTAS', mov: 'HERR_MOV', prefijo: 'H', contador: 'SIGUIENTE_HERR', carpeta: 'HERRAMIENTAS', resumen: '', cod: 'herramienta_codigo', nom: 'herramienta' }
};
function clase_(c) { return CLASES[c === 'HER' ? 'HER' : 'MAT']; }
// filas de movimientos con el código y nombre siempre en material_codigo / material
function movFilas_(c) {
  return filas_(c.mov).map(function (f) { f.material_codigo = f[c.cod]; f.material = f[c.nom]; return f; });
}
var ESQUEMA = '10';            // subir cuando cambien las columnas de HOJAS
var EMAIL_COPIA = 'soleracanarias@gmail.com';
var CSV_NOMBRE = 'PARTES APP 2026.csv';  // se crea en la carpeta CARPETA_CSV_ID de CONFIG (CLIENTES\PARTES\APP)
var CSV_COLUMNAS = ['N_PARTE','FECHA','DIA_SEMANA','CLIENTE','OBRA','COD_OBRA_APP','RESP_CLIENTE','RESP_CERT','RESP_SOLERA','MATRICULA',
  'CONDUCTOR','TIPO_DIA','FIRMADO','OPERARIO_PARTE','COD_OPERARIO_APP','CATEGORIA_PARTE','HORAS','HORAS_TEXTO_PARTE','TRABAJOS',
  'MATERIALES_Y_MEDIOS','PORTES','TRANSPORTES','EN_APP','NOTAS','LEIDO_EL'];

// ---------------------------------------------------------------- instalación
function instalar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  asegurarHojas_(true);
  var cfg = ss.getSheetByName('CONFIG');
  if (cfg.getLastRow() < 2) {
    cfg.appendRow(['TOKEN', Utilities.getUuid().replace(/-/g, '').slice(0, 20)]);
    cfg.appendRow(['CARPETA_PARTES_ID', '']);
    cfg.appendRow(['SIGUIENTE_NUMERO', 90001]);
    cfg.appendRow(['CARPETA_CSV_ID', '']);
    cfg.appendRow(['AVISOS_EMAIL', EMAIL_COPIA]);
    cfg.appendRow(['EMPRESA', 'SOLERA CANARIAS TÉCNICA SL · CIF B13789649 · Calle Quiquirá, bajo, nº 1 · 38300 La Orotava']);
  }
  var tr = ss.getSheetByName('TRABAJADORES');
  if (tr.getLastRow() < 2) tr.appendRow([1, 'José Miguel Brito Sosa', 'OFICIAL', '1234', 'SI', 'SI']);
  // rol por defecto donde esté vacío: 999 = admin; encargado=SI → encargado; resto → oficial
  filas_('TRABAJADORES').forEach(function (t, i) { if (!String(t.rol || '').trim()) ponerEnFila_('TRABAJADORES', i + 2, { rol: rolDe_(t) }); });
  var ob = ss.getSheetByName('OBRAS');
  if (ob.getLastRow() < 2) ob.appendRow(['2549', 'MERCADONA 2549 GÁLDAR', 'MERCADONA', 'SI']);
  var ma = ss.getSheetByName('MATERIALES');
  if (ma.getLastRow() < 2) ma.appendRow(['CEM25', 'Cemento gris saco 25 kg', 'saco', 10, 'SI']);
  // STOCK por fórmulas (se rehacen siempre): entradas = ENTRADA + DEVOLUCION + RECUPERADO, salidas = SALIDA, sin anulados
  var st = ss.getSheetByName('STOCK'), cm = hoja_('MOVIMIENTOS').getRange(1, 1, 1, hoja_('MOVIMIENTOS').getLastColumn()).getValues()[0];
  var col = function (n) { var i = cm.indexOf(n) + 1, s = ''; while (i > 0) { s = String.fromCharCode(65 + (i - 1) % 26) + s; i = Math.floor((i - 1) / 26); } return 'MOVIMIENTOS!' + s + ':' + s; };
  var suma = function (tipo) { return 'SUMIFS(' + col('cantidad') + ';' + col('material_codigo') + ';A2:A;' + col('tipo') + ';"' + tipo + '";' + col('anulado') + ';"<>SI")'; };
  st.getRange('A2').setFormula('=ARRAYFORMULA(IF(MATERIALES!A2:A="";;MATERIALES!A2:A))');
  st.getRange('B2').setFormula('=ARRAYFORMULA(IF(MATERIALES!A2:A="";;MATERIALES!B2:B))');
  st.getRange('C2').setFormula('=ARRAYFORMULA(IF(MATERIALES!A2:A="";;MATERIALES!C2:C))');
  st.getRange('D2').setFormula('=ARRAYFORMULA(IF(A2:A="";;' + suma('ENTRADA') + '+' + suma('DEVOLUCION') + '+' + suma('RECUPERADO') + '))');
  st.getRange('E2').setFormula('=ARRAYFORMULA(IF(A2:A="";;' + suma('SALIDA') + '))');
  st.getRange('F2').setFormula('=ARRAYFORMULA(IF(A2:A="";;D2:D-E2:E))');
  st.getRange('G2').setFormula('=ARRAYFORMULA(IF(MATERIALES!A2:A="";;MATERIALES!D2:D))');
  st.getRange('H2').setFormula('=ARRAYFORMULA(IF(A2:A="";;IF((G2:G>0)*(F2:F<=G2:G);"PEDIR";"")))');
  try { porObra_(); } catch (e) {}
  SpreadsheetApp.getUi().alert('APP SOLERA instalada. Rellena TRABAJADORES, OBRAS, MATERIALES y CARPETA_PARTES_ID en CONFIG; luego publica como aplicación web.');
}

// crea las pestañas que falten y añade al final las columnas nuevas (p. ej. FIRMANTES, firmado_en)
function asegurarHojas_(forzar) {
  var props = PropertiesService.getScriptProperties();
  if (!forzar && props.getProperty('ESQUEMA') === ESQUEMA) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HOJAS).forEach(function (nombre) {
    var h = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    if (h.getLastRow() === 0) {
      h.appendRow(HOJAS[nombre]);
      h.getRange(1, 1, 1, HOJAS[nombre].length).setFontWeight('bold').setBackground('#fde9b8');
      h.setFrozenRows(1);
      return;
    }
    var cab = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
    var faltan = HOJAS[nombre].filter(function (c) { return cab.indexOf(c) < 0; });
    if (faltan.length) h.getRange(1, cab.length + 1, 1, faltan.length).setValues([faltan]).setFontWeight('bold').setBackground('#fde9b8');
  });
  props.setProperty('ESQUEMA', ESQUEMA);
}

// ---------------------------------------------------------------- utilidades
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function hoja_(n) { return ss_().getSheetByName(n); }
function filas_(n) {
  var h = hoja_(n), v = h.getDataRange().getValues(), cab = v.shift();
  return v.filter(function (f) { return f[0] !== ''; }).map(function (f) {
    var o = {}; cab.forEach(function (c, i) { o[c] = f[i]; }); return o;
  });
}
function config_(clave) {
  var r = filas_('CONFIG').filter(function (f) { return f.clave === clave; })[0];
  return r ? r.valor : '';
}
function setConfig_(clave, valor) {
  var h = hoja_('CONFIG'), v = h.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (v[i][0] === clave) { h.getRange(i + 1, 2).setValue(valor); return; }
  h.appendRow([clave, valor]);
}
// añade una fila colocando cada valor bajo su columna (por nombre de cabecera)
function anadirFila_(n, o) {
  var h = hoja_(n), cab = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  h.appendRow(cab.map(function (c) { return o[c] === undefined ? '' : o[c]; }));
}
// escribe valores en la fila (número de fila de la hoja) de la pestaña, por nombre de columna
function ponerEnFila_(n, fila, o) {
  var h = hoja_(n), cab = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  Object.keys(o).forEach(function (c) { var i = cab.indexOf(c); if (i >= 0) h.getRange(fila, i + 1).setValue(o[c]); });
}
function normal_(s) { // para comparar nombres sin mayúsculas ni acentos
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function si_(v) { return String(v).trim().toUpperCase() === 'SI'; }
function fechaES_(iso) { // 'YYYY-MM-DD' -> 'dd/mm/aaaa'
  var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0];
}
function fechaNombre_(iso) { var p = String(iso).slice(0, 10).split('-'); return p[2] + '-' + p[1] + '-' + p[0]; }
function mesDe_(iso) { return MESES[parseInt(String(iso).slice(5, 7), 10) - 1]; }
function ahora_() { return Utilities.formatDate(new Date(), 'Atlantic/Canary', 'dd/MM/yyyy HH:mm'); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function subcarpeta_(padre, nombre) {
  var it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}
function blobDeDataUrl_(dataUrl, nombre) {
  var m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return null;
  return Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], nombre);
}
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }

// ---------------------------------------------------------------- API
function doGet() { return json_({ ok: true, app: 'APP SOLERA', hora: ahora_() }); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    asegurarHojas_();
    if (body.token !== config_('TOKEN')) return json_({ ok: false, error: 'Token incorrecto' });
    switch (body.action) {
      case 'login': return json_(login_(body));
      case 'bootstrap': return json_(bootstrap_());
      case 'crearParte': lock.waitLock(30000); return json_(crearParte_(body.parte));
      case 'movimiento': lock.waitLock(30000); return json_(movimiento_(body.mov));
      case 'stock': return json_({ ok: true, stock: stock_() });
      case 'partes': return json_({ ok: true, partes: ultimosPartes_(body.limite || 30) });
      case 'movimientos': return json_({ ok: true, movimientos: movimientosMaterial_(body.material, 10, body.clase) });
      case 'vale': lock.waitLock(30000); return json_(vale_(body.vale));
      case 'vales': exigirAdmin_(body.auth); return json_({ ok: true, vales: listaVales_(body.filtros || {}) });
      case 'anularVale': exigirAdmin_(body.auth); lock.waitLock(30000); return json_(anularVale_(body.numero, body.motivo, body.auth));
      default: return json_({ ok: false, error: 'Acción desconocida' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function login_(b) {
  var t = filas_('TRABAJADORES').filter(function (f) { return String(f.codigo) === String(b.codigo) && si_(f.activo); })[0];
  if (!t) return { ok: false, error: 'Trabajador no encontrado' };
  if (String(t.pin).padStart(4, '0') !== String(b.pin).padStart(4, '0')) return { ok: false, error: 'PIN incorrecto' };
  return { ok: true, trabajador: { codigo: t.codigo, nombre: t.nombre, categoria: t.categoria, encargado: si_(t.encargado), rol: rolDe_(t) } };
}
// rol del trabajador: el de la columna rol; si está vacía, 999 = admin, encargado=SI → encargado, resto → oficial
// (de momento encargado tiene los mismos permisos que oficial)
function rolDe_(t) {
  var r = normal_(t.rol);
  if (r === 'admin' || r === 'encargado' || r === 'oficial') return r;
  return String(t.codigo) === '999' ? 'admin' : (si_(t.encargado) ? 'encargado' : 'oficial');
}
// las acciones de admin llevan auth = {codigo, pin} y se comprueban aquí (ocultar botones no basta)
function exigirAdmin_(auth) {
  auth = auth || {};
  var t = filas_('TRABAJADORES').filter(function (f) { return String(f.codigo) === String(auth.codigo) && si_(f.activo); })[0];
  if (!t || String(t.pin).padStart(4, '0') !== String(auth.pin || '').padStart(4, '0')) throw new Error('Solo el administrador puede hacer esto (vuelve a entrar con tu PIN)');
  if (rolDe_(t) !== 'admin') throw new Error('Solo el administrador puede hacer esto');
  return t;
}

function bootstrap_() {
  return {
    ok: true,
    trabajadores: filas_('TRABAJADORES').filter(function (f) { return si_(f.activo); })
      .map(function (f) { return { codigo: f.codigo, nombre: f.nombre, categoria: f.categoria, rol: rolDe_(f) }; }),
    obras: filas_('OBRAS').filter(function (f) { return si_(f.activa); })
      .map(function (f) { return { codigo: String(f.codigo), nombre: f.nombre, cliente: f.cliente }; }),
    materiales: filas_('MATERIALES').filter(function (f) { return si_(f.activo); })
      .sort(function (a, b) { return (Number(a.orden) || 9999) - (Number(b.orden) || 9999); })   // lo más usado primero
      .map(function (f) { return { codigo: String(f.codigo), nombre: f.nombre, unidad: f.unidad, stock_min: Number(f.stock_min) || 0 }; }),
    stock: stock_(),
    otros: otrosPendientes_(),
    herramientas: herrDonde_(false),
    herrTipos: filas_('HERR_TIPOS').filter(function (f) { return f.prefijo; })
      .sort(function (a, b) { return (Number(a.orden) || 9999) - (Number(b.orden) || 9999); })
      .map(function (f) { return { prefijo: String(f.prefijo), nombre: String(f.tipo) }; }),
    firmantes: filas_('FIRMANTES').filter(function (f) { return f.nombre; })
      .sort(function (a, b) { return (Number(b.veces) || 0) - (Number(a.veces) || 0); })
      .map(function (f) { return { nombre: String(f.nombre), email: String(f.email || '') }; }),
    hora: ahora_()
  };
}

function stock_() {
  var mats = filas_('MATERIALES').filter(function (f) { return si_(f.activo); });
  var acc = {};
  filas_('MOVIMIENTOS').forEach(function (m) {
    if (si_(m.anulado)) return;
    var k = String(m.material_codigo); acc[k] = acc[k] || { e: 0, s: 0 };
    if (m.tipo === 'SALIDA') acc[k].s += Number(m.cantidad) || 0; else acc[k].e += Number(m.cantidad) || 0;   // ENTRADA, DEVOLUCION, RECUPERADO
  });
  return mats.map(function (f) {
    var a = acc[String(f.codigo)] || { e: 0, s: 0 };
    return { codigo: String(f.codigo), nombre: f.nombre, unidad: f.unidad, stock: a.e - a.s, stock_min: Number(f.stock_min) || 0 };
  });
}

// dónde está cada herramienta: según su último movimiento (alta/devolución = ALMACÉN, salida = la obra)
// escribir = true rehace la hoja HERR_DONDE (con la última foto, para ver el estado y comprobar que es esa máquina)
function herrDonde_(escribir) {
  var ult = {};
  movFilas_(CLASES.HER).forEach(function (m) {
    var k = String(m.material_codigo), u = ult[k] = ult[k] || {};
    u.m = m; if (m.fotos) u.foto = String(m.fotos).split(' ')[0];
  });
  var orden = {}; filas_('HERR_TIPOS').forEach(function (t) { orden[t.prefijo] = Number(t.orden) || 999; });
  var lista = filas_('HERRAMIENTAS').filter(function (f) { return si_(f.activo); }).map(function (f) {
    var u = ult[String(f.codigo)] || {}, m = u.m;
    var fuera = m && m.tipo === 'SALIDA';
    return { codigo: String(f.codigo), tipo: f.tipo, nombre: f.codigo + ' · ' + f.tipo,
      donde: fuera ? m.obra : 'ALMACÉN', quien: m ? (m.persona || m.usuario || '') : (f.alta_por || ''),
      desde: m ? txtFecha_(m.fecha, 'dd/MM/yyyy') + (m.hora ? ' ' + m.hora : '') : '', ultimo_mov: m ? m.numero : '', foto: u.foto || '' };
  }).sort(function (a, b) {
    var pa = a.codigo.split('-')[0], pb = b.codigo.split('-')[0];
    return (orden[pa] || 999) - (orden[pb] || 999) || (a.codigo < b.codigo ? -1 : 1);
  });
  if (escribir) {
    var h = hoja_('HERR_DONDE'), ancho = HOJAS.HERR_DONDE.length;
    if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, ancho).clearContent();
    if (lista.length) h.getRange(2, 1, lista.length, ancho).setValues(lista.map(function (x) {
      return [x.codigo, x.tipo, x.donde, x.quien, x.desde, x.ultimo_mov, x.foto]; }));
  }
  return lista;
}

// alta de una máquina nueva: el móvil propone el número (ya escrito en la máquina y visible en la foto);
// si otro lo ha cogido a la vez, se le da el siguiente libre y se avisa
function altaHerramienta_(prefijo, usuario, propuesto) {
  var t = filas_('HERR_TIPOS').filter(function (f) { return String(f.prefijo) === String(prefijo); })[0];
  if (!t) throw new Error('Tipo de herramienta no encontrado');
  var max = 0, usados = {};
  filas_('HERRAMIENTAS').forEach(function (f) {
    var p = String(f.codigo).split('-'); usados[f.codigo] = true;
    if (p[0] === t.prefijo) max = Math.max(max, Number(p[1]) || 0);
  });
  var valido = new RegExp('^' + t.prefijo + '-\\d{2,}$').test(String(propuesto || '')) && !usados[propuesto];
  var codigo = valido ? String(propuesto) : t.prefijo + '-' + ('0' + (max + 1)).slice(-2);
  anadirFila_('HERRAMIENTAS', { codigo: codigo, tipo: t.tipo, activo: 'SI', alta_fecha: ahora_(), alta_por: usuario || '' });
  return { codigo: codigo, nombre: codigo + ' · ' + t.tipo, unidad: 'ud', cambiado: !!propuesto && codigo !== propuesto };
}

function ultimosPartes_(n) {
  var p = filas_('PARTES'); return p.slice(-n).reverse().map(function (f) {
    return { numero: f.numero, fecha: f.fecha, obra: f.obra, total_horas: f.total_horas, firmado: f.firmado, pdf_url: f.pdf_url, creado_por: f.creado_por };
  });
}

// ---------------------------------------------------------------- partes
function crearParte_(p) {
  if (!p || !p.id) throw new Error('Parte sin id');
  // idempotente: si ya existe ese id (reintento del móvil) devolvemos lo guardado
  var ya = filas_('PARTES').filter(function (f) { return f.id === p.id; })[0];
  if (ya) return { ok: true, repetido: true, numero: ya.numero, pdf_url: ya.pdf_url, copia_enviada_a: ya.copia_enviada_a || '', copia_error: ya.copia_error || '' };

  var numero = Number(config_('SIGUIENTE_NUMERO')) || 90001;
  setConfig_('SIGUIENTE_NUMERO', numero + 1);

  var obra = filas_('OBRAS').filter(function (f) { return String(f.codigo) === String(p.obra); })[0] || { codigo: p.obra, nombre: String(p.obra), cliente: '' };
  var trabajadores = (p.trabajadores || []).filter(function (t) { return t && t.codigo; });
  var totalHoras = trabajadores.reduce(function (s, t) { return s + (Number(t.horas) || 0) + (Number(t.extra) || 0); }, 0);
  var materiales = (p.materiales || []).filter(function (m) { return m && m.codigo && Number(m.cantidad) > 0; });
  var firmado = !!p.firma;
  var emailCopia = firmado ? String(p.firmanteEmail || '').trim() : '';

  // PDF y fotos en Drive
  var pdfUrl = '', fotosUrls = [];
  var idCarpeta = config_('CARPETA_PARTES_ID');
  var base = fechaNombre_(p.fecha) + ' ' + numero + ' ' + obra.nombre + (firmado ? ' FIRMADO' : '');
  var pdf = (idCarpeta || emailCopia) ? pdfParte_(p, numero, obra, trabajadores, totalHoras, materiales).setName(base + '.pdf') : null;
  if (idCarpeta) {
    var raiz = DriveApp.getFolderById(idCarpeta);
    var mes = subcarpeta_(raiz, mesDe_(p.fecha));
    var carpObra = subcarpeta_(mes, obra.nombre);
    var fPdf = mes.createFile(pdf);               // carpeta del mes
    carpObra.createFile(pdf);                     // copia en la carpeta de su obra
    pdfUrl = fPdf.getUrl();
    if (p.fotos && p.fotos.length) {
      var carpFotos = subcarpeta_(carpObra, 'FOTOS');
      p.fotos.forEach(function (f, i) {
        var b = blobDeDataUrl_(f, base + ' foto' + (i + 1) + '.jpg');
        if (b) fotosUrls.push(carpFotos.createFile(b).getUrl());
      });
    }
  }

  var creadoEn = ahora_();
  var txtTrab = trabajadores.map(function (t) { return t.codigo + ' ' + t.nombre + ' (' + (t.categoria || '') + ') ' + (Number(t.horas) || 0) + 'h' + (Number(t.extra) ? ' +' + Number(t.extra) + 'h extra' : ''); }).join('; ');
  var txtMat = materiales.map(function (m) { return m.cantidad + ' ' + (m.unidad || '') + ' ' + m.nombre; }).join('; ');
  anadirFila_('PARTES', { id: p.id, numero: numero, fecha: fechaES_(p.fecha), obra_codigo: String(obra.codigo), obra: obra.nombre,
    cliente: obra.cliente, creado_por: p.creadoPor || '', trabajadores: txtTrab, total_horas: totalHoras, trabajos: p.trabajos || '',
    materiales: txtMat, medios: p.medios || '', observaciones: p.observaciones || '', firmado: firmado ? 'SI' : 'NO',
    firmante: p.firmante || '', pdf_url: pdfUrl, fotos: fotosUrls.join(' '), creado_en: creadoEn, origen: 'APP',
    firmado_en: firmado ? (p.firmadoEn || '') : '' });

  var hl = hoja_('PARTES_LINEAS');
  trabajadores.forEach(function (t) {
    hl.appendRow([p.id, numero, fechaES_(p.fecha), obra.nombre, t.codigo, t.nombre, t.categoria || '', Number(t.horas) || 0, Number(t.extra) || 0, firmado ? 'SI' : 'NO']);
  });

  // los materiales del parte son lo que se cobra al cliente: NO tocan el almacén (eso va por Entrada/Salida/Devolución)

  // copia por correo al firmante; si falla, el parte queda guardado igual y se anota el error
  var copia = { copia_enviada_a: '', copia_error: '' };
  if (emailCopia) {
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCopia)) throw new Error('Correo no válido: ' + emailCopia);
      GmailApp.sendEmail(emailCopia, 'Parte nº ' + numero + ' · ' + obra.nombre + ' · ' + fechaES_(p.fecha),
        'Adjuntamos el parte de trabajo nº ' + numero + ' de la obra ' + obra.nombre + ' del día ' + fechaES_(p.fecha) +
        ', firmado en conformidad el ' + (p.firmadoEn || creadoEn) + ' por ' + (p.firmante || 'el cliente') + '.\n\nSOLERA CANARIAS TÉCNICA SL',
        { cc: EMAIL_COPIA, attachments: [pdf], name: 'SOLERA CANARIAS TÉCNICA SL' });
      copia.copia_enviada_a = emailCopia;
    } catch (err) {
      copia.copia_error = String(err && err.message || err);
    }
    var fila = filas_('PARTES').map(function (f) { return f.id; }).lastIndexOf(p.id) + 2;
    ponerEnFila_('PARTES', fila, { copia_enviada_a: copia.copia_enviada_a, copia_enviada_en: copia.copia_enviada_a ? ahora_() : '', copia_error: copia.copia_error });
  }
  if (p.firmante) guardarFirmante_(p.firmante, String(p.firmanteEmail || '').trim(), obra.nombre);
  try { exportarCSV(); } catch (err) { console.error('CSV: ' + err); }

  return { ok: true, numero: numero, pdf_url: pdfUrl, copia_enviada_a: copia.copia_enviada_a, copia_error: copia.copia_error };
}

// libreta de firmantes: actualiza si el nombre ya existe (sin mayúsculas/acentos), si no lo añade
function guardarFirmante_(nombre, email, obraNombre) {
  var clave = normal_(nombre); if (!clave) return;
  var lista = filas_('FIRMANTES');
  for (var i = 0; i < lista.length; i++) {
    if (normal_(lista[i].nombre) !== clave) continue;
    var cambios = { obra_ultima: obraNombre, veces: (Number(lista[i].veces) || 0) + 1, actualizado_en: ahora_() };
    if (email) cambios.email = email;
    ponerEnFila_('FIRMANTES', i + 2, cambios);
    return;
  }
  anadirFila_('FIRMANTES', { nombre: String(nombre).trim(), email: email, obra_ultima: obraNombre, veces: 1, actualizado_en: ahora_() });
}

function pdfParte_(p, numero, obra, trabajadores, totalHoras, materiales) {
  var filas = trabajadores.map(function (t) {
    return '<tr><td>' + esc_(t.codigo) + '</td><td>' + esc_(t.nombre) + '</td><td>' + esc_(t.categoria) + '</td><td class="n">' + (Number(t.horas) || 0) + '</td><td class="n">' + (Number(t.extra) || 0) + '</td></tr>';
  }).join('');
  var mats = materiales.length ? '<table><tr><th>Cant.</th><th>Ud.</th><th>Material</th></tr>' + materiales.map(function (m) {
    return '<tr><td class="n">' + esc_(m.cantidad) + '</td><td>' + esc_(m.unidad) + '</td><td>' + esc_(m.nombre) + '</td></tr>';
  }).join('') + '</table>' : '<p class="vacio">Sin materiales</p>';
  var firma = p.firma ? '<img src="' + p.firma + '" style="height:70px">' : '<div class="sinfirma">SIN FIRMAR</div>';
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#111;margin:18mm 16mm}' +
    'h1{font-size:18pt;margin:0;letter-spacing:3px;color:#343434}.cab{display:flex;justify-content:space-between;border-bottom:3px solid #f9b526;padding-bottom:6px;margin-bottom:10px}' +
    '.num{font-size:16pt;font-weight:bold;color:#343434;text-align:right}.emp{font-size:8.5pt;color:#555}' +
    '.datos td{padding:3px 10px 3px 0;vertical-align:top}.datos b{color:#646464}' +
    'h2{font-size:10.5pt;background:#f4f4f4;padding:4px 6px;margin:12px 0 4px;border-left:4px solid #f9b526}' +
    'table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;font-size:10pt}th{background:#f4f4f4}.n{text-align:right}' +
    '.texto{border:1px solid #bbb;padding:6px;min-height:40px;white-space:pre-wrap}.vacio{color:#888;font-style:italic;margin:4px 0}' +
    '.firmas{display:flex;gap:20px;margin-top:16px}.firma{flex:1;border:1px solid #bbb;height:110px;padding:6px;position:relative;text-align:center}' +
    '.firma small{position:absolute;left:6px;top:4px;color:#555}.sinfirma{color:#c00;font-weight:bold;margin-top:35px}' +
    '.pie{font-size:8pt;color:#777;margin-top:10px;text-align:center}' +
    '</style></head><body>' +
    '<div class="cab"><div><h1>SOLERA · PARTE DE TRABAJO</h1><div class="emp">' + esc_(config_('EMPRESA')) + '</div></div><div class="num">Nº ' + numero + '</div></div>' +
    '<table class="datos"><tr><td><b>Fecha:</b> ' + fechaES_(p.fecha) + '</td><td><b>Cliente:</b> ' + esc_(obra.cliente) + '</td></tr>' +
    '<tr><td colspan="2"><b>Obra:</b> ' + esc_(obra.nombre) + '</td></tr></table>' +
    '<h2>PERSONAL</h2><table><tr><th>Cód.</th><th>Trabajador</th><th>Categoría</th><th>Horas</th><th>Extra</th></tr>' + filas +
    '<tr><th colspan="3" class="n">TOTAL HORAS</th><th class="n" colspan="2">' + totalHoras + '</th></tr></table>' +
    '<h2>TRABAJOS REALIZADOS</h2><div class="texto">' + esc_(p.trabajos) + '</div>' +
    '<h2>MATERIALES</h2>' + mats +
    (p.medios ? '<h2>MEDIOS / MAQUINARIA / PORTES</h2><div class="texto">' + esc_(p.medios) + '</div>' : '') +
    (p.observaciones ? '<h2>OBSERVACIONES</h2><div class="texto">' + esc_(p.observaciones) + '</div>' : '') +
    '<div class="firmas"><div class="firma"><small>Por SOLERA: ' + esc_(p.creadoPor) + '</small></div>' +
    '<div class="firma"><small>CONFORME cliente' + (p.firmante ? ': ' + esc_(p.firmante) : '') + (p.firma && p.firmadoEn ? ' · ' + esc_(p.firmadoEn) : '') + '</small><br>' + firma + '</div></div>' +
    '<div class="pie">Parte generado con la app SOLERA el ' + ahora_() + (p.fotos && p.fotos.length ? ' · ' + p.fotos.length + ' foto(s) de obra adjuntas en Drive' : '') + '</div>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html).getBlob().getAs('application/pdf');
}

// ---------------------------------------------------------------- almacén
function movimiento_(m) {
  if (!m || !m.id) throw new Error('Movimiento sin id');
  var c = clase_(m.clase);
  var ya = filas_(c.mov).filter(function (f) { return f.id === m.id; })[0];
  if (ya) return { ok: true, repetido: true, numero: ya.numero || '' };
  var her = c === CLASES.HER, mat;
  // alta, o herramienta que aún no tenía número (se le da uno al llevarla/devolverla)
  if (her && (m.tipo === 'ENTRADA' || (!m.material && m.tipoHer))) mat = altaHerramienta_(m.tipoHer, m.usuario, m.codigoNuevo);
  else if (her) {
    var u = filas_('HERRAMIENTAS').filter(function (f) { return String(f.codigo) === String(m.material); })[0];
    if (!u) throw new Error('Herramienta no encontrada: ' + (m.material || ''));
    mat = { codigo: String(u.codigo), nombre: u.codigo + ' · ' + u.tipo, unidad: 'ud' };
  } else {
    mat = filas_(c.catalogo).filter(function (f) { return String(f.codigo) === String(m.material); })[0];
    // cosas que no están en la lista de materiales: se guardan con su nombre y código OTRO (no cuentan en el stock)
    if (!mat && m.materialNombre) mat = { codigo: 'OTRO', nombre: String(m.materialNombre).trim().toUpperCase(), unidad: m.unidad || '' };
  }
  if (!mat) throw new Error('Material no encontrado');
  // número propio de cada movimiento de almacén: A0001, A0002…
  var n = Number(config_(c.contador)) || 1;
  setConfig_(c.contador, n + 1);
  var numero = c.prefijo + ('000' + n).slice(-4);
  var tipo = m.tipo === 'ENTRADA' || m.tipo === 'DEVOLUCION' ? m.tipo : 'SALIDA';
  var fecha = m.fecha || new Date().toISOString();
  // fotos en <CARPETA_PARTES>/ALMACEN (o HERRAMIENTAS)/<MES>/ "DD-MM-AAAA A0001 ENTRADA|SALIDA <material> <comentario>.jpg"
  var fotosUrls = [], idCarpeta = config_('CARPETA_PARTES_ID');
  if (m.fotos && m.fotos.length && idCarpeta) {
    var carp = subcarpeta_(subcarpeta_(DriveApp.getFolderById(idCarpeta), c.carpeta), mesDe_(fecha));
    var base = [fechaNombre_(fecha), numero, tipo, mat.nombre, m.nota || ''].join(' ').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
    m.fotos.forEach(function (f, i) {
      var b = blobDeDataUrl_(f, base + (m.fotos.length > 1 ? ' (' + (i + 1) + ')' : '') + '.jpg');
      if (b) fotosUrls.push(carp.createFile(b).getUrl());
    });
  }
  var fila = { id: m.id, fecha: fechaES_(fecha), tipo: tipo, cantidad: her ? 1 : Number(m.cantidad) || 0, unidad: mat.unidad || '', obra: m.obra || '',
    parte_numero: '', usuario: m.usuario || '', nota: m.nota || '', creado_en: ahora_(), fotos: fotosUrls.join(' '), numero: numero,
    hora: m.hora ? "'" + m.hora : '',     // con ' para que la hoja no lo convierta en fecha
    persona: tipo === 'ENTRADA' ? '' : (m.persona || m.usuario || '') };   // quién se lo lleva / lo devuelve (usuario = quién lo anota)
  fila[c.cod] = String(mat.codigo); fila[c.nom] = mat.nombre;
  anadirFila_(c.mov, fila);
  if (her) { try { herrDonde_(true); } catch (err) { console.error('HERR_DONDE: ' + err); } }
  else {
    avisarStock_([String(mat.codigo)]);   // una ENTRADA que repone rearma el aviso
    if (tipo !== 'ENTRADA') try { porObra_(c); } catch (err) { console.error('POR_OBRA: ' + err); }
  }
  return { ok: true, numero: numero, fotos: fotosUrls, herramienta: her ? mat.codigo : '', cambiado: !!mat.cambiado };
}

// POR_OBRA: por obra y material, lo que salió del almacén, lo que volvió y lo gastado (salido - devuelto).
// Es control interno; lo que se cobra al cliente es lo que pone el parte.
function porObra_(c) {
  c = c || CLASES.MAT;
  var acc = {}, orden = [];
  var campo = { SALIDA: 'salido', DEVOLUCION: 'devuelto', RECUPERADO: 'recuperado' };
  movFilas_(c).forEach(function (m) {
    if (!campo[m.tipo] || !m.obra || si_(m.anulado)) return;
    var k = m.obra + '|' + m.material_codigo + '|' + m.material;
    if (!acc[k]) { acc[k] = { obra: m.obra, material_codigo: m.material_codigo, material: m.material, unidad: m.unidad, salido: 0, devuelto: 0, recuperado: 0 }; orden.push(k); }
    acc[k][campo[m.tipo]] += Number(m.cantidad) || 0;
  });
  // gastado = salido − devuelto − recuperado (lo encontrado de esa obra vuelve al almacén como una devolución)
  orden.forEach(function (k) { var a = acc[k]; a.gastado = a.salido - a.devuelto - a.recuperado; });
  var h = hoja_(c.resumen), cab = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, cab.length).clearContent();
  var filas = orden.sort().map(function (k) { return cab.map(function (col) { return acc[k][col] === undefined ? '' : acc[k][col]; }); });
  if (filas.length) h.getRange(2, 1, filas.length, cab.length).setValues(filas);
}

// ---------------------------------------------------------------- vales de almacén (varias líneas, un número)
var TIPOS_VALE = ['ENTRADA', 'SALIDA', 'DEVOLUCION', 'RECUPERADO'];   // ENTRADA = COMPRA (solo admin)
function extension_(dataUrl) {
  var m = String(dataUrl).match(/^data:([^;]+);/), t = m ? m[1] : '';
  return t === 'application/pdf' ? '.pdf' : (t === 'image/png' ? '.png' : '.jpg');
}
function vale_(v) {
  if (!v || !v.id) throw new Error('Vale sin id');
  // reintento del móvil sin cobertura: el id del vale evita duplicados
  var ya = filas_('VALES').filter(function (f) { return f.id === v.id; })[0];
  if (ya) return { ok: true, repetido: true, numero: ya.numero };
  var tipo = String(v.tipo || '');
  if (TIPOS_VALE.indexOf(tipo) < 0) throw new Error('Tipo de vale no válido: ' + tipo);
  if (tipo === 'ENTRADA') {
    exigirAdmin_(v.auth);
    if (!String(v.proveedor || '').trim() || !String(v.albaran || '').trim()) throw new Error('La compra necesita proveedor y nº de albarán o ticket');
    // el mismo albarán/ticket del mismo proveedor no se mete dos veces (las facturas no van en la app)
    var clave = normal_(v.proveedor) + '|' + normal_(v.albaran).replace(/[^a-z0-9]/g, '');
    var repetido = filas_('VALES').filter(function (f) {
      return f.tipo === 'ENTRADA' && !si_(f.anulado) && normal_(f.proveedor) + '|' + normal_(f.albaran).replace(/[^a-z0-9]/g, '') === clave;
    })[0];
    if (repetido) throw new Error('Albarán ya registrado: vale ' + repetido.numero);
  }
  if (tipo !== 'ENTRADA' && !String(v.obra || '').trim()) throw new Error('Falta la obra');
  if (tipo === 'RECUPERADO' && !String(v.nota || '').trim()) throw new Error('Falta el comentario (dónde se encontró)');
  var lineas = (v.lineas || []).filter(function (l) { return l && (l.material || l.materialNombre) && Number(l.cantidad) > 0; });
  if (!lineas.length) throw new Error('El vale no tiene líneas');
  var mats = {}; filas_('MATERIALES').forEach(function (f) { mats[String(f.codigo)] = f; });

  var n = Number(config_('SIGUIENTE_MOV')) || 1;
  setConfig_('SIGUIENTE_MOV', n + 1);
  var numero = 'A' + ('000' + n).slice(-4);
  var fecha = v.fecha || new Date().toISOString(), creadoEn = ahora_();

  // fotos y albarán (foto o PDF) en <CARPETA_PARTES>/ALMACEN/<MES>/
  var urls = [], idCarpeta = config_('CARPETA_PARTES_ID');
  var adjuntos = (v.albaranArchivo ? [v.albaranArchivo] : []).concat(v.fotos || []);
  if (adjuntos.length && idCarpeta) {
    var carp = subcarpeta_(subcarpeta_(DriveApp.getFolderById(idCarpeta), 'ALMACEN'), mesDe_(fecha));
    var base = [fechaNombre_(fecha), numero, tipo, v.obra || v.proveedor || '', v.albaran || v.nota || ''].join(' ')
      .replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
    adjuntos.forEach(function (f, i) {
      var b = blobDeDataUrl_(f, base + (adjuntos.length > 1 ? ' (' + (i + 1) + ')' : '') + extension_(f));
      if (b) urls.push(carp.createFile(b).getUrl());
    });
  }
  var persona = tipo === 'ENTRADA' ? '' : (v.persona || v.usuario || '');
  var hora = v.hora ? "'" + v.hora : '';   // con ' para que la hoja no lo convierta en fecha
  lineas.forEach(function (l, i) {
    var mat = mats[String(l.material)] || { codigo: 'OTRO', nombre: String(l.materialNombre || l.material).trim().toUpperCase(), unidad: l.unidad || '' };
    anadirFila_('MOVIMIENTOS', { id: v.id + '-' + (i + 1), fecha: fechaES_(fecha), tipo: tipo, material_codigo: String(mat.codigo), material: mat.nombre,
      cantidad: Number(l.cantidad), unidad: mat.unidad || '', obra: v.obra || '', parte_numero: '', usuario: v.usuario || '', nota: v.nota || '',
      creado_en: creadoEn, fotos: urls.join(' '), numero: numero, hora: hora, persona: persona, linea: i + 1, anulado: '' });
  });
  anadirFila_('VALES', { numero: numero, fecha: fechaES_(fecha), hora: hora, tipo: tipo, obra: v.obra || '', usuario: v.usuario || '', persona: persona,
    nota: v.nota || '', fotos: urls.join(' '), proveedor: v.proveedor || '', albaran: v.albaran || '', n_lineas: lineas.length,
    anulado: '', anulado_por: '', anulado_en: '', motivo_anulacion: '', creado_en: creadoEn, id: v.id,
    tipo_doc: tipo === 'ENTRADA' ? (v.tipoDoc === 'TICKET' ? 'TICKET' : 'ALBARAN') : '', estado: tipo === 'ENTRADA' ? 'CONFIRMADA' : '' });
  avisarStock_(lineas.map(function (l) { return String(l.material); }));
  if (tipo !== 'ENTRADA') try { porObra_(); } catch (err) { console.error('POR_OBRA: ' + err); }
  return { ok: true, numero: numero, fotos: urls, n_lineas: lineas.length };
}

// lista de vales para el admin (el más nuevo primero), con sus líneas; filtros: desde, hasta (aaaa-mm-dd), trabajador, tipo, obra
function listaVales_(fl) {
  var iso = function (v) { var t = txtFecha_(v, 'dd/MM/yyyy').split('/'); return t.length === 3 ? t[2] + '-' + t[1] + '-' + t[0] : ''; };
  var lineas = {};
  filas_('MOVIMIENTOS').forEach(function (m) {
    if (!m.numero || !m.linea) return;
    (lineas[m.numero] = lineas[m.numero] || []).push({ linea: Number(m.linea), material_codigo: String(m.material_codigo), material: m.material,
      cantidad: m.cantidad, unidad: m.unidad, anulado: si_(m.anulado) });
  });
  var q = normal_(fl.trabajador), o = normal_(fl.obra);
  return filas_('VALES').filter(function (v) {
    var f = iso(v.fecha);
    if (fl.desde && f < fl.desde) return false;
    if (fl.hasta && f > fl.hasta) return false;
    if (fl.tipo && v.tipo !== fl.tipo) return false;
    if (q && normal_(v.usuario + ' ' + v.persona).indexOf(q) < 0) return false;
    if (o && normal_(v.obra).indexOf(o) < 0) return false;
    return true;
  }).reverse().slice(0, 300).map(function (v) {
    return { numero: v.numero, fecha: txtFecha_(v.fecha, 'dd/MM/yyyy'), hora: String(v.hora || ''), tipo: v.tipo, obra: v.obra, usuario: v.usuario,
      persona: v.persona, nota: v.nota, proveedor: v.proveedor, albaran: v.albaran, tipo_doc: v.tipo_doc || '', estado: v.estado || '', n_lineas: v.n_lineas,
      fotos: String(v.fotos || '').split(' ').filter(function (u) { return u; }), anulado: si_(v.anulado), anulado_por: v.anulado_por,
      anulado_en: String(v.anulado_en || ''), motivo_anulacion: v.motivo_anulacion,
      lineas: (lineas[v.numero] || []).sort(function (a, b) { return a.linea - b.linea; }) };
  });
}

// anular: marca el vale y sus líneas (nunca borra); el stock y POR_OBRA dejan de contarlas
function anularVale_(numero, motivo, auth) {
  if (!String(motivo || '').trim()) throw new Error('Falta el motivo de la anulación');
  var t = exigirAdmin_(auth);
  var vales = filas_('VALES'), i = vales.map(function (v) { return v.numero; }).indexOf(numero);
  if (i < 0) throw new Error('Vale no encontrado: ' + numero);
  if (si_(vales[i].anulado)) throw new Error('El vale ' + numero + ' ya estaba anulado');
  ponerEnFila_('VALES', i + 2, { anulado: 'SI', anulado_por: t.nombre, anulado_en: ahora_(), motivo_anulacion: String(motivo).trim() });
  var codigos = [];
  filas_('MOVIMIENTOS').forEach(function (m, j) {
    if (m.numero === numero) { ponerEnFila_('MOVIMIENTOS', j + 2, { anulado: 'SI' }); codigos.push(String(m.material_codigo)); }
  });
  try { porObra_(); } catch (err) { console.error('POR_OBRA: ' + err); }
  avisarStock_(codigos);
  return { ok: true, numero: numero };
}

// líneas con material fuera de la lista (OTRO) que el admin debería dar de alta en MATERIALES
function otrosPendientes_() {
  var acc = {};
  filas_('MOVIMIENTOS').forEach(function (m) {
    if (String(m.material_codigo) !== 'OTRO' || si_(m.anulado)) return;
    var k = String(m.material);
    acc[k] = acc[k] || { nombre: k, veces: 0, ultimo: '' };
    acc[k].veces++; acc[k].ultimo = m.numero || acc[k].ultimo;
  });
  return Object.keys(acc).map(function (k) { return acc[k]; });
}

// últimos movimientos de un material, el más reciente primero
function movimientosMaterial_(codigo, n, clase) {
  return movFilas_(clase_(clase)).filter(function (f) { return String(f.material_codigo) === String(codigo); })
    .slice(-n).reverse().map(function (f) {
      return { numero: f.numero || '', linea: f.linea || '', anulado: si_(f.anulado), hora: String(f.hora || ''), fecha: txtFecha_(f.fecha, 'dd/MM/yyyy'), tipo: f.tipo, cantidad: f.cantidad, unidad: f.unidad, obra: f.obra,
        usuario: f.usuario, persona: f.persona || '', nota: f.nota, fotos: String(f.fotos || '').split(' ').filter(function (u) { return u; }) };
    });
}

// aviso por correo cuando un material baja al stock mínimo (solo al cruzarlo, no en cada salida)
function avisarStock_(codigos) {
  if (!codigos.length) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var bajos = stock_().filter(function (m) {
      if (codigos.indexOf(m.codigo) < 0 || !(m.stock_min > 0)) return false;
      var clave = 'AVISO_STOCK_' + m.codigo, bajo = m.stock <= m.stock_min, avisado = props.getProperty(clave) === 'SI';
      props.setProperty(clave, bajo ? 'SI' : 'NO');      // al reponer por encima del mínimo se puede volver a avisar
      return bajo && !avisado;
    });
    if (!bajos.length) return;
    var lista = bajos.map(function (m) { return '- ' + m.nombre + ' (' + m.codigo + '): quedan ' + m.stock + ' ' + (m.unidad || '') + ', mínimo ' + m.stock_min; }).join('\n');
    GmailApp.sendEmail(config_('AVISOS_EMAIL') || EMAIL_COPIA, 'APP SOLERA · Stock bajo: ' + bajos.map(function (m) { return m.nombre; }).join(', '),
      'Estos materiales han llegado al stock mínimo y hay que pedirlos:\n\n' + lista + '\n\nAviso automático de la app SOLERA (' + ahora_() + ').',
      { name: 'APP SOLERA' });
  } catch (err) { console.error('Aviso stock: ' + err); }
}

// ---------------------------------------------------------------- CSV para "DATOS PARTES LEIDOS 2026"
// Rehace "PARTES APP 2026.csv" con todas las líneas de la app, con las mismas columnas y formato que el CSV maestro
// (separador ;, BOM UTF-8, CRLF, una fila por trabajador, categorías OF/PE). El maestro no se toca.
// Se ejecuta solo tras cada parte; también se puede lanzar a mano desde el editor.
function exportarCSV() {
  var idCarpeta = config_('CARPETA_CSV_ID');
  if (!idCarpeta) return { ok: false, error: 'Falta CARPETA_CSV_ID en CONFIG' };
  var partes = {}; filas_('PARTES').forEach(function (f) { partes[f.id] = f; });
  var lineas = [CSV_COLUMNAS.join(';')];
  filas_('PARTES_LINEAS').forEach(function (l) {
    var p = partes[l.id] || {}, fecha = txtFecha_(l.fecha, 'dd-MM-yyyy'), horas = (Number(l.horas) || 0) + (Number(l.horas_extra) || 0);
    var matMedios = [p.materiales, p.medios].filter(function (x) { return x; }).join('; ');
    var notas = ['Parte de la APP SOLERA', p.observaciones, p.pdf_url].filter(function (x) { return x; }).join('. ');
    lineas.push([l.numero, fecha, diaSemana_(fecha), p.cliente || '', l.obra, p.obra_codigo || '', p.firmante || '', '', p.creado_por || '', '',
      '', 'NORMAL', si_(l.firmado) ? 'SI' : 'NO', l.trabajador, l.trabajador_codigo, catCSV_(l.categoria), numES_(horas),
      numES_(Number(l.horas) || 0) + ' h' + (Number(l.horas_extra) ? ' + ' + numES_(Number(l.horas_extra)) + ' h extra' : ''),
      p.trabajos || '', matMedios, '', '', 'NO', notas, txtFecha_(p.creado_en, 'dd/MM/yyyy')].map(celdaCSV_).join(';'));
  });
  var texto = '\uFEFF' + lineas.join('\r\n') + '\r\n';
  var carpeta = DriveApp.getFolderById(idCarpeta), it = carpeta.getFilesByName(CSV_NOMBRE);
  if (it.hasNext()) it.next().setContent(texto); else carpeta.createFile(CSV_NOMBRE, texto, MimeType.CSV);
  return { ok: true, filas: lineas.length - 1 };
}
function celdaCSV_(v) {
  var t = String(v == null ? '' : v).replace(/\r?\n/g, ' ');
  return /[;"]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}
function catCSV_(c) { // las categorías del maestro van abreviadas
  var k = normal_(c); return k === 'oficial' ? 'OF' : (k === 'peon' ? 'PE' : String(c || ''));
}
function numES_(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }
// la hoja puede devolver la fecha como texto 'dd/mm/aaaa' o como fecha de verdad
function txtFecha_(v, formato) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, 'Atlantic/Canary', formato);
  var m = String(v || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return String(v || '');
  return formato === 'dd-MM-yyyy' ? m[1] + '-' + m[2] + '-' + m[3] : m[1] + '/' + m[2] + '/' + m[3];
}
function diaSemana_(ddmmyyyy) {
  var p = ddmmyyyy.split('-'); if (p.length !== 3) return '';
  return 'DLMXJVS'.charAt(new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0])).getDay());
}
