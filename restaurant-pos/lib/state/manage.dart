import 'dart:async';
import 'dart:io';

import '../core/api.dart';
import '../core/models.dart';
import 'pos_state.dart';

/// Setting up the restaurant from the till, for restaurants that don't use the admin site:
/// menu (categories, dishes, options), tables, staff and printers. The cloud stays the one
/// copy of these, so changes need the internet. Each call writes through the same admin
/// endpoints the website uses, then pulls the change back into the till's own copy.
///
/// Updates start from the cloud's current record so fields the till doesn't show (photos,
/// allergens, descriptions used by the website) are kept as they are.
extension Manage on PosState {
  CloudApi get _api => sync?.api ?? (throw const PosError('The till is not connected to the cloud.'));

  Future<T> _write<T>(Future<T> Function(CloudApi api) body) async {
    final T result;
    try {
      result = await body(_api);
    } on ApiException catch (e) {
      throw PosError(e.message);
    } on SocketException {
      throw const PosError('Changes to the menu, tables, staff and printers need the internet. Try again once it is back.');
    } on TimeoutException {
      throw const PosError('The cloud is not answering. Try again in a minute.');
    }
    await sync?.syncNow();
    return result;
  }

  Future<Map<String, dynamic>> _find(CloudApi api, String listPath, String id) async {
    final rows = (await api.get(listPath) as List).cast<Map<String, dynamic>>();
    return rows.where((r) => r['id'] == id).firstOrNull ?? (throw const PosError('It was removed on another device. The list will refresh.'));
  }

  // ---- categories -----------------------------------------------------------------

  Future<void> saveCategory({String? id, required String name, required bool isActive, required String printRoute}) =>
      _write((api) async {
        if (name.trim().isEmpty) throw const PosError('Give the category a name.');
        final Map<String, dynamic> saved;
        if (id == null) {
          saved = await api.post('/api/admin/menu-categories', {
            'name': name.trim(), 'description': null, 'imageUrl': null, 'displayOrder': catalog.categories.length, 'isActive': isActive,
          });
        } else {
          final current = await _find(api, '/api/admin/menu-categories', id);
          saved = await api.put('/api/admin/menu-categories/$id', {...current, 'name': name.trim(), 'isActive': isActive});
        }
        await api.put('/api/admin/menu-categories/${saved['id']}/print-route', {'printRoute': printRoute});
      });

  Future<void> deleteCategory(String id) => _write((api) => api.delete('/api/admin/menu-categories/$id'));

  Future<void> reorderCategories(List<String> ids) => _write((api) => api.put('/api/admin/menu-categories/reorder', {'orderedIds': ids}));

  // ---- dishes -----------------------------------------------------------------------

  Future<void> saveItem({
    String? id,
    required String categoryId,
    required String name,
    required int pricePence,
    String? description,
    required bool isAvailable,
    String? printRouteOverride,
  }) =>
      _write((api) async {
        if (name.trim().isEmpty) throw const PosError('Give the dish a name.');
        if (pricePence < 0) throw const PosError('The price can’t be negative.');
        final fields = {
          'categoryId': categoryId, 'name': name.trim(), 'description': (description?.trim().isEmpty ?? true) ? null : description!.trim(),
          'basePrice': fromPence(pricePence), 'isAvailable': isAvailable,
        };
        final Map<String, dynamic> saved;
        if (id == null) {
          saved = await api.post('/api/admin/menu-items', {
            ...fields, 'imageUrl': null, 'isVegetarian': false, 'isVegan': false, 'isBestSeller': false, 'spiceLevel': 'None',
            'displayOrder': catalog.itemsIn(categoryId).length, 'preparationTimeMinutes': 15,
          });
        } else {
          final old = catalog.item(id);
          final current = await _find(api, '/api/admin/menu-items?categoryId=${old?.categoryId ?? categoryId}', id);
          saved = await api.put('/api/admin/menu-items/$id', {...current, ...fields});
        }
        await api.put('/api/admin/menu-items/${saved['id']}/print-route', {'printRouteOverride': printRouteOverride});
      });

  /// "86" a dish (sold out) or bring it back, without opening the editor.
  Future<void> setAvailable(MenuItem item, bool available) => _write((api) async {
        final current = await _find(api, '/api/admin/menu-items?categoryId=${item.categoryId}', item.id);
        await api.put('/api/admin/menu-items/${item.id}', {...current, 'isAvailable': available});
      });

  Future<void> deleteItem(String id) => _write((api) => api.delete('/api/admin/menu-items/$id'));

