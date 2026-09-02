import Foundation

enum RoadGeometry {
    static let earthRadiusMeters = 6_371_000.0

    static func distance(_ a: Coordinate, _ b: Coordinate) -> Double {
        let lat1 = a.latitude * .pi / 180
        let lat2 = b.latitude * .pi / 180
        let dLat = (b.latitude - a.latitude) * .pi / 180
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let value = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        return earthRadiusMeters * 2 * atan2(sqrt(value), sqrt(1 - value))
    }

    static func bearing(_ a: Coordinate, _ b: Coordinate) -> Double {
        let lat1 = a.latitude * .pi / 180
        let lat2 = b.latitude * .pi / 180
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let y = sin(dLon) * cos(lat2)
        let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon)
        return (atan2(y, x) * 180 / .pi + 360).truncatingRemainder(dividingBy: 360)
    }

    static func angleDifference(_ a: Double, _ b: Double) -> Double {
        let difference = abs(a - b).truncatingRemainder(dividingBy: 360)
        return min(difference, 360 - difference)
    }

    static func project(_ point: Coordinate, onto polyline: [Coordinate]) -> (offset: Double, distance: Double, bearing: Double)? {
        guard polyline.count >= 2 else { return nil }
        let origin = point
        let metersPerLatitude = 111_132.0
        let metersPerLongitude = 111_320.0 * cos(origin.latitude * .pi / 180)
        var best: (offset: Double, distance: Double, bearing: Double)?
        var traversed = 0.0

        for index in 0..<(polyline.count - 1) {
            let start = polyline[index]
            let end = polyline[index + 1]
            let ax = (start.longitude - origin.longitude) * metersPerLongitude
            let ay = (start.latitude - origin.latitude) * metersPerLatitude
            let bx = (end.longitude - origin.longitude) * metersPerLongitude
            let by = (end.latitude - origin.latitude) * metersPerLatitude
            let dx = bx - ax
            let dy = by - ay
            let denominator = dx * dx + dy * dy
            let t = denominator == 0 ? 0 : max(0, min(1, -(ax * dx + ay * dy) / denominator))
            let projectedX = ax + t * dx
            let projectedY = ay + t * dy
            let lateral = hypot(projectedX, projectedY)
            let segmentLength = RoadGeometry.distance(start, end)
            let candidate = (offset: traversed + segmentLength * t,
                             distance: lateral,
                             bearing: RoadGeometry.bearing(start, end))
            if best == nil || lateral < best!.distance { best = candidate }
            traversed += segmentLength
        }
        return best
    }
}
