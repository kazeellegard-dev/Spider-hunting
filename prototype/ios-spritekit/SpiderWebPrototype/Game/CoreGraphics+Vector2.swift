import CoreGraphics
import SpiderWebPhysics

extension Vector2 {
    init(_ point: CGPoint) {
        self.init(x: Double(point.x), y: Double(point.y))
    }

    var cgPoint: CGPoint {
        CGPoint(x: x, y: y)
    }
}
