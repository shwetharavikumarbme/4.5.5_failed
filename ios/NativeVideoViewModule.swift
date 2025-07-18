import AVKit
import React

@objc(NativeVideoViewModule)
class NativeVideoViewModule: NSObject, RCTBridgeModule {
    static func moduleName() -> String! { "NativeVideoViewModule" }
    static func requiresMainQueueSetup() -> Bool { true }

    private var fullscreenVC: AVPlayerViewController?
    private var fullscreenPlayer: AVPlayer?
    private var fullscreenURL: URL?
    private var observer: Any?
    private var isSeeking = false
    private var slider: UISlider?

    @objc func pauseEmbedded(_ urlString: String) {
        guard let url = URL(string: urlString) else { return }
        VideoPlayerCache.shared.pausePlayer(for: url)
        VideoPlayerCache.shared.mutePlayer(for: url)
    }

    @objc func presentFullscreen(_ urlString: String) {
        guard let url = URL(string: urlString) else { return }
        fullscreenURL = url

        let currentTime = VideoPlayerCache.shared.getCurrentTime(for: url) ?? .zero
        fullscreenPlayer = AVPlayer(url: url)
        fullscreenPlayer?.seek(to: currentTime)
        fullscreenPlayer?.isMuted = false

        DispatchQueue.main.async {
            self.fullscreenVC = AVPlayerViewController()
            guard let vc = self.fullscreenVC else { return }

            vc.player = self.fullscreenPlayer
            vc.showsPlaybackControls = false
            vc.modalPresentationStyle = .fullScreen
            vc.isModalInPresentation = false

            let overlay = UIView(frame: UIScreen.main.bounds)
            overlay.backgroundColor = .clear
            vc.contentOverlayView?.addSubview(overlay)

            let close = UIButton(type: .system)
            close.setImage(UIImage(systemName: "xmark.circle"), for: .normal)
            close.tintColor = .white
            close.frame = CGRect(x: 20, y: 40, width: 40, height: 40)
            close.addTarget(self, action: #selector(self.closeFullscreen), for: .touchUpInside)
            overlay.addSubview(close)

            let pp = UIButton(type: .system)
            pp.setImage(UIImage(systemName: "pause.fill"), for: .normal)
            pp.tintColor = .white
            pp.frame = CGRect(x: 20, y: UIScreen.main.bounds.height - 100, width: 40, height: 40)
            pp.addTarget(self, action: #selector(self.togglePlayPause(_:)), for: .touchUpInside)
            overlay.addSubview(pp)

            let mute = UIButton(type: .system)
            mute.setImage(UIImage(systemName: "speaker.wave.2.fill"), for: .normal)
            mute.tintColor = .white
            mute.frame = CGRect(x: 80, y: UIScreen.main.bounds.height - 100, width: 40, height: 40)
            mute.addTarget(self, action: #selector(self.toggleMute(_:)), for: .touchUpInside)
            overlay.addSubview(mute)

            let slider = UISlider(frame: CGRect(
                x: 20,
                y: UIScreen.main.bounds.height - 50,
                width: UIScreen.main.bounds.width - 40,
                height: 30
            ))
            slider.minimumTrackTintColor = .white
            slider.addTarget(self, action: #selector(self.sliderTouchBegan(_:)), for: .touchDown)
            slider.addTarget(self, action: #selector(self.sliderTouchEnded(_:)), for: [.touchUpInside, .touchUpOutside])
            overlay.addSubview(slider)
            self.slider = slider

            self.observer = self.fullscreenPlayer?.addPeriodicTimeObserver(
                forInterval: CMTime(seconds: 0.3, preferredTimescale: 600),
                queue: .main
            ) { [weak self] time in
                guard let self = self,
                      let duration = self.fullscreenPlayer?.currentItem?.duration.seconds,
                      duration > 0,
                      !self.isSeeking else { return }
                self.slider?.value = Float(time.seconds / duration)
            }

            if let top = RCTPresentedViewController() {
                top.present(vc, animated: true) {
                    self.fullscreenPlayer?.play()
                }
            }
        }
    }

    @objc func togglePlayPause(_ sender: UIButton) {
        guard let player = fullscreenPlayer else { return }
        if player.timeControlStatus == .playing {
            player.pause()
            sender.setImage(UIImage(systemName: "play.fill"), for: .normal)
        } else {
            player.play()
            sender.setImage(UIImage(systemName: "pause.fill"), for: .normal)
        }
    }

    @objc func toggleMute(_ sender: UIButton) {
        guard let player = fullscreenPlayer else { return }
        player.isMuted.toggle()
        let icon = player.isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill"
        sender.setImage(UIImage(systemName: icon), for: .normal)
    }

    @objc func sliderTouchBegan(_ slider: UISlider) {
        isSeeking = true
    }

    @objc func sliderTouchEnded(_ slider: UISlider) {
        guard let duration = fullscreenPlayer?.currentItem?.duration.seconds else { return }
        let target = Double(slider.value) * duration
        fullscreenPlayer?.seek(to: CMTime(seconds: target, preferredTimescale: 600)) { _ in
            self.isSeeking = false
        }
    }

  @objc func closeFullscreen() {
      guard let player = fullscreenPlayer,
            let currentItem = player.currentItem,
            let urlAsset = currentItem.asset as? AVURLAsset else { return }

      let currentTime = player.currentTime()

      // Sync time back to embedded player
      VideoPlayerCache.shared.seekPlayer(for: urlAsset.url, to: currentTime)

      // Resume embedded playback and unmute
      let sharedPlayer = VideoPlayerCache.shared.getPlayer(for: urlAsset.url)
      sharedPlayer.play()
      sharedPlayer.isMuted = false

      // Dismiss fullscreen
      fullscreenVC?.dismiss(animated: true)
      fullscreenVC = nil
      fullscreenPlayer = nil

      if let obs = observer {
          fullscreenPlayer?.removeTimeObserver(obs)
          observer = nil
      }
  }
}
