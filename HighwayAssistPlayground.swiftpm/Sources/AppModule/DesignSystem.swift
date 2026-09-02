import SwiftUI

enum HighwayTheme {
    static let background = Color(red: 0.94, green: 0.96, blue: 0.95)
    static let panel = Color.white
    static let primaryText = Color(red: 0.04, green: 0.12, blue: 0.09)
    static let secondaryText = Color(red: 0.27, green: 0.36, blue: 0.32)
    static let roadAccent = Color(red: 0.00, green: 0.43, blue: 0.25)
    static let roadDark = Color(red: 0.00, green: 0.25, blue: 0.16)

    static func color(for kind: RoadPointKind) -> Color {
        switch kind {
        case .sa: Color(red: 0.11, green: 0.72, blue: 0.52)
        case .pa: Color(red: 0.20, green: 0.56, blue: 0.93)
        case .ic: Color(red: 0.95, green: 0.61, blue: 0.20)
        case .jct: Color(red: 0.72, green: 0.40, blue: 0.96)
        }
    }
}
