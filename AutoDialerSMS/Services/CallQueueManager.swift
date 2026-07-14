import CallKit
import Combine
import Foundation
import UIKit
import UserNotifications

enum DialerStatus: Equatable {
    case idle
    case dialing
    case ringing
    case answered
}

@MainActor
final class CallQueueManager: NSObject, ObservableObject {
    @Published var status: DialerStatus = .idle
    @Published var numbers: [String] = []
    @Published var currentIndex = 0
    @Published var currentNumber: String?
    @Published var statusMessage = "მზად ხართ დასაწყებად"
    @Published var lastResult: String?
    @Published var showAfterCallSheet = false
    @Published var afterCallAnswered = false
    @Published var afterCallNumber: String?
    @Published var calledNumbers: Set<String> = []
    @Published var history: [CallRecord] = []

    private var queue: [String] = []
    private var isRunning = false
    private var callObserver: CXCallObserver?
    private var callWasAnswered = false
    private var callFinishHandled = false

    override init() {
        super.init()
        let observer = CXCallObserver()
        observer.setDelegate(self, queue: nil)
        callObserver = observer
        loadHistory()
    }

    var isActive: Bool {
        status == .dialing || status == .ringing || status == .answered
    }

    var progressText: String {
        guard !queue.isEmpty else { return "" }
        return "\(currentIndex + 1)/\(queue.count)"
    }

    var smsTargetNumber: String {
        currentNumber ?? numbers.first ?? ""
    }

    func isCalled(_ number: String) -> Bool {
        calledNumbers.contains(normalize(number))
    }

    func start(numbers parsed: [String]) {
        guard !parsed.isEmpty else {
            statusMessage = "შეიყვანეთ მაინც ერთი ნომერი"
            return
        }
        queue = parsed
        numbers = parsed
        currentIndex = 0
        isRunning = true
        calledNumbers = []
        status = .idle
        dialNext()
    }

    func stop() {
        isRunning = false
        queue = []
        currentIndex = 0
        currentNumber = nil
        status = .idle
        statusMessage = "გაჩერებულია"
    }

    func clearHistory() {
        history = []
        UserDefaults.standard.removeObject(forKey: "callHistory")
    }

    private func dialNext() {
        guard isRunning else { return }

        callWasAnswered = false
        callFinishHandled = false
        showAfterCallSheet = false

        if currentIndex >= queue.count {
            finishQueue()
            return
        }

        let number = queue[currentIndex]
        currentNumber = number
        status = .dialing
        statusMessage = "ირეკება... \(number)"

        guard let url = URL(string: "tel://\(number)") else {
            handleCallFinished(answered: false, reason: "არასწორი ნომერი")
            return
        }

        UIApplication.shared.open(url) { [weak self] success in
            Task { @MainActor in
                guard let self else { return }
                if !success {
                    self.handleCallFinished(answered: false, reason: "ვერ დარეკა")
                }
            }
        }
    }

    private func handleCallFinished(answered: Bool, reason: String? = nil) {
        guard isRunning, !callFinishHandled else { return }

        callFinishHandled = true
        let number = currentNumber ?? queue[currentIndex]
        afterCallNumber = number
        afterCallAnswered = answered

        let note: String
        if let reason {
            note = reason
        } else {
            note = answered ? "მიპასუხეს" : "არ მიპასუხეს"
        }

        calledNumbers.insert(normalize(number))
        addHistory(number: number, note: note)

        let result = "\(number) — \(note)"
        lastResult = result
        statusMessage = result
        status = .idle
        showAfterCallSheet = true
        notifyCallResult(number: number, note: note)
    }

    func continueAfterCall(goNext: Bool) {
        showAfterCallSheet = false
        currentIndex += 1
        if goNext && isRunning {
            dialNext()
        } else if !goNext {
            finishQueue()
        }
    }

    private func finishQueue() {
        isRunning = false
        currentNumber = nil
        status = .idle
        statusMessage = "დასრულდა ✓"
    }

    private func addHistory(number: String, note: String) {
        history.insert(CallRecord(number: number, note: note), at: 0)
        if history.count > 50 { history = Array(history.prefix(50)) }
        if let data = try? JSONEncoder().encode(history) {
            UserDefaults.standard.set(data, forKey: "callHistory")
        }
    }

    private func loadHistory() {
        guard let data = UserDefaults.standard.data(forKey: "callHistory"),
              let records = try? JSONDecoder().decode([CallRecord].self, from: data) else { return }
        history = records
    }

    private func normalize(_ n: String) -> String {
        n.replacingOccurrences(of: "[\\s\\-()]", with: "", options: .regularExpression)
    }

    private func notifyCallResult(number: String, note: String) {
        let content = UNMutableNotificationContent()
        content.title = "ზარი დასრულდა"
        content.body = "\(number) — \(note)"
        content.sound = .default
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)
    }
}

extension CallQueueManager: CXCallObserverDelegate {
    nonisolated func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        Task { @MainActor in
            guard isRunning else { return }

            if call.isOutgoing && !call.hasEnded {
                if call.hasConnected {
                    if !callWasAnswered {
                        callWasAnswered = true
                        status = .answered
                        statusMessage = "მიპასუხეს: \(currentNumber ?? "")"
                    }
                } else {
                    status = .ringing
                    statusMessage = "Calling: \(currentNumber ?? "")"
                }
            }

            if call.hasEnded {
                let wasOurCall = status == .dialing || status == .ringing || status == .answered
                if wasOurCall {
                    handleCallFinished(answered: callWasAnswered)
                }
            }
        }
    }
}
