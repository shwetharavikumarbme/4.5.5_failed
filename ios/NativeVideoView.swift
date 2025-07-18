import UIKit
import AVFoundation

class NativeVideoUIView: UIView {
    private var playerLayer: AVPlayerLayer?
    private var player: AVPlayer?
    private var currentURL: URL?
    private var isPaused = true
    private var thumbnailImageView: UIImageView?

    var videoURL: String? {
        didSet {
            guard let us = videoURL, let url = URL(string: us) else { return }
            currentURL = url
            player = VideoPlayerCache.shared.getPlayer(for: url)
            setupLayer()
        }
    }

    private func setupLayer() {
        guard let player = player else { return }

        playerLayer?.removeFromSuperlayer()
        playerLayer = AVPlayerLayer(player: player)
        playerLayer?.frame = bounds
        playerLayer?.videoGravity = .resizeAspectFill
        layer.addSublayer(playerLayer!)

        bringSubviewToFront(thumbnailImageView ?? UIView())
    }

    func setThumbnail(_ urlString: String) {
        if thumbnailImageView == nil {
            thumbnailImageView = UIImageView(frame: bounds)
            thumbnailImageView?.contentMode = .scaleAspectFill
            thumbnailImageView?.backgroundColor = .black
            addSubview(thumbnailImageView!)
        }
        if let url = URL(string: urlString) {
            DispatchQueue.global().async {
                if let data = try? Data(contentsOf: url),
                   let image = UIImage(data: data) {
                    DispatchQueue.main.async {
                        self.thumbnailImageView?.image = image
                    }
                }
            }
        }
    }

    func play() {
        isPaused = false
        player?.play()
        thumbnailImageView?.isHidden = true
    }

    func pause() {
        isPaused = true
        player?.pause()
    }

    func setRepeat(_ r: Bool) {
        guard let item = player?.currentItem else { return }
        NotificationCenter.default.removeObserver(self)
        if r {
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(restart),
                name: .AVPlayerItemDidPlayToEndTime,
                object: item
            )
        }
    }

    @objc private func restart() {
        player?.seek(to: .zero)
        player?.play()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        playerLayer?.frame = bounds
        thumbnailImageView?.frame = bounds
    }

    deinit {
        if let url = currentURL {
            VideoPlayerCache.shared.removePlayer(for: url)
        }
        NotificationCenter.default.removeObserver(self)
    }
}
