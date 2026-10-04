import 'widgets/skip_dialog.dart';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/data/driver_repository.dart';
import '../../core/error/api_exception.dart';
import '../../core/models/driver_models.dart';
import 'widgets/manifest_widgets.dart';

/// Boarding manifest for one trip.
///
/// Where a driver spends their day, so the layout optimises for one thumb,
/// bright sunlight and a crowded bus: large rows, high-contrast status, and a
/// guardian call button within reach.
class ManifestScreen extends StatefulWidget {
  const ManifestScreen({required this.trip, super.key});

  final DriverTrip trip;

  @override
  State<ManifestScreen> createState() => _ManifestScreenState();
}

class _ManifestScreenState extends State<ManifestScreen> {
  TripManifest? _manifest;
  bool _loading = true;
  String? _error;

  /// learnerId currently being submitted — the row shows a spinner without
  /// blocking the whole list.
  final Set<String> _busy = {};

  bool get _isEvening => widget.trip.isEvening;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final manifest = await context.read<DriverRepository>().fetchManifest(
        widget.trip.id,
      );
      if (!mounted) return;
      setState(() {
        _manifest = manifest;
        _error = null;
      });
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

  /// Record boarding (morning run) or alighting (afternoon run).
  ///
  /// One-way on purpose. The backend has no un-record endpoint and every event
  /// notifies the learner's guardian, so a mistaken tap needs the school office
  /// to correct rather than a silent undo.
  Future<void> _record(ManifestLearner learner) async {
    final target = _isEvening
        ? BoardingStatus.alighted
        : BoardingStatus.boarded;
    if (learner.boardingStatus == target) return;
    if (!widget.trip.isOpen) return;

    setState(() => _busy.add(learner.learnerId));

    try {
      await context.read<DriverRepository>().recordBoarding(
        tripId: widget.trip.id,
        learnerId: learner.learnerId,
        eventType: target == BoardingStatus.boarded ? 'BOARDED' : 'ALIGHTED',
      );
      if (!mounted) return;
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: const Color(0xFFB91C1C),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _busy.remove(learner.learnerId));
    }
  }

  /// Confirm the learner was not collected.
  ///
  /// Reached by long-pressing a row, not by tapping: a single mis-tap here tells
  /// a parent their child was not collected, so it must be deliberate. The
  /// reason sheet is shown first and the backend rejects the whole thing if the
  /// learner turns out to have boarded.
  Future<void> _openSkipSheet(ManifestLearner learner) async {
    if (!widget.trip.isOpen) return;

    final result = await showSkipSheet(context, learner);
    if (result == null || !mounted) return;

    setState(() => _busy.add(learner.learnerId));

    try {
      final notified = await context.read<DriverRepository>().recordSkip(
        tripId: widget.trip.id,
        learnerId: result.learnerId,
        reason: result.reason,
        note: result.note,
      );

      if (!mounted) return;
      await _load();

      if (!mounted) return;
      // The record saved either way. Only the alert can fail, and the driver
      // must know, because they are the only person at the roadside who can
      // chase it right now.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            notified
                ? '${learner.name} marked not collected. Parent alerted.'
                : '${learner.name} marked not collected, but the parent was NOT '
                      'reached. Please call the office.',
          ),
          backgroundColor: notified ? null : const Color(0xFFB91C1C),
          duration: Duration(seconds: notified ? 3 : 7),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: const Color(0xFFB91C1C),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _busy.remove(learner.learnerId));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.trip.routeName,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            Text(
              '${widget.trip.directionLabel} · ${widget.trip.status}',
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
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading && _manifest == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final manifest = _manifest;
    if (manifest == null) {
      return _ErrorRetry(
        message: _error ?? 'Could not load the manifest.',
        onRetry: _load,
      );
    }

    if (manifest.learners.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'No learners are assigned to this route yet.',
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return Column(
      children: [
        SummaryBar(manifest: manifest, isEvening: _isEvening),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 32),
              itemCount: manifest.learners.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final learner = manifest.learners[index];
                return LearnerRow(
                  learner: learner,
                  isEvening: _isEvening,
                  busy: _busy.contains(learner.learnerId),
                  onRecord: () => _record(learner),
                  onSkip: () => _openSkipSheet(learner),
                  onCall: () => callGuardian(context, learner.phone!),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _ErrorRetry extends StatelessWidget {
  const _ErrorRetry({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              size: 40,
              color: Colors.black26,
            ),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: Colors.black.withValues(alpha: 0.6),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.tonal(
              onPressed: onRetry,
              child: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}
