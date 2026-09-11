/* ============================================================
 *  tools/bump.js — 统一改版本号
 *
 *  用法：node tools/bump.js 0.6.0 "这次改了什么"
 *
 *  会同步三处，避免手改漏掉导致「显示的版本」和「实际加载的资源」不一致：
 *    1. src/data.js  里的 BL.VERSION（界面显示用）
 *    2. version.json（前端检测新版本用）
 *    3. index.html   里所有 ?v= 缓存击穿参数（保证刷新能拿到新代码）
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const ver = process.argv[2];
const note = process.argv[3] || '';
if (!ver || !/^\d+\.\d+\.\d+$/.test(ver)) {
  console.error('用法: node tools/bump.js <版本号 x.y.z> ["说明文字"]');
  process.exit(1);
}
const date = new Date().toISOString().slice(0, 10);
const changed = [];

/* 1. src/data.js —— 只替换 BL.VERSION 代码块内部，避免误伤别处 */
const dataPath = path.join(ROOT, 'src/data.js');
let src = fs.readFileSync(dataPath, 'utf8');
const start = src.indexOf('BL.VERSION = {');
const end = src.indexOf('};', start);
if (start < 0 || end < 0) { console.error('在 src/data.js 里找不到 BL.VERSION 代码块'); process.exit(1); }
let block = src.slice(start, end);
const oldVer = (block.match(/num:\s*'([^']*)'/) || [])[1];
block = block.replace(/(num:\s*')[^']*(')/, '$1' + ver + '$2');
block = block.replace(/(date:\s*')[^']*(')/, '$1' + date + '$2');
if (note) block = block.replace(/(note:\s*')[^']*(')/, '$1' + note.replace(/'/g, "\\'") + '$2');
fs.writeFileSync(dataPath, src.slice(0, start) + block + src.slice(end));
changed.push('src/data.js');

/* 2. version.json —— 说明文字没给就沿用旧的 */
const verPath = path.join(ROOT, 'version.json');
let old = {};
try { old = JSON.parse(fs.readFileSync(verPath, 'utf8')); } catch (e) {}
fs.writeFileSync(verPath, JSON.stringify({
  version: ver, date: date, note: note || old.note || ''
}, null, 2) + '\n');
changed.push('version.json');

/* 3. index.html —— 所有 ?v= 一起换 */
const htmlPath = path.join(ROOT, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const n = (html.match(/\?v=[0-9.]+/g) || []).length;
html = html.replace(/\?v=[0-9.]+/g, '?v=' + ver);
fs.writeFileSync(htmlPath, html);
changed.push('index.html (' + n + ' 处 ?v=)');

console.log('版本 ' + (oldVer || '?') + ' -> ' + ver + '  (' + date + ')');
changed.forEach(function (c) { console.log('  已更新 ' + c); });
if (note) console.log('  说明: ' + note);
