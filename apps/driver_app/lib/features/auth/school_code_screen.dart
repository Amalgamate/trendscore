import 'package:flutter/material.dart';

import '../../core/data/school_connection_repository.dart';
import '../../core/error/api_exception.dart';
import '../../core/models/school_connection.dart';

class SchoolCodeScreen extends StatefulWidget {
  const SchoolCodeScreen({
    required this.repository,
    required this.onConnected,
    super.key,
  });

  final SchoolConnectionRepository repository;
  final ValueChanged<SchoolConnection> onConnected;

  @override
  State<SchoolCodeScreen> createState() => _SchoolCodeScreenState();
}

class _SchoolCodeScreenState extends State<SchoolCodeScreen> {
  final _code = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    final value = _code.text.trim();
    if (value.isEmpty || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final connection = await widget.repository.resolve(value);
      if (mounted) widget.onConnected(connection);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.directions_bus_rounded, size: 56),
                const SizedBox(height: 16),
                const Text(
                  'Connect your school',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 23, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Enter the school code provided by your school. This app can connect to one school only.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: _code,
                  textCapitalization: TextCapitalization.none,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    labelText: 'School code',
                    prefixIcon: Icon(Icons.school_outlined),
                  ),
                  onSubmitted: (_) => _connect(),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _busy ? null : _connect,
                  child: _busy
                      ? const CircularProgressIndicator()
                      : const Text('Connect'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
