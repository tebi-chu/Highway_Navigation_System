import Foundation

enum FacilityType: String, Codable, CaseIterable, Identifiable, Sendable {
    case restaurant
    case restroom
    case fuel
    case convenienceStore
    case cafe
    case evCharging
    case shower
    case lodging
    case dogRun
    case accessibility

    var id: String { rawValue }

    var title: String {
        switch self {
        case .restaurant: "食事"
        case .restroom: "トイレ"
        case .fuel: "給油"
        case .convenienceStore: "コンビニ"
        case .cafe: "カフェ"
        case .evCharging: "EV充電"
        case .shower: "シャワー"
        case .lodging: "宿泊"
        case .dogRun: "ドッグラン"
        case .accessibility: "バリアフリー"
        }
    }

    var symbolName: String {
        switch self {
        case .restaurant: "fork.knife"
        case .restroom: "figure.dress.line.vertical.figure"
        case .fuel: "fuelpump.fill"
        case .convenienceStore: "basket.fill"
        case .cafe: "cup.and.saucer.fill"
        case .evCharging: "bolt.car.fill"
        case .shower: "shower.fill"
        case .lodging: "bed.double.fill"
        case .dogRun: "dog.fill"
        case .accessibility: "figure.roll"
        }
    }
}

