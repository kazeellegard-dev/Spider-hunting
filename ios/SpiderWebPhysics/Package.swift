// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "SpiderWebPhysics",
    products: [
        .library(name: "SpiderWebPhysics", targets: ["SpiderWebPhysics"])
    ],
    targets: [
        .target(name: "SpiderWebPhysics"),
        .testTarget(name: "SpiderWebPhysicsTests", dependencies: ["SpiderWebPhysics"])
    ]
)
