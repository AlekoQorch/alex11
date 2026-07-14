import CallKit
import Combine
import Foundation
import UIKit

enum DialerStatus: Equatable {
    case idle
    case dialing
    case ringing
    case answered
    case paused
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
    }

    var isActive: Bool {
        status == .dialing || status == .ringing || status == .answered
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
        queue = parsed
        numbers = parsed
        currentIndex = 0
        isRunning = true
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
        statusMessage = "ირეკება... \(number) (\(currentIndex + 1)/\(queue.count))"

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
        currentNumber = nil
        status = .idle
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
                        status = .answered
                        statusMessage = "მიპასუხეს: \(currentNumber ?? "")"
                    }
                } else {
                    status = .ringing
                    statusMessage = "ირეკება (Calling): \(currentNumber ?? "")"
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
