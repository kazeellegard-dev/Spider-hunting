// App Store Connect API で証明書の一覧を取り、このビルドで新しくできた証明書だけを取り消す。
// GitHub のビルド用 Mac は毎回まっさらなので、署名のたびに開発用の証明書が1枚作られ、放っておくとアカウントの上限に達する。
//   node scripts/asc-certs.mjs snapshot <file>   … 今ある証明書の ID を保存
//   node scripts/asc-certs.mjs revoke-new <file> … 保存したときになかった証明書を取り消す
// 環境変数：KEY_PATH・ASC_KEY_ID・ASC_ISSUER_ID
import { readFileSync, writeFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const { KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID } = process.env;
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

function token() {
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }) + '.' +
    b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' });
  const sig = createSign('SHA256').update(body).sign({ key: readFileSync(KEY_PATH), dsaEncoding: 'ieee-p1363' });
  return body + '.' + sig.toString('base64url');
}

async function api(method, path) {
  const res = await fetch('https://api.appstoreconnect.apple.com' + path, { method, headers: { Authorization: 'Bearer ' + token() } });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function list() {
  const out = [];
  let next = '/v1/certificates?limit=200&fields[certificates]=name,certificateType,expirationDate';
  while (next) {
    const j = await api('GET', next);
    out.push(...j.data);
    next = j.links && j.links.next ? j.links.next.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  return out;
}

const [cmd, file] = process.argv.slice(2);
const certs = await list();
if (cmd === 'snapshot') {
  writeFileSync(file, JSON.stringify(certs.map(c => c.id)));
  console.log(`証明書 ${certs.length} 枚を記録しました`);
} else if (cmd === 'revoke-new') {
  const before = new Set(JSON.parse(readFileSync(file, 'utf8')));
  const added = certs.filter(c => !before.has(c.id));
  for (const c of added) {
    await api('DELETE', '/v1/certificates/' + c.id);
    console.log(`このビルドで作られた証明書を取り消しました：${c.attributes.name}（${c.attributes.certificateType}）`);
  }
  if (!added.length) console.log('このビルドで作られた証明書はありません');
} else {
  console.error('使い方：snapshot <file> | revoke-new <file>');
  process.exit(1);
}
