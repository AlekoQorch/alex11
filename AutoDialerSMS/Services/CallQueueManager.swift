import CallKit
import Combine
import Foundation
import UIKit

enum DialerStatus: Equatable {
    case idle
    case dialing
    case ringing
    case answered
    case waitingHangup
    case paused
}

@MainActor
final class CallQueueManager: NSObject, ObservableObject {
    @Published var status: DialerStatus = .idle
    @Published var numbers: [String] = []
    @Published var currentIndex = 0
    @Published var currentNumber: String?
    @Published var secondsRemaining = 30
    @Published var statusMessage = "მზად ხართ დასაწყებად"
    @Published var lastResult: String?
    @Published var showHangupAlert = false
    @Published var showAfterCallSheet = false
    @Published var afterCallAnswered = false
    @Published var afterCallNumber: String?

    private let timeoutSeconds = 30
    private var queue: [String] = []
    private var isRunning = false
    private var countdownTimer: Timer?
    private var timeoutTimer: Timer?
    private var callObserver: CXCallObserver?
    private var activeCallUUID: UUID?
    private var callWasAnswered = false
    private var waitingForNextAfterHangup = false
    private var callFinishHandled = false

    override init() {
        super.init()
        let observer = CXCallObserver()
        observer.setDelegate(self, queue: nil)
        callObserver = observer
    }

    var isActive: Bool {
        status == .dialing || status == .ringing || status == .answered || status == .waitingHangup
    }

    var progressText: String {
        guard !queue.isEmpty else { return "" }
        return "\(min(currentIndex, queue.count))/\(queue.count)"
    }

    func updateNumbers(from text: String) {
        numbers = PhoneNumberParser.parse(text)
    }

    func start(numbers parsed: [String]) {
        guard !parsed.isEmpty else {
            statusMessage = "შეიყვანეთ მაინც ერთი ნომერი"
            return
        }
        stopTimers()
        queue = parsed
        numbers = parsed
        currentIndex = 0
        isRunning = true
        status = .idle
        dialNext()
    }

    func stop() {
        isRunning = false
        waitingForNextAfterHangup = false
        stopTimers()
        queue = []
        currentIndex = 0
        currentNumber = nil
        status = .idle
        secondsRemaining = timeoutSeconds
        statusMessage = "გაჩერებულია"
    }

    private func dialNext() {
        guard isRunning else { return }

        stopTimers()
        callWasAnswered = false
        waitingForNextAfterHangup = false
        callFinishHandled = false
        showHangupAlert = false
        activeCallUUID = nil

        if currentIndex >= queue.count {
            finishQueue()
            return
        }

        let number = queue[currentIndex]
        currentNumber = number
        status = .dialing
        secondsRemaining = timeoutSeconds
        statusMessage = "ირეკება... \(number) (\(currentIndex + 1)/\(queue.count))"

        guard let url = URL(string: "tel://\(number)") else {
            handleCallFinished(answered: false, reason: "არასწორი ნომერი")
            return
        }

        UIApplication.shared.open(url) { [weak self] success in
            Task { @MainActor in
                guard let self else { return }
                if success {
                    self.startTimers()
                } else {
                    self.handleCallFinished(answered: false, reason: "ვერ დარეკა")
                }
            }
        }
    }

    private func startTimers() {
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.isRunning, !self.callWasAnswered else { return }
                if self.secondsRemaining > 0 {
                    self.secondsRemaining -= 1
                }
            }
        }

        timeoutTimer = Timer.scheduledTimer(withTimeInterval: TimeInterval(timeoutSeconds), repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.handleTimeout()
            }
        }
    }

    private func stopTimers() {
        countdownTimer?.invalidate()
        timeoutTimer?.invalidate()
        countdownTimer = nil
        timeoutTimer = nil
    }

    private func handleTimeout() {
        guard isRunning, !callWasAnswered else { return }

        if hasActiveCall {
            status = .waitingHangup
            statusMessage = "30 წამი გავიდა — გთხოვთ გათიშოთ ზარი"
            showHangupAlert = true
            waitingForNextAfterHangup = true
        } else {
            handleCallFinished(answered: false, reason: "არ მიპასუხეს (30 წმ)")
        }
    }

    private var hasActiveCall: Bool {
        callObserver?.calls.contains { !$0.hasEnded } ?? false
    }

    private func handleCallFinished(answered: Bool, reason: String? = nil) {
        guard isRunning, !callFinishHandled else { return }

        callFinishHandled = true
        stopTimers()
        let number = currentNumber ?? queue[currentIndex]
        afterCallNumber = number
        afterCallAnswered = answered

        let result: String
        if let reason {
            result = "\(number) — \(reason)"
        } else if answered {
            result = "\(number) — მიპასუხეს ✓"
        } else {
            result = "\(number) — არ მიპასუხეს"
        }

        lastResult = result
        statusMessage = result
        status = .idle
        showAfterCallSheet = true
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
        stopTimers()
        currentNumber = nil
        status = .idle
        secondsRemaining = timeoutSeconds
        statusMessage = "ყველა ნომერზე დარეკვა დასრულდა"
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
                        stopTimers()
                        status = .answered
                        statusMessage = "მიპასუხეს: \(currentNumber ?? "")"
                        showHangupAlert = false
                    }
                } else if status == .dialing || status == .ringing {
                    status = .ringing
                    statusMessage = "ირეკება (Calling): \(currentNumber ?? "")"
                }
            }

            if call.hasEnded {
                let wasActive = status == .dialing || status == .ringing || status == .answered || status == .waitingHangup || waitingForNextAfterHangup
                if wasActive {
                    let answered = callWasAnswered
                    waitingForNextAfterHangup = false
                    showHangupAlert = false
                    handleCallFinished(answered: answered)
                }
            }
        }
    }
}