  // ---- options (modifier groups) ------------------------------------------------------

  /// [options]: {id?, name, priceDelta (pounds), isDefault, isAvailable}. Options left out are removed.
  Future<void> saveModifierGroup({
    required String itemId,
    String? groupId,
    required String name,
    required int minSelect,
    required int maxSelect,
    required bool isRequired,
    required List<Map<String, dynamic>> options,
  }) =>
      _write((api) async {
        if (name.trim().isEmpty) throw const PosError('Give the option group a name.');
        if (options.isEmpty) throw const PosError('Add at least one choice.');
        if (maxSelect < 1 || minSelect < 0 || minSelect > maxSelect) throw const PosError('Check the minimum and maximum picks.');
        if (minSelect > options.length) throw const PosError('The minimum is more than the number of choices.');
        var groupType = 'Modifier';
        if (groupId != null) {
          final current = await _find(api, '/api/admin/menu-items/$itemId/modifier-groups', groupId);
          groupType = current['groupType'] ?? groupType;
        }
        final body = {
          'name': name.trim(), 'minSelect': minSelect, 'maxSelect': maxSelect, 'isRequired': isRequired, 'groupType': groupType,
          'options': options,
        };
        groupId == null
            ? await api.post('/api/admin/menu-items/$itemId/modifier-groups', body)
            : await api.put('/api/admin/modifier-groups/$groupId', body);
      });

  Future<void> deleteModifierGroup(String groupId) => _write((api) => api.delete('/api/admin/modifier-groups/$groupId'));

  // ---- tables -------------------------------------------------------------------------

  Future<void> saveTable({String? id, required String number, required int capacity, String? location, required bool isActive}) =>
      _write((api) async {
        if (number.trim().isEmpty) throw const PosError('Give the table a number or name.');
        final fields = {
          'tableNumber': number.trim(), 'capacity': capacity, 'location': (location?.trim().isEmpty ?? true) ? null : location!.trim(),
          'isActive': isActive,
        };
        id == null ? await api.post('/api/admin/tables', fields) : await api.put('/api/admin/tables/$id', fields);
      });

  Future<void> deleteTable(String id) {
    if (orderForTable(id) != null) throw const PosError('That table has an open order. Close it first.');
    return _write((api) => api.delete('/api/admin/tables/$id'));
  }

  // ---- staff --------------------------------------------------------------------------

  /// Staff management is done as the manager signed in here (their role is checked by the cloud).
  Future<T> _asManager<T>(Future<T> Function(CloudApi api) body) => _write((api) async {
        api.actingStaffId = staff?.id;
        try {
          return await body(api);
        } finally {
          api.actingStaffId = null;
        }
      });

  /// The full staff list from the cloud (email, active), for the staff screen.
  Future<List<Map<String, dynamic>>> loadStaff() async {
    try {
      final api = _api..actingStaffId = staff?.id;
      return (await api.get('/api/admin/staff') as List).cast<Map<String, dynamic>>();
    } on ApiException catch (e) {
      throw PosError(e.message);
    } on SocketException {
      throw const PosError('Managing staff needs the internet.');
    } finally {
      sync?.api.actingStaffId = null;
    }
  }

  /// Waiters and cashiers only need a name and a PIN; other roles also get an email login.
  Future<void> addStaff({required String name, required String role, String? email, String? password, String? pin}) =>
      _asManager((api) async {
        final created = await api.post('/api/admin/staff', {
          'fullName': name.trim(), 'role': role, 'email': (email?.trim().isEmpty ?? true) ? null : email!.trim(),
          'password': (password?.isEmpty ?? true) ? null : password,
        }) as Map;
        if (pin != null && pin.isNotEmpty) await api.post('/api/admin/staff/${created['id']}/pin', {'pin': pin});
      });

  Future<void> updateStaff(String id, {required String name, required String role, required bool isActive}) =>
      _asManager((api) => api.put('/api/admin/staff/$id', {'fullName': name.trim(), 'role': role, 'isActive': isActive}));

  Future<void> setStaffPin(String id, String pin) => _asManager((api) => api.post('/api/admin/staff/$id/pin', {'pin': pin}));

  Future<void> removeStaff(String id) => _asManager((api) => api.delete('/api/admin/staff/$id'));

  // ---- printers -----------------------------------------------------------------------

  /// Replaces the printer list (same as the admin's Printers page).
  Future<void> savePrinters(List<Map<String, dynamic>> printers) => _write((api) => api.put('/api/pos/printers', printers));
}
