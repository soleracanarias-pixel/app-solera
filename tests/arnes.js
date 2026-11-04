// Arnés de pruebas del servidor: carga backend/Code.gs en Node con dobles EN MEMORIA de los servicios de Apps Script
// (SpreadsheetApp, DriveApp, MailApp/GmailApp, HtmlService, PropertiesService, LockService, ScriptApp, Utilities, ContentService…).
// Nada sale de este proceso: ni hojas reales, ni Drive, ni correos.
var fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
var CODIGO = fs.readFileSync(path.join(__dirname, '..', 'backend', 'Code.gs'), 'utf8');

// cualquier método que no esté definido (formatos, colores, congelar filas…) no hace nada y devuelve el mismo objeto
function tolerante(obj) {
  return new Proxy(obj, { get: function (o, k) { if (k in o || typeof k === 'symbol') return o[k]; return function () { return tolerante(o); }; } });
}
// ---------------------------------------------------------------- hoja de cálculo
function celda(v) { return typeof v === 'string' && v.charAt(0) === "'" ? v.slice(1) : (v === undefined || v === null ? '' : v); }   // la ' del principio la quita Sheets
function Hoja(nombre) {
  var h = { nombre: nombre, filas: [], formulas: {} };
  var ancho = function () { return h.filas.reduce(function (a, f) { return Math.max(a, f.length); }, 0); };
  var pad = function (f, n) { var c = f.slice(); while (c.length < n) c.push(''); return c; };
  var asegurar = function (r, c) { while (h.filas.length < r) h.filas.push([]); var f = h.filas[r - 1]; while (f.length < c) f.push(''); };
  var rango = function (r, c, nr, nc) {
    nr = nr || 1; nc = nc || 1;
    var R = {
      getValues: function () { var out = []; for (var i = 0; i < nr; i++) { var f = h.filas[r - 1 + i] || []; out.push(pad(f, c - 1 + nc).slice(c - 1, c - 1 + nc)); } return out; },
      getDisplayValues: function () { return R.getValues().map(function (f) { return f.map(function (v) { return v instanceof Date ? v.toISOString() : String(v); }); }); },
      getValue: function () { return R.getValues()[0][0]; },
      setValues: function (vals) { vals.forEach(function (f, i) { f.forEach(function (v, j) { asegurar(r + i, c + j); h.filas[r - 1 + i][c - 1 + j] = celda(v); }); }); return tolerante(R); },
      setValue: function (v) { for (var i = 0; i < nr; i++) for (var j = 0; j < nc; j++) { asegurar(r + i, c + j); h.filas[r - 1 + i][c - 1 + j] = celda(v); } return tolerante(R); },
      setFormula: function (f) { h.formulas[r + ',' + c] = f; return tolerante(R); },
      clearContent: function () { for (var i = 0; i < nr; i++) for (var j = 0; j < nc; j++) if (h.filas[r - 1 + i]) h.filas[r - 1 + i][c - 1 + j] = ''; return tolerante(R); }
    };
    return tolerante(R);
  };
  var S = {
    getName: function () { return nombre; },
    appendRow: function (f) { h.filas.push(f.map(celda)); return tolerante(S); },
    getLastRow: function () { return h.filas.length; },
    getLastColumn: function () { return ancho(); },
    getDataRange: function () { return rango(1, 1, Math.max(1, h.filas.length), Math.max(1, ancho())); },
    getRange: function (r, c, nr, nc) {
      if (typeof r === 'string') {   // notación A1 ('A2:C', 'A2'): solo se usa para fórmulas y borrar en STOCK
        var m = r.match(/^([A-Z]+)(\d+)/), col = m[1].split('').reduce(function (a, l) { return a * 26 + l.charCodeAt(0) - 64; }, 0);
        return rango(Number(m[2]), col, 1, 1);
      }
      return rango(r, c, nr, nc);
    },
    _h: h
  };
  return tolerante(S);
}
function Libro() {
  var hojas = {};
  return tolerante({
    getSheetByName: function (n) { return hojas[n] || null; },
    insertSheet: function (n) { hojas[n] = Hoja(n); return hojas[n]; },
    getSheets: function () { return Object.keys(hojas).map(function (k) { return hojas[k]; }); },
    getUi: function () { return tolerante({ alert: function () {} }); },
    _hojas: hojas
  });
}
// ---------------------------------------------------------------- Drive y blobs
function Blob(bytes, tipo, nombre) {
  var b = { bytes: Buffer.from(bytes || []), tipo: tipo || 'application/octet-stream', nombre: nombre || '' };
  return {
    getBytes: function () { return Array.prototype.slice.call(b.bytes); },
    getContentType: function () { return b.tipo; },
    getName: function () { return b.nombre; },
    setName: function (n) { b.nombre = n; return this; },
    getAs: function (t) { return Blob(b.bytes, t, b.nombre); },
    getDataAsString: function () { return b.bytes.toString('utf8'); },
    _b: b
  };
}
function Drive() {
  var porId = {}, d = {};
  function fichero(nombre, contenido, tipo, padre) {
    var id = 'F' + crypto.randomBytes(14).toString('hex'), f = { id: id, nombre: nombre, contenido: contenido, tipo: tipo, papelera: false, padre: padre };
    var F = { getId: function () { return id; }, getName: function () { return f.nombre; }, getUrl: function () { return 'https://drive.test/' + id; },
      setContent: function (c) { f.contenido = c; return F; }, getBlob: function () { return Blob(Buffer.from(typeof f.contenido === 'string' ? f.contenido : f.contenido || []), f.tipo, f.nombre); },
      setTrashed: function (v) { f.papelera = !!v; return F; }, isTrashed: function () { return f.papelera; }, _f: f };
    porId[id] = F; return F;
  }
  function iter(l) { var i = 0; return { hasNext: function () { return i < l.length; }, next: function () { return l[i++]; } }; }
  function carpeta(nombre, padre) {
    var c = { nombre: nombre, carpetas: [], ficheros: [], papelera: false, padre: padre }, id = 'D' + crypto.randomBytes(10).toString('hex');
    var C = {
      getId: function () { return id; }, getName: function () { return c.nombre; }, getUrl: function () { return 'https://drive.test/carpeta/' + id; },
      getFoldersByName: function (n) { return iter(c.carpetas.filter(function (x) { return x._c.nombre === n && !x._c.papelera; })); },
      getFolders: function () { return iter(c.carpetas.filter(function (x) { return !x._c.papelera; })); },
      createFolder: function (n) { var x = carpeta(n, C); c.carpetas.push(x); return x; },
      getFilesByName: function (n) { return iter(c.ficheros.filter(function (x) { return x._f.nombre === n && !x._f.papelera; })); },
      getFiles: function () { return iter(c.ficheros.filter(function (x) { return !x._f.papelera; })); },
      createFile: function (a, contenido, tipo) {
        var f = typeof a === 'string' ? fichero(a, contenido, tipo || 'text/plain', C) : fichero(a.getName(), a._b.bytes, a.getContentType(), C);
        c.ficheros.push(f); return f;
      },
      setTrashed: function (v) { c.papelera = !!v; return C; }, isTrashed: function () { return c.papelera; },
      _c: c
    };
    porId[id] = C; return C;
  }
  d.raiz = carpeta('APP');
  d.servicio = tolerante({
    getFolderById: function (id) { if (!porId[id]) throw new Error('Carpeta no encontrada: ' + id); return porId[id]; },
    getFileById: function (id) { if (!porId[id]) throw new Error('Fichero no encontrado: ' + id); return porId[id]; },
    getRootFolder: function () { return d.raiz; }
  });
  return d;
}
// ---------------------------------------------------------------- fechas (Utilities.formatDate con zona horaria)
function formatDate(fecha, zona, formato) {
  var p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: zona || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .formatToParts(new Date(fecha)).forEach(function (x) { p[x.type] = x.value; });
  var t = { yyyy: p.year, MM: p.month, dd: p.day, HH: p.hour === '24' ? '00' : p.hour, mm: p.minute, ss: p.second };
  return String(formato).replace(/yyyy|MM|dd|HH|mm|ss/g, function (k) { return t[k]; });
}
// ---------------------------------------------------------------- todo junto
function cargar(extra) {
  var libro = Libro(), drive = Drive(), props = {}, correos = [], disparadores = [];
  var correo = { sendEmail: function () { correos.push([].slice.call(arguments)); } };
  var globales = {
    console: console,
    SpreadsheetApp: { getActiveSpreadsheet: function () { return libro; }, getUi: function () { return libro.getUi(); } },
    DriveApp: drive.servicio,
    MailApp: correo, GmailApp: correo,
    HtmlService: { createHtmlOutput: function (html) { return tolerante({ getContent: function () { return String(html); }, getBlob: function () { return Blob(Buffer.from(String(html)), 'text/html', ''); } }); } },
    PropertiesService: { getScriptProperties: function () { return { getProperty: function (k) { return k in props ? props[k] : null; }, setProperty: function (k, v) { props[k] = String(v); }, getProperties: function () { return Object.assign({}, props); }, deleteProperty: function (k) { delete props[k]; } }; } },
    LockService: { getScriptLock: function () { return { waitLock: function () {}, tryLock: function () { return true; }, releaseLock: function () {}, hasLock: function () { return true; } }; } },
    ScriptApp: {
      getProjectTriggers: function () { return disparadores.slice(); },
      deleteTrigger: function (t) { var i = disparadores.indexOf(t); if (i >= 0) disparadores.splice(i, 1); },
      newTrigger: function (fn) {
        var d = { fn: fn, conf: {} }, B = new Proxy({}, { get: function (o, k) {
          if (k === 'create') return function () { var t = { getHandlerFunction: function () { return fn; }, conf: d.conf }; disparadores.push(t); return t; };
          return function (v) { d.conf[k] = v === undefined ? true : v; return B; };
        } });
        return B;
      }
    },
    Utilities: {
      formatDate: formatDate,
      getUuid: function () { return crypto.randomUUID(); },
      base64Encode: function (b) { return Buffer.from(typeof b === 'string' ? Buffer.from(b, 'utf8') : b.map(function (x) { return x & 255; })).toString('base64'); },
      base64Decode: function (s) { return Array.prototype.slice.call(Buffer.from(s, 'base64')); },
      newBlob: function (data, tipo, nombre) { return Blob(typeof data === 'string' ? Buffer.from(data) : (data || []).map(function (x) { return x & 255; }), tipo, nombre); },
      sleep: function () {},
      parseCsv: function (t) { return String(t).split(/\r?\n/).filter(function (l) { return l; }).map(function (l) { return l.split(','); }); }
    },
    ContentService: { createTextOutput: function (s) { var o = { getContent: function () { return s; }, setMimeType: function () { return o; } }; return o; }, MimeType: { JSON: 'application/json' } },
    MimeType: { CSV: 'text/csv', PDF: 'application/pdf', JPEG: 'image/jpeg', PNG: 'image/png' },
    UrlFetchApp: { fetch: function () { throw new Error('UrlFetchApp no se usa en las pruebas'); } },
    Session: { getScriptTimeZone: function () { return 'Atlantic/Canary'; } },
    Logger: { log: function () {} }
  };
  var ctx = vm.createContext(Object.assign(globales, extra || {}));
  vm.runInContext(CODIGO, ctx, { filename: 'Code.gs' });
  ctx._libro = libro; ctx._drive = drive; ctx._props = props; ctx._correos = correos; ctx._disparadores = disparadores;
  return ctx;
}

