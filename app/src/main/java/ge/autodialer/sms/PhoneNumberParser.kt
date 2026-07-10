package ge.autodialer.sms

object PhoneNumberParser {
    private val numberRegex = Regex("""\+?\d[\d\s\-()]{6,}\d""")

    fun parse(input: String): List<String> {
        return input
            .lines()
            .flatMap { line ->
                if (line.contains(',') || line.contains(';')) {
                    line.split(',', ';')
                } else {
                    listOf(line)
                }
            }
            .map { normalize(it) }
            .filter { it.isNotBlank() && it.length >= 9 }
            .distinct()
    }

    private fun normalize(raw: String): String {
        val trimmed = raw.trim()
        val match = numberRegex.find(trimmed)?.value ?: trimmed
        return match.replace(Regex("""[\s\-()]"""), "")
    }
}
