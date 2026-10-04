/// School branding as returned by `GET /api/schools/public/branding`.
///
/// That endpoint is public and unauthenticated, so branding can be fetched
/// before sign-in. That is what lets the sign-in screen show the school's real
/// logo rather than a generic bus icon.
library;

/// Colours arrive from the backend as hex strings such as "#030b82", sometimes
/// without the leading hash. Parsing is defensive: a bad colour must never take
/// down the app.
int? parseHexColor(String? raw) {
  if (raw == null) return null;
  var value = raw.trim();
  if (value.isEmpty) return null;
  if (value.startsWith('#')) value = value.substring(1);

  // Expand shorthand like "#FFF" to "#FFFFFF".
  if (value.length == 3) {
    value = value.split('').map((c) => '$c$c').join();
  }

  // Only 3/4/6/8-digit forms are valid CSS colours. int.tryParse would happily
  // accept any length, turning a typo like "#12345" into a plausible-looking but
  // wrong colour instead of falling back to the design-system default.
  if (value.length != 3 &&
      value.length != 4 &&
      value.length != 6 &&
      value.length != 8) {
    return null;
  }
  if (!RegExp(r'^[0-9a-fA-F]+$').hasMatch(value)) return null;

  final parsed = int.tryParse(value, radix: 16);
  if (parsed == null) return null;

  // Assume opaque unless the caller supplied an alpha channel.
  return value.length == 8 ? parsed : (parsed | 0xFF000000);
}

class SchoolBranding {
  const SchoolBranding({
    this.schoolId,
    this.name = '',
    this.motto = '',
    this.logoUrl,
    this.pwaLogoUrl,
    this.faviconUrl,
    this.primaryColorHex,
    this.secondaryColorHex,
    this.phone = '',
    this.email = '',
    this.address = '',
  });

  final String? schoolId;
  final String name;
  final String motto;

  final String? logoUrl;
  final String? pwaLogoUrl;
  final String? faviconUrl;

  final String? primaryColorHex;
  final String? secondaryColorHex;

  final String phone;
  final String email;
  final String address;

  /// Prefers the dedicated PWA logo, falling back to the main logo and then the
  /// favicon. Mirrors resolvePwaIconUrl in the web App.jsx.
  String? get bestLogoUrl {
    if (pwaLogoUrl != null &&
        pwaLogoUrl!.isNotEmpty &&
        pwaLogoUrl != '/logo512.png') {
      return pwaLogoUrl;
    }
    if (logoUrl != null && logoUrl!.isNotEmpty) return logoUrl;
    return (faviconUrl != null && faviconUrl!.isNotEmpty) ? faviconUrl : null;
  }

  bool get hasLogo => bestLogoUrl != null;

  int? get primaryColor => parseHexColor(primaryColorHex);
  int? get secondaryColor => parseHexColor(secondaryColorHex);

  /// Nothing usable to render, so fall back to generic chrome.
  bool get isEmpty => name.isEmpty && !hasLogo && primaryColor == null;

  factory SchoolBranding.fromJson(Map<String, dynamic> json) {
    // The endpoint wraps payloads in { success, data } on some deployments and
    // returns the object directly on others. Accept both.
    final body = (json['data'] is Map)
        ? (json['data'] as Map).cast<String, dynamic>()
        : json;

    return SchoolBranding(
      schoolId: body['id']?.toString(),
      name: body['name']?.toString() ?? '',
      motto: body['motto']?.toString() ?? '',
      logoUrl: body['logoUrl']?.toString(),
      pwaLogoUrl: body['pwaLogoUrl']?.toString(),
      faviconUrl: body['faviconUrl']?.toString(),
      primaryColorHex: (body['primaryColor'] ?? body['brandColor'])?.toString(),
      secondaryColorHex: body['secondaryColor']?.toString(),
      phone: body['phone']?.toString() ?? '',
      email: body['email']?.toString() ?? '',
      address: body['address']?.toString() ?? '',
    );
  }

  /// Serialised shape used by the on-device offline cache.
  Map<String, dynamic> toJson() => {
    'id': schoolId,
    'name': name,
    'motto': motto,
    'logoUrl': logoUrl,
    'pwaLogoUrl': pwaLogoUrl,
    'faviconUrl': faviconUrl,
    'primaryColor': primaryColorHex,
    'secondaryColor': secondaryColorHex,
    'phone': phone,
    'email': email,
    'address': address,
  };

  /// Neutral placeholder so a school without branding still renders.
  static const SchoolBranding empty = SchoolBranding();
}
