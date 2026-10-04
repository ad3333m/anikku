import UIKit

/// Stands in for the page when it cannot be reached, with the same two ways out
/// the Windows shell offers: try again, or hand it to the real browser.
final class FaultView: UIView {

    private let titleLabel = UILabel()
    private let bodyLabel = UILabel()
    private let primary = UIButton(type: .system)
    private let secondary = UIButton(type: .system)

    private var onPrimary: (() -> Void)?
    private var onSecondary: (() -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)

        backgroundColor = Palette.shell
        isHidden = true

        titleLabel.textColor = Palette.ink
        titleLabel.font = .preferredFont(forTextStyle: .title2)
        titleLabel.adjustsFontForContentSizeCategory = true
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 0

        bodyLabel.textColor = Palette.muted
        bodyLabel.font = .preferredFont(forTextStyle: .subheadline)
        bodyLabel.adjustsFontForContentSizeCategory = true
        bodyLabel.textAlignment = .center
        bodyLabel.numberOfLines = 0

        style(primary, filled: true)
        style(secondary, filled: false)
        primary.addTarget(self, action: #selector(tappedPrimary), for: .touchUpInside)
        secondary.addTarget(self, action: #selector(tappedSecondary), for: .touchUpInside)

        let buttons = UIStackView(arrangedSubviews: [primary, secondary])
        buttons.axis = .horizontal
        buttons.spacing = 12
        buttons.distribution = .fillEqually

        let stack = UIStackView(arrangedSubviews: [titleLabel, bodyLabel, buttons])
        stack.axis = .vertical
        stack.spacing = 16
        stack.setCustomSpacing(24, after: bodyLabel)
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: layoutMarginsGuide.leadingAnchor),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: layoutMarginsGuide.trailingAnchor),
            stack.widthAnchor.constraint(lessThanOrEqualToConstant: 460),
            buttons.heightAnchor.constraint(equalToConstant: 46),
        ])
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    private func style(_ button: UIButton, filled: Bool) {
        button.backgroundColor = filled ? Palette.accent : Palette.surface
        button.setTitleColor(filled ? Palette.onAccent : Palette.ink, for: .normal)
        button.titleLabel?.font = .preferredFont(forTextStyle: filled ? .headline : .body)
        button.titleLabel?.adjustsFontForContentSizeCategory = true
        button.layer.cornerRadius = 12
        button.layer.cornerCurve = .continuous
        button.layer.borderWidth = filled ? 0 : 1
        button.layer.borderColor = Palette.hairline.cgColor
    }

    func present(title: String,
                 body: String,
                 primaryTitle: String, primaryAction: @escaping () -> Void,
                 secondaryTitle: String, secondaryAction: @escaping () -> Void) {
        titleLabel.text = title
        bodyLabel.text = body
        primary.setTitle(primaryTitle, for: .normal)
        secondary.setTitle(secondaryTitle, for: .normal)
        onPrimary = primaryAction
        onSecondary = secondaryAction
        isHidden = false
    }

    @objc private func tappedPrimary() { onPrimary?() }
    @objc private func tappedSecondary() { onSecondary?() }
}
