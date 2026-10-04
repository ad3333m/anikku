import UIKit

/// The small transient notice the Windows shell shows at the bottom of the
/// window, in the place iOS expects it: above the home indicator.
final class ToastView: UIView {

    private let label = UILabel()
    private var hideWork: DispatchWorkItem?

    override init(frame: CGRect) {
        super.init(frame: frame)

        backgroundColor = Palette.surface
        layer.cornerRadius = 14
        layer.cornerCurve = .continuous
        layer.borderWidth = 1
        layer.borderColor = Palette.hairline.cgColor
        alpha = 0
        isUserInteractionEnabled = false

        label.textColor = Palette.ink
        label.font = .preferredFont(forTextStyle: .footnote)
        label.adjustsFontForContentSizeCategory = true
        label.numberOfLines = 2
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)

        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            label.topAnchor.constraint(equalTo: topAnchor, constant: 10),
            label.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -10),
        ])
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    func show(_ text: String, for seconds: TimeInterval = 3) {
        label.text = text
        hideWork?.cancel()

        UIView.animate(withDuration: 0.18) { self.alpha = 1 }

        let work = DispatchWorkItem { [weak self] in
            UIView.animate(withDuration: 0.25) { self?.alpha = 0 }
        }
        hideWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
    }
}
