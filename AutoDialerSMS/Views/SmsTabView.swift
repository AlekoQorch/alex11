import MessageUI
import SwiftUI
import UIKit

struct SmsTabView: View {
    @EnvironmentObject private var callManager: CallQueueManager

    @State private var smsNumber = ""
    @State private var introLang: IntroLang = .ka
    @State private var offerTariff = ""
    @State private var offerCar = ""
    @State private var offerThird = "10000$"
    @State private var offerHealth = "20000$"
    @State private var offerIsElectric = false
    @State private var showComposer = false
    @State private var composerBody = ""
    @State private var showUnavailable = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                TextField("ტელეფონის ნომერი", text: $smsNumber)
                    .keyboardType(.phonePad)
                    .textFieldStyle(.roundedBorder)
                    .onAppear { smsNumber = callManager.smsTargetNumber }

                introCard
                templateCard("არ პასუხობს", message: AldagiMessages.noAnswer)
                templateCard("ტარიფის დაანგარიშება", message: AldagiMessages.tariff)
                offerCard
            }
            .padding()
        }
        .onChange(of: callManager.currentNumber) { _, n in
            if let n, smsNumber.isEmpty { smsNumber = n }
        }
        .sheet(isPresented: $showComposer) {
            MessageComposeView(recipients: [resolvedNumber], body: composerBody) {
                showComposer = false
            }
        }
        .alert("SMS ვერ გაიგზავნა", isPresented: $showUnavailable) {
            Button("კარგი", role: .cancel) {}
        }
    }

    private var introCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("პატარა SMS-ის დატოვება").font(.headline)
            Picker("ენა", selection: $introLang) {
                ForEach(IntroLang.allCases, id: \.self) { lang in
                    Text(lang.rawValue).tag(lang)
                }
            }
            .pickerStyle(.segmented)
            Text(AldagiMessages.intro(lang: introLang))
                .font(.caption)
                .foregroundStyle(.secondary)
            channelButtons(for: AldagiMessages.intro(lang: introLang))
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func templateCard(_ title: String, message: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.headline)
            Text(message).font(.caption).foregroundStyle(.secondary)
            channelButtons(for: message)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var offerCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("სრული შეთავაზება").font(.headline)
            TextField("ტარიფი ($)", text: $offerTariff).keyboardType(.decimalPad)
            TextField("ავტომობილი ($)", text: $offerCar).keyboardType(.decimalPad)
            limitPicker("მესამე პირი", options: AldagiMessages.thirdLimits, selection: $offerThird)
            limitPicker("ჯანმრთელობა", options: AldagiMessages.healthLimits, selection: $offerHealth)
            Toggle("ავტომობილი ელექტროა", isOn: $offerIsElectric)
            Text(offerPreview).font(.caption).foregroundStyle(.secondary)
            channelButtons(for: offerPreview)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func channelButtons(for body: String) -> some View {
        HStack(spacing: 8) {
            Button { send(body) } label: {
                Label("SMS", systemImage: "message.fill")
            }
            .buttonStyle(.borderedProminent)
            .frame(maxWidth: .infinity)

            Menu {
                Button("WhatsApp") { openChat(scheme: "https://wa.me/", body: body, wa: true) }
                Button("Viber") { openChat(scheme: "viber://chat?number=", body: body, wa: false) }
                Button("Telegram") { openChat(scheme: "tg://resolve?phone=", body: body, wa: false) }
            } label: {
                Label("WhatsApp", systemImage: "phone.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(red: 0.145, green: 0.827, blue: 0.4))
            .frame(maxWidth: .infinity)
        }
    }

    private var offerPreview: String {
        AldagiMessages.fullOffer(
            tariff: offerTariff,
            car: offerCar,
            third: offerThird,
            health: offerHealth,
            isElectric: offerIsElectric
        )
    }

    private func limitPicker(_ label: String, options: [String], selection: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption).foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    ForEach(options, id: \.self) { opt in
                        Button(opt) { selection.wrappedValue = opt }
                            .buttonStyle(.bordered)
                            .tint(selection.wrappedValue == opt ? .blue : .gray)
                    }
                }
            }
        }
    }

    private var resolvedNumber: String {
        let n = smsNumber.trimmingCharacters(in: .whitespaces)
        if !n.isEmpty { return PhoneNumberParser.parse(n).first ?? n }
        return callManager.smsTargetNumber
    }

    private func send(_ body: String) {
        guard !resolvedNumber.isEmpty else { return }
        composerBody = body
        if MFMessageComposeViewController.canSendText() {
            showComposer = true
        } else {
            showUnavailable = true
        }
    }

    private func intlDigits() -> String {
        var digits = resolvedNumber.filter(\.isNumber)
        if digits.count == 9, digits.hasPrefix("5") {
            digits = "995" + digits
        }
        return digits
    }

    private func openChat(scheme: String, body: String, wa: Bool) {
        guard !resolvedNumber.isEmpty else { return }
        let digits = intlDigits()
        if !wa { UIPasteboard.general.string = body }
        let urlString: String
        if wa {
            urlString = "https://wa.me/\(digits)?text=\(body.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")"
        } else {
            urlString = scheme + digits
        }
        guard let url = URL(string: urlString) else { return }
        UIApplication.shared.open(url)
    }
}
