import ActivityKit
import SwiftUI
import WidgetKit

@main
struct ActiveWorkoutLiveActivityBundle: WidgetBundle {
  var body: some Widget {
    ActiveWorkoutLiveActivity()
  }
}

struct ActiveWorkoutLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ActiveWorkoutActivityAttributes.self) { _ in
      Text("Trening pågår")
        .widgetURL(URL(string: "trene-active-workout://notification-tap"))
        .activityBackgroundTint(Color(uiColor: .systemBackground))
        .activitySystemActionForegroundColor(Color.primary)
    } dynamicIsland: { _ in
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) {
          Text("Trening pågår")
        }
      } compactLeading: {
        Text("Trening pågår")
      } compactTrailing: {
        EmptyView()
      } minimal: {
        Text("Trening pågår")
      }
      .widgetURL(URL(string: "trene-active-workout://notification-tap"))
    }
  }
}
