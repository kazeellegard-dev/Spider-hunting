import XCTest
@testable import SpiderWebPhysics

final class WebTests: XCTestCase {
    func testSpinningThreadConsumesBudget() {
        let web = Web(maxTotalLength: 150)
        let thread = web.spinThread(from: Vector2(x: 0, y: 0), to: Vector2(x: 100, y: 0), strength: 2)
        XCTAssertNotNil(thread)
        XCTAssertEqual(web.usedLength, 100)
        XCTAssertEqual(web.remainingLength, 50)
    }

    func testSpinningThreadFailsWhenOverBudget() {
        let web = Web(maxTotalLength: 50)
        let thread = web.spinThread(from: Vector2(x: 0, y: 0), to: Vector2(x: 100, y: 0), strength: 2)
        XCTAssertNil(thread)
        XCTAssertEqual(web.threads.count, 0)
    }

    func testBrokenThreadsAreRemovedOnUpdate() {
        let web = Web(maxTotalLength: 1000)
        let thread = web.spinThread(from: Vector2(x: 0, y: 0), to: Vector2(x: 100, y: 0), strength: 1)!
        thread.breakIfOverloaded(byWeight: 5)
        web.update(gravity: Vector2(x: 0, y: -0.3))
        XCTAssertTrue(web.threads.isEmpty)
    }

    func testThreadNearFindsClosestThread() {
        let web = Web(maxTotalLength: 1000)
        web.spinThread(from: Vector2(x: 0, y: 0), to: Vector2(x: 100, y: 0), strength: 2)
        web.spinThread(from: Vector2(x: 0, y: 50), to: Vector2(x: 100, y: 50), strength: 2)

        let hit = web.threadNear(Vector2(x: 50, y: 48), within: 10)
        XCTAssertNotNil(hit)
        XCTAssertEqual(hit?.point.y ?? -1, 50, accuracy: 5)
    }

    func testBreakThreadLeavesTwoStubsAnchoredOnEitherSide() {
        let web = Web(maxTotalLength: 1000)
        let thread = web.spinThread(from: Vector2(x: 0, y: 0), to: Vector2(x: 100, y: 0), strength: 1)!

        let broke = web.breakThread(thread, atSegmentIndex: 5, byWeight: 5)
        XCTAssertTrue(broke)
        XCTAssertTrue(thread.isBroken)

        web.update(gravity: Vector2(x: 0, y: -0.3))

        // The original strand is gone; both remaining stubs (still anchored
        // on their original end) survive instead of the whole thread vanishing.
        XCTAssertEqual(web.threads.count, 2)
        XCTAssertFalse(web.threads.contains { $0 === thread })
    }

    func testBreakThreadDiscardsSliverStubNearAnchor() {
        let web = Web(maxTotalLength: 1000)
        let thread = web.spinThread(from: Vector2(x: 0, y: 0), to: Vector2(x: 100, y: 0), strength: 1)!

        web.breakThread(thread, atSegmentIndex: 0, byWeight: 5)
        web.update(gravity: Vector2(x: 0, y: -0.3))

        // The tear landed right next to the start anchor, so that stub is
        // too short to keep — only the long remainder stays in the web.
        XCTAssertEqual(web.threads.count, 1)
    }

    func testBreakThreadDoesNothingWhenWithinStrength() {
        let web = Web(maxTotalLength: 1000)
        let thread = web.spinThread(from: Vector2(x: 0, y: 0), to: Vector2(x: 100, y: 0), strength: 5)!

        let broke = web.breakThread(thread, atSegmentIndex: 5, byWeight: 2)

        XCTAssertFalse(broke)
        XCTAssertFalse(thread.isBroken)
        XCTAssertEqual(web.threads.count, 1)
    }
}
