import SwiftUI
import SpriteKit

@main
struct SpiderWebPrototypeApp: App {
    // Created once and reused, not rebuilt from SwiftUI body re-evaluation
    // (e.g. on every safe-area/geometry change), which would otherwise reset
    // the whole game each time.
    private static let scene: GameScene = {
        let scene = GameScene()
        scene.scaleMode = .resizeFill
        return scene
    }()

    var body: some Scene {
        WindowGroup {
            GeometryReader { proxy in
                SpriteView(scene: Self.scene)
                    .ignoresSafeArea()
                    .onAppear { Self.scene.externalSafeAreaInsets = UIEdgeInsets(proxy.safeAreaInsets) }
                    .onChange(of: proxy.safeAreaInsets) { newValue in
                        Self.scene.externalSafeAreaInsets = UIEdgeInsets(newValue)
                    }
            }
        }
    }
}

private extension UIEdgeInsets {
    init(_ edgeInsets: EdgeInsets) {
        self.init(top: edgeInsets.top, left: edgeInsets.leading, bottom: edgeInsets.bottom, right: edgeInsets.trailing)
    }
}
