// el QR de las pegatinas se genera en Code.gs (qrMatriz_ y qrPng_) y se lee aquí con jsqr
var assert = require('assert'), zlib = require('zlib'), jsQR = require('jsqr');
var gs = require('./arnes').cargar();
function leer(m, escala) {
  var n = m.length, lado = (n + 8) * escala, px = new Uint8ClampedArray(lado * lado * 4);
  for (var y = 0; y < lado; y++) for (var x = 0; x < lado; x++) {
    var my = Math.floor(y / escala) - 4, mx = Math.floor(x / escala) - 4, negro = my >= 0 && my < n && mx >= 0 && mx < n && m[my][mx];
    var i = (y * lado + x) * 4; px[i] = px[i + 1] = px[i + 2] = negro ? 0 : 255; px[i + 3] = 255;
  }
  var r = jsQR(px, lado, lado); return r && r.data;
}
function pngAGris(bytes) {
  var b = Buffer.from(bytes), pos = 8, w, h, idat = [];
  assert.deepStrictEqual([].slice.call(b.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  while (pos < b.length) {
    var len = b.readUInt32BE(pos), tipo = b.toString('ascii', pos + 4, pos + 8), dat = b.slice(pos + 8, pos + 8 + len);
    var crc = zlib.crc32 ? zlib.crc32(b.slice(pos + 4, pos + 8 + len)) : null;
    if (crc !== null) assert.strictEqual(crc >>> 0, b.readUInt32BE(pos + 8 + len), 'CRC de ' + tipo);
    if (tipo === 'IHDR') { w = dat.readUInt32BE(0); h = dat.readUInt32BE(4); }
    if (tipo === 'IDAT') idat.push(dat);
    pos += 12 + len;
  }
  var raw = zlib.inflateSync(Buffer.concat(idat)), px = new Uint8ClampedArray(w * h * 4);
  for (var y = 0; y < h; y++) { assert.strictEqual(raw[y * (w + 1)], 0); for (var x = 0; x < w; x++) { var g = raw[y * (w + 1) + 1 + x], i = (y * w + x) * 4; px[i] = px[i + 1] = px[i + 2] = g; px[i + 3] = 255; } }
  return { px: px, w: w, h: h };
}
var textos = ['BAT-01', 'RAD-123', 'A', 'MAQ-0001 · BATIDORA ÑÚ', 'x'.repeat(60), 'y'.repeat(120), 'z'.repeat(200)];
module.exports = {
  'cada versión se lee con jsqr (modo byte, nivel M)': function () {
    textos.forEach(function (t) { assert.strictEqual(leer(gs.qrMatriz_(t), 4), t, 'QR de ' + t.slice(0, 20)); });
  },
  'tamaño según la versión': function () {
    assert.strictEqual(gs.qrMatriz_('BAT-01').length, 21);        // versión 1
    assert.strictEqual(gs.qrMatriz_('y'.repeat(120)).length, 45);   // 120 bytes con nivel M: versión 7 (lleva la información de versión)
    assert.strictEqual(gs.qrMatriz_('z'.repeat(200)).length, 57);   // versión 10 (longitud en 16 bits)
    assert.throws(function () { gs.qrMatriz_('w'.repeat(300)); }, /demasiado largo/);
  },
  'el PNG es válido y se lee': function () {
    ['BAT-01', 'CORT-07'].forEach(function (t) {
      var img = pngAGris(gs.qrPng_(gs.qrMatriz_(t), 6)), r = jsQR(img.px, img.w, img.h);
      assert.ok(r, 'sin lectura del PNG de ' + t); assert.strictEqual(r.data, t);
    });
  },
  'base64_ igual que Buffer': function () {
    [[], [1], [1, 2], [255, 0, 128], gs.qrPng_(gs.qrMatriz_('BAT-01'), 2)].forEach(function (b) { assert.strictEqual(gs.base64_(b), Buffer.from(b).toString('base64')); });
  }
};
