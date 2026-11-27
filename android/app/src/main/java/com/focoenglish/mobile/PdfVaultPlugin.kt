package com.focoenglish.mobile

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

@CapacitorPlugin(name = "PdfVault")
class PdfVaultPlugin : Plugin() {

    private fun vaultDir(): File {
        val dir = File(context.filesDir, "pdf_vault")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    /**
     * Copies a PDF from a user-selected content URI into private app storage.
     * The original PDF file is NEVER modified or deleted.
     */
    @PluginMethod
    fun copyPdfToPrivateStorage(call: PluginCall) {
        val uriStr = call.getString("uri")
        val fileName = call.getString("fileName") ?: "study_material.pdf"
        if (uriStr.isNullOrBlank()) {
            call.reject("Missing URI")
            return
        }

        try {
            val sourceUri = Uri.parse(uriStr)
            val safeKey = "pdf_${UUID.randomUUID()}.pdf"
            val destFile = File(vaultDir(), safeKey)

            context.contentResolver.openInputStream(sourceUri)?.use { input ->
                FileOutputStream(destFile).use { output ->
                    input.copyTo(output)
                }
            } ?: run {
                call.reject("Unable to read source PDF stream")
                return
            }

            val res = JSObject().apply {
                put("key", safeKey)
                put("fileName", fileName)
                put("sizeBytes", destFile.length())
            }
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("Failed to copy PDF: ${e.message}")
        }
    }

    @PluginMethod
    fun openPrivatePdf(call: PluginCall) {
        val key = call.getString("key")
        if (key.isNullOrBlank()) {
            call.reject("Missing PDF key")
            return
        }
        val file = File(vaultDir(), key)
        if (!file.exists()) {
            call.reject("Private PDF copy not found")
            return
        }
        val contentUri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(contentUri, "application/pdf")
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
        call.resolve()
    }
}
