import SwiftUI

struct PermissionsOnboardingView: View {
    @EnvironmentObject private var permissions: PermissionsManager

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "phone.connection.fill")
                .font(.system(size: 56))
                .foregroundStyle(.green)

            Text("Cold Caller")
                .font(.title.bold())

            Text("აპი ზარის სტატუსს ხედავს CallKit-ით:\nირეკება → მიპასუხეს → დასრულდა")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            VStack(alignment: .leading, spacing: 16) {
                permissionRow(
                    icon: "bell.badge.fill",
                    title: "შეტყობინებები",
                    subtitle: "ზარის შედეგის შესახებ",
                    granted: permissions.notificationsGranted
                ) {
                    Task { await permissions.requestNotifications() }
                }

                permissionRow(
                    icon: "mic.fill",
                    title: "მიკროფონი",
                    subtitle: "აქტიური ზარის აღმოჩენა",
                    granted: permissions.microphoneGranted
                ) {
                    Task { await permissions.requestMicrophone() }
                }

                permissionRow(
                    icon: "phone.fill",
                    title: "ზარის მონიტორინგი",
                    subtitle: "Calling / მიპასუხეს — ავტომატურად",
                    granted: true,
                    alwaysOn: true
                ) {}
            }
            .padding()
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal)

            Spacer()

            Button {
                permissions.completeOnboarding()
            } label: {
                Text("გაგრძელება")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .padding(.horizontal)
            .padding(.bottom, 32)
        }
    }

    @ViewBuilder
    private func permissionRow(
        icon: String,
        title: String,
        subtitle: String,
        granted: Bool,
        alwaysOn: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(.blue)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.bold())
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if alwaysOn {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            } else if granted {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            } else {
                Button("Allow") {
                    action()
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
    }
}
