import SwiftUI

struct NavigationDashboard: View {
    @Bindable var viewModel: NavigationViewModel

    var body: some View {
        ZStack {
            HighwayTheme.background.ignoresSafeArea()
            VStack(spacing: 10) {
                if viewModel.state != .setup {
                    RoadHeader(
                        highwayName: viewModel.highwayName,
                        directionName: viewModel.directionName,
                        destinationName: viewModel.destinationName
                    )
                }
                content
                if viewModel.state != .setup {
                    CurrentLocationMarker(isActive: viewModel.state == .navigating)
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 4)
        }
        .task { viewModel.start() }
        .onDisappear { viewModel.stop() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .setup:
            DestinationSetup(viewModel: viewModel)
        case .loading, .locating:
            StatusPanel(title: "現在地を取得中", message: "安全な場所に端末を固定してお待ちください。", symbol: "location.magnifyingglass")
        case .needsPermission:
            StatusPanel(
                title: "位置情報を使用します",
                message: "走行中の高速道路と前方の地点を判定するために使用します。位置履歴は外部へ送信しません。",
                symbol: "location.fill",
                primaryTitle: "位置情報を許可",
                primaryAction: viewModel.requestLocationPermission,
                secondaryTitle: "デモ走行を表示",
                secondaryAction: viewModel.startDemo
            )
        case .unavailable(let message):
            StatusPanel(
                title: "案内を表示できません",
                message: message,
                symbol: "exclamationmark.triangle.fill",
                secondaryTitle: "デモ走行を表示",
                secondaryAction: viewModel.startDemo
            )
        case .navigating:
            if viewModel.upcomingPoints.isEmpty {
                StatusPanel(title: "前方地点がありません", message: "対応区間または予定経路を確認してください。", symbol: "road.lanes")
            } else {
                GeometryReader { geometry in
                    let spacing = 8.0
                    let cardHeight = max(1, (geometry.size.height - spacing * 5) / 6)
                    VStack(spacing: spacing) {
                        ForEach(0..<6, id: \.self) { slot in
                            if let item = item(for: slot) {
                                RoadPointCard(
                                    item: item,
                                    isDestination: item.point.id == viewModel.selectedDestinationID
                                )
                                .frame(height: cardHeight)
                            } else {
                                Color.clear.frame(height: cardHeight)
                            }
                        }
                    }
                }
            }
        }
    }

    private func item(for slot: Int) -> UpcomingPoint? {
        let emptySlots = 6 - viewModel.upcomingPoints.count
        guard slot >= emptySlots else { return nil }
        let indexFromTop = slot - emptySlots
        let itemIndex = viewModel.upcomingPoints.count - 1 - indexFromTop
        guard viewModel.upcomingPoints.indices.contains(itemIndex) else { return nil }
        return viewModel.upcomingPoints[itemIndex]
    }
}

private struct DestinationSetup: View {
    @Bindable var viewModel: NavigationViewModel

    var body: some View {
        VStack(spacing: 22) {
            Spacer()
            Image(systemName: "point.bottomleft.forward.to.point.topright.scurvepath.fill")
                .font(.system(size: 52, weight: .bold))
                .foregroundStyle(HighwayTheme.roadAccent)
            VStack(spacing: 6) {
                Text("高速道路アシスト")
                    .font(.largeTitle.bold())
                Text("行き先を選んで案内を開始します")
                    .font(.headline)
                    .foregroundStyle(HighwayTheme.secondaryText)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("目的インターチェンジ")
                    .font(.subheadline.bold())
                    .foregroundStyle(HighwayTheme.secondaryText)
                Picker("目的インターチェンジ", selection: $viewModel.selectedDestinationID) {
                    ForEach(viewModel.destinations) { destination in
                        Text("\(destination.name) \(destination.kind.rawValue)")
                            .tag(destination.id)
                    }
                }
                .pickerStyle(.menu)
                .tint(HighwayTheme.primaryText)
                .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
                .padding(.horizontal, 14)
                .background(.white, in: RoundedRectangle(cornerRadius: 14))
                .overlay { RoundedRectangle(cornerRadius: 14).stroke(HighwayTheme.roadAccent, lineWidth: 2) }
            }
            .frame(maxWidth: 520)
            Button("デモ走行で開始", action: viewModel.beginDemoNavigation)
                .buttonStyle(.borderedProminent)
                .tint(HighwayTheme.roadAccent)
                .controlSize(.large)
                .frame(maxWidth: 520)
            Button("現在地を使って開始", action: viewModel.beginLiveNavigation)
                .buttonStyle(.bordered)
                .tint(HighwayTheme.roadAccent)
                .controlSize(.large)
            Text("目的地を通過しても案内は終了せず、その先の地点を最大6件表示します。")
                .font(.footnote)
                .foregroundStyle(HighwayTheme.secondaryText)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 520)
            Text("道路形状・地点座標 © OpenStreetMap contributors / ODbL 1.0")
                .font(.caption2)
                .foregroundStyle(HighwayTheme.secondaryText)
            Spacer()
        }
        .padding(24)
    }
}

