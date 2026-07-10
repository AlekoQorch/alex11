package ge.autodialer.sms

data class SmsTemplate(
    val id: Int,
    val title: String,
    val message: String
)

object SmsTemplates {
    val defaults = listOf(
        SmsTemplate(
            id = 1,
            title = "ზარის მოთხოვნა",
            message = "გამარჯობა! გთხოვთ დაგვიბრუნოთ ზარი, როცა შეძლებთ. გმადლობთ!"
        ),
        SmsTemplate(
            id = 2,
            title = "შეხსენება",
            message = "გამარჯობა! გიგზავნით შეხსენებას — გთხოვთ დაგვიკავშირდეთ დღესვე. გმადლობთ!"
        ),
        SmsTemplate(
            id = 3,
            title = "ვიზიტის დადასტურება",
            message = "გამარჯობა! თქვენი ვიზიტი დადასტურებულია. დამატებითი კითხვებისთვის დაგვიკავშირდით."
        ),
        SmsTemplate(
            id = 4,
            title = "გადახდის შეხსენება",
            message = "გამარჯობა! გიგზავნით შეხსენებას გადასახადის გადახდის შესახებ. გმადლობთ ყურადღებისთვის!"
        ),
        SmsTemplate(
            id = 5,
            title = "მადლობა",
            message = "გმადლობთ ჩვენთან კავშირისთვის! საჭიროების შემთხვევაში ნებისმიერ დროს დაგვიკავშირდით."
        )
    )
}
