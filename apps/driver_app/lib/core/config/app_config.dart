import '../models/school_connection.dart';

/// Build time values are limited to app metadata; school identity is runtime data.
class AppConfig {
  const AppConfig({
    required this.schoolCode,
    required this.schoolName,
    required this.apiBaseUrl,
    required this.primaryColorValue,
    required this.version,
    required this.buildNumber,
  });

  factory AppConfig.forConnection(SchoolConnection connection) => AppConfig(
    schoolCode: connection.schoolCode,
    schoolName: connection.branding.name.isEmpty
        ? 'TrendsCORE Transport'
        : connection.branding.name,
    apiBaseUrl: connection.apiOrigin,
    primaryColorValue: connection.branding.primaryColor ?? 0xFF030B82,
    version: const String.fromEnvironment('APP_VERSION', defaultValue: '1.0.6'),
    buildNumber: const String.fromEnvironment('APP_BUILD', defaultValue: '7'),
  );

  final String schoolCode;
  final String schoolName;
  final String apiBaseUrl;
  final int primaryColorValue;
  final String version;
  final String buildNumber;

  String get displayVersion => '$version ($buildNumber)';
}
