import AVFoundation
import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private let root = RootViewController()

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // play sound even with the silent switch on, and keep it going in the background / PiP
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        CinejoySettings.registerDefaults()

        let window = UIWindow(frame: UIScreen.main.bounds)
        window.backgroundColor = .black
        window.overrideUserInterfaceStyle = .dark
        window.rootViewController = root
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        root.wentToBackground()
    }
}