// ---------------------------------------------------------------- una APP SOLERA de prueba, con datos inventados
var PIN = { MATEO: '1111', GREGORIO: '2222', SERGIO: '3333', JUAN: '4444', PEPE: '5555', LUIS: '6666' };
function appDePrueba() {
  var gs = cargar();
  gs.asegurarHojas_(true);
  gs.setConfig_('TOKEN', 'T-PRUEBA');
  gs.setConfig_('CARPETA_PARTES_ID', gs._drive.raiz.getId());
  gs.setConfig_('AVISOS_EMAIL', 'pruebas@example.invalid');
  var T = [
    { codigo: 999, nombre: 'MATEO', categoria: 'OFICIAL', pin: PIN.MATEO, activo: 'SI', rol: 'admin', inventario: 'SI', herramientas: 'SI', historial: 'SI', ver_stock: 'SI' },
    { codigo: 998, nombre: 'GREGORIO', categoria: 'OFICIAL', pin: PIN.GREGORIO, activo: 'SI', rol: 'encargado', inventario: 'SI', herramientas: 'SI', historial: 'SI', ver_stock: 'SI' },
    { codigo: 997, nombre: 'SERGIO', categoria: 'OFICIAL', pin: PIN.SERGIO, activo: 'SI', rol: 'trabajador', herramientas: 'SI' },
    { codigo: 11, nombre: 'JUAN', categoria: 'OFICIAL', pin: PIN.JUAN, activo: 'SI', rol: 'trabajador' },
    { codigo: 12, nombre: 'PEPE', categoria: 'PEON', pin: PIN.PEPE, activo: 'SI', rol: 'trabajador' },
    { codigo: 13, nombre: 'LUIS', categoria: 'PEON', pin: PIN.LUIS, activo: 'NO', rol: 'trabajador' }];
  T.forEach(function (t) { gs.anadirFila_('TRABAJADORES', t); });
  gs.anadirFila_('OBRAS', { codigo: '2184', nombre: 'MERCADONA 2184 LOS MAJUELOS', cliente: 'MERCADONA', activa: 'SI' });
  gs.anadirFila_('OBRAS', { codigo: 'OB2', nombre: 'OBRA DOS', cliente: 'OTRO', activa: 'SI' });
  [['CEM', 'CEMENTO SACO', 'saco', 'CEMENTOS', 'SI'], ['ADH', 'ADHESIVO C2', 'saco', 'ADHESIVOS', 'SI'], ['ARE', 'ARENA A GRANEL', 'm3', 'ARIDOS', 'NO']].forEach(function (m) {
    gs.anadirFila_('MATERIALES', { codigo: m[0], nombre: m[1], unidad: m[2], categoria: m[3], en_almacen: m[4], activo: 'SI', stock_min: 0 });
  });
  gs.anadirFila_('HERR_TIPOS', { prefijo: 'BAT', tipo: 'BATIDORA', orden: 1, va_con: 'PERSONA', control: 'UNIDAD' });
  gs.anadirFila_('HERR_TIPOS', { prefijo: 'ANA', tipo: 'ANDAMIO', orden: 2, va_con: 'OBRA', control: 'CANTIDAD' });
  ['BAT-01', 'BAT-02'].forEach(function (c) { gs.anadirFila_('HERRAMIENTAS', { codigo: c, tipo: 'BATIDORA', activo: 'SI', ok: 'OK' }); });
  // llamada como la hace el móvil (doPost con token), devuelve el JSON
  gs.llamar = function (action, extra) {
    var out = gs.doPost({ postData: { contents: JSON.stringify(Object.assign({ action: action, token: 'T-PRUEBA' }, extra || {})) } });
    return JSON.parse(out.getContent());
  };
  gs.auth = function (nombre) { var t = T.filter(function (x) { return x.nombre === nombre; })[0]; return { codigo: t.codigo, pin: PIN[nombre] }; };
  return gs;
}
module.exports = { cargar: cargar, appDePrueba: appDePrueba, PIN: PIN, formatDate: formatDate };
