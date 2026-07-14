import SwiftUI

struct HistoryTabView: View {
    @EnvironmentObject private var callManager: CallQueueManager

    var body: some View {
        NavigationStack {
            List {
                if callManager.history.isEmpty {
                    Text("ცარიელია")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(callManager.history) { record in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(record.number).font(.body.weight(.medium))
                            Text("\(record.note) · \(record.timeText)")
                                .font(.caption)
                                .foregroundStyle(record.note.contains("მიპასუხეს") ? .green : .secondary)
                        }
                    }
                }
            }
            .navigationTitle("ისტორია")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("გასუფთავება", role: .destructive) {
                        callManager.clearHistory()
                    }
                }
            }
        }
    }
}
