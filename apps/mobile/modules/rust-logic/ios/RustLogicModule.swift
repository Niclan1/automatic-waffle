import ExpoModulesCore
import Foundation
import VolkspeleLogic
import PDFKit
import UIKit
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
    AsyncFunction("command") { (request: String) throws -> String in
      let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("volkspele").path
      return try root.withCString { r in try request.withCString { q in try unwrap(rust_command(r,q)) } }
    }
    Function("domain") { (request: String) throws -> String in try request.withCString { try unwrap(rust_domain($0)) } }
    Function("progress") { (id: String) throws -> Int in
      let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("volkspele").path
      let request = String(data: try JSONSerialization.data(withJSONObject: ["op":"progress", "id":id]), encoding: .utf8)!
      return try root.withCString { r in try request.withCString { q in Int(try unwrap(rust_command(r,q))) ?? 0 } }
    }
    Function("cancelDownload") { (id: String) throws -> String in
      let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("volkspele").path
      let request = String(data: try JSONSerialization.data(withJSONObject: ["op":"cancel", "id":id]), encoding: .utf8)!
      return try root.withCString { r in try request.withCString { q in try unwrap(rust_command(r,q)) } }
    }
    AsyncFunction("renderPdfPage") { (uri: String, index: Int, requestedWidth: Int) throws -> [String: Any] in
      guard let url = URL(string: uri), url.isFileURL else { throw NSError(domain: "PDF", code: 1) }
      let resolved = url.resolvingSymlinksInPath()
      let roots = [FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0], FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]]
      guard roots.contains(where: { resolved.path.hasPrefix($0.resolvingSymlinksInPath().path + "/") }), let document = PDFDocument(url: resolved), index >= 0, index < document.pageCount, let page = document.page(at: index) else { throw NSError(domain: "PDF", code: 2) }
      let bounds = page.bounds(for: .mediaBox)
      guard bounds.width > 0, bounds.height > 0 else { throw NSError(domain: "PDF", code: 3) }
      let scale = min(CGFloat(max(320, min(1600, requestedWidth))) / bounds.width, 6000 / bounds.height)
      let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
      let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = true
      let image = UIGraphicsImageRenderer(size: size, format: format).image { context in
        UIColor.white.setFill(); context.fill(CGRect(origin: .zero, size: size))
        context.cgContext.translateBy(x: 0, y: size.height); context.cgContext.scaleBy(x: scale, y: -scale)
        context.cgContext.translateBy(x: -bounds.minX, y: -bounds.minY)
        page.draw(with: .mediaBox, to: context.cgContext)
      }
      let output = roots[1].appendingPathComponent("sheet-\(UUID().uuidString).png")
      guard let data = image.pngData() else { throw NSError(domain: "PDF", code: 4) }
      try data.write(to: output, options: .atomic)
      return ["uri": output.absoluteString, "width": Int(size.width), "height": Int(size.height), "pages": document.pageCount]
    }
    AsyncFunction("fetchCatalog") { (url: String) throws -> String in try url.withCString { try unwrap(rust_fetch_catalog($0)) } }
    Function("parseCatalog") { (text: String) throws -> String in try text.withCString { try unwrap(rust_parse_catalog($0)) } }
    AsyncFunction("sha256Base64") { (text: String) throws -> String in try text.withCString { try unwrap(rust_sha256_base64($0)) } }
    AsyncFunction("sha256File") { (text: String) throws -> String in try text.withCString { try unwrap(rust_sha256_file($0)) } }
    Function("isNewer") { (current: String, latest: String) throws -> Bool in try current.withCString { c in try latest.withCString { l in try unwrap(rust_is_newer(c,l)) == "true" } } }
  }
}
