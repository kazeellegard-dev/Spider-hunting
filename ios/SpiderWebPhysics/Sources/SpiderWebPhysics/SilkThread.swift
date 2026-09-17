import Foundation

/// One strand of silk stretched between two fixed anchors, simulated with
/// Verlet integration plus iterative distance constraints — the standard
/// cheap "rope simulation" recipe. This is the core of requirements-doc
/// item T-02: does this integrator give a natural sag/jolt/snap feel before
/// it gets wired into SpriteKit rendering.
public final class SilkThread {
    public private(set) var points: [VerletPoint]
    /// Rest length of a single segment between adjacent points.
    public let segmentLength: Double
    /// How much insect weight (see F-03) this strand can catch before it snaps.
    public let strength: Double
    public private(set) var isBroken = false

    /// - Parameters:
    ///   - start/end: anchor positions (both pinned in place).
    ///   - segmentCount: more segments = smoother sag, more constraint-solving cost.
    ///   - slack: extra length over the straight-line distance, as a fraction
    ///     (0 = taut, 0.15 = 15% longer than a straight line so it visibly sags).
    ///   - strength: max insect weight this thread can catch before it snaps.
    public init(start: Vector2, end: Vector2, segmentCount: Int = 12, slack: Double = 0.15, strength: Double) {
        precondition(segmentCount >= 2, "need at least 2 segments to have a movable midpoint")
        let straightLength = start.distance(to: end)
        let totalLength = straightLength * (1 + slack)
        self.segmentLength = totalLength / Double(segmentCount)
        self.strength = strength

        points = (0...segmentCount).map { i in
            let t = Double(i) / Double(segmentCount)
            let position = start + (end - start) * t
            let isAnchor = (i == 0 || i == segmentCount)
            return VerletPoint(position: position, isPinned: isAnchor)
        }
    }

    public func update(gravity: Vector2, damping: Double = 0.985, constraintIterations: Int = 8) {
        guard !isBroken else { return }
        for point in points {
            point.integrate(gravity: gravity, damping: damping)
        }
        for _ in 0..<constraintIterations {
            satisfyConstraints()
        }
    }

    private func satisfyConstraints() {
        for i in 0..<(points.count - 1) {
            let a = points[i]
            let b = points[i + 1]
            let delta = b.position - a.position
            let distance = delta.length
            guard distance > 0 else { continue }
            let difference = (distance - segmentLength) / distance
            let correction = delta * (difference * 0.5)

            if a.isPinned && b.isPinned {
                continue
            } else if a.isPinned {
                b.position -= correction * 2
            } else if b.isPinned {
                a.position += correction * 2
            } else {
                a.position += correction
                b.position -= correction
            }
        }
    }

    /// Closest point on the thread's polyline to `target`, plus which segment it's on.
    public func closestPoint(to target: Vector2) -> (distance: Double, segmentIndex: Int, point: Vector2) {
        var best: (distance: Double, segmentIndex: Int, point: Vector2) = (.infinity, 0, points[0].position)
        for i in 0..<(points.count - 1) {
            let a = points[i].position
            let b = points[i + 1].position
            let closest = Self.closestPointOnSegment(from: a, to: b, target: target)
            let distance = closest.distance(to: target)
            if distance < best.distance {
                best = (distance, i, closest)
            }
        }
        return best
    }

    private static func closestPointOnSegment(from a: Vector2, to b: Vector2, target: Vector2) -> Vector2 {
        let segment = b - a
        let lengthSquared = segment.dot(segment)
        guard lengthSquared > 0 else { return a }
        let t = max(0, min(1, (target - a).dot(segment) / lengthSquared))
        return a + segment * t
    }

    /// Applies an impulse to the points bracketing `segmentIndex` (e.g. an insect hitting the thread).
    public func applyImpact(atSegmentIndex segmentIndex: Int, impulse: Vector2) {
        guard segmentIndex >= 0, segmentIndex < points.count - 1 else { return }
        points[segmentIndex].applyImpulse(impulse)
        points[segmentIndex + 1].applyImpulse(impulse)
    }

    /// F-03: if the incoming insect is heavier than this thread can hold, it snaps.
    @discardableResult
    public func breakIfOverloaded(byWeight weight: Double) -> Bool {
        if weight > strength {
            isBroken = true
        }
        return isBroken
    }
}
