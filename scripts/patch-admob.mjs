// npm install のあとに自動で実行し、@capacitor-community/admob を書き換える
// 1. 同意確認（UMP）の失敗理由を捨てて「Request consent info failed」だけを返すので、「アプリの状態」画面で原因が分かるように Google の理由もつけて返す
// 2. AdMob メディエーションで Unity Ads を使えるよう、Google の Unity アダプター（SPM）をプラグインの依存に足す
//    （ios/App/CapApp-SPM/Package.swift は cap sync で作り直されるので、こちらに足す）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const dir = 'node_modules/@capacitor-community/admob';
if (!existsSync(dir)) process.exit(0);

function patch(file, from, to, done, label) {
  const f = `${dir}/${file}`;
  const src = readFileSync(f, 'utf8');
  if (src.includes(to)) return;
  if (!src.includes(from)) { console.warn(`patch-admob: ${label}の書き換える場所が見つかりません（プラグインの版が変わった？）`); return; }
  writeFileSync(f, src.replace(from, to));
  console.log(`patch-admob: ${done}`);
}

patch('ios/Sources/AdMobPlugin/Consent/ConsentExecutor.swift',
  `                if error != nil {
                    call.reject("Request consent info failed")`,
  `                if let error = error as NSError? {
                    call.reject("Request consent info failed: \\(error.domain) \\(error.code) \\(error.localizedDescription)")`,
  '同意確認の失敗理由を返すようにしました', '同意確認');

const UNITY_ADAPTER = '4.21.0'; // タグは 4.21.000（SPM は 4.21.0 として読む）
patch('Package.swift',
  `        .package(url: "https://github.com/googleads/swift-package-manager-google-user-messaging-platform.git", .upToNextMinor(from: "3.1.0"))
    ],`,
  `        .package(url: "https://github.com/googleads/swift-package-manager-google-user-messaging-platform.git", .upToNextMinor(from: "3.1.0")),
        .package(url: "https://github.com/googleads/googleads-mobile-ios-mediation-unity.git", exact: "${UNITY_ADAPTER}")
    ],`,
  'Unity Ads のアダプターを足しました', 'Unity アダプター（依存）');
patch('Package.swift',
  `                .product(name: "GoogleUserMessagingPlatform", package: "swift-package-manager-google-user-messaging-platform")
            ],`,
  `                .product(name: "GoogleUserMessagingPlatform", package: "swift-package-manager-google-user-messaging-platform"),
                .product(name: "UnityAdapterTarget", package: "googleads-mobile-ios-mediation-unity")
            ],`,
  'Unity Ads のアダプターをプラグインにつなぎました', 'Unity アダプター（ターゲット）');
