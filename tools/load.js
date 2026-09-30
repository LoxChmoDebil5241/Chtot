// Загрузчик игровых модулей в Node (для тестов логики без браузера)
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function load(files) {
  const ctx = { console, setTimeout, clearTimeout, Math, JSON, Promise };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  return ctx.K;
};
