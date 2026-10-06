import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/school_connection.dart';

class SchoolConnectionStore {
  static const _activeKey = 'driver_active_school_v1';
  static const _connectionsKey = 'driver_school_connections_v1';
  static const _deviceIdKey = 'driver_device_id_v1';
  static const _identityChannel = MethodChannel(
    'co.trendscore.driver/device_identity',
  );

  Future<List<SchoolConnection>> all() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_connectionsKey);
    if (raw == null) return const [];
    try {
      final list = jsonDecode(raw) as List;
      return list
          .whereType<Map>()
          .map((e) => SchoolConnection.fromJson(e.cast<String, dynamic>()))
          .toList();
    } catch (_) {
      return const [];
    }
  }

  Future<SchoolConnection?> active() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(_activeKey);
    if (code == null) return null;
    for (final item in await all()) {
      if (item.schoolCode == code) return item;
    }
    return null;
  }

  Future<String?> lockedSchoolCode() async {
    final prefs = await SharedPreferences.getInstance();
    final activeCode = prefs.getString(_activeKey);
    if (activeCode != null) return activeCode;
    final saved = await all();
    return saved.isEmpty ? null : saved.first.schoolCode;
  }

  Future<void> save(SchoolConnection connection, {bool activate = true}) async {
    final prefs = await SharedPreferences.getInstance();
    final list = await all();
    final activeCode = prefs.getString(_activeKey);
    final lockedCode = activeCode ?? (list.isEmpty ? null : list.first.schoolCode);
    if (lockedCode != null && lockedCode != connection.schoolCode) {
      throw StateError(
        'This app is connected to $lockedCode and cannot connect to another school.',
      );
    }
    final updated = [
      for (final item in list)
        if (item.schoolCode != connection.schoolCode) item,
      connection,
    ];
    await prefs.setString(
      _connectionsKey,
      jsonEncode(updated.map((e) => e.toJson()).toList()),
    );
    if (activate) await prefs.setString(_activeKey, connection.schoolCode);
  }

  /// Cleans up older multi-school state and permanently keeps the active
  /// connection as this installation's one school.
  Future<void> retainSingleSchool() async {
    final prefs = await SharedPreferences.getInstance();
    final list = await all();
    if (list.isEmpty) return;
    final activeCode = prefs.getString(_activeKey);
    final retained = list.firstWhere(
      (item) => item.schoolCode == activeCode,
      orElse: () => list.first,
    );
    await prefs.setString(_activeKey, retained.schoolCode);
    await prefs.setString(_connectionsKey, jsonEncode([retained.toJson()]));
  }

  Future<String> deviceId() async {
    const secure = FlutterSecureStorage();
    final existing = await secure.read(key: _deviceIdKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final stableId = await _identityChannel.invokeMethod<String>(
      'deviceScopedId',
    );
    if (stableId == null || !RegExp(r'^[a-f0-9]{64}$').hasMatch(stableId)) {
      throw StateError('Could not read this Android installation’s device id.');
    }
    final id = 'android-$stableId';
    await secure.write(key: _deviceIdKey, value: id);
    return id;
  }
}
