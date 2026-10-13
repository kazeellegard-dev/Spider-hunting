// アプリに入れる Web ファイルを www/ にまとめる（GitHub Pages と同じ中身。テストと開発用ツールは除く）
import { rmSync, mkdirSync, cpSync, readdirSync } from 'node:fs';

const SKIP = new Set(['tests', 'tools']);
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of readdirSync('web')) if (!SKIP.has(f)) cpSync(`web/${f}`, `www/${f}`, { recursive: true });
console.log('www/ を作成しました');
