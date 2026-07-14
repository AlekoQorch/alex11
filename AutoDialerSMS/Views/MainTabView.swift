import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var callManager: CallQueueManager

    var body: some View {
        TabView {
            NavigationStack {
                DialTabView()
            }
            .tabItem { Label("დარეკვა", systemImage: "phone.fill") }

            NavigationStack {
                SmsTabView()
            }
            .tabItem { Label("SMS", systemImage: "message.fill") }

            HistoryTabView()
                .tabItem { Label("ისტორია", systemImage: "clock.fill") }
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(CallQueueManager())
}
