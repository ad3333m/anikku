import UIKit

/// The same values the Windows shell uses, so the two builds look related.
enum Palette {
    /// The site's own backdrop, so there is no flash before the page paints.
    static let page = UIColor(red: 5 / 255, green: 5 / 255, blue: 5 / 255, alpha: 1)
    static let shell = UIColor(red: 10 / 255, green: 10 / 255, blue: 12 / 255, alpha: 1)
    static let ink = UIColor(red: 236 / 255, green: 238 / 255, blue: 240 / 255, alpha: 1)
    static let muted = UIColor(red: 150 / 255, green: 153 / 255, blue: 158 / 255, alpha: 1)
    /// #95FF50, Cinejoy's lime.
    static let accent = UIColor(red: 149 / 255, green: 255 / 255, blue: 80 / 255, alpha: 1)
    static let onAccent = UIColor(red: 9 / 255, green: 24 / 255, blue: 4 / 255, alpha: 1)
    static let surface = UIColor(red: 28 / 255, green: 29 / 255, blue: 33 / 255, alpha: 1)
    static let hairline = UIColor(red: 62 / 255, green: 65 / 255, blue: 72 / 255, alpha: 1)
}
