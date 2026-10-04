import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/config/app_config.dart';
import '../../core/data/auth_repository.dart';
import '../../core/data/driver_repository.dart';
import '../../core/error/api_exception.dart';
import '../../core/models/driver_models.dart';
import '../manifest/manifest_screen.dart';
import 'widgets/home_widgets.dart';

/// The driver's home screen: assigned vehicle and today's runs.
///
/// Backed by a single call, `GET /api/v1/driver/today`, which the server scopes
/// to the signed-in driver.
class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({
    required this.onSwitchSchool,
    required this.onSignedOut,
    super.key,
  });

  final VoidCallback onSwitchSchool;
  final VoidCallback onSignedOut;

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen> {
  DriverDay? _day;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final day = await context.read<DriverRepository>().fetchToday();
      if (!mounted) return;
      setState(() => _day = day);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signOut() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text(
          'You will need your school email and password to sign back in.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;
    await context.read<AuthRepository>().signOut();
    if (!mounted) return;
    widget.onSignedOut();
  }

  Future<void> _openManifest(DriverTrip trip) async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => ManifestScreen(trip: trip)));
    // Boarding may have changed while the manifest was open.
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    final config = context.read<AppConfig>();

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Today',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            Text(
              config.schoolName,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w400),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
          ),
          IconButton(
            onPressed: _signOut,
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
          ),
          IconButton(
            onPressed: widget.onSwitchSchool,
            icon: const Icon(Icons.swap_horiz),
            tooltip: 'Switch school',
          ),
        ],
      ),
      body: RefreshIndicator(onRefresh: _load, child: _buildBody(config)),
    );
  }

  Widget _buildBody(AppConfig config) {
    if (_loading && _day == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _day == null) {
      return MessageState(
        icon: Icons.cloud_off_rounded,
        title: 'Cannot load your runs',
        message: _error!,
        actionLabel: 'Try again',
        onAction: _load,
      );
    }

    final day = _day;
    if (day == null) return const SizedBox.shrink();

    // No vehicle assigned is a normal onboarding state, not an error.
    if (!day.hasVehicle) {
      return MessageState(
        icon: Icons.no_transfer_outlined,
        title: 'No vehicle assigned yet',
        message:
            'Ask the ${config.schoolName} office to link your driver '
            'account to your vehicle. Once they do, your routes appear here '
            'automatically.',
        actionLabel: 'Check again',
        onAction: _load,
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        VehicleCard(vehicle: day.vehicle!),
        const SizedBox(height: 20),
        Text(
          "Today's runs",
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.4,
            color: Colors.black.withValues(alpha: 0.55),
          ),
        ),
        const SizedBox(height: 10),
        if (!day.hasTrips)
          const NoTripsCard()
        else
          ...day.trips.map(
            (trip) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TripCard(trip: trip, onTap: () => _openManifest(trip)),
            ),
          ),
      ],
    );
  }
}
