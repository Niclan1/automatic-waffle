import ExpoModulesCore
import Foundation
import VolkspeleLogic
private func unwrap(_ pointer: UnsafeMutablePointer<CChar>?) throws -> String {
  guard let output = pointer else { throw NSError(domain: "RustLogic", code: 2) }
  defer { rust_free_string(output) }
  let result = try JSONSerialization.jsonObject(with: Data(String(cString: output).utf8)) as! [String: Any]
  guard result["ok"] as? Bool == true else { throw NSError(domain: "RustLogic", code: 1, userInfo: [NSLocalizedDescriptionKey: result["error"] as? String ?? "Rust logic failed"]) }
  return result["value"] as! String
}
public class RustLogicModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RustLogic")
    AsyncFunction("fetchCatalog") { (url: String) throws -> String in try url.withCString { try unwrap(rust_fetch_catalog($0)) } }
    Function("parseCatalog") { (text: String) throws -> String in try text.withCString { try unwrap(rust_parse_catalog($0)) } }
    AsyncFunction("sha256Base64") { (text: String) throws -> String in try text.withCString { try unwrap(rust_sha256_base64($0)) } }
    AsyncFunction("sha256File") { (text: String) throws -> String in try text.withCString { try unwrap(rust_sha256_file($0)) } }
    Function("isNewer") { (current: String, latest: String) throws -> Bool in try current.withCString { c in try latest.withCString { l in try unwrap(rust_is_newer(c,l)) == "true" } } }
  }
}
