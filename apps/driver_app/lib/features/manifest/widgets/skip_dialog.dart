import 'package:flutter/material.dart';

import '../../../core/models/driver_models.dart';
import '../../../core/theme/app_theme.dart';

/// Outcome of the skip flow, so the caller can show the right message.
class SkipResult {
  const SkipResult({required this.learnerId, required this.reason, this.note});

  final String learnerId;
  final SkipReason reason;
  final String? note;
}

/// Asks the driver to confirm a learner was not collected, and why.
///
/// Two deliberate choices:
///
///  1. It is a bottom sheet, not an instant tap. A single mis-tap here tells a
///     parent their child was not collected, so the action must be deliberate.
///  2. It names the consequence in the confirm button ("Not collected - alert
///     parent") so nobody performs it without realising a parent is messaged.
Future<SkipResult?> showSkipSheet(
  BuildContext context,
  ManifestLearner learner,
) {
  return showModalBottomSheet<SkipResult>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _SkipSheet(learner: learner),
  );
}

class _SkipSheet extends StatefulWidget {
  const _SkipSheet({required this.learner});

  final ManifestLearner learner;

  @override
  State<_SkipSheet> createState() => _SkipSheetState();
}

class _SkipSheetState extends State<_SkipSheet> {
  SkipReason _reason = SkipReason.noAnswer;
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _submit() {
    Navigator.of(context).pop(
      SkipResult(
        learnerId: widget.learner.learnerId,
        reason: _reason,
        note: _note.text.trim().isEmpty ? null : _note.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final needsNote = _reason.requiresNote;
    final noteMissing = needsNote && _note.text.trim().isEmpty;

    return Padding(
      // Lift above the keyboard so the note field stays visible.
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Not collected',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 2),
          Text(
            widget.learner.name,
            style: TextStyle(
              fontSize: 13,
              color: Colors.black.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: 14),

          // The guardian will be messaged. Say so before they confirm.
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppTheme.warningSurface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.notifications_active_outlined,
                  size: 16,
                  color: AppTheme.warningText,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'The parent will be alerted that their child was not collected.',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.warningText,
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          for (final reason in SkipReason.values)
            RadioListTile<SkipReason>(
              value: reason,
              groupValue: _reason,
              onChanged: (v) => setState(() => _reason = v ?? _reason),
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(
                reason.label,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              secondary: Icon(reason.icon, size: 18),
            ),

          if (needsNote) ...[
            const SizedBox(height: 8),
            TextField(
              controller: _note,
              maxLines: 2,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                labelText: 'Note (required)',
                hintText: 'Briefly, what happened?',
              ),
            ),
          ],

          const SizedBox(height: 16),
          FilledButton(
            onPressed: noteMissing ? null : _submit,
            style: FilledButton.styleFrom(backgroundColor: AppTheme.danger),
            child: const Text('Not collected - alert parent'),
          ),
        ],
      ),
    );
  }
}
