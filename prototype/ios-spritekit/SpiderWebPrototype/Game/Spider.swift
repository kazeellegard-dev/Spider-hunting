import SpriteKit

/// The player-controlled spider (F-12/F-13): tapping moves it, and once it
/// arrives the caller spins an actual `SilkThread` from its previous stop to
/// the new one (see `GameScene.spinThread`).
final class Spider: SKShapeNode {
    private(set) var anchorPosition: CGPoint

    init(startingAt position: CGPoint) {
        anchorPosition = position
        super.init()
        path = CGPath(ellipseIn: CGRect(x: -12, y: -12, width: 24, height: 24), transform: nil)
        fillColor = .black
        strokeColor = .clear
        self.position = position
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func move(to target: CGPoint, duration: TimeInterval, completion: @escaping () -> Void) {
        let action = SKAction.move(to: target, duration: duration)
        run(action) { [weak self] in
            self?.anchorPosition = target
            completion()
        }
    }
}
