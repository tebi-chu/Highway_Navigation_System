import XCTest
@testable import HighwayAssist

final class UpcomingPointEngineTests: XCTestCase {
    func testReturnsAtMostSixPointsInDistanceOrder() {
        let network = fixtureNetwork()
        let position = MatchedPosition(linkID: "a", offsetMeters: 500, lateralDistanceMeters: 2, confidence: 0.9)
        let now = Date(timeIntervalSince1970: 1_000)
        let result = UpcomingPointEngine().upcoming(from: position, network: network, speedMetersPerSecond: 20, now: now)
        XCTAssertEqual(result.count, 6)
        XCTAssertEqual(result.map(\.point.id), ["p1", "p2", "p3", "p4", "p5", "p6"])
        XCTAssertTrue(zip(result, result.dropFirst()).allSatisfy { $0.0.distanceMeters < $0.1.distanceMeters })
        XCTAssertEqual(result[0].distanceMeters, 500, accuracy: 0.01)
        XCTAssertEqual(result[0].estimatedPassageDate.timeIntervalSince(now), 25, accuracy: 0.01)
    }

    func testPassedPointIsRemoved() {
        let network = fixtureNetwork()
        let position = MatchedPosition(linkID: "a", offsetMeters: 1_100, lateralDistanceMeters: 2, confidence: 0.9)
        let result = UpcomingPointEngine().upcoming(from: position, network: network, speedMetersPerSecond: 20, now: .now)
        XCTAssertFalse(result.contains { $0.point.id == "p1" })
        XCTAssertEqual(result.count, 6)
        XCTAssertEqual(result.last?.point.id, "p7")
    }

    private func fixtureNetwork() -> RoadNetwork {
        let coordinates = [Coordinate(latitude: 35, longitude: 139), Coordinate(latitude: 35.1, longitude: 139)]
        let a = RoadLink(id: "a", highwayName: "Test", directionName: "下り", destinationName: "西方面", lengthMeters: 5_000, standardSpeedKPH: 80, polyline: coordinates, nextLinkIDs: ["b"])
        let b = RoadLink(id: "b", highwayName: "Test", directionName: "下り", destinationName: "西方面", lengthMeters: 5_000, standardSpeedKPH: 80, polyline: coordinates, nextLinkIDs: [])
        let offsets: [(String, String, Double)] = [("p1", "a", 1_000), ("p2", "a", 2_000), ("p3", "a", 3_000), ("p4", "a", 4_000), ("p5", "b", 500), ("p6", "b", 1_500), ("p7", "b", 2_500)]
        let points = offsets.map { id, link, offset in
            RoadPoint(id: id, name: id, kind: .ic, linkID: link, offsetMeters: offset, coordinate: coordinates[0], facilities: [])
        }
        return RoadNetwork(version: 1, links: [a, b], points: points)
    }
}
