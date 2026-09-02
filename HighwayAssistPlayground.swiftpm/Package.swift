// swift-tools-version: 6.0

import PackageDescription
import AppleProductTypes

let package = Package(
    name: "HighwayAssistPlayground",
    platforms: [
        .iOS("18.0")
    ],
    products: [
        .iOSApplication(
            name: "高速道路アシスト",
            targets: ["AppModule"],
            bundleIdentifier: "jp.tebcub.HighwayAssistPlayground",
            teamIdentifier: "",
            displayVersion: "0.1.0",
            bundleVersion: "1",
            appIcon: .placeholder(icon: .car),
            accentColor: .presetColor(.green),
            supportedDeviceFamilies: [.phone, .pad],
            supportedInterfaceOrientations: [.portrait]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: "Sources/AppModule",
            resources: [
                .process("Resources")
            ]
        )
    ]
)

