// source_availability_chip.dart
// Shows "N sources ready" (or "checking...") for a Z-mode episode,
// running probeEach automatically in the background on first render.
// Tapping it opens the full episode sources sheet.

import 'dart:async';

import 'package:flutter/material.dart';

import '../core/di/injector.dart';
import '../core/models/episode.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_text.dart';
import '../core/zmode/playback_resolver.dart';
import 'detail/episode_sources_sheet.dart';

class SourceAvailabilityChip extends StatefulWidget {
  const SourceAvailabilityChip({
    super.key,
    required this.episode,
    this.onSourcePicked,
  });

  /// The Z-mode episode to probe.
  final Episode episode;

  /// Called with the picked source so the caller can open the player.
  final void Function(SourceProbe picked)? onSourcePicked;

  @override
  State<SourceAvailabilityChip> createState() => _SourceAvailabilityChipState();
}

class _SourceAvailabilityChipState extends State<SourceAvailabilityChip> {
  StreamSubscription<SourceProbe>? _sub;
  final List<SourceProbe> _found = [];
  bool _done = false;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    // Start probe after first frame so it never competes with rendering.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _startProbe();
    });
  }

  void _startProbe() {
    if (_started) return;
    _started = true;
    final resolver = sl.isRegistered<PlaybackResolver>()
        ? sl<PlaybackResolver>()
        : null;
    if (resolver == null) {
      setState(() => _done = true);
      return;
    }
    final stream = resolver.probeEach(
      widget.episode.url,
      wallClock: const Duration(seconds: 15),
    );
    _sub = stream.listen(
      (probe) {
        if (!mounted) return;
        if (probe.hasEpisode && !probe.skipped && !probe.checking) {
          setState(() => _found.add(probe));
        }
      },
      onDone: () {
        if (mounted) setState(() => _done = true);
      },
      onError: (_) {
        if (mounted) setState(() => _done = true);
      },
    );
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final count = _found.length;
    final checking = !_done;

    final Color bg;
    final Color fg;
    final IconData icon;
    final String label;

    if (checking && count == 0) {
      bg = AppColors.surface;
      fg = AppColors.textSecondary;
      icon = Icons.sensors_rounded;
      label = 'Checking sources…';
    } else if (count == 0 && _done) {
      bg = AppColors.surface;
      fg = AppColors.textTertiary;
      icon = Icons.signal_wifi_off_rounded;
      label = 'No sources found';
    } else {
      bg = AppColors.accent.withOpacity(0.15);
      fg = AppColors.accent;
      icon = Icons.check_circle_outline_rounded;
      label = count == 1
          ? '1 source ready${checking ? '…' : ''}'
          : '$count sources ready${checking ? '…' : ''}';
    }

    return GestureDetector(
      onTap: count > 0 || _done
          ? () async {
              final picked = await showEpisodeSourcesSheet(
                context,
                episode: widget.episode,
              );
              if (picked != null) widget.onSourcePicked?.call(picked);
            }
          : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: count > 0 ? AppColors.accent.withOpacity(0.3) : AppColors.hairline,
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (checking && count == 0)
              SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  strokeWidth: 1.5,
                  color: AppColors.textSecondary,
                ),
              )
            else
              Icon(icon, size: 14, color: fg),
            const SizedBox(width: 6),
            Text(label, style: AppText.caption.copyWith(color: fg)),
          ],
        ),
      ),
    );
  }
}
