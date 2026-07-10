import Foundation

enum PhoneNumberParser {
    private static let numberPattern = #"\+?\d[\d\s\-()]{6,}\d"#

    static func parse(_ input: String) -> [String] {
        input
            .components(separatedBy: .newlines)
            .flatMap { line -> [String] in
                if line.contains(",") || line.contains(";") {
                    return line.components(separatedBy: CharacterSet(charactersIn: ",;"))
                }
                return [line]
            }
            .map(normalize)
            .filter { !$0.isEmpty && $0.count >= 9 }
            .reduce(into: [String]()) { result, number in
                if !result.contains(number) {
                    result.append(number)
                }
            }
    }

    private static func normalize(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let regex = try? NSRegularExpression(pattern: numberPattern) else {
            return trimmed.filter(\.isNumber)
        }
        let range = NSRange(trimmed.startIndex..., in: trimmed)
        let match = regex.firstMatch(in: trimmed, range: range)
        let source = match.flatMap { Range($0.range, in: trimmed) }.map { String(trimmed[$0]) } ?? trimmed
        return source.replacingOccurrences(of: "[\\s\\-()]", with: "", options: .regularExpression)
    }
}
