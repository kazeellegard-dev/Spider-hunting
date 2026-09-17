import XCTest
@testable import SpiderWebPhysics

final class SilkThreadTests: XCTestCase {
    func testThreadSagsUnderGravity() {
        let thread = SilkThread(start: Vector2(x: 0, y: 0), end: Vector2(x: 100, y: 0), segmentCount: 10, slack: 0.15, strength: 5)
        let midpointBefore = thread.points[5].position.y

        for _ in 0..<120 {
            thread.update(gravity: Vector2(x: 0, y: -0.3))
        }

        let midpointAfter = thread.points[5].position.y
        XCTAssertLessThan(midpointAfter, midpointBefore, "midpoint should sag downward under gravity")
    }

    func testAnchorsStayPinned() {
        let start = Vector2(x: 0, y: 0)
        let end = Vector2(x: 100, y: 40)
        let thread = SilkThread(start: start, end: end, segmentCount: 8, strength: 5)

        for _ in 0..<200 {
            thread.update(gravity: Vector2(x: 0, y: -0.3))
        }

        XCTAssertEqual(thread.points.first!.position, start)
        XCTAssertEqual(thread.points.last!.position, end)
    }

    func testSegmentLengthIsRoughlyMaintained() {
        let thread = SilkThread(start: Vector2(x: 0, y: 0), end: Vector2(x: 100, y: 0), segmentCount: 10, slack: 0.1, strength: 5)

        for _ in 0..<200 {
            thread.update(gravity: Vector2(x: 0, y: -0.3))
        }

        for i in 0..<(thread.points.count - 1) {
            let distance = thread.points[i].position.distance(to: thread.points[i + 1].position)
            XCTAssertEqual(distance, thread.segmentLength, accuracy: thread.segmentLength * 0.05)
        }
    }

    func testHeavyInsectBreaksWeakThread() {
        let thread = SilkThread(start: Vector2(x: 0, y: 0), end: Vector2(x: 100, y: 0), strength: 1.0)
        XCTAssertFalse(thread.isBroken)
        XCTAssertTrue(thread.breakIfOverloaded(byWeight: 2.5))
        XCTAssertTrue(thread.isBroken)
    }

    func testLightInsectDoesNotBreakThread() {
        let thread = SilkThread(start: Vector2(x: 0, y: 0), end: Vector2(x: 100, y: 0), strength: 3.0)
        XCTAssertFalse(thread.breakIfOverloaded(byWeight: 1.0))
        XCTAssertFalse(thread.isBroken)
    }

    func testClosestPointFindsMidSegment() {
        let thread = SilkThread(start: Vector2(x: 0, y: 0), end: Vector2(x: 100, y: 0), segmentCount: 10, slack: 0, strength: 5)
        // With zero slack the thread should sit almost exactly on the straight line initially.
        let result = thread.closestPoint(to: Vector2(x: 50, y: 5))
        XCTAssertEqual(result.point.x, 50, accuracy: 5)
        XCTAssertLessThan(result.distance, 6)
    }

    func testApplyImpactDisplacesBracketingPoints() {
        let thread = SilkThread(start: Vector2(x: 0, y: 0), end: Vector2(x: 100, y: 0), segmentCount: 10, slack: 0, strength: 5)
        let before = thread.points[5].position

        thread.applyImpact(atSegmentIndex: 4, impulse: Vector2(x: 0, y: -5))
        thread.update(gravity: .zero, damping: 1.0, constraintIterations: 0)

        XCTAssertNotEqual(thread.points[5].position, before)
    }
}
