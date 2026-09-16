import Foundation

final class ActiveWorkoutNotificationTapStore: @unchecked Sendable {
  static let shared = ActiveWorkoutNotificationTapStore()
  static let didReceiveTap = Notification.Name("ActiveWorkoutNotificationDidReceiveTap")
  static let urlScheme = "trene-active-workout"
  static let urlHost = "notification-tap"

  private let lock = NSLock()
  private var pendingTap = false

  private init() {}

  func record(url: URL) -> Bool {
    guard url.scheme == Self.urlScheme, url.host == Self.urlHost else {
      return false
    }
    lock.lock()
    pendingTap = true
    lock.unlock()
    NotificationCenter.default.post(name: Self.didReceiveTap, object: nil)
    return true
  }

  func consume() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    let result = pendingTap
    pendingTap = false
    return result
  }
}
