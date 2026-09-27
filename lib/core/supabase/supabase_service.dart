import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  SupabaseClient get client => Supabase.instance.client;

  /// The signed-in user's id, or null when signed out OR when Supabase isn't
  /// initialized yet (e.g. its boot init timed out on a dead network). Either
  /// way the stores treat it as local-only — never crashes on an uninitialized
  /// client (`Supabase.instance` asserts when init never ran).
  String? currentUserId() {
    try {
      return client.auth.currentUser?.id;
    } catch (_) {
      return null;
    }
  }

  /// Public URL for an avatar Storage object path (bucket public-read).
  String avatarUrl(String path) =>
      client.storage.from('avatars').getPublicUrl(path);
}
