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

    /// F-03a: light-touch capture animation — wrap in silk, pause, then pop. No gore.
    func playCaptureAnimation(removal: @escaping () -> Void) {
        isCaptured = true
        velocity = .zero
        let wrap = SKAction.scale(to: 0.6, duration: 0.15)
        let hold = SKAction.wait(forDuration: 0.7)
        let pop = SKAction.group([
            SKAction.scale(to: 0, duration: 0.15),
            SKAction.fadeOut(withDuration: 0.15)
        ])
        run(.sequence([wrap, hold, pop])) { [weak self] in
            self?.removeFromParent()
            removal()
        }
    }
}
