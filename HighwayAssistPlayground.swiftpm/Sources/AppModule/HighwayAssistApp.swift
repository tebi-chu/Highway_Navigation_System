import SwiftUI

@main
struct HighwayAssistApp: App {
    @State private var navigation = NavigationViewModel.live()

    var body: some Scene {
        WindowGroup {
            NavigationDashboard(viewModel: navigation)
                .preferredColorScheme(.light)
        }
    }
}