private struct RoadHeader: View {
    let highwayName: String
    let directionName: String
    let destinationName: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "road.lanes")
                .font(.title2.bold())
            Text(highwayName).font(.headline.bold()).lineLimit(1)
            Spacer()
            Text(directionName).font(.headline.bold()).lineLimit(1)
            Text(destinationName).font(.headline.bold()).lineLimit(1)
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 54)
        .background(HighwayTheme.roadAccent, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .foregroundStyle(.white)
        .accessibilityElement(children: .combine)
    }
}

private struct RoadPointCard: View {
    let item: UpcomingPoint
    let isDestination: Bool

    private var distanceText: String {
        if item.distanceMeters < 1_000 { return "\(Int(item.distanceMeters.rounded())) m" }
        return String(format: "%.1f km", item.distanceMeters / 1_000)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                HStack(spacing: 8) {
                    Text(item.point.kind.rawValue)
                        .font(.caption.bold())
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .foregroundStyle(.black)
                        .background(HighwayTheme.color(for: item.point.kind), in: Capsule())
                    Text(item.point.name)
                        .font(.title3.bold())
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                }
                if isDestination {
                    Text("目的地")
                        .font(.caption2.bold())
                        .foregroundStyle(HighwayTheme.roadDark)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(.white, in: Capsule())
                }
                Spacer()
            }
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .background(HighwayTheme.roadAccent)

            if item.point.kind.hasFacilities, !item.point.facilities.isEmpty {
                HStack(spacing: 12) {
                    ForEach(item.point.brands.prefix(3)) { brand in
                        BrandBadge(brand: brand)
                    }
                    ForEach(item.point.facilities.prefix(
                        item.point.brands.isEmpty ? 8 : max(2, 7 - item.point.brands.count * 2)
                    )) { facility in
                        Image(systemName: facility.symbolName)
                            .font(.system(size: 17, weight: .bold))
                            .frame(minWidth: 20, minHeight: 20)
                            .accessibilityLabel(facility.title)
                    }
                    .foregroundStyle(.white)
                    Spacer()
                }
                .padding(.horizontal, 12)
                .frame(minHeight: 31)
                .background(HighwayTheme.roadDark)
            }

            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Spacer()
                Text(distanceText)
                    .font(.title2.monospacedDigit().bold())
                    .foregroundStyle(HighwayTheme.primaryText)
                    .minimumScaleFactor(0.75)
                    .lineLimit(1)
                Text(item.estimatedPassageDate, format: .dateTime.hour().minute())
                    .font(.title3.monospacedDigit().bold())
                    .foregroundStyle(HighwayTheme.primaryText)
                Text("通過予定")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(HighwayTheme.secondaryText)
            }
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(.white)
        }
        .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(HighwayTheme.roadDark.opacity(0.45), lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.point.name)、\(item.point.kind.rawValue)、\(distanceText)、\(item.estimatedPassageDate.formatted(date: .omitted, time: .shortened))通過予定")
    }
}

private struct BrandBadge: View {
    let brand: RoadBrand

    var body: some View {
        HStack(spacing: 4) {
            if let assetName = brand.licensedAssetName {
                Image(assetName)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 20, height: 20)
            } else {
                Image(systemName: brand.categorySymbolName)
                    .font(.system(size: 15, weight: .bold))
                Text(brand.shortName)
                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                    .lineLimit(1)
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 6)
        .frame(minHeight: 24)
        .overlay {
            RoundedRectangle(cornerRadius: 5)
                .stroke(.white.opacity(0.9), lineWidth: 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(brand.displayName)
    }
}

private struct CurrentLocationMarker: View {
    let isActive: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "location.north.fill")
                .font(.title2.bold())
                .foregroundStyle(isActive ? Color.red : HighwayTheme.secondaryText)
            Text("現在地")
                .font(.headline.bold())
            Spacer()
            Circle()
                .fill(isActive ? Color.green : Color.orange)
                .frame(width: 9, height: 9)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 18)
        .frame(height: 44)
        .foregroundStyle(HighwayTheme.primaryText)
    }
}

private struct StatusPanel: View {
    let title: String
    let message: String
    let symbol: String
    var primaryTitle: String? = nil
    var primaryAction: (() -> Void)? = nil
    var secondaryTitle: String? = nil
    var secondaryAction: (() -> Void)? = nil

    var body: some View {
        Spacer()
        VStack(spacing: 18) {
            Image(systemName: symbol)
                .font(.system(size: 42, weight: .semibold))
                .foregroundStyle(HighwayTheme.roadAccent)
            Text(title).font(.title2.bold()).multilineTextAlignment(.center)
            Text(message)
                .font(.body)
                .foregroundStyle(HighwayTheme.secondaryText)
                .multilineTextAlignment(.center)
            if let primaryTitle, let primaryAction {
                Button(primaryTitle, action: primaryAction)
                    .buttonStyle(.borderedProminent)
                    .tint(HighwayTheme.roadAccent)
                    .foregroundStyle(.black)
                    .controlSize(.large)
            }
            if let secondaryTitle, let secondaryAction {
                Button(secondaryTitle, action: secondaryAction)
                    .buttonStyle(.bordered)
                    .tint(HighwayTheme.roadAccent)
                    .controlSize(.large)
            }
        }
        .padding(24)
        Spacer()
    }
}
