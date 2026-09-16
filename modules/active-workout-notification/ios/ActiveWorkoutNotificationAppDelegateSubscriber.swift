import ExpoModulesCore
import UIKit

public final class ActiveWorkoutNotificationAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    ActiveWorkoutNotificationTapStore.shared.record(url: url)
  }
}
