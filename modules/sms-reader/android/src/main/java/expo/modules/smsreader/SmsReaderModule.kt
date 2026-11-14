package expo.modules.smsreader

import android.content.ContentResolver
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    AsyncFunction("readRecentSms") { limit: Int ->
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val smsList = mutableListOf<Map<String, Any>>()
      val maxLimit = limit.coerceIn(1, 2000)

      fun querySmsUri(uri: Uri): Boolean {
        try {
          val projection = arrayOf("_id", "address", "body", "date")

          // On Android 8.0+ (API 26+), use Bundle with QUERY_ARG_LIMIT to avoid TelephonyProvider IllegalArgumentException.
          // On older versions, use strictly "date DESC" (never put LIMIT in sortOrder string) and break the loop manually.
          val cursor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val queryArgs = Bundle().apply {
              putInt(ContentResolver.QUERY_ARG_LIMIT, maxLimit)
              putString(ContentResolver.QUERY_ARG_SQL_SORT_ORDER, "date DESC")
            }
            context.contentResolver.query(uri, projection, queryArgs, null)
          } else {
            context.contentResolver.query(uri, projection, null, null, "date DESC")
          }

          cursor?.use {
            val addressIdx = it.getColumnIndex("address")
            val bodyIdx = it.getColumnIndex("body")
            val dateIdx = it.getColumnIndex("date")

            var count = 0
            while (it.moveToNext() && count < maxLimit) {
              val address = if (addressIdx != -1) it.getString(addressIdx) ?: "" else ""
              val body = if (bodyIdx != -1) it.getString(bodyIdx) ?: "" else ""
              val date = if (dateIdx != -1) it.getLong(dateIdx) else 0L

              smsList.add(mapOf(
                "address" to address,
                "body" to body,
                "date" to date
              ))
              count++
            }
          }
          return smsList.isNotEmpty()
        } catch (e: Exception) {
          Log.w("SmsReader", "SMS query exception on $uri: ${e.message}")
          return false
        }
      }

      // First query content://sms/inbox
      val found = querySmsUri(Uri.parse("content://sms/inbox"))
      // If inbox returned empty (e.g. certain Samsung RCS/carrier storage patterns), fallback to content://sms
      if (!found && smsList.isEmpty()) {
        querySmsUri(Uri.parse("content://sms"))
      }

      return@AsyncFunction smsList
    }
  }
}
