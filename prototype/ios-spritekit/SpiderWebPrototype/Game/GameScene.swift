import SpriteKit
import SpiderWebPhysics

/// T-02 prototype scene: validates whether Verlet-integrated silk threads
/// (see the SpiderWebPhysics package) feel right for the "cast a web, catch
/// a bug" core loop before committing to this approach in the real game.
///
/// Controls: tap anywhere to move the spider there; a thread is spun from
/// its previous stop to the new tap. Insects spawn automatically and fly
/// across the screen — watch how the thread sags, jolts on impact, and
/// snaps when an insect is too heavy for `threadStrength`.
final class GameScene: SKScene {

    // MARK: - Tunable parameters (the actual point of this prototype)

    /// Downward acceleration applied to the thread each physics step.
    /// Larger magnitude = droopier web. Tune this first — biggest visual effect.
    private let gravity = Vector2(x: 0, y: -0.35)

    /// How many Verlet constraint-solve passes per frame. More = stiffer,
    /// less stretchy thread, at a (cheap) CPU cost. 8 is a common default.
    private let constraintIterations = 8

    /// How much weight a freshly-spun thread can catch before snapping (F-03).
    private var threadStrength = 2.0

    /// Total silk length available before the web can't be extended further (F-15).
    /// Bumped up from the original 2000 — that ran out after ~2-3 taps on a
    /// typical phone screen, which read as "silk stopped coming out" almost
    /// immediately rather than as a meaningful budget to manage.
    private let maxWebLength = 6000.0

    // MARK: - State

    private var spider: Spider!
    private var web: Web!
    private var threadNodes: [ObjectIdentifier: SKShapeNode] = [:]
    private var insects: [Insect] = []
    private var isSpiderMoving = false
    private var lastUpdateTime: TimeInterval = 0
    private var hudLabel: SKLabelNode!

    /// Set from the SwiftUI layer (see SpiderWebPrototypeApp.swift), which
    /// gets safe-area insets from SwiftUI's own GeometryReader instead of
    /// asking the SKView for them. SKView.safeAreaInsets has been reported
    /// as reading 0 in this SpriteView(...).ignoresSafeArea() setup even
    /// several frames in — if that turns out to be a real SpriteKit/SwiftUI
    /// interaction quirk (vs. e.g. a stale build on the test device), this
    /// sidesteps it. Falls back to view?.safeAreaInsets if never set.
    var externalSafeAreaInsets: UIEdgeInsets?

    override func didMove(to view: SKView) {
        backgroundColor = SKColor(white: 0.95, alpha: 1)
        web = Web(maxTotalLength: maxWebLength)

        let start = CGPoint(x: frame.midX, y: frame.midY)
        spider = Spider(startingAt: start)
        addChild(spider)

        hudLabel = SKLabelNode(fontNamed: "Menlo")
        hudLabel.fontSize = 14
        hudLabel.fontColor = .darkGray
        hudLabel.horizontalAlignmentMode = .left
        // Multi-line + top-anchored: a single long line ran off the right
        // edge on iPhone widths (this was the real "HUD overlaps" issue).
        hudLabel.verticalAlignmentMode = .top
        hudLabel.numberOfLines = 0
        addChild(hudLabel)
        positionHUD()

        run(.repeatForever(.sequence([
            .run { [weak self] in self?.spawnInsect() },
            .wait(forDuration: 1.6)
        ])))
    }

    private func positionHUD() {
        let insets = externalSafeAreaInsets ?? view?.safeAreaInsets ?? .zero
        hudLabel.position = CGPoint(x: 12 + insets.left, y: size.height - insets.top - 8)
    }

    // MARK: - Input

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first, !isSpiderMoving else { return }
        let target = touch.location(in: self)
        let from = spider.anchorPosition
        let distance = hypot(target.x - from.x, target.y - from.y)
        let duration = max(0.15, TimeInterval(distance / 400))

