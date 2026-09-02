import Foundation

struct UpcomingPointEngine: Sendable {
    let maximumCount: Int

    init(maximumCount: Int = 6) {
        self.maximumCount = maximumCount
    }

    func upcoming(from position: MatchedPosition, network: RoadNetwork, speedMetersPerSecond: Double?, now: Date) -> [UpcomingPoint] {
        guard let startingLink = network.linksByID[position.linkID] else { return [] }
        let linksByID = network.linksByID
        var route: [(link: RoadLink, distanceToStart: Double)] = [(startingLink, -position.offsetMeters)]
        var visited = Set([startingLink.id])

        while route.count < 64, let last = route.last, let nextID = last.link.nextLinkIDs.first,
              let next = linksByID[nextID], !visited.contains(nextID) {
            route.append((next, last.distanceToStart + last.link.lengthMeters))
            visited.insert(nextID)
        }

        let routeOffsets = Dictionary(uniqueKeysWithValues: route.map { ($0.link.id, $0.distanceToStart) })
        let fallbackSpeed = max(16.7, startingLink.standardSpeedKPH / 3.6)
        let currentSpeed = speedMetersPerSecond.flatMap { $0 >= 5 ? $0 : nil }
        let estimatedSpeed = min(max(currentSpeed ?? fallbackSpeed, fallbackSpeed * 0.55), fallbackSpeed * 1.15)

        return network.points.compactMap { point -> UpcomingPoint? in
            guard let linkStart = routeOffsets[point.linkID] else { return nil }
            let distance = linkStart + point.offsetMeters
            guard distance > 40 else { return nil }
            let passage = now.addingTimeInterval(distance / estimatedSpeed)
            return UpcomingPoint(point: point, distanceMeters: distance, estimatedPassageDate: passage)
        }
        .sorted { $0.distanceMeters < $1.distanceMeters }
        .prefix(maximumCount)
        .map { $0 }
    }
}
