@preconcurrency import CoreLocation
import Foundation

@MainActor
protocol LocationServicing: AnyObject {
    var authorizationStatus: CLAuthorizationStatus { get }
    var accuracyAuthorization: CLAccuracyAuthorization { get }
    var onSample: ((LocationSample) -> Void)? { get set }
    var onError: ((String) -> Void)? { get set }
    func requestAuthorization()
    func start()
    func stop()
}

@MainActor
final class CoreLocationService: NSObject, LocationServicing, @preconcurrency CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    var onSample: ((LocationSample) -> Void)?
    var onError: ((String) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.activityType = .automotiveNavigation
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.distanceFilter = 10
        manager.pausesLocationUpdatesAutomatically = true
    }

    var authorizationStatus: CLAuthorizationStatus { manager.authorizationStatus }
    var accuracyAuthorization: CLAccuracyAuthorization { manager.accuracyAuthorization }

    func requestAuthorization() {
        manager.requestWhenInUseAuthorization()
    }

    func start() {
        guard CLLocationManager.locationServicesEnabled() else {
            onError?("位置情報サービスが無効です。設定を確認してください。")
            return
        }
        manager.startUpdatingLocation()
    }

    func stop() {
        manager.stopUpdatingLocation()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            start()
        case .denied, .restricted:
            onError?("現在地を表示するには位置情報の許可が必要です。")
        case .notDetermined:
            break
        @unknown default:
            onError?("位置情報の権限状態を確認できません。")
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last, location.horizontalAccuracy >= 0,
              Date().timeIntervalSince(location.timestamp) < 15 else { return }
        onSample?(LocationSample(
            coordinate: Coordinate(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude),
            courseDegrees: location.course >= 0 ? location.course : nil,
            speedMetersPerSecond: location.speed >= 0 ? location.speed : nil,
            horizontalAccuracy: location.horizontalAccuracy,
            timestamp: location.timestamp
        ))
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard (error as? CLError)?.code != .locationUnknown else { return }
        onError?("現在地を取得できませんでした。")
    }
}
