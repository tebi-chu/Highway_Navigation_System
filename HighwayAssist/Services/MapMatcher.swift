import Foundation

struct MapMatcher: Sendable {
    func match(_ sample: LocationSample, network: RoadNetwork, previous: MatchedPosition?) -> MatchedPosition? {
        let candidates = network.links.compactMap { link -> (RoadLink, Double, Double, Double, Double)? in
            guard let projection = RoadGeometry.project(sample.coordinate, onto: link.polyline) else { return nil }
            guard projection.distance <= max(120, sample.horizontalAccuracy * 2.5) else { return nil }
            let headingPenalty: Double
            if let course = sample.courseDegrees, (sample.speedMetersPerSecond ?? 0) >= 2.5 {
                headingPenalty = RoadGeometry.angleDifference(course, projection.bearing) * 0.65
            } else {
                headingPenalty = 0
            }
            let continuityPenalty = previous.map { previousPosition in
                if previousPosition.linkID == link.id { return 0.0 }
                guard let oldLink = network.linksByID[previousPosition.linkID] else { return 100.0 }
                return oldLink.nextLinkIDs.contains(link.id) ? 15.0 : 90.0
            } ?? 0
            return (link, projection.offset, projection.distance, projection.bearing,
                    projection.distance + headingPenalty + continuityPenalty)
        }
        guard let best = candidates.min(by: { $0.4 < $1.4 }) else { return nil }
        let confidence = max(0, min(1, 1 - best.4 / 180))
        return MatchedPosition(linkID: best.0.id, offsetMeters: best.1,
                               lateralDistanceMeters: best.2, confidence: confidence)
    }
}

