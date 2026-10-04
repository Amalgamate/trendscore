import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/config/app_config.dart';
import 'core/data/auth_repository.dart';
import 'core/data/driver_repository.dart';
import 'core/data/school_connection_repository.dart';
import 'core/models/school_connection.dart';
import 'core/network/api_client.dart';
import 'core/storage/school_connection_store.dart';
import 'core/storage/token_store.dart';
import 'features/auth/school_code_screen.dart';
import 'features/auth/sign_in_screen.dart';
import 'features/home/driver_home_screen.dart';

void main() => runApp(const DriverApp());

class DriverApp extends StatefulWidget {
  const DriverApp({super.key});

  @override
  State<DriverApp> createState() => _DriverAppState();
}

class _DriverAppState extends State<DriverApp> {
  final _store = SchoolConnectionStore();
  late final SchoolConnectionRepository _connections =
      SchoolConnectionRepository(store: _store);
  SchoolConnection? _connection;
  String? _deviceId;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    var saved = await _store.active();
    if (saved != null) {
      try {
        saved = await _connections.resolve(saved.schoolCode);
      } catch (_) {
        // The validated cached connection and branding remain usable offline.
      }
    }
    final id = saved == null ? null : await _store.deviceId();
    if (!mounted) return;
    setState(() {
      _connection = saved;
      _deviceId = id;
      _loading = false;
    });
  }

  void _connected(SchoolConnection connection) async {
    final id = await _store.deviceId();
    if (!mounted) return;
    setState(() {
      _connection = connection;
      _deviceId = id;
    });
  }

  @override
  void dispose() {
    _connections.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const MaterialApp(
        home: Scaffold(body: Center(child: CircularProgressIndicator())),
      );
    }
    final connection = _connection;
    if (connection == null || _deviceId == null) {
      return MaterialApp(
        title: 'TrendsCORE Driver',
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF030B82)),
        ),
        home: SchoolCodeScreen(
          store: _store,
          repository: _connections,
          onConnected: _connected,
        ),
      );
    }

    final config = AppConfig.forConnection(connection);
    final tokenStore = TokenStore(schoolCode: connection.schoolCode);
    final api = ApiClient(
      connection: connection,
      tokenStore: tokenStore,
      deviceId: _deviceId!,
    );
    final brand = Color(config.primaryColorValue);
    return MultiProvider(
      key: ValueKey(connection.schoolCode),
      providers: [
        Provider<AppConfig>.value(value: config),
        Provider<SchoolConnection>.value(value: connection),
        Provider<SchoolConnectionRepository>.value(value: _connections),
        Provider<TokenStore>.value(value: tokenStore),
        Provider<ApiClient>(
          create: (_) => api,
          dispose: (_, client) => client.dispose(),
        ),
        Provider<AuthRepository>(
          create: (ctx) => AuthRepository(
            api: ctx.read<ApiClient>(),
            tokenStore: ctx.read<TokenStore>(),
          ),
        ),
        Provider<DriverRepository>(
          create: (ctx) => DriverRepository(api: ctx.read<ApiClient>()),
        ),
      ],
      child: MaterialApp(
        title: '${config.schoolName} Drivers',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(seedColor: brand),
          scaffoldBackgroundColor: const Color(0xFFF7F7FB),
          appBarTheme: AppBarTheme(
            backgroundColor: brand,
            foregroundColor: Colors.white,
            elevation: 0,
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
          ),
          filledButtonTheme: FilledButtonThemeData(
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              textStyle: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
        home: _RootGate(
          onSwitchSchool: () => setState(() => _connection = null),
        ),
      ),
    );
  }
}

class _RootGate extends StatefulWidget {
  const _RootGate({required this.onSwitchSchool});
  final VoidCallback onSwitchSchool;

  @override
  State<_RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<_RootGate> {
  Timer? _timer;
  bool _checking = true;
  bool _approved = false;
  bool _signedIn = false;
  bool _registered = false;
  bool _requestInFlight = false;
  String _status = 'PENDING';
  String? _error;

  @override
  void initState() {
    super.initState();
    _check();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _check());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<bool> _check() async {
    if (!mounted) {
      return false;
    }
    if (_requestInFlight) return _approved;
    _requestInFlight = true;
    try {
      final connection = context.read<SchoolConnection>();
      final repository = context.read<SchoolConnectionRepository>();
      final authRepository = context.read<AuthRepository>();
      if (!_registered) {
        await repository.ensureDeviceRegistered(connection);
        _registered = true;
      }
      final status = await repository.deviceStatus(connection);
      final hasSession =
          status == 'APPROVED' && await authRepository.hasSession();
      if (!mounted) {
        return false;
      }
      setState(() {
        _status = status;
        _approved = status == 'APPROVED';
        _signedIn = hasSession;
        _error = null;
        _checking = false;
      });
      return status == 'APPROVED';
    } catch (e) {
      if (!mounted) {
        return false;
      }
      setState(() {
        _error = e.toString();
        _checking = false;
      });
      return false;
    } finally {
      _requestInFlight = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_approved) {
      if (_signedIn) {
        return DriverHomeScreen(
          onSwitchSchool: widget.onSwitchSchool,
          onSignedOut: () => setState(() => _signedIn = false),
        );
      }
      return SignInScreen(
        onSignedIn: () => setState(() => _signedIn = true),
        onSwitchSchool: widget.onSwitchSchool,
        beforeSignIn: _check,
      );
    }
    final message =
        _error ??
        (_status == 'REVOKED'
            ? 'This phone’s approval was revoked. Contact your school.'
            : 'Waiting for your school to approve this phone.');
    return Scaffold(
      appBar: AppBar(
        title: const Text('Device approval'),
        actions: [
          IconButton(
            onPressed: widget.onSwitchSchool,
            icon: const Icon(Icons.swap_horiz),
            tooltip: 'Switch school',
          ),
        ],
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                _status == 'REVOKED'
                    ? Icons.phonelink_lock
                    : Icons.hourglass_top,
                size: 48,
              ),
              const SizedBox(height: 16),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _check,
                child: const Text('Check approval'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
