import Foundation

struct CallRecord: Identifiable, Codable, Hashable {
    let id: UUID
    let number: String
    let note: String
    let time: Date

    init(number: String, note: String, time: Date = .now) {
        self.id = UUID()
        self.number = number
        self.note = note
        self.time = time
    }

    var timeText: String {
        time.formatted(date: .omitted, time: .shortened)
    }
}
