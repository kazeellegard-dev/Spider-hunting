import SpriteKit

/// A single flying insect (F-01/F-03). `weight` is compared against a
/// thread's `strength` to decide capture vs. breaking through.
final class Insect: SKShapeNode {
    let weight: Double
    var velocity: CGVector
    private(set) var isCaptured = false

    init(at position: CGPoint, velocity: CGVector, weight: Double, threadStrength: Double, radius: CGFloat = 6) {
        self.weight = weight
        self.velocity = velocity
        super.init()
        path = CGPath(ellipseIn: CGRect(x: -radius, y: -radius, width: radius * 2, height: radius * 2), transform: nil)
        fillColor = Insect.color(forWeight: weight, threadStrength: threadStrength)
        strokeColor = .clear
        self.position = position
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    /// Color must promise the truth about what happens on impact: red means
    /// "will snap a freshly-spun thread", full stop. Deriving the red
    /// threshold from `threadStrength` (rather than a fixed absolute number)
    /// keeps that promise even if `threadStrength` gets tuned later — a
    /// fixed threshold previously let e.g. weight 2.2 show orange while
    /// threadStrength was 2.0, so an "orange" insect could still snap the
    /// thread it touched.
    private static func color(forWeight weight: Double, threadStrength: Double) -> SKColor {
        if weight > threadStrength { return .systemRed }
        if weight > threadStrength * 0.5 { return .systemOrange }
        return .systemYellow
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
