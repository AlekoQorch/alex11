import MessageUI
import SwiftUI
import UniformTypeIdentifiers

struct MessageComposeView: UIViewControllerRepresentable {
    let recipients: [String]
    let body: String
    var attachments: [(data: Data, typeIdentifier: String, filename: String)] = []
    var onFinish: (() -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(onFinish: onFinish)
    }

    func makeUIViewController(context: Context) -> MFMessageComposeViewController {
        let controller = MFMessageComposeViewController()
        controller.messageComposeDelegate = context.coordinator
        controller.recipients = recipients
        controller.body = body
        for item in attachments {
            controller.addAttachmentData(
                item.data,
                typeIdentifier: item.typeIdentifier,
                filename: item.filename
            )
        }
        return controller
    }

    func updateUIViewController(_ uiViewController: MFMessageComposeViewController, context: Context) {}

    final class Coordinator: NSObject, MFMessageComposeViewControllerDelegate {
        let onFinish: (() -> Void)?

        init(onFinish: (() -> Void)?) {
            self.onFinish = onFinish
        }

        func messageComposeViewController(
            _ controller: MFMessageComposeViewController,
            didFinishWith result: MessageComposeResult
        ) {
            controller.dismiss(animated: true)
            onFinish?()
        }
    }
}
