// carga backend/Code.gs en un contexto de Node (el encargo 12 añade los dobles de SpreadsheetApp, DriveApp…)
var fs = require('fs'), path = require('path'), vm = require('vm');
function cargar(globales) {
  var ctx = vm.createContext(Object.assign({ console: console }, globales || {}));
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'backend', 'Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  return ctx;
}
module.exports = { cargar: cargar };
