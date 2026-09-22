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

    /// F-03: if `weight` overloads `thread`'s strength, tears it apart at
    /// `segmentIndex` (an insect punching through) instead of discarding the
    /// whole strand — the stubs on either side of the tear stay in the web,
    /// still anchored on their original ends. Returns whether it broke.
    @discardableResult
    public func breakThread(_ thread: SilkThread, atSegmentIndex segmentIndex: Int, byWeight weight: Double) -> Bool {
        guard weight > thread.strength else { return false }
        let (before, after) = thread.sever(atSegmentIndex: segmentIndex)

        // Discard stubs too short to read as a remaining strand (the tear
        // landed right next to an anchor) rather than leaving a flickering
        // single-segment sliver.
        if before.count >= 3 {
            threads.append(SilkThread(rawPoints: before, segmentLength: thread.segmentLength, strength: thread.strength))
        }
        if after.count >= 3 {
            threads.append(SilkThread(rawPoints: after, segmentLength: thread.segmentLength, strength: thread.strength))
        }
        return true
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
