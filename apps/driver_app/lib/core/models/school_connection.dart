import 'school_branding.dart';

/// A school origin accepted only from the resolver response or its validated cache.
class SchoolConnection {
  const SchoolConnection({
    required this.schoolCode,
    required this.schoolId,
    required this.apiOrigin,
    required this.branding,
    this.approvedStatus = 'PENDING',
  });

  final String schoolCode;
  final String schoolId;
  final String apiOrigin;
  final SchoolBranding branding;
  final String approvedStatus;

  static Uri validateOrigin(String code, String value) {
    final normalized = code.trim().toLowerCase();
    if (!RegExp(r'^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])$').hasMatch(normalized)) {
      throw const FormatException('Invalid school code.');
    }
    final uri = Uri.tryParse(value);
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host != '$normalized.trendscore.co.ke' ||
        uri.path != '/api' ||
        uri.userInfo.isNotEmpty ||
        uri.hasPort ||
        uri.hasQuery ||
        uri.hasFragment) {
      throw const FormatException(
        'The school server returned an invalid origin.',
      );
    }
    return uri;
  }

  factory SchoolConnection.fromResolvedJson(Map<String, dynamic> json) {
    final code = json['schoolCode']?.toString().trim().toLowerCase() ?? '';
    final origin = json['apiOrigin']?.toString() ?? '';
    validateOrigin(code, origin);
    final rawBrand = json['branding'];
    final brand = rawBrand is Map
        ? rawBrand.cast<String, dynamic>()
        : const <String, dynamic>{};
    return SchoolConnection(
      schoolCode: code,
      schoolId: json['schoolId']?.toString() ?? '',
      apiOrigin: origin,
      branding: SchoolBranding.fromJson({
        'id': json['schoolId'],
        'name': brand['displayName'],
        'motto': brand['motto'],
        'logoUrl': brand['logoUrl'],
        'primaryColor': brand['brandColorHex'],
      }),
    );
  }

  factory SchoolConnection.fromJson(Map<String, dynamic> json) {
    final connection = SchoolConnection.fromResolvedJson(json);
    return SchoolConnection(
      schoolCode: connection.schoolCode,
      schoolId: connection.schoolId,
      apiOrigin: connection.apiOrigin,
      branding: connection.branding,
      approvedStatus: json['approvedStatus']?.toString() ?? 'PENDING',
    );
  }

  Map<String, dynamic> toJson() => {
    'schoolCode': schoolCode,
    'schoolId': schoolId,
    'apiOrigin': apiOrigin,
    'branding': {
      'displayName': branding.name,
      'motto': branding.motto,
      'logoUrl': branding.logoUrl,
      'brandColorHex': branding.primaryColorHex,
    },
    'approvedStatus': approvedStatus,
  };

  SchoolConnection withStatus(String status) => SchoolConnection(
    schoolCode: schoolCode,
    schoolId: schoolId,
    apiOrigin: apiOrigin,
    branding: branding,
    approvedStatus: status,
  );
}
