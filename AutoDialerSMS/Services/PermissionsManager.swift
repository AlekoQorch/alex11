import AVFoundation
import Foundation
import UserNotifications

@MainActor
final class PermissionsManager: ObservableObject {
    @Published var notificationsGranted = false
    @Published var microphoneGranted = false
    @Published var onboardingComplete = false

    private let onboardingKey = "onboardingComplete"

    init() {
        onboardingComplete = UserDefaults.standard.bool(forKey: onboardingKey)
        Task { await refreshStatus() }
    }

    var allReady: Bool {
        onboardingComplete
    }

    func refreshStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        notificationsGranted = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional

        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted:
            microphoneGranted = true
        case .denied, .undetermined:
            microphoneGranted = false
        @unknown default:
            microphoneGranted = false
        }
    }

    func requestNotifications() async {
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        notificationsGranted = granted
    }

    func requestMicrophone() async {
        await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                Task { @MainActor in
                    self.microphoneGranted = granted
                    continuation.resume()
                }
            }
        }
    }

    func completeOnboarding() {
        onboardingComplete = true
        UserDefaults.standard.set(true, forKey: onboardingKey)
    }
}
