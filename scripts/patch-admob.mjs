// @capacitor-community/admob は同意確認（UMP）の失敗理由を捨てて「Request consent info failed」だけを返す。
// 「アプリの状態」画面で原因が分かるように、Google から返ってきた理由もつけて返すよう書き換える（npm install のあとに自動で実行）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const f = 'node_modules/@capacitor-community/admob/ios/Sources/AdMobPlugin/Consent/ConsentExecutor.swift';
if (!existsSync(f)) process.exit(0);
const src = readFileSync(f, 'utf8');
const from = `                if error != nil {
                    call.reject("Request consent info failed")`;
const to = `                if let error = error as NSError? {
                    call.reject("Request consent info failed: \\(error.domain) \\(error.code) \\(error.localizedDescription)")`;
if (src.includes(to)) process.exit(0);
if (!src.includes(from)) { console.warn('patch-admob: 書き換える場所が見つかりません（プラグインの版が変わった？）'); process.exit(0); }
writeFileSync(f, src.replace(from, to));
console.log('patch-admob: 同意確認の失敗理由を返すようにしました');
