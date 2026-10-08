package expo.modules.rustlogic
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
object NativeLogic {
  init { System.loadLibrary("volkspele_logic") }
  external fun fetchCatalog(url: String): String
  external fun parseCatalog(text: String): String
  external fun sha256Base64(text: String): String
  external fun sha256File(uri: String): String
  external fun isNewer(current: String, latest: String): String
}
private fun unwrap(text: String): String {
  val result = JSONObject(text)
  if (!result.getBoolean("ok")) throw IllegalArgumentException(result.getString("error"))
  return result.getString("value")
}
class RustLogicModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RustLogic")
    AsyncFunction("fetchCatalog") { url: String -> unwrap(NativeLogic.fetchCatalog(url)) }
    Function("parseCatalog") { text: String -> unwrap(NativeLogic.parseCatalog(text)) }
    AsyncFunction("sha256Base64") { text: String -> unwrap(NativeLogic.sha256Base64(text)) }
    AsyncFunction("sha256File") { uri: String -> unwrap(NativeLogic.sha256File(uri)) }
    Function("isNewer") { current: String, latest: String -> unwrap(NativeLogic.isNewer(current, latest)) == "true" }
  }
}
