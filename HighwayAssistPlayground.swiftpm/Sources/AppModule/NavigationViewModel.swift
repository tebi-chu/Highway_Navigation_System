import CoreLocation
import Foundation
import Observation

@MainActor
@Observable
final class NavigationViewModel {
    enum State: Equatable {
        case loading
        case setup
        case needsPermission
        case locating
        case navigating
        case unavailable(String)
    }

    private(set) var state: State = .loading
    private(set) var upcomingPoints: [UpcomingPoint] = []
    private(set) var highwayName = "道路を確認中"
    private(set) var directionName = "—"
    private(set) var destinationName = "—"
    private(set) var locationAccuracy: Double?
    private(set) var matchConfidence: Double?
    private(set) var destinations: [RoadPoint] = []
    var selectedDestinationID: String = ""

    private let locationService: LocationServicing
    private let repository: RoadNetworkProviding
    private let matcher: MapMatcher
    private let upcomingEngine: UpcomingPointEngine
    private var network: RoadNetwork?
    private var lastMatch: MatchedPosition?
    @ObservationIgnored private var demoTask: Task<Void, Never>?

    init(locationService: LocationServicing,
         repository: RoadNetworkProviding,
         matcher: MapMatcher = MapMatcher(),
         upcomingEngine: UpcomingPointEngine = UpcomingPointEngine()) {
        self.locationService = locationService
        self.repository = repository
        self.matcher = matcher
        self.upcomingEngine = upcomingEngine
        connectLocationService()
    }

    static func live() -> NavigationViewModel {
        NavigationViewModel(locationService: CoreLocationService(), repository: BundledRoadNetworkRepository())
    }

    func start() {
        do {
            if network == nil {
                let loadedNetwork = try repository.load()
                network = loadedNetwork
                destinations = loadedNetwork.points
                    .filter { $0.kind == .ic || $0.kind == .jct }
                    .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
                selectedDestinationID = destinations.contains { $0.id == "kuki-shiraoka-jct" }
                    ? "kuki-shiraoka-jct"
                    : destinations.first?.id ?? ""
            }
        } catch {
            state = .unavailable(error.localizedDescription)
            return
        }

        state = .setup
    }

    func beginLiveNavigation() {
        switch locationService.authorizationStatus {
        case .notDetermined:
            state = .needsPermission
        case .authorizedAlways, .authorizedWhenInUse:
            state = .locating
            locationService.start()
        case .denied, .restricted:
            state = .unavailable("位置情報が許可されていません。設定アプリから許可してください。")
        @unknown default:
            state = .unavailable("位置情報の権限状態を確認できません。")
        }
    }

    func beginDemoNavigation() {
        startDemo()
    }

    func requestLocationPermission() {
        locationService.requestAuthorization()
    }

    func stop() {
        locationService.stop()
        demoTask?.cancel()
    }

    func startDemo() {
        locationService.stop()
        demoTask?.cancel()
        state = .locating
        guard let network else { return }
        let fullRoute = network.links.flatMap(\.polyline)
        let step = max(1, fullRoute.count / 45)
        var coordinates = stride(from: 0, to: fullRoute.count, by: step).map { fullRoute[$0] }
        if let last = fullRoute.last, coordinates.last != last { coordinates.append(last) }
        demoTask = Task { [weak self] in
            for (index, coordinate) in coordinates.enumerated() {
                guard !Task.isCancelled else { return }
                let nextCoordinate = coordinates.indices.contains(index + 1) ? coordinates[index + 1] : coordinate
                self?.consume(LocationSample(
                    coordinate: coordinate,
                    courseDegrees: RoadGeometry.bearing(coordinate, nextCoordinate),
                    speedMetersPerSecond: 27,
                    horizontalAccuracy: 5,
                    timestamp: .now
                ))
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    private func connectLocationService() {
        locationService.onSample = { [weak self] sample in self?.consume(sample) }
        locationService.onError = { [weak self] message in self?.state = .unavailable(message) }
    }

    private func consume(_ sample: LocationSample) {
        guard let network else { return }
        locationAccuracy = sample.horizontalAccuracy
        guard let match = matcher.match(sample, network: network, previous: lastMatch) else {
            state = .unavailable("対応区間の高速道路を判定できません。")
            upcomingPoints = []
            return
        }
        lastMatch = match
        matchConfidence = match.confidence
        guard let link = network.linksByID[match.linkID] else { return }
        highwayName = link.highwayName
        directionName = link.directionName
        destinationName = link.destinationName
        upcomingPoints = upcomingEngine.upcoming(
            from: match,
            network: network,
            speedMetersPerSecond: sample.speedMetersPerSecond,
            now: sample.timestamp
        )
        state = .navigating
    }
}
