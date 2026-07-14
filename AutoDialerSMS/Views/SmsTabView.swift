import MessageUI
import SwiftUI

struct SmsTabView: View {
    @EnvironmentObject private var callManager: CallQueueManager

    @State private var smsNumber = ""
    @State private var introLang: IntroLang = .ka
    @State private var offerTariff = ""
    @State private var offerCar = ""
    @State private var offerThird = "10000$"
    @State private var offerHealth = "20000$"
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
            Button("გაგზავნა SMS") { send(AldagiMessages.intro(lang: introLang)) }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func templateCard(_ title: String, message: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.headline)
            Text(message).font(.caption).foregroundStyle(.secondary)
            Button("SMS") { send(message) }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
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
            Text(offerPreview).font(.caption).foregroundStyle(.secondary)
            Button("SMS") { send(offerPreview) }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var offerPreview: String {
        AldagiMessages.fullOffer(tariff: offerTariff, car: offerCar, third: offerThird, health: offerHealth)
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
}
