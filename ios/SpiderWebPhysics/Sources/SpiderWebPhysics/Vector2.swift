import Foundation

/// Platform-agnostic 2D vector. Deliberately has zero dependency on
/// CoreGraphics/SpriteKit so the physics core can be built and unit-tested
/// as a plain Swift package, independent of Xcode or an iOS simulator.
public struct Vector2: Equatable {
    public var x: Double
    public var y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }

    public static let zero = Vector2(x: 0, y: 0)

    public static func + (lhs: Vector2, rhs: Vector2) -> Vector2 {
        Vector2(x: lhs.x + rhs.x, y: lhs.y + rhs.y)
    }

    public static func - (lhs: Vector2, rhs: Vector2) -> Vector2 {
        Vector2(x: lhs.x - rhs.x, y: lhs.y - rhs.y)
    }

    public static func * (lhs: Vector2, rhs: Double) -> Vector2 {
        Vector2(x: lhs.x * rhs, y: lhs.y * rhs)
    }

    public static func += (lhs: inout Vector2, rhs: Vector2) { lhs = lhs + rhs }
    public static func -= (lhs: inout Vector2, rhs: Vector2) { lhs = lhs - rhs }

    public var length: Double { (x * x + y * y).squareRoot() }

    public func distance(to other: Vector2) -> Double { (self - other).length }

    public func dot(_ other: Vector2) -> Double { x * other.x + y * other.y }
}
