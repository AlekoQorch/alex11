import MessageUI
import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var callManager: CallQueueManager

    @State private var numbersText = ""
    @State private var smsTargetNumber = ""
    @State private var selectedTemplate = SmsTemplates.all[0]
    @State private var showMessageComposer = false
    @State private var showSmsUnavailableAlert = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    iosNoteCard

                    dialerSection
                    statusSection
                    dialerButtons
                    smsSection
                }
                .padding()
            }
            .navigationTitle("ავტოდაილერი + SMS")
            .navigationBarTitleDisplayMode(.inline)
            .alert("30 წამი გავიდა", isPresented: $callManager.showHangupAlert) {
                Button("კარგი", role: .cancel) {}
            } message: {
                Text("iOS-ზე აპი ვერ გათიშავს ზარს ავტომატურად. გთხოვთ, ხელით გათიშოთ — შემდეგ ავტომატურად გადავა შემდეგ ნომერზე.")
            }
            .alert("SMS ვერ გაიგზავნა", isPresented: $showSmsUnavailableAlert) {
                Button("კარგი", role: .cancel) {}
            } message: {
                Text("ამ მოწყობილობაზე SMS-ის გაგზავნა არ არის ხელმისაწვდომი.")
            }
            .sheet(isPresented: $showMessageComposer) {
                MessageComposeView(
                    recipients: [resolvedSmsNumber],
                    body: selectedTemplate.message
                ) {
                    showMessageComposer = false
                }
            }
        }
    }

    private var iosNoteCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("iOS შეზღუდვა", systemImage: "info.circle.fill")
                .font(.subheadline.bold())
                .foregroundStyle(.orange)
            Text("Apple არ იძლევა აპებს ზარის ავტომატურ გათიშვის უფლებას. 30 წამის შემდეგ გაჩნდება შეტყობინება — ხელით გათიშეთ, დანარჩენს აპი გააკეთებს.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var dialerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionTitle("📞 ნომრების სია")

            TextEditor(text: $numbersText)
                .frame(minHeight: 120)
                .padding(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.gray.opacity(0.3))
                )
                .disabled(callManager.isActive)
                .onChange(of: numbersText) { _, newValue in
                    callManager.updateNumbers(from: newValue)
                }

            if numbersText.isEmpty {
                Text("ჩაწერეთ ან ჩასვით ნომრები\n(თითო ხაზზე ერთი)\n\nმაგ: +995555123456")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, 4)
            }

            Text("ნაპოვნი ნომრები: \(PhoneNumberParser.parse(numbersText).count)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var statusSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                if callManager.isActive {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: "phone.fill")
                        .foregroundStyle(.blue)
                }
                Text(callManager.statusMessage)
                    .font(.subheadline.weight(.medium))
            }

            if callManager.isActive && !callManager.callWasAnsweredPublic {
                ProgressView(value: Double(callManager.secondsRemaining), total: 30)
                    .tint(.blue)
                Text("დარჩენილია: \(callManager.secondsRemaining) წმ")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let last = callManager.lastResult {
                Text(last)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if !callManager.progressText.isEmpty {
                Text("პროგრესი: \(callManager.progressText)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.blue.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var dialerButtons: some View {
        HStack(spacing: 12) {
            Button {
                callManager.start(numbers: PhoneNumberParser.parse(numbersText))
            } label: {
                Label("დაწყება", systemImage: "play.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(callManager.isActive || PhoneNumberParser.parse(numbersText).isEmpty)

            Button(role: .destructive) {
                callManager.stop()
            } label: {
                Label("გაჩერება", systemImage: "stop.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(!callManager.isActive)
        }
    }

    private var smsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("💬 SMS შაბლონები")

            TextField("SMS-ის მიმღები ნომერი", text: $smsTargetNumber)
                .keyboardType(.phonePad)
                .textFieldStyle(.roundedBorder)

            ForEach(SmsTemplates.all) { template in
                smsTemplateCard(template)
            }
        }
    }

    private func smsTemplateCard(_ template: SmsTemplate) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: selectedTemplate.id == template.id ? "largecircle.fill.circle" : "circle")
                    .foregroundStyle(.blue)
                    .onTapGesture { selectedTemplate = template }
                Text(template.title)
                    .font(.headline)
                Spacer()
            }

            Text(template.message)
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.leading, 28)

            HStack {
                Spacer()
                Button {
                    selectedTemplate = template
                    sendSms()
                } label: {
                    Label("გაგზავნა", systemImage: "message.fill")
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(selectedTemplate.id == template.id ? Color.blue : Color.gray.opacity(0.2), lineWidth: selectedTemplate.id == template.id ? 2 : 1)
        )
        .onTapGesture { selectedTemplate = template }
    }

    private var resolvedSmsNumber: String {
        if !smsTargetNumber.trimmingCharacters(in: .whitespaces).isEmpty {
            return PhoneNumberParser.parse(smsTargetNumber).first ?? smsTargetNumber
        }
        if let current = callManager.currentNumber { return current }
        return PhoneNumberParser.parse(numbersText).first ?? ""
    }

    private func sendSms() {
        let number = resolvedSmsNumber
        guard !number.isEmpty else { return }

        if MFMessageComposeViewController.canSendText() {
            showMessageComposer = true
        } else {
            showSmsUnavailableAlert = true
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.title3.bold())
            .foregroundStyle(.blue)
    }
}

private extension CallQueueManager {
    var callWasAnsweredPublic: Bool {
        status == .answered
    }
}

#Preview {
    ContentView()
        .environmentObject(CallQueueManager())
}
