import Foundation

enum RoadBrand: String, Codable, CaseIterable, Identifiable, Sendable {
    case starbucks
    case sevenEleven
    case eneos
    case familyMart
    case apollostation

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .starbucks: "スターバックス"
        case .sevenEleven: "セブン-イレブン"
        case .eneos: "ENEOS"
        case .familyMart: "ファミリーマート"
        case .apollostation: "apollostation"
        }
    }

    var shortName: String {
        switch self {
        case .starbucks: "STARBUCKS"
        case .sevenEleven: "7-ELEVEN"
        case .eneos: "ENEOS"
        case .familyMart: "FamilyMart"
        case .apollostation: "apollo"
        }
    }

    var categorySymbolName: String {
        switch self {
        case .starbucks: "cup.and.saucer.fill"
        case .sevenEleven: "basket.fill"
        case .eneos: "fuelpump.fill"
        case .familyMart: "basket.fill"
        case .apollostation: "fuelpump.fill"
        }
    }

    // 各ブランドから正式な利用許諾を得た場合だけ、対応する画像アセット名を返す。
    var licensedAssetName: String? { nil }
}
