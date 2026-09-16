package com.kjetilvalle.trene.activeworkoutnotification

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ActiveWorkoutNotificationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val notificationManager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  override fun definition() = ModuleDefinition {
    Name(MODULE_NAME)
    Events(TAP_EVENT, TAP_ERROR_EVENT)

    AsyncFunction("inspectAuthorizationAsync") {
      runOperation("inspect notification authorization") {
        ensureChannel()
        val authorized = isAuthorized()
        val channelEnabled = isChannelEnabled()

        mapOf(
          "supported" to true,
          "authorized" to authorized,
          "canShow" to (authorized && channelEnabled)
        )
      }
    }

    AsyncFunction("showAsync") {
      runOperation("show active workout notification") {
        ensureChannel()
        if (!isAuthorized() || !isChannelEnabled()) {
          throw NotificationNotAuthorizedException()
        }

        notificationManager.notify(NOTIFICATION_ID, buildNotification())
      }
    }

    AsyncFunction("removeAsync") {
      runOperation("remove active workout notification") {
        notificationManager.cancel(NOTIFICATION_ID)
      }
    }

    AsyncFunction("openSettingsAsync") {
      runOperation("open app notification settings") {
        context.startActivity(
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
        )
      }
    }

    AsyncFunction("getInitialTapAsync") {
      runOperation("read initial notification tap") {
        consumeTap(appContext.currentActivity?.intent)
      }
    }

    OnNewIntent { intent ->
      try {
        if (consumeTap(intent)) {
          sendEvent(TAP_EVENT)
        }
      } catch (exception: Exception) {
        sendEvent(
          TAP_ERROR_EVENT,
          mapOf("message" to (exception.message ?: "Failed to handle notification tap"))
        )
      }
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notificationManager.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          CHANNEL_NAME,
          NotificationManager.IMPORTANCE_LOW
        ).apply {
          description = CHANNEL_DESCRIPTION
          setShowBadge(false)
        }
      )
    }
  }

  private fun isAuthorized(): Boolean {
    val permissionGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    return permissionGranted && notificationManager.areNotificationsEnabled()
  }

  private fun isChannelEnabled(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
      notificationManager.getNotificationChannel(CHANNEL_ID)?.importance != NotificationManager.IMPORTANCE_NONE

  private fun buildNotification(): Notification {
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: throw NotificationOperationException("create notification tap intent")
    launchIntent.apply {
      action = TAP_ACTION
      putExtra(TAP_EXTRA, true)
      addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }

    val pendingIntent = PendingIntent.getActivity(
      context,
      PENDING_INTENT_REQUEST_CODE,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return Notification.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_notify_more)
      .setContentText(NOTIFICATION_TEXT)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setCategory(Notification.CATEGORY_PROGRESS)
      .build()
  }

  private fun consumeTap(intent: Intent?): Boolean {
    if (intent?.action != TAP_ACTION || !intent.getBooleanExtra(TAP_EXTRA, false)) {
      return false
    }
    intent.removeExtra(TAP_EXTRA)
    intent.action = null
    return true
  }

  private inline fun <T> runOperation(operation: String, body: () -> T): T {
    try {
      return body()
    } catch (exception: CodedException) {
      throw exception
    } catch (exception: Exception) {
      throw NotificationOperationException(operation, exception)
    }
  }

  companion object {
    private const val MODULE_NAME = "ActiveWorkoutNotification"
    private const val CHANNEL_ID = "active-workout"
    private const val CHANNEL_NAME = "Aktiv trening"
    private const val CHANNEL_DESCRIPTION = "Viser at en trening pågår"
    private const val NOTIFICATION_ID = 245
    private const val NOTIFICATION_TEXT = "Trening pågår"
    private const val PENDING_INTENT_REQUEST_CODE = 245
    private const val TAP_ACTION = "com.kjetilvalle.trene.ACTIVE_WORKOUT_NOTIFICATION_TAP"
    private const val TAP_EXTRA = "activeWorkoutNotificationTap"
    private const val TAP_EVENT = "notificationTap"
    private const val TAP_ERROR_EVENT = "notificationTapError"
  }
}

private class NotificationNotAuthorizedException : CodedException(
  "Notification authorization is not available"
)

private class NotificationOperationException : CodedException {
  constructor(operation: String) : super("Unable to $operation")
  constructor(operation: String, cause: Throwable) : super("Unable to $operation", cause)
}
