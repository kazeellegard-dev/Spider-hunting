import SwiftUI
import SpriteKit

@main
struct SpiderWebPrototypeApp: App {
    var body: some Scene {
        WindowGroup {
            SpriteView(scene: Self.makeScene())
                .ignoresSafeArea()
        }
    }

    private static func makeScene() -> SKScene {
        let scene = GameScene()
        scene.scaleMode = .resizeFill
        return scene
    }
}
