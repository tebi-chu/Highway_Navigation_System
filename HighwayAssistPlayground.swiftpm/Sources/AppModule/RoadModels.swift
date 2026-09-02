import CoreLocation
import Foundation

struct Coordinate: Codable, Hashable, Sendable {
    let latitude: Double
    let longitude: Double

    var clLocationCoordinate: CLLocationCoordinate2D {
        .init(latitude: latitude, longitude: longitude)
    }
}

enum RoadPointKind: String, Codable, CaseIterable, Sendable {
    case sa = "SA"
    case pa = "PA"
    case ic = "IC"
    case jct = "JCT"

    var hasFacilities: Bool { self == .sa || self == .pa }
}

struct RoadPoint: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let kind: RoadPointKind
    let linkID: String
    let offsetMeters: Double
    let coordinate: Coordinate
    let facilities: [FacilityType]
    let brands: [RoadBrand]

    init(id: String, name: String, kind: RoadPointKind, linkID: String,
         offsetMeters: Double, coordinate: Coordinate,
         facilities: [FacilityType], brands: [RoadBrand] = []) {
        self.id = id
        self.name = name
        self.kind = kind
        self.linkID = linkID
        self.offsetMeters = offsetMeters
        self.coordinate = coordinate
        self.facilities = facilities
        self.brands = brands
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, kind, linkID, offsetMeters, coordinate, facilities, brands
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        name = try values.decode(String.self, forKey: .name)
        kind = try values.decode(RoadPointKind.self, forKey: .kind)
        linkID = try values.decode(String.self, forKey: .linkID)
        offsetMeters = try values.decode(Double.self, forKey: .offsetMeters)
        coordinate = try values.decode(Coordinate.self, forKey: .coordinate)
        facilities = try values.decodeIfPresent([FacilityType].self, forKey: .facilities) ?? []
        brands = try values.decodeIfPresent([RoadBrand].self, forKey: .brands) ?? []
    }
}

struct RoadLink: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let highwayName: String
    let directionName: String
    let destinationName: String
    let lengthMeters: Double
    let standardSpeedKPH: Double
    let polyline: [Coordinate]
    let nextLinkIDs: [String]
}

struct RoadNetwork: Codable, Sendable {
    let version: Int
    let links: [RoadLink]
    let points: [RoadPoint]

    var linksByID: [String: RoadLink] {
        Dictionary(uniqueKeysWithValues: links.map { ($0.id, $0) })
    }
}

struct LocationSample: Sendable {
    let coordinate: Coordinate
    let courseDegrees: Double?
    let speedMetersPerSecond: Double?
    let horizontalAccuracy: Double
    let timestamp: Date
}

struct MatchedPosition: Equatable, Sendable {
    let linkID: String
    let offsetMeters: Double
    let lateralDistanceMeters: Double
    let confidence: Double
}

struct UpcomingPoint: Identifiable, Equatable, Sendable {
    let point: RoadPoint
    let distanceMeters: Double
    let estimatedPassageDate: Date

    var id: String { point.id }
}
