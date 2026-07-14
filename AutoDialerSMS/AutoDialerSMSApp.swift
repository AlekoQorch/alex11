import SwiftUI

@main
struct AutoDialerSMSApp: App {
    @StateObject private var callManager = CallQueueManager()
    @StateObject private var permissions = PermissionsManager()

    var body: some Scene {
        WindowGroup {
            Group {
                if permissions.allReady {
                    ContentView()
                } else {
                    PermissionsOnboardingView()
                }
            }
            .environmentObject(callManager)
            .environmentObject(permissions)
        }
    }
}
