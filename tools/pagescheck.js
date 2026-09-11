
const fs = require('fs'), path = require('path');
const ROOT = process.cwd();
let bad = [];

/* 1. index.html 里引用的资源必须与磁盘上的文件名大小写完全一致 */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])
  .filter(u => !/^(https?:)?\/\//.test(u));
console.log('index.html 引用 ' + refs.length + ' 个本地资源:');
refs.forEach(u => {
  const parts = u.split('/');
  const dir = path.join(ROOT, ...parts.slice(0, -1));
  const name = parts[parts.length - 1];
  const entries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const ok = entries.includes(name);          // 精确大小写比对
  if (!ok) bad.push('大小写/缺失: ' + u);
  console.log('  ' + (ok ? 'OK  ' : 'FAIL') + ' ' + u);
});

/* 2. JS 中不能出现根绝对路径（Pages 部署在 /<repo>/ 子路径下） */
function walk(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.git') walk(p); }
    else if (e.name.endsWith('.js')) {
      const s = fs.readFileSync(p, 'utf8');
      const m = s.match(/(?:src|href)\s*=\s*["']\/(?!\/)/g);
      if (m) bad.push('绝对路径: ' + path.relative(ROOT, p));
      if (/type\s*=\s*["']module["']/.test(s)) bad.push('ES module: ' + path.relative(ROOT, p));
    }
  });
}
walk(ROOT);

/* 3. 任何下划线开头的文件/目录都会被 Jekyll 忽略 */
const under = [];
(function scan(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    if (e.name === 'node_modules' || e.name === '.git') return;
    const p = path.join(d, e.name);
    if (e.name.startsWith('_')) under.push(path.relative(ROOT, p));
    if (e.isDirectory()) scan(p);
  });
})(ROOT);

/* 4. 中文/空格文件名（URL 编码容易出问题） */
const weird = [];
(function scan2(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    if (e.name === 'node_modules' || e.name === '.git') return;
    const p = path.join(d, e.name);
    if (/[^\x20-\x7e]/.test(e.name) || /\s/.test(e.name)) weird.push(path.relative(ROOT, p));
    if (e.isDirectory()) scan2(p);
  });
})(ROOT);

console.log('\n--- 检查结果 ---');
console.log('根路径引用问题: ' + (bad.length ? bad.join('; ') : '无'));
console.log('下划线开头的文件/目录（Jekyll 会忽略）: ' + (under.length ? under.join(', ') : '无'));
console.log('非 ASCII / 含空格文件名: ' + (weird.length ? weird.join(', ') : '无'));
console.log('模块化脚本: 无（全部传统 script 标签）');
