import 'dart:convert';

import 'package:http/http.dart' as http;

import '../error/api_exception.dart';
import '../models/school_connection.dart';
import '../storage/school_connection_store.dart';

/// Resolves school codes against the school's API and handles device approval.
class SchoolConnectionRepository {
  SchoolConnectionRepository({
    required SchoolConnectionStore store,
    http.Client? client,
  }) : _store = store,
       _http = client ?? http.Client();

  final SchoolConnectionStore _store;
  final http.Client _http;

  Future<SchoolConnection> resolve(String code) async {
    final normalized = code.trim().toLowerCase();
    if (!RegExp(r'^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])$')
        .hasMatch(normalized)) {
      throw const ApiException(
        statusCode: 400,
        message: 'That is not a valid school code.',
      );
    }

    final lockedCode = await _store.lockedSchoolCode();
    if (lockedCode != null && lockedCode != normalized) {
      throw ApiException(
        statusCode: 409,
        message: 'This app is connected to $lockedCode. It can connect to only one school.',
      );
    }

    // School API origins are independently hosted. The apex website redirects
    // POSTs to www (307), where the API route does not exist. Contact the
    // school subdomain directly; the resolver still validates the code and
    // returns the authoritative origin, which SchoolConnection validates.
    final resolverUri = Uri.https(
      '$normalized.trendscore.co.ke',
      '/api/driver-connection/resolve',
    );
    try {
      final response = await _http
          .post(
            resolverUri,
            headers: const {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({'code': normalized}),
          )
          .timeout(const Duration(seconds: 20));
      final body = _decode(response);
      final data = body['data'];
      if (data is! Map) {
        throw const FormatException('Unexpected resolver response.');
      }
      final connection = SchoolConnection.fromResolvedJson(
        data.cast<String, dynamic>(),
      );
      if (connection.schoolCode != normalized) {
        throw const FormatException(
          'Resolver returned a different school code.',
        );
      }
      await _store.save(connection);
      return connection;
    } on ApiException catch (e) {
      if (e.statusCode == 400) {
        throw const ApiException(
          statusCode: 400,
          message: 'That is not a valid school code.',
        );
      }
      if (e.statusCode == 404) {
        throw const ApiException(
          statusCode: 404,
          message: 'No school found for that code.',
        );
      }
      rethrow;
    }
  }

  Future<String> ensureDeviceRegistered(SchoolConnection connection) async {
    final id = await _store.deviceId();
    final response = await _http
        .post(
          Uri.parse(
            '${connection.apiOrigin}/driver-connection/devices/register',
          ),
          headers: const {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'code': connection.schoolCode,
            'deviceId': id,
            'label': 'Android driver phone · ${id.substring(id.length - 6).toUpperCase()}',
          }),
        )
        .timeout(const Duration(seconds: 20));
    _decode(response);
    return id;
  }

  Future<({String status, bool registered})> deviceStatus(
    SchoolConnection connection,
  ) async {
    final id = await _store.deviceId();
    final uri = Uri.parse(
      '${connection.apiOrigin}/driver-connection/devices/status',
    ).replace(queryParameters: {'code': connection.schoolCode, 'deviceId': id});
    final body = _decode(
      await _http
          .get(uri, headers: const {'Accept': 'application/json'})
          .timeout(const Duration(seconds: 20)),
    );
    final data = body['data'];
    final status = data is Map ? data['status']?.toString() : null;
    if (!const {'PENDING', 'APPROVED', 'REVOKED'}.contains(status)) {
      throw const FormatException('Unexpected device approval status.');
    }
    final validatedStatus = status!;
    await _store.save(connection.withStatus(validatedStatus));
    return (
      status: validatedStatus,
      registered: data is Map ? data['registered'] != false : true,
    );
  }

  Map<String, dynamic> _decode(http.Response response) {
    Map<String, dynamic> body;
    try {
      body = (jsonDecode(response.body) as Map).cast<String, dynamic>();
    } catch (_) {
      throw ApiException(
        statusCode: response.statusCode,
        message: 'Unexpected response from the server.',
      );
    }
    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        body['success'] != false) {
      return body;
    }
    throw ApiException(
      statusCode: response.statusCode,
      message:
          body['message']?.toString() ??
          'Request failed (${response.statusCode}).',
      code: body['code']?.toString(),
    );
  }

  void dispose() => _http.close();
}
