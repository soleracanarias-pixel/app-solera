// npm test: ejecuta todos los tests/*.test.js (cada uno exporta { 'nombre': function () {...} })
var fs = require('fs'), path = require('path');
var bien = 0, mal = 0;
fs.readdirSync(__dirname).filter(function (f) { return /\.test\.js$/.test(f); }).sort().forEach(function (f) {
  var casos = require(path.join(__dirname, f));
  Object.keys(casos).forEach(function (n) {
    try { casos[n](); bien++; console.log('  ok   ' + f + ' › ' + n); }
    catch (e) { mal++; console.log('  MAL  ' + f + ' › ' + n + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 30).join('\n       ')); }
  });
});
console.log('\n' + bien + ' bien, ' + mal + ' mal');
process.exit(mal ? 1 : 0);
