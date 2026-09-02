import XCTest
@testable import HighwayAssist

final class GeometryTests: XCTestCase {
    func testDistanceIsApproximatelyOneKilometer() {
        let start = Coordinate(latitude: 35.0, longitude: 139.0)
        let end = Coordinate(latitude: 35.009, longitude: 139.0)
        XCTAssertEqual(RoadGeometry.distance(start, end), 1_001, accuracy: 8)
    }

    func testAngleDifferenceWrapsAtNorth() {
        XCTAssertEqual(RoadGeometry.angleDifference(355, 5), 10, accuracy: 0.001)
    }

    func testProjectionReturnsOffsetAndLateralDistance() throws {
        let line = [Coordinate(latitude: 35.0, longitude: 139.0), Coordinate(latitude: 35.01, longitude: 139.0)]
        let point = Coordinate(latitude: 35.005, longitude: 139.001)
        let result = try XCTUnwrap(RoadGeometry.project(point, onto: line))
        XCTAssertEqual(result.offset, 556, accuracy: 15)
        XCTAssertEqual(result.distance, 91, accuracy: 5)
    }
}

