package expo.modules.rustlogic
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import java.io.File
import java.security.MessageDigest
object NativeLogic {
  init { System.loadLibrary("volkspele_logic") }
  external fun fetchCatalog(url: String): String
  external fun parseCatalog(text: String): String
  external fun sha256Base64(text: String): String
  external fun sha256File(uri: String): String
  external fun isNewer(current: String, latest: String): String
  external fun command(root: String, request: String): String
  external fun domain(request: String): String
}
private fun unwrap(text: String): String {
  val result = JSONObject(text)
  if (!result.getBoolean("ok")) throw IllegalArgumentException(result.getString("error"))
  return result.getString("value")
}
class RustLogicModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RustLogic")
    fun root(): String = File(appContext.reactContext?.filesDir ?: throw IllegalStateException("No app context"), "volkspele").absolutePath
    AsyncFunction("command") { request: String -> unwrap(NativeLogic.command(root(), request)) }
    Function("domain") { request: String -> unwrap(NativeLogic.domain(request)) }
    Function("progress") { id: String -> unwrap(NativeLogic.command(root(), JSONObject().put("op", "progress").put("id", id).toString())).toInt() }
    Function("cancelDownload") { id: String -> unwrap(NativeLogic.command(root(), JSONObject().put("op", "cancel").put("id", id).toString())) }
    AsyncFunction("renderPdfPage") { uri: String, index: Int, requestedWidth: Int ->
      val context = appContext.reactContext ?: throw IllegalStateException("No app context")
      val file = File(Uri.parse(uri).path ?: throw IllegalArgumentException("Invalid file URI")).canonicalFile
      require(uri.startsWith("file://") && listOf(context.filesDir, context.cacheDir).any { file.path.startsWith(it.canonicalPath + File.separator) }) { "PDF must be saved in app storage" }
      ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
        PdfRenderer(descriptor).use { renderer ->
          require(index >= 0 && index < renderer.pageCount) { "Invalid PDF page" }
          renderer.openPage(index).use { page ->
            val width = requestedWidth.coerceIn(320, 1600)
            val scale = minOf(width.toDouble() / page.width, 6000.0 / page.height)
            val outputWidth = (page.width * scale).toInt().coerceAtLeast(1)
            val outputHeight = (page.height * scale).toInt().coerceAtLeast(1)
            val fingerprint = MessageDigest.getInstance("SHA-256").digest("${file.path}:${file.lastModified()}:$index:$width".toByteArray()).joinToString("") { "%02x".format(it) }
            val output = File(context.cacheDir, "sheet-$fingerprint.png")
            if (!output.exists()) {
              val bitmap = Bitmap.createBitmap(outputWidth, outputHeight, Bitmap.Config.ARGB_8888)
              try { bitmap.eraseColor(Color.WHITE); page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY); output.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) } }
              finally { bitmap.recycle() }
            }
            mapOf("uri" to Uri.fromFile(output).toString(), "width" to outputWidth, "height" to outputHeight, "pages" to renderer.pageCount)
          }
        }
      }
    }
    AsyncFunction("fetchCatalog") { url: String -> unwrap(NativeLogic.fetchCatalog(url)) }
    Function("parseCatalog") { text: String -> unwrap(NativeLogic.parseCatalog(text)) }
    AsyncFunction("sha256Base64") { text: String -> unwrap(NativeLogic.sha256Base64(text)) }
    AsyncFunction("sha256File") { uri: String -> unwrap(NativeLogic.sha256File(uri)) }
    Function("isNewer") { current: String, latest: String -> unwrap(NativeLogic.isNewer(current, latest)) == "true" }
  }
}
