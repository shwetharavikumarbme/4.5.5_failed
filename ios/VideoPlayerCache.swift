import AVFoundation
import UIKit

class VideoPlayerCache {
    static let shared = VideoPlayerCache()

    private var playerMap: [String: AVPlayer] = [:]
    private var muteMap: [String: Bool] = [:]
    private var thumbnailCache: [String: [NSValue: UIImage]] = [:]
    private let maxPlayerCount = 5 // LRU caching
    private var usageOrder: [String] = []

    // MARK: - Player Management

    func getPlayer(for url: URL) -> AVPlayer {
        let key = url.absoluteString
        if let player = playerMap[key] {
            updateUsage(for: key)
            return player
        }

        let player = AVPlayer(url: url)
        playerMap[key] = player
        updateUsage(for: key)
        enforceCacheLimit()
        return player
    }

    func removePlayer(for url: URL) {
        let key = url.absoluteString
        playerMap[key]?.pause()
        playerMap[key]?.replaceCurrentItem(with: nil)
        playerMap.removeValue(forKey: key)
        muteMap.removeValue(forKey: key)
        thumbnailCache.removeValue(forKey: key)
        usageOrder.removeAll { $0 == key }
    }

    func releaseAll() {
        for (key, player) in playerMap {
            player.pause()
            player.replaceCurrentItem(with: nil)
        }
        playerMap.removeAll()
        muteMap.removeAll()
        thumbnailCache.removeAll()
        usageOrder.removeAll()
    }

    func pausePlayer(for url: URL) {
        playerMap[url.absoluteString]?.pause()
    }

    // MARK: - Mute Management

    func mutePlayer(for url: URL) {
        let key = url.absoluteString
        playerMap[key]?.isMuted = true
        muteMap[key] = true
    }

    func unmutePlayer(for url: URL) {
        let key = url.absoluteString
        playerMap[key]?.isMuted = false
        muteMap[key] = false
    }

    func isPlayerMuted(for url: URL) -> Bool {
        return muteMap[url.absoluteString] ?? false
    }

    func setMuteState(for url: URL, isMuted: Bool) {
        let key = url.absoluteString
        muteMap[key] = isMuted
        playerMap[key]?.isMuted = isMuted
    }

    // MARK: - Playback Time Sync

    func getCurrentTime(for url: URL) -> CMTime? {
        return playerMap[url.absoluteString]?.currentTime()
    }

    func seekPlayer(for url: URL, to time: CMTime) {
        playerMap[url.absoluteString]?.seek(to: time)
    }

    // MARK: - Thumbnail Generation

    func generateThumbnail(url: URL, at time: CMTime, completion: @escaping (UIImage?) -> Void) {
        let cacheKey = url.absoluteString
        var map = thumbnailCache[cacheKey] ?? [:]
        let timeKey = NSValue(time: time)

        if let cached = map[timeKey] {
            completion(cached)
            return
        }

        let asset = AVAsset(url: url)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true

        generator.generateCGImagesAsynchronously(forTimes: [timeKey]) { _, cgImg, _, _, _ in
            var img: UIImage?
            if let cg = cgImg {
                img = UIImage(cgImage: cg)
            }

            DispatchQueue.main.async {
                if let final = img {
                    map[timeKey] = final
                    self.thumbnailCache[cacheKey] = map
                }
                completion(img)
            }
        }
    }

    // MARK: - LRU Cache Management

    private func updateUsage(for key: String) {
        usageOrder.removeAll { $0 == key }
        usageOrder.insert(key, at: 0)
    }

    private func enforceCacheLimit() {
        while usageOrder.count > maxPlayerCount {
            if let last = usageOrder.popLast(), let url = URL(string: last) {
                removePlayer(for: url)
            }
        }
    }
}
