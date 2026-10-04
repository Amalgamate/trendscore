import 'package:flutter/material.dart';

/// Design-system colours for the driver app.
///
/// Mirrors src/design-system/colors.ts in the main product so both apps read as
/// one system. Two layers, in priority order:
///
///  1. The school's own brand colour, fetched at connect time from
///     /api/schools/public/branding and applied via [AppTheme.overrideBrand].
///  2. The TrendsCORE design-system default when a school has no colour set.
///
/// Widgets read [AppTheme.brand] rather than hardcoding a colour, so a school's
/// branding propagates everywhere without touching a single screen.
class AppTheme {
  const AppTheme._();

  /// Matches COLORS.brand.primary in the main design system.
  static const Color brandPrimary = Color(0xFF030B82);

  /// Matches COLORS.brand.primaryDark.
  static const Color brandPrimaryDark = Color(0xFF02075E);

  /// Matches COLORS.brand.secondary (#0D9488).
  static const Color brandSecondary = Color(0xFF0D9488);

  // ── Semantic colours ────────────────────────────────────────────────────────
  // These are deliberately NOT brandable: green must read as "recorded" and red
  // as "cancelled" for every school. Brand them and the UI becomes ambiguous.

  /// Learner is on the bus.
  static const Color successSurface = Color(0xFFDCFCE7);
  static const Color success = Color(0xFF16A34A);
  static const Color successBorder = Color(0xFF86EFAC);
  static const Color successText = Color(0xFF166534);

  /// Trip has not started.
  static const Color warningSurface = Color(0xFFFEF3C7);
  static const Color warningText = Color(0xFF92400E);

  static const Color dangerSurface = Color(0xFFFEE2E2);
  static const Color danger = Color(0xFFB91C1C);
  static const Color dangerSurfaceAlt = Color(0xFFFCA5A5);

  static const Color neutralSurface = Color(0xFFF3F4F6);
  static const Color neutralText = Color(0xFF374151);

  /// App page background.
  static const Color pageBackground = Color(0xFFF7F7FB);

  /// Background behind the fixed summary bar.
  static const Color tintedSurface = Color(0xFFEDE9FE);

  // ── Runtime brand override ──────────────────────────────────────────────────

  /// Per-school brand colour, set once branding has been fetched.
  ///
  /// Stored as a plain static rather than in [BuildContext] because branding is
  /// loaded before the widget tree exists, and it must survive offline.
  static Color? _override;

  static void overrideBrand(Color? colour) => _override = colour;

  static Color? get brandOverride => _override;

  /// Effective brand colour for this device, ignoring the widget tree.
  static Color get brand => _override ?? brandPrimary;

  /// Brand colour for a widget. Prefers the runtime override, then the theme's
  /// resolved primary so a screen rendered before branding loads is never
  /// unbranded.
  static Color brandFor(BuildContext context) =>
      _override ?? Theme.of(context).colorScheme.primary;

  /// Build a Material 3 theme around the effective brand colour.
  ///
  /// The runtime override is already a [Color]; the build-time fallback is an
  /// ARGB [int] from `--dart-define`. Resolving them to a Color first avoids
  /// the `??` inferring `Object` across the two types.
  static ThemeData theme() {
    final Color seed = _override ?? brandPrimary;

    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: seed),
      scaffoldBackgroundColor: pageBackground,
      appBarTheme: AppBarTheme(
        backgroundColor: seed,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
      ),
    );
  }
}
