package co.trendscore.driver_app

import android.provider.Settings
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.android.FlutterActivity
import io.flutter.plugin.common.MethodChannel
import java.security.MessageDigest

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, DEVICE_ID_CHANNEL)
            .setMethodCallHandler { call, result ->
                if (call.method != "deviceScopedId") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }

                val androidId = Settings.Secure.getString(
                    contentResolver,
                    Settings.Secure.ANDROID_ID,
                )
                if (androidId.isNullOrBlank()) {
                    result.error("DEVICE_ID_UNAVAILABLE", "Android did not provide a device id.", null)
                    return@setMethodCallHandler
                }

                val scopedValue = "${applicationContext.packageName}:driver-device-v1:$androidId"
                val digest = MessageDigest.getInstance("SHA-256")
                    .digest(scopedValue.toByteArray(Charsets.UTF_8))
                    .joinToString("") { byte -> "%02x".format(byte) }
                result.success(digest)
            }
    }

    private companion object {
        const val DEVICE_ID_CHANNEL = "co.trendscore.driver/device_identity"
    }
}
