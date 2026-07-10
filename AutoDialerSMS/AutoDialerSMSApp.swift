import SwiftUI

@main
struct AutoDialerSMSApp: App {
    @StateObject private var callManager = CallQueueManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(callManager)
        }
    }
}
