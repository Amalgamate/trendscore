import 'package:flutter/material.dart';

import '../../../core/models/driver_models.dart';
import '../../../core/theme/app_theme.dart';

/// The vehicle a driver is assigned to, with its routes.
class VehicleCard extends StatelessWidget {
  const VehicleCard({required this.vehicle, super.key});

  final DriverVehicle vehicle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          Container(
            height: 46,
            width: 46,
            decoration: BoxDecoration(
              color: AppTheme.tintedSurface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.airport_shuttle,
              color: AppTheme.brandFor(context),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  vehicle.registrationNumber,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  vehicle.routes.isEmpty
                      ? 'No route assigned yet'
                      : vehicle.routes.map((r) => r.name).join(' · '),
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.black.withValues(alpha: 0.55),
                  ),
                ),
              ],
            ),
          ),
          Text(
            '${vehicle.capacity} seats',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.black.withValues(alpha: 0.45),
            ),
          ),
        ],
      ),
    );
  }
}

/// Coloured status chip: Scheduled / Running / Done / Cancelled.
class StatusPill extends StatelessWidget {
  const StatusPill({required this.status, super.key});

  final String status;

  @override
  Widget build(BuildContext context) {
    late final Color bg;
    late final Color fg;
    late final String label;

    switch (status) {
      case 'IN_PROGRESS':
        bg = AppTheme.successSurface;
        fg = AppTheme.successText;
        label = 'Running';
      case 'COMPLETED':
        bg = AppTheme.neutralSurface;
        fg = AppTheme.neutralText;
        label = 'Done';
      case 'CANCELLED':
        bg = AppTheme.dangerSurface;
        fg = const Color(0xFF991B1B);
        label = 'Cancelled';
      default:
        bg = AppTheme.warningSurface;
        fg = AppTheme.warningText;
        label = 'Scheduled';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: fg),
      ),
    );
  }
}

class TripCount extends StatelessWidget {
  const TripCount({
    required this.label,
    required this.value,
    this.highlight = false,
    super.key,
  });

  final String label;
  final int value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$value',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: highlight ? AppTheme.successText : Colors.black87,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: Colors.black.withValues(alpha: 0.45),
          ),
        ),
      ],
    );
  }
}

/// A single trip card. Shows boarding progress at a glance.
class TripCard extends StatelessWidget {
  const TripCard({required this.trip, required this.onTap, super.key});

  final DriverTrip trip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final done = !trip.isOpen;
    final progress = trip.totalAssigned == 0
        ? 0.0
        : (trip.boarded / trip.totalAssigned).clamp(0.0, 1.0);

    return Opacity(
      opacity: done ? 0.6 : 1,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _header(),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 6,
                    backgroundColor: AppTheme.tintedSurface,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      AppTheme.brandFor(context),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                _footer(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Row(
      children: [
        Icon(
          trip.isMorning ? Icons.wb_sunny_outlined : Icons.nightlight_outlined,
          size: 18,
          color: trip.isMorning
              ? const Color(0xFFD97706)
              : const Color(0xFF4338CA),
        ),
        const SizedBox(width: 8),
        Text(
          trip.directionLabel,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            trip.routeName,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 13,
              color: Colors.black.withValues(alpha: 0.55),
            ),
          ),
        ),
        StatusPill(status: trip.status),
      ],
    );
  }

  Widget _footer() {
    return Row(
      children: [
        TripCount(label: 'Assigned', value: trip.totalAssigned),
        const SizedBox(width: 18),
        TripCount(label: 'On board', value: trip.boarded, highlight: true),
        const SizedBox(width: 18),
        TripCount(label: 'Pending', value: trip.pending),
        const Spacer(),
        if (!trip.assignedToMe)
          Tooltip(
            message: 'Matched via your vehicle, not assigned by name',
            child: Icon(
              Icons.info_outline,
              size: 15,
              color: Colors.black.withValues(alpha: 0.35),
            ),
          ),
        const Icon(Icons.chevron_right, color: Colors.black26),
      ],
    );
  }
}

/// Shown when the school has not scheduled any runs today.
class NoTripsCard extends StatelessWidget {
  const NoTripsCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
      ),
      child: const Column(
        children: [
          Icon(Icons.beach_access_outlined, size: 30, color: Colors.black26),
          SizedBox(height: 10),
          Text(
            'No runs scheduled today',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          SizedBox(height: 4),
          Text(
            'Runs appear here once the school creates them.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Colors.black54),
          ),
        ],
      ),
    );
  }
}

/// Full-screen empty / error panel.
class MessageState extends StatelessWidget {
  const MessageState({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
    super.key,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 24),
        Icon(icon, size: 44, color: Colors.black26),
        const SizedBox(height: 14),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        Text(
          message,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 13,
            color: Colors.black.withValues(alpha: 0.6),
          ),
        ),
        const SizedBox(height: 20),
        FilledButton.tonal(onPressed: onAction, child: Text(actionLabel)),
      ],
    );
  }
}
