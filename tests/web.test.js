// estructura del front (js/*.js): orden de carga, nombres globales y funciones huérfanas
var assert = require('assert'), fs = require('fs'), path = require('path'), acorn = require('acorn'), walk = require('acorn-walk');
var R = path.join(__dirname, '..'), html = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
var ORDEN = (html.match(/<script src="js\/[^"]+"><\/script>/g) || []).map(function (s) { return s.match(/js\/[^"]+/)[0]; });
var ficheros = ORDEN.map(function (f) { var src = fs.readFileSync(path.join(R, f), 'utf8'); return { f: f, src: src, ast: acorn.parse(src, { ecmaVersion: 2020, sourceType: 'script', locations: true }) }; });
// nombres que pone el propio navegador (y config.js) y que el código usa sin declararlos
var NAVEGADOR = ('window document navigator location console setTimeout clearTimeout setInterval clearInterval requestAnimationFrame fetch Promise JSON Object Array String Number Math Date RegExp Error TypeError ' +
  'Boolean Uint8Array Uint8ClampedArray ArrayBuffer Blob File FileReader URL Image Event CustomEvent indexedDB caches atob btoa encodeURIComponent decodeURIComponent unescape escape isNaN parseFloat parseInt Infinity NaN undefined ' +
  'PublicKeyCredential BarcodeDetector ZXing alert confirm crypto getComputedStyle matchMedia history performance localStorage sessionStorage HTMLCanvasElement HTMLElement Node MutationObserver IntersectionObserver ' +
  'TextEncoder TextDecoder structuredClone DOMException Set Map WeakMap Symbol Function arguments FormData Headers Response Request AbortController ClipboardItem prompt open print screen devicePixelRatio innerWidth innerHeight scrollTo').split(' ');
