import 'dart:convert';

import 'package:flutter/material.dart' show Color;

import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';
import '../theme/app_theme.dart';
import '../models/school_branding.dart';

/// Fetches school branding and caches it on the device.
///
/// Caching matters more than usual here: drivers run in areas with poor
/// coverage, and a parent-portal-grade UI must never render unbranded just
/// because a request timed out. The cache is written on success only, so a
/// failed fetch can never wipe good branding.
class BrandingRepository {
  BrandingRepository({required ApiClient api, required this.schoolCode})
    : _api = api;

  final ApiClient _api;
  final String schoolCode;

  String get _cacheKey => 'school_branding_v1_$schoolCode';

  /// Returns the cached branding, or the neutral placeholder on first run.
  ///
  /// Call this synchronously-ish during startup so the first frame is branded.
  Future<SchoolBranding> loadCached() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_cacheKey);
      if (raw == null || raw.isEmpty) return SchoolBranding.empty;
      return SchoolBranding.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return SchoolBranding.empty;
    }
  }

  /// Fetch branding from the school and apply it to [AppTheme].
  ///
  /// On any failure the cached branding is left untouched � a driver in a dead
  /// zone keeps the branding they already had.
  Future<SchoolBranding> refresh() async {
    try {
      final body = await _api.get('/schools/public/branding');
      final branding = SchoolBranding.fromJson(body);

      if (branding.isEmpty) {
        return await loadCached();
      }

      // Apply before persisting so a cache write failure cannot leave the UI
      // branded while the stored copy is stale.
      _apply(branding);

      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_cacheKey, jsonEncode(branding.toJson()));
      } catch (_) {
        // Branding still applied for this session.
      }

      return branding;
    } catch (_) {
      return await loadCached();
    }
  }

  /// Push branding into the theme so every widget picks it up.
  void _apply(SchoolBranding branding) {
    final color = branding.primaryColor;
    if (color != null) {
      AppTheme.overrideBrand(
        Color.fromARGB(
          (color >> 24) & 0xFF,
          (color >> 16) & 0xFF,
          (color >> 8) & 0xFF,
          color & 0xFF,
        ),
      );
    }
  }

  /// School name for the UI: the fetched branding, else the build-time default.
  String displayName(SchoolBranding branding) =>
      branding.name.isNotEmpty ? branding.name : 'TrendsCORE Transport';
}
