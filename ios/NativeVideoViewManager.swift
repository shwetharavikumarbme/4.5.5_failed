import Foundation
import React

@objc(NativeVideoViewManager)
class NativeVideoViewManager: RCTViewManager {
    override static func requiresMainQueueSetup() -> Bool { true }

    override func view() -> UIView! {
        return NativeVideoUIView()
    }

    @objc func setSource(_ reactTag: NSNumber, source: NSDictionary) {
        DispatchQueue.main.async {
            guard let component = self.bridge.uiManager.view(forReactTag: reactTag) as? NativeVideoUIView else { return }
            if let urlString = source["uri"] as? String {
                component.videoURL = urlString
            }
        }
    }

    @objc func setPaused(_ reactTag: NSNumber, paused: Bool) {
        DispatchQueue.main.async {
            guard let view = self.bridge.uiManager.view(forReactTag: reactTag) as? NativeVideoUIView else { return }
            paused ? view.pause() : view.play()
        }
    }

    @objc func setRepeat(_ reactTag: NSNumber, repeatVideo: Bool) {
        DispatchQueue.main.async {
            guard let view = self.bridge.uiManager.view(forReactTag: reactTag) as? NativeVideoUIView else { return }
            view.setRepeat(repeatVideo)
        }
    }

    @objc func setThumbnail(_ reactTag: NSNumber, thumbnail: NSString) {
        DispatchQueue.main.async {
            guard let view = self.bridge.uiManager.view(forReactTag: reactTag) as? NativeVideoUIView else { return }
            view.setThumbnail(thumbnail as String)
        }
    }
}
