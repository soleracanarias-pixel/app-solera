/**
 * APP SOLERA — backend (Google Apps Script)
 * Hoja de cálculo "APP SOLERA" + carpeta de Drive para los PDF de los partes.
 *
 * INSTALACIÓN (una sola vez):
 *  1. Crear una hoja de Google Sheets nueva llamada "APP SOLERA".
 *  2. Extensiones > Apps Script. Borrar lo que haya y pegar este fichero entero.
 *  3. Ejecutar la función  instalar  (menú de arriba: elegir "instalar" y pulsar ▶). Aceptar permisos.
 *     Crea las pestañas CONFIG, TRABAJADORES, OBRAS, MATERIALES, PARTES, PARTES_LINEAS, MOVIMIENTOS, STOCK y FIRMANTES.
 *  4. Rellenar TRABAJADORES (código, nombre, categoría, PIN), OBRAS y MATERIALES.
 *     En CONFIG poner CARPETA_PARTES_ID = id de la carpeta de Drive donde irán los PDF
 *     (el id es lo que va después de /folders/ en la dirección de la carpeta).
 *  5. Implementar > Nueva implementación > Aplicación web:
 *        Ejecutar como: Yo      ·      Quién tiene acceso: Cualquier usuario
 *     Copiar la URL (acaba en /exec) y ponerla en web/config.js junto con el TOKEN de CONFIG.
 *  Cada vez que se cambie este código: Implementar > Gestionar implementaciones > ✎ > Versión nueva.
 */

var MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
var HOJAS = {
  CONFIG: ['clave','valor'],
  TRABAJADORES: ['codigo','nombre','categoria','pin','activo','encargado'],
  OBRAS: ['codigo','nombre','cliente','activa'],
  MATERIALES: ['codigo','nombre','unidad','stock_min','activo'],
  PARTES: ['id','numero','fecha','obra_codigo','obra','cliente','creado_por','trabajadores','total_horas','trabajos','materiales','medios','observaciones','firmado','firmante','pdf_url','fotos','creado_en','origen','firmado_en','copia_enviada_a','copia_enviada_en','copia_error'],
  PARTES_LINEAS: ['id','numero','fecha','obra','trabajador_codigo','trabajador','categoria','horas','horas_extra','firmado'],
  MOVIMIENTOS: ['id','fecha','tipo','material_codigo','material','cantidad','unidad','obra','parte_numero','usuario','nota','creado_en'],
  STOCK: ['codigo','nombre','unidad','entradas','salidas','stock','stock_min','aviso'],
  FIRMANTES: ['nombre','email','obra_ultima','veces','actualizado_en']
};
var ESQUEMA = '2';            // subir cuando cambien las columnas de HOJAS
var EMAIL_COPIA = 'soleracanarias@gmail.com';