        // Spin the thread immediately, before the spider finishes walking
        // over, so the silk appears to trail the spider instead of lagging
        // behind its arrival.
        isSpiderMoving = true
        spinThread(from: from, to: target)
        spider.move(to: target, duration: duration) { [weak self] in
            self?.isSpiderMoving = false
        }
    }

    private func spinThread(from start: CGPoint, to end: CGPoint) {
        // Node creation is handled uniformly in syncThreadNodes() for every
        // thread that shows up in web.threads, including this one and any
        // stubs a punch-through leaves behind — see its doc comment for why.
        web.spinThread(from: Vector2(start), to: Vector2(end), strength: threadStrength)
    }

    // MARK: - Game loop

    override func update(_ currentTime: TimeInterval) {
        let dt = lastUpdateTime == 0 ? 1.0 / 60.0 : currentTime - lastUpdateTime
        lastUpdateTime = currentTime

        // Re-derive the HUD position every frame instead of once in
        // didMove(to:) — at that point the view often hasn't finished its
        // layout pass yet, so `safeAreaInsets` reads as zero and the label
        // ends up under the notch/Dynamic Island.
        positionHUD()

        web.update(gravity: gravity)
        syncThreadNodes()
        stepInsects(dt: dt)
        resolveCollisions()

        var hud = String(
            format: "silk left: %.0f / %.0f\nthreads: %d   strength: %.1f",
            web.remainingLength, maxWebLength, web.threads.count, threadStrength
        )
        if web.remainingLength <= 0 {
            hud += "\n[SILK DEPLETED]"
        }
        hudLabel.text = hud
    }

    /// Keeps `threadNodes` in exact sync with `web.threads`: creates an
    /// SKShapeNode the first time a thread shows up (a freshly-spun thread,
    /// or — just as importantly — one of the two stubs a punch-through
    /// leaves behind via Web.breakThread, which never went through
    /// spinThread() and previously never got a node at all, making split
    /// threads invisible even though they were still alive and collidable),
    /// drops nodes for threads no longer present, and redraws the rest from
    /// their current point positions.
    private func syncThreadNodes() {
        let currentIDs = Set(web.threads.map { ObjectIdentifier($0) })

        for (id, node) in threadNodes where !currentIDs.contains(id) {
            node.removeFromParent()
            threadNodes.removeValue(forKey: id)
        }

        for thread in web.threads {
            let id = ObjectIdentifier(thread)
            let node: SKShapeNode
            if let existing = threadNodes[id] {
                node = existing
            } else {
                node = SKShapeNode()
                node.strokeColor = .darkGray
                node.lineWidth = 1.5
                node.zPosition = -1
                addChild(node)
                threadNodes[id] = node
            }
            let path = CGMutablePath()
            let points = thread.points.map { $0.position.cgPoint }
            path.addLines(between: points)
            node.path = path
        }
    }

    private func spawnInsect() {
        guard insects.count < 8 else { return }
        let fromLeft = Bool.random()
        let y = CGFloat.random(in: frame.minY + 40...frame.maxY - 40)
        let startX = fromLeft ? frame.minX - 20 : frame.maxX + 20
        let speed = CGFloat.random(in: 80...160)
        let vx = fromLeft ? speed : -speed
        // Skew toward catchable weights so breaks read as a notable event
        // rather than the common case (threadStrength is 2.0): ~75% land
        // safely below it, ~25% are heavy enough to snap the thread.
        let weight = Double.random(in: 0...1) < 0.75
            ? Double.random(in: 0.3...1.6)
            : Double.random(in: 2.1...3.2)

        let insect = Insect(at: CGPoint(x: startX, y: y), velocity: CGVector(dx: vx, dy: 0), weight: weight, threadStrength: threadStrength)
        addChild(insect)
        insects.append(insect)
    }

    private func stepInsects(dt: TimeInterval) {
        for insect in insects {
            insect.step(dt: dt)
        }
        insects.removeAll { insect in
            let offscreen = insect.position.x < frame.minX - 40 || insect.position.x > frame.maxX + 40
            if offscreen { insect.removeFromParent() }
            return offscreen
        }
    }

    private func resolveCollisions() {
        for insect in insects where insect.parent != nil && !insect.isCaptured {
            guard let hit = web.threadNear(Vector2(insect.position), within: 10) else { continue }

            if hit.thread.strength >= insect.weight {
                // Bumped from 0.02 — the original jolt was barely visible.
                let impulse = Vector2(x: Double(insect.velocity.dx), y: Double(insect.velocity.dy)) * 0.06
                hit.thread.applyImpact(atSegmentIndex: hit.segmentIndex, impulse: impulse)
                insect.position = hit.point.cgPoint
                let captured = insect
                insects.removeAll { $0 === insect }
                captured.playCaptureAnimation {}
            } else if web.breakThread(hit.thread, atSegmentIndex: hit.segmentIndex, byWeight: insect.weight) {
                insect.velocity = CGVector(dx: insect.velocity.dx * 0.6, dy: insect.velocity.dy * 0.6)
                // Punch the insect just past the collision radius so it
                // doesn't immediately re-trigger a break against one of the
                // fresh stubs left dangling right where it just tore through.
                let vx = insect.velocity.dx
                let nudge: CGFloat = vx >= 0 ? 14 : -14
                insect.position.x += nudge
            }
        }
    }
}
