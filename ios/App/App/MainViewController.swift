import UIKit
import Capacitor

/// アプリの画面。ゲーム用の小さなネイティブ機能（SafeArea）を登録する
class MainViewController: CAPBridgeViewController {
    private let safeArea = SafeAreaPlugin()

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(safeArea)
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        safeArea.notifyChange(view.safeAreaInsets)
    }
}

/// ダイナミックアイランドやホームバーの大きさ（セーフエリア）をゲームに伝える
@objc(SafeAreaPlugin)
public class SafeAreaPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SafeAreaPlugin"
    public let jsName = "SafeArea"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise)
    ]

    private static func dict(_ i: UIEdgeInsets) -> [String: Any] {
        return ["top": i.top, "right": i.right, "bottom": i.bottom, "left": i.left]
    }

    @objc func get(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let insets = self.bridge?.viewController?.view.safeAreaInsets ?? .zero
            call.resolve(SafeAreaPlugin.dict(insets))
        }
    }

    func notifyChange(_ insets: UIEdgeInsets) {
        notifyListeners("change", data: SafeAreaPlugin.dict(insets))
    }
}
