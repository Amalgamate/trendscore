import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/models/driver_models.dart';
import '../../../core/theme/app_theme.dart';

/// Sticky boarding progress across the top of the manifest.
class SummaryBar extends StatelessWidget {
  const SummaryBar({
    required this.manifest,
    required this.isEvening,
    super.key,
  });

  final TripManifest manifest;
  final bool isEvening;

  @override
  Widget build(BuildContext context) {
    final recorded = isEvening ? manifest.alighted : manifest.boarded;
    final verb = isEvening ? 'Alighted' : 'On board';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      color: AppTheme.brandFor(context),
      child: Row(
        children: [
          _Metric(value: recorded, label: verb),
          const _Rule(),
          _Metric(value: manifest.pending, label: 'Pending'),
          const _Rule(),
          _Metric(value: manifest.totalAssigned, label: 'Total'),
        ],
      ),
    );
  }
}

class _Rule extends StatelessWidget {
  const _Rule();

  @override
  Widget build(BuildContext context) => Container(
    width: 1,
    height: 30,
    margin: const EdgeInsets.symmetric(horizontal: 12),
    color: Colors.white24,
  );
}

class _Metric extends StatelessWidget {
  const _Metric({required this.value, required this.label});

  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            '$value',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            label,
            style: const TextStyle(color: Colors.white70, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

/// One learner on the manifest.
///
/// The whole row is the tap target - drivers do this dozens of times per run,
/// one-handed, often holding a bag. The call button sits at the leading edge,
/// within thumb reach.
class LearnerRow extends StatelessWidget {
  const LearnerRow({
    required this.learner,
    required this.isEvening,
    required this.busy,
    required this.onRecord,
    required this.onSkip,
    required this.onCall,
    super.key,
  });

  final ManifestLearner learner;
  final bool isEvening;
  final bool busy;
  final VoidCallback onRecord;
  final VoidCallback onSkip;
  final VoidCallback onCall;

  @override
  Widget build(BuildContext context) {
    final target = isEvening ? BoardingStatus.alighted : BoardingStatus.boarded;
    final done = learner.boardingStatus == target;

    return Material(
      color: done ? AppTheme.successSurface : Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: busy ? null : onRecord,
        // Long-press, not tap: a single mis-tap would tell a parent their child was not collected.
        onLongPress: busy ? null : onSkip,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          constraints: const BoxConstraints(minHeight: 72),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: done
                  ? AppTheme.successBorder
                  : Colors.black.withValues(alpha: 0.07),
            ),
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: learner.hasContact ? onCall : null,
                icon: Icon(
                  Icons.call_rounded,
                  size: 20,
                  color: learner.hasContact
                      ? AppTheme.successText
                      : Colors.black.withValues(alpha: 0.2),
                ),
                tooltip: learner.hasContact
                    ? 'Call guardian'
                    : 'No guardian number on file',
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      learner.name,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        if (learner.grade != null) learner.grade!,
                        if (learner.pickupPoint != null) learner.pickupPoint!,
                      ].join(' - '),
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.black.withValues(alpha: 0.5),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (busy)
                const SizedBox(
                  height: 22,
                  width: 22,
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                )
              else
                Icon(
                  done
                      ? Icons.check_circle_rounded
                      : Icons.radio_button_unchecked_rounded,
                  size: 30,
                  color: done ? AppTheme.success : Colors.black26,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Open the system dialler pre-filled with the guardian's number.
///
/// Hands off to the OS dialler rather than placing the call: that needs no
/// runtime permission, and it keeps the final press in the driver's hands.
Future<void> callGuardian(BuildContext context, String phone) async {
  try {
    final launched = await launchUrl(Uri(scheme: 'tel', path: phone));
    if (!launched && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No phone app available for $phone')),
      );
    }
  } catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Could not open the phone app.')),
    );
  }
}
