/// Who may do what at the till (design section 6). One map, checked by the UI.
enum Perm { takeOrders, takePayment, discount, voidItem, refund, dayReport, settings }

enum Access { allowed, managerPin, denied }

const _managers = {'Owner', 'Manager'};

/// Staff (the older admin role) works like a cashier at the till. KitchenDisplay can't sign in here.
const _rules = <Perm, Map<String, Access>>{
  Perm.takeOrders: {'Cashier': Access.allowed, 'Staff': Access.allowed, 'Waiter': Access.allowed},
  Perm.takePayment: {'Cashier': Access.allowed, 'Staff': Access.allowed},
  Perm.discount: {'Cashier': Access.managerPin, 'Staff': Access.managerPin},
  Perm.voidItem: {'Cashier': Access.managerPin, 'Staff': Access.managerPin, 'Waiter': Access.managerPin},
  Perm.refund: {'Cashier': Access.managerPin, 'Staff': Access.managerPin},
  Perm.dayReport: {'Cashier': Access.managerPin, 'Staff': Access.managerPin},
  Perm.settings: {},
};

Access can(String role, Perm perm) => _managers.contains(role) ? Access.allowed : (_rules[perm]?[role] ?? Access.denied);

bool canSignInAtTill(String role) => role != 'KitchenDisplay';

bool isManager(String role) => _managers.contains(role);
