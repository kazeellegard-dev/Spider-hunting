import Foundation

/// The whole web: a budgeted collection of `SilkThread`s. Mirrors F-15 (the
/// total amount of silk is a limited, non-renewing-within-a-run resource) so
/// this prototype validates the budget-then-decay design, not just the
/// per-thread physics.
public final class Web {
    public private(set) var threads: [SilkThread] = []
    public let maxTotalLength: Double
    public private(set) var usedLength: Double = 0

    public init(maxTotalLength: Double) {
        self.maxTotalLength = maxTotalLength
    }

    public var remainingLength: Double { max(0, maxTotalLength - usedLength) }

    /// Attempts to spin a new thread between two anchors. Returns nil if there
    /// isn't enough silk left (F-15: the web can't be extended indefinitely).
    @discardableResult
    public func spinThread(from start: Vector2, to end: Vector2, strength: Double) -> SilkThread? {
        let straightLength = start.distance(to: end)
        guard straightLength <= remainingLength else { return nil }
        let thread = SilkThread(start: start, end: end, strength: strength)
        threads.append(thread)
        usedLength += straightLength
        return thread
    }

    public func update(gravity: Vector2) {
        threads.removeAll { $0.isBroken }
        for thread in threads {
            thread.update(gravity: gravity)
        }
    }

    /// Finds the thread (if any) an object at `position` is touching, closest first.
    public func threadNear(_ position: Vector2, within radius: Double) -> (thread: SilkThread, segmentIndex: Int, point: Vector2)? {
        var best: (thread: SilkThread, segmentIndex: Int, point: Vector2, distance: Double)?
        for thread in threads {
            let (distance, segmentIndex, point) = thread.closestPoint(to: position)
            if distance <= radius, best == nil || distance < best!.distance {
                best = (thread, segmentIndex, point, distance)
            }
        }
        return best.map { ($0.thread, $0.segmentIndex, $0.point) }
    }
}
