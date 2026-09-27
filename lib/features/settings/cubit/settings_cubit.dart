import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Navigation + filter state for the settings screen's drill-down.
/// [query] is the search text (top level only); [openSection] is the section
/// whose sub-page is showing, or null for the top-level category list.
class SettingsState extends Equatable {
  const SettingsState({this.query = '', this.openSection});

  final String query;
  final String? openSection;

  @override
  List<Object?> get props => [query, openSection];
}

class SettingsCubit extends Cubit<SettingsState> {
  SettingsCubit() : super(const SettingsState());

  /// Update the search text (stays at the top level).
  void setQuery(String q) =>
      emit(SettingsState(query: q, openSection: state.openSection));

  /// Drill into a section's sub-page.
  void open(String section) =>
      emit(SettingsState(query: state.query, openSection: section));

  /// Back out of a section to the top-level category list.
  void back() => emit(SettingsState(query: state.query));
}
