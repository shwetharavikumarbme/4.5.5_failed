import UserNotifications

class NotificationService: UNNotificationServiceExtension {
    
    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        let bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        if let bestAttemptContent = bestAttemptContent,
           let mediaUrlString = request.content.userInfo["media-url"] as? String,
           let mediaUrl = URL(string: mediaUrlString) {

            downloadImage(from: mediaUrl) { attachment in
                if let attachment = attachment {
                    bestAttemptContent.attachments = [attachment]
                }
                contentHandler(bestAttemptContent)
            }

        } else {
            contentHandler(bestAttemptContent!)
        }
    }

    private func downloadImage(from url: URL, completion: @escaping (UNNotificationAttachment?) -> Void) {
        URLSession.shared.downloadTask(with: url) { (location, _, _) in
            guard let location = location else {
                completion(nil)
                return
            }

            let tmpDir = FileManager.default.temporaryDirectory
            let tmpFile = tmpDir.appendingPathComponent(url.lastPathComponent)

            try? FileManager.default.moveItem(at: location, to: tmpFile)
            let attachment = try? UNNotificationAttachment(identifier: "image", url: tmpFile, options: nil)
            completion(attachment)
        }.resume()
    }
}