// ---------------------------------------------------------------- instalación
function instalar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  asegurarHojas_(true);
  var cfg = ss.getSheetByName('CONFIG');
  if (cfg.getLastRow() < 2) {
    cfg.appendRow(['TOKEN', Utilities.getUuid().replace(/-/g, '').slice(0, 20)]);
    cfg.appendRow(['CARPETA_PARTES_ID', '']);
    cfg.appendRow(['SIGUIENTE_NUMERO', 90001]);
    cfg.appendRow(['EMPRESA', 'SOLERA CANARIAS TÉCNICA SL · CIF B13789649 · Calle Quiquirá, bajo, nº 1 · 38300 La Orotava']);
  }
  var tr = ss.getSheetByName('TRABAJADORES');
  if (tr.getLastRow() < 2) tr.appendRow([1, 'José Miguel Brito Sosa', 'OFICIAL', '1234', 'SI', 'SI']);
  var ob = ss.getSheetByName('OBRAS');
  if (ob.getLastRow() < 2) ob.appendRow(['2549', 'MERCADONA 2549 GÁLDAR', 'MERCADONA', 'SI']);
  var ma = ss.getSheetByName('MATERIALES');
  if (ma.getLastRow() < 2) ma.appendRow(['CEM25', 'Cemento gris saco 25 kg', 'saco', 10, 'SI']);
  var st = ss.getSheetByName('STOCK');
  if (st.getLastRow() < 2) {
    st.getRange('A2').setFormula('=ARRAYFORMULA(IF(MATERIALES!A2:A="";;MATERIALES!A2:A))');
    st.getRange('B2').setFormula('=ARRAYFORMULA(IF(MATERIALES!A2:A="";;MATERIALES!B2:B))');
    st.getRange('C2').setFormula('=ARRAYFORMULA(IF(MATERIALES!A2:A="";;MATERIALES!C2:C))');
    st.getRange('D2').setFormula('=ARRAYFORMULA(IF(A2:A="";;SUMIFS(MOVIMIENTOS!F:F;MOVIMIENTOS!D:D;A2:A;MOVIMIENTOS!C:C;"ENTRADA")))');
    st.getRange('E2').setFormula('=ARRAYFORMULA(IF(A2:A="";;SUMIFS(MOVIMIENTOS!F:F;MOVIMIENTOS!D:D;A2:A;MOVIMIENTOS!C:C;"SALIDA")))');
    st.getRange('F2').setFormula('=ARRAYFORMULA(IF(A2:A="";;D2:D-E2:E))');
    st.getRange('G2').setFormula('=ARRAYFORMULA(IF(MATERIALES!A2:A="";;MATERIALES!D2:D))');
    st.getRange('H2').setFormula('=ARRAYFORMULA(IF(A2:A="";;IF(F2:F<=G2:G;"PEDIR";"")))');
  }
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
  return { ok: true, trabajador: { codigo: t.codigo, nombre: t.nombre, categoria: t.categoria, encargado: si_(t.encargado) } };
}

function bootstrap_() {
  return {
    ok: true,
    trabajadores: filas_('TRABAJADORES').filter(function (f) { return si_(f.activo); })
      .map(function (f) { return { codigo: f.codigo, nombre: f.nombre, categoria: f.categoria }; }),
    obras: filas_('OBRAS').filter(function (f) { return si_(f.activa); })
      .map(function (f) { return { codigo: String(f.codigo), nombre: f.nombre, cliente: f.cliente }; }),
    materiales: filas_('MATERIALES').filter(function (f) { return si_(f.activo); })
      .map(function (f) { return { codigo: String(f.codigo), nombre: f.nombre, unidad: f.unidad, stock_min: Number(f.stock_min) || 0 }; }),
    stock: stock_(),
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
    var k = String(m.material_codigo); acc[k] = acc[k] || { e: 0, s: 0 };
    if (m.tipo === 'ENTRADA') acc[k].e += Number(m.cantidad) || 0; else acc[k].s += Number(m.cantidad) || 0;
  });
  return mats.map(function (f) {
    var a = acc[String(f.codigo)] || { e: 0, s: 0 };
    return { codigo: String(f.codigo), nombre: f.nombre, unidad: f.unidad, stock: a.e - a.s, stock_min: Number(f.stock_min) || 0 };
  });
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

  var hm = hoja_('MOVIMIENTOS');
  materiales.forEach(function (m, i) {
    hm.appendRow([p.id + '-m' + i, fechaES_(p.fecha), 'SALIDA', String(m.codigo), m.nombre, Number(m.cantidad), m.unidad || '', obra.nombre, numero, p.creadoPor || '', 'Desde parte', creadoEn]);
  });

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
  var ya = filas_('MOVIMIENTOS').filter(function (f) { return f.id === m.id; })[0];
  if (ya) return { ok: true, repetido: true };
  var mat = filas_('MATERIALES').filter(function (f) { return String(f.codigo) === String(m.material); })[0];
  if (!mat) throw new Error('Material no encontrado');
  var tipo = m.tipo === 'ENTRADA' ? 'ENTRADA' : 'SALIDA';
  hoja_('MOVIMIENTOS').appendRow([m.id, fechaES_(m.fecha || new Date().toISOString()), tipo, String(mat.codigo), mat.nombre,
    Number(m.cantidad) || 0, mat.unidad, m.obra || '', '', m.usuario || '', m.nota || '', ahora_()]);
  return { ok: true };
}
