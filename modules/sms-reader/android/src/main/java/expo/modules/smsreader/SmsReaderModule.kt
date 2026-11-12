package expo.modules.smsreader

import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    AsyncFunction("readRecentSms") { limit: Int ->
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val smsList = mutableListOf<Map<String, Any>>()
      
      try {
        val cursor = context.contentResolver.query(
          Uri.parse("content://sms/inbox"),
          arrayOf("_id", "address", "body", "date"),
          null,
          null,
          "date DESC LIMIT ${limit.coerceIn(1, 1000)}"
        )

        cursor?.use {
          val addressIdx = it.getColumnIndex("address")
          val bodyIdx = it.getColumnIndex("body")
          val dateIdx = it.getColumnIndex("date")

          while (it.moveToNext()) {
            val address = if (addressIdx != -1) it.getString(addressIdx) ?: "" else ""
            val body = if (bodyIdx != -1) it.getString(bodyIdx) ?: "" else ""
            val date = if (dateIdx != -1) it.getLong(dateIdx) else 0L

            smsList.add(mapOf(
              "address" to address,
              "body" to body,
              "date" to date
            ))
          }
        }
      } catch (e: Exception) {
        // Return whatever was collected or empty list if error
      }

      return@AsyncFunction smsList
    }
  }
}
