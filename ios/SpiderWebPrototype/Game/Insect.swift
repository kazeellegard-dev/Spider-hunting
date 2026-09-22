import SpriteKit

/// A single flying insect (F-01/F-03). `weight` is compared against a
/// thread's `strength` to decide capture vs. breaking through.
final class Insect: SKShapeNode {
    let weight: Double
    var velocity: CGVector
    private(set) var isCaptured = false

    init(at position: CGPoint, velocity: CGVector, weight: Double, radius: CGFloat = 6) {
        self.weight = weight
        self.velocity = velocity
        super.init()
        path = CGPath(ellipseIn: CGRect(x: -radius, y: -radius, width: radius * 2, height: radius * 2), transform: nil)
        fillColor = Insect.color(forWeight: weight)
        strokeColor = .clear
        self.position = position
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private static func color(forWeight weight: Double) -> SKColor {
        // Heavier insects read as visibly bigger threats even before they hit a thread.
        switch weight {
        case ..<1.0: return .systemYellow
        case ..<2.5: return .systemOrange
        default: return .systemRed
        }
    }

    func step(dt: TimeInterval) {
        guard !isCaptured else { return }
        position.x += velocity.dx * CGFloat(dt)
        position.y += velocity.dy * CGFloat(dt)
    }

    /// F-03a: light-touch capture animation — wrap in silk, pause, then pop
    /// with a little burst ring. No gore.
    func playCaptureAnimation(removal: @escaping () -> Void) {
        isCaptured = true
        velocity = .zero
        let wrap = SKAction.sequence([
            SKAction.scale(to: 1.2, duration: 0.08),
            SKAction.scale(to: 0.6, duration: 0.12)
        ])
        let hold = SKAction.wait(forDuration: 0.6)
        let pop = SKAction.group([
            SKAction.scale(to: 1.8, duration: 0.14),
            SKAction.fadeOut(withDuration: 0.14)
        ])
        run(.sequence([wrap, hold, pop])) { [weak self] in
            self?.removeFromParent()
            removal()
        }

        if let scene = parent {
            let burst = SKShapeNode(circleOfRadius: 4)
            burst.position = position
            burst.strokeColor = .clear
            burst.fillColor = fillColor
            burst.alpha = 0.8
            burst.zPosition = zPosition + 1
            scene.addChild(burst)
            burst.run(.sequence([
                .wait(forDuration: 0.8),
                .group([
                    .scale(to: 4, duration: 0.2),
                    .fadeOut(withDuration: 0.2)
                ]),
                .removeFromParent()
            ]))
        }
    }
}
