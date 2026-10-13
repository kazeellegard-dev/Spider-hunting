import Foundation

/// A single mass point simulated with Verlet integration: instead of storing
/// velocity explicitly, velocity is implied by the delta between the current
/// and previous position. This is the standard trick that keeps rope/cloth
/// simulations stable with a very simple integrator.
public final class VerletPoint {
    public var position: Vector2
    public var previousPosition: Vector2
    public let isPinned: Bool

    public init(position: Vector2, isPinned: Bool = false) {
        self.position = position
        self.previousPosition = position
        self.isPinned = isPinned
    }

    /// Integrates the point forward one step under gravity plus its implicit velocity.
    /// `damping` < 1 bleeds off energy so the thread settles instead of oscillating forever.
    public func integrate(gravity: Vector2, damping: Double) {
        guard !isPinned else { return }
        let velocity = (position - previousPosition) * damping
        let next = position + velocity + gravity
        previousPosition = position
        position = next
    }

    /// Instantly nudges the point's implicit velocity (used when an insect slams into the thread).
    public func applyImpulse(_ impulse: Vector2) {
        guard !isPinned else { return }
        previousPosition -= impulse
    }
}
