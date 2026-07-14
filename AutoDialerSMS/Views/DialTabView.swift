import MessageUI
import SwiftUI

struct NumberRowListView: View {
    @Binding var rows: [String]
    var disabled: Bool
    var calledNumbers: Set<String>

    var body: some View {
        VStack(spacing: 0) {
            ForEach(rows.indices, id: \.self) { i in
                HStack(spacing: 8) {
                    Text("\(i + 1).")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(width: 24, alignment: .trailing)

                    TextField("ნომერი", text: $rows[i])
                        .keyboardType(.phonePad)
                        .disabled(disabled)
                        .onChange(of: rows[i]) { _, newVal in
                            rows[i] = newVal.filter { $0.isNumber || "+ -()".contains($0) }
                            if i == rows.count - 1 && !newVal.trimmingCharacters(in: .whitespaces).isEmpty {
                                rows.append("")
                            }
                        }

                    if calledNumbers.contains(normalized(rows[i])) {
                        Image(systemName: "checkmark")
                            .foregroundStyle(.green)
                            .font(.caption.bold())
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(rowBackground(i))

                if i < rows.count - 1 {
                    Divider().padding(.leading, 36)
                }
            }
        }
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.25)))
    }

    private func rowBackground(_ i: Int) -> Color {
        let n = normalized(rows[i])
        if calledNumbers.contains(n) && !n.isEmpty {
            return Color.green.opacity(0.08)
        }
        return Color.clear
    }

    private func normalized(_ n: String) -> String {
        n.replacingOccurrences(of: "[\\s\\-()]", with: "", options: .regularExpression)
    }
}

struct DialTabView: View {
    @EnvironmentObject private var callManager: CallQueueManager
    @State private var rows = Array(repeating: "", count: 5)
    @State private var showSmsComposer = false
    @State private var smsComposerNumber = ""
    @State private var smsComposerBody = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                statusCard

                NumberRowListView(
                    rows: $rows,
                    disabled: callManager.isActive,
                    calledNumbers: callManager.calledNumbers
                )

                HStack {
                    Text("\(parsedNumbers.count) ნომერი")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Button("გასუფთავება", role: .destructive) {
                        rows = Array(repeating: "", count: 5)
                        callManager.calledNumbers = []
                    }
                    .font(.caption)
                    Button("ჩასმა") {
                        if let str = UIPasteboard.general.string {
                            appendPaste(str)
                        }
                    }
                    .font(.caption)
                }

                HStack(spacing: 12) {
                    Button {
                        callManager.start(numbers: parsedNumbers)
                    } label: {
                        Text("დაწყება")
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                    .disabled(callManager.isActive || parsedNumbers.isEmpty)

                    Button(role: .destructive) {
                        callManager.stop()
                    } label: {
                        Text("გაჩერება")
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                    .buttonStyle(.bordered)
                    .disabled(!callManager.isActive)
                }
            }
            .padding()
        }
        .sheet(isPresented: $callManager.showAfterCallSheet) {
            afterCallSheet
        }
        .sheet(isPresented: $showSmsComposer) {
            MessageComposeView(recipients: [smsComposerNumber], body: smsComposerBody) {
                showSmsComposer = false
            }
        }
    }

    private var afterCallSheet: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text(callManager.afterCallAnswered ? "მიპასუხეს" : "არ მიპასუხეს")
                    .font(.title2.bold())

                Text(callManager.afterCallNumber ?? "")
                    .font(.title3)
                    .foregroundStyle(.secondary)

                Button {
                    openPostCallSms()
                } label: {
                    Text("SMS გაგზავნა")
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .buttonStyle(.borderedProminent)

                if callManager.currentIndex < callManager.numbers.count - 1 {
                    Button {
                        callManager.continueAfterCall(goNext: true)
                    } label: {
                        Text("შემდეგი ნომერი (\(callManager.currentIndex + 2)/\(callManager.numbers.count))")
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                    .buttonStyle(.bordered)
                }

                Button("დასრულება", role: .cancel) {
                    callManager.continueAfterCall(goNext: false)
                }
                .padding(.top, 8)

                Spacer()
            }
            .padding()
            .presentationDetents([.medium])
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("დახურვა") {
                        callManager.showAfterCallSheet = false
                    }
                }
            }
        }
    }

    private var parsedNumbers: [String] {
        PhoneNumberParser.parse(rows.joined(separator: "\n"))
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(callManager.statusMessage)
                .font(.subheadline.weight(.medium))

            if callManager.status == .ringing {
                Label("Calling — ჯერ არ პასუხობენ", systemImage: "phone.arrow.up.right")
                    .font(.caption).foregroundStyle(.orange)
            } else if callManager.status == .answered {
                Label("მიპასუხეს — საუბარი მიმდინარეობს", systemImage: "phone.connection.fill")
                    .font(.caption).foregroundStyle(.green)
            }

            if !callManager.progressText.isEmpty && callManager.isActive {
                Text("პროგრესი: \(callManager.progressText)")
                    .font(.caption2).foregroundStyle(.tertiary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.blue.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func appendPaste(_ text: String) {
        let existing = parsedNumbers
        let incoming = PhoneNumberParser.parse(text)
        let merged = existing + incoming
        rows = merged + [""]
        while rows.count < 5 { rows.append("") }
    }

    private func openPostCallSms() {
        guard let number = callManager.afterCallNumber else { return }
        smsComposerNumber = number
        smsComposerBody = AldagiMessages.noAnswer
        if MFMessageComposeViewController.canSendText() {
            showSmsComposer = true
        }
    }
}
