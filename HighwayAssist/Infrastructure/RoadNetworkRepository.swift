import Foundation

protocol RoadNetworkProviding: Sendable {
    func load() throws -> RoadNetwork
}

struct BundledRoadNetworkRepository: RoadNetworkProviding {
    func load() throws -> RoadNetwork {
        guard let url = Bundle.main.url(forResource: "real_highway", withExtension: "json") else {
            throw RepositoryError.missingBundledData
        }
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(RoadNetwork.self, from: data)
    }

    enum RepositoryError: LocalizedError {
        case missingBundledData

        var errorDescription: String? { "道路データを読み込めませんでした。" }
    }
}