function globales(f) {
  var out = [];
  f.ast.body.forEach(function (n) {
    if (n.type === 'FunctionDeclaration') out.push({ n: n.id.name, tipo: 'función' });
    if (n.type === 'VariableDeclaration') n.declarations.forEach(function (d) { if (d.id.type === 'Identifier') out.push({ n: d.id.name, tipo: 'var' }); });
  });
  return out;
}
var decl = {};   // nombre -> fichero
// lo que declaran los <script> pequeños de index.html (MODO_ALMACEN, en la cabecera)
(html.match(/<script>([\s\S]*?)<\/script>/g) || []).forEach(function (s) { (s.match(/var ([A-Za-z_$][\w$]*)/g) || []).forEach(function (v) { decl[v.slice(4)] = [{ f: 'index.html', i: -1, tipo: 'var' }]; }); });
ficheros.forEach(function (f, i) { globales(f).forEach(function (g) { decl[g.n] = decl[g.n] || []; decl[g.n].push({ f: f.f, i: i, tipo: g.tipo }); }); });
// var y function declaradas dentro de un cuerpo (sin entrar en las funciones de dentro)
function declsEn(n, loc) {
  if (!n || typeof n.type !== 'string') return;
  if (n.type === 'VariableDeclarator') { if (n.id.type === 'Identifier') loc[n.id.name] = 1; return declsEn(n.init, loc); }
  if (n.type === 'FunctionDeclaration') { loc[n.id.name] = 1; return; }
  if (/Function/.test(n.type)) return;
  Object.keys(n).forEach(function (k) { var v = n[k]; if (k === 'loc') return; if (Array.isArray(v)) v.forEach(function (x) { declsEn(x, loc); }); else if (v && typeof v === 'object') declsEn(v, loc); });
}
// identificadores usados en cada fichero (sin contar los que se declaran dentro de funciones: parámetros y var locales)
function usados(f, soloCarga) {
  var u = [];
  function visitar(node, locales, enFuncion) {
    if (!node || typeof node.type !== 'string') return;
    if (/Function/.test(node.type)) {
      if (soloCarga) return;   // lo de dentro de una función no se ejecuta al cargar
      var loc = Object.create(locales);
      node.params.forEach(function (p) { walk.simple(p, { Identifier: function (x) { loc[x.name] = 1; } }); });
      if (node.id && node.type !== 'FunctionDeclaration') loc[node.id.name] = 1;
      declsEn(node.body, loc);
      node.body.type === 'BlockStatement' ? node.body.body.forEach(function (b) { visitar(b, loc, true); }) : visitar(node.body, loc, true);
      return;
    }
    if (node.type === 'CatchClause') { var l2 = Object.create(locales); if (node.param) l2[node.param.name] = 1; return visitar(node.body, l2, enFuncion); }
    if (node.type === 'Identifier') { if (!(node.name in locales)) u.push({ n: node.name, l: node.loc.start.line }); return; }
    Object.keys(node).forEach(function (k) {
      if (k === 'loc' || k === 'start' || k === 'end') return;
      var v = node[k];
      if (node.type === 'MemberExpression' && k === 'property' && !node.computed) return;
      if (node.type === 'Property' && k === 'key' && !node.computed) return;
      if (node.type === 'VariableDeclarator' && k === 'id') return;
      if (node.type === 'FunctionDeclaration' && k === 'id') return;
      if ((node.type === 'BreakStatement' || node.type === 'ContinueStatement' || node.type === 'LabeledStatement') && k === 'label') return;
      if (Array.isArray(v)) v.forEach(function (x) { visitar(x, locales, enFuncion); }); else if (v && typeof v === 'object') visitar(v, locales, enFuncion);
    });
  }
  visitar(f.ast, Object.create(null), false);
  return u;
}
module.exports = {
  'index.html carga los seis ficheros en orden y arranca al final': function () {
    assert.deepStrictEqual(ORDEN, ['js/base.js', 'js/parte.js', 'js/almacen.js', 'js/inventario.js', 'js/herramientas.js', 'js/admin.js']);
    assert.ok(/<script src="js\/admin\.js"><\/script>\s*<script>arrancar\(\);<\/script>/.test(html), 'falta arrancar() después de admin.js');
    assert.ok(/<link rel="stylesheet" href="css\/app\.css">/.test(html));
    assert.ok(!/<style>/.test(html), 'quedan estilos dentro de index.html');
  },
  'ningún nombre global repetido ni que pise uno del navegador': function () {
    var rep = Object.keys(decl).filter(function (n) { return decl[n].length > 1; });
    assert.deepStrictEqual(rep, [], 'repetidos: ' + rep.map(function (n) { return n + ' (' + decl[n].map(function (d) { return d.f; }).join(', ') + ')'; }).join('; '));
    var pisan = Object.keys(decl).filter(function (n) { return NAVEGADOR.indexOf(n) >= 0 || ['name', 'status', 'close', 'stop', 'focus', 'blur', 'top', 'parent', 'self', 'frames', 'length', 'origin', 'event', 'external', 'opener', 'closed', 'find', 'scroll', 'print', 'open', 'menubar', 'toolbar', 'content'].indexOf(n) >= 0; });
    assert.deepStrictEqual(pisan, []);
  },
  'al cargar, cada fichero solo usa lo de los ficheros anteriores': function () {
    var malos = [];
    ficheros.forEach(function (f, i) {
      usados(f, true).forEach(function (u) { var d = decl[u.n]; if (d && d[0].i > i) malos.push(f.f + ':' + u.l + ' usa ' + u.n + ' (de ' + d[0].f + ')'); });
    });
    assert.deepStrictEqual(malos, []);
  },
  'todo lo que se usa está declarado (o es del navegador)': function () {
    var falta = {};
    ficheros.forEach(function (f) { usados(f, false).forEach(function (u) { if (!decl[u.n] && NAVEGADOR.indexOf(u.n) < 0) falta[u.n] = f.f + ':' + u.l; }); });
    assert.deepStrictEqual(falta, {});
  },
  'no quedan funciones huérfanas (declaradas y nunca usadas)': function () {
    var veces = {};
    ficheros.forEach(function (f) { usados(f, false).forEach(function (u) { veces[u.n] = (veces[u.n] || 0) + 1; }); });
    var inline = html.match(/<script>([^<]*)<\/script>/g) || [];
    inline.forEach(function (s) { (s.match(/[A-Za-z_$][\w$]*/g) || []).forEach(function (w) { veces[w] = (veces[w] || 0) + 1; }); });
    var huerf = Object.keys(decl).filter(function (n) { return decl[n][0].tipo === 'función' && !veces[n]; });
    assert.deepStrictEqual(huerf, []);
  }
};
