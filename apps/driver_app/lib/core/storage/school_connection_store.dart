import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/school_connection.dart';

class SchoolConnectionStore {
  static const _activeKey = 'driver_active_school_v1';
  static const _connectionsKey = 'driver_school_connections_v1';
  static const _deviceIdKey = 'driver_device_id_v1';

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

  Future<void> save(SchoolConnection connection, {bool activate = true}) async {
    final prefs = await SharedPreferences.getInstance();
    final list = await all();
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

  Future<void> activate(String code) async {
    final found = (await all()).any((e) => e.schoolCode == code);
    if (!found) throw StateError('School connection not found.');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_activeKey, code);
  }

  Future<String> deviceId() async {
    const secure = FlutterSecureStorage();
    final existing = await secure.read(key: _deviceIdKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((e) => e.toRadixString(16).padLeft(2, '0')).join();
    final id =
        '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
    await secure.write(key: _deviceIdKey, value: id);
    return id;
  }
}
