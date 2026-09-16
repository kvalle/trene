import ActivityKit
import ExpoModulesCore
import UIKit

public final class ActiveWorkoutNotificationModule: Module {
  private var tapObserver: NSObjectProtocol?
  private var isObservingTaps = false

  public func definition() -> ModuleDefinition {
    Name("ActiveWorkoutNotification")
    Events("notificationTap", "notificationTapError")

    OnCreate {
      tapObserver = NotificationCenter.default.addObserver(
        forName: ActiveWorkoutNotificationTapStore.didReceiveTap,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        guard self?.isObservingTaps == true,
              ActiveWorkoutNotificationTapStore.shared.consume() else { return }
        self?.sendEvent("notificationTap")
      }
    }

    OnStartObserving("notificationTap") {
      isObservingTaps = true
      if ActiveWorkoutNotificationTapStore.shared.consume() {
        sendEvent("notificationTap")
      }
    }

    OnStopObserving("notificationTap") {
      isObservingTaps = false
    }

    OnDestroy {
      if let tapObserver {
        NotificationCenter.default.removeObserver(tapObserver)
      }
    }

    AsyncFunction("inspectAuthorizationAsync") { () -> [String: Bool] in
      guard #available(iOS 16.1, *) else {
        return ["supported": false, "authorized": false, "canShow": false]
      }
      let authorized = ActivityAuthorizationInfo().areActivitiesEnabled
      return ["supported": true, "authorized": authorized, "canShow": authorized]
    }

    AsyncFunction("showAsync") { () async throws in
      guard #available(iOS 16.1, *) else { return }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        throw LiveActivityNotAuthorizedException()
      }
      guard Activity<ActiveWorkoutActivityAttributes>.activities.isEmpty else { return }

      do {
        let attributes = ActiveWorkoutActivityAttributes()
        let state = ActiveWorkoutActivityAttributes.ContentState()
        if #available(iOS 16.2, *) {
          _ = try Activity.request(
            attributes: attributes,
            content: ActivityContent(state: state, staleDate: nil),
            pushType: nil
          )
        } else {
          _ = try Activity.request(attributes: attributes, contentState: state, pushType: nil)
        }
      } catch {
        throw LiveActivityOperationException("start active workout Live Activity", cause: error)
      }
    }

    AsyncFunction("removeAsync") { () async throws in
      guard #available(iOS 16.1, *) else { return }
      for activity in Activity<ActiveWorkoutActivityAttributes>.activities {
        let state = ActiveWorkoutActivityAttributes.ContentState()
        if #available(iOS 16.2, *) {
          await activity.end(
            ActivityContent(state: state, staleDate: nil),
            dismissalPolicy: .immediate
          )
        } else {
          await activity.end(using: state, dismissalPolicy: .immediate)
        }
      }
    }

    AsyncFunction("openSettingsAsync") { () async throws in
      guard let url = URL(string: UIApplication.openSettingsURLString),
            await UIApplication.shared.canOpenURL(url) else {
        throw LiveActivityOperationException("open app settings")
      }
      await UIApplication.shared.open(url)
    }

    AsyncFunction("getInitialTapAsync") {
      ActiveWorkoutNotificationTapStore.shared.consume()
    }
  }
}

private final class LiveActivityNotAuthorizedException: Exception, @unchecked Sendable {
  override var reason: String {
    "Live Activities are not authorized"
  }
}

private final class LiveActivityOperationException: Exception, @unchecked Sendable {
  private let operation: String
  private let underlyingError: Error?

  init(_ operation: String, cause: Error? = nil) {
    self.operation = operation
    self.underlyingError = cause
    super.init()
  }

  override var reason: String {
    if let underlyingError {
      return "Unable to \(operation): \(underlyingError.localizedDescription)"
    }
    return "Unable to \(operation)"
  }
}
