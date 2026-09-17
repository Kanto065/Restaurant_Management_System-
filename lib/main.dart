import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'firebase_options.dart';
import 'printer_service.dart';
import 'printing/receipt_settings.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // Initialize Printer Service
  await PrinterService().init();
  await ReceiptSettings().init();

  final provider = POSProvider();
  await provider.loadData();
  runApp(
    ChangeNotifierProvider.value(
      value: provider,
      child: const ChipShopApp(),
    ),
  );
}

class ChipShopApp extends StatelessWidget {
  const ChipShopApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Chip Shop POS Pro',
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF020617),
        cardColor: const Color(0xFF0F172A),
        primaryColor: const Color(0xFF2563EB),
        useMaterial3: true,
        fontFamily: 'Inter',
      ),
      home: const POSDashboard(),
    );
  }
}

// --- MODELS ---
enum PaymentMethod { cash, card }

class Product {
  String id;
  String name;
  double price;
  String category;

  Product({required this.id, required this.name, required this.price, required this.category});

  Map<String, dynamic> toMap() => {'id': id, 'name': name, 'price': price, 'category': category};
  factory Product.fromMap(Map<dynamic, dynamic> map) => Product(
        id: map['id']?.toString() ?? '',
        name: map['name']?.toString() ?? '',
        price: (map['price'] as num?)?.toDouble() ?? 0.0,
        category: map['category']?.toString() ?? '',
      );
}

class CartItem {
  final Product product;
  int quantity;

  CartItem({required this.product, this.quantity = 1});

  Map<String, dynamic> toMap() => {'product': product.toMap(), 'quantity': quantity};
  factory CartItem.fromMap(Map<dynamic, dynamic> map) => CartItem(
        product: Product.fromMap(Map<dynamic, dynamic>.from(map['product'] ?? {})),
        quantity: (map['quantity'] as num?)?.toInt() ?? 0,
      );
}

class SaleRecord {
  final String id;
  String? firebaseKey;
  final List<CartItem> items;
  final double total;
  final DateTime date;
  PaymentMethod method;
  final double cashReceived;
  final double change;

  SaleRecord({
    required this.id,
    this.firebaseKey,
    required this.items,
    required this.total,
    required this.date,
    required this.method,
    this.cashReceived = 0.0,
    this.change = 0.0,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'firebaseKey': firebaseKey,
        'items': items.map((i) => i.toMap()).toList(),
        'total': total,
        'date': date.toIso8601String(),
        'method': method.index,
        'cashReceived': cashReceived,
        'change': change,
      };

  factory SaleRecord.fromMap(Map<dynamic, dynamic> map, [String? key]) {
    List<CartItem> parsedItems = [];
    if (map['items'] != null) {
      if (map['items'] is List) {
        for (var item in map['items']) {
          if (item != null) parsedItems.add(CartItem.fromMap(Map<dynamic, dynamic>.from(item)));
        }
      } else if (map['items'] is Map) {
        (map['items'] as Map).forEach((k, v) {
          if (v != null) parsedItems.add(CartItem.fromMap(Map<dynamic, dynamic>.from(v)));
        });
      }
    }

    return SaleRecord(
      id: map['id']?.toString() ?? '',
      firebaseKey: key ?? map['firebaseKey']?.toString(),
      items: parsedItems,
      total: (map['total'] as num?)?.toDouble() ?? 0.0,
      date: map['date'] != null ? DateTime.tryParse(map['date'].toString()) ?? DateTime.now() : DateTime.now(),
      method: PaymentMethod.values[(map['method'] as int?) ?? 0],
      cashReceived: (map['cashReceived'] as num?)?.toDouble() ?? 0.0,
      change: (map['change'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

// --- STATE MANAGEMENT ---
class POSProvider extends ChangeNotifier {
  String _selectedCategory = 'All Items';
  PaymentMethod _selectedPayment = PaymentMethod.cash;
  List<SaleRecord> _salesHistory = [];
  List<Product> _products = [];
  String _searchQuery = '';
  
  // Admin password and action visibility state
  String? _adminPassword;
  bool _showAdminActions = false;

  String get selectedCategory => _selectedCategory;
  PaymentMethod get selectedPayment => _selectedPayment;
  List<SaleRecord> get salesHistory => _salesHistory;
  List<Product> get products => _products;
  String get searchQuery => _searchQuery;
  
  String? get adminPassword => _adminPassword;
  bool get showAdminActions => _showAdminActions;

  final List<CartItem> _cart = [];
  List<CartItem> get cart => _cart;

  final DatabaseReference _dbRef = FirebaseDatabase.instance.ref('transactions');

  Future<void> loadData() async {
    final prefs = await SharedPreferences.getInstance();
    
    // Load admin password from storage
    _adminPassword = prefs.getString('admin_password');

    final String? productsJson = prefs.getString('products');
    if (productsJson != null) {
      final List decoded = jsonDecode(productsJson);
      _products = decoded.map<Product>((p) => Product.fromMap(p as Map<dynamic, dynamic>)).toList();
    } else {
      _products = [
        Product(id: 'f1', name: 'Small Cod', price: 7.50, category: 'FISH'),
        Product(id: 'f2', name: 'Large Cod', price: 10.00, category: 'FISH'),
        Product(id: 'f3', name: 'Haddock', price: 7.00, category: 'FISH'),
        Product(id: 'f4', name: 'Hake', price: 6.50, category: 'FISH'),
        Product(id: 'f5', name: 'Scampi (8)', price: 6.50, category: 'FISH'),
        Product(id: 'f6', name: 'Fish Cake', price: 2.40, category: 'FISH'),
        Product(id: 'f7', name: 'Fish Bite', price: 2.00, category: 'FISH'),
        Product(id: 'c1', name: 'Small Chips', price: 3.30, category: 'CHIPS'),
        Product(id: 'c2', name: 'Large Chips', price: 4.40, category: 'CHIPS'),
        Product(id: 'c3', name: 'Cone Of Chips', price: 2.50, category: 'CHIPS'),
        Product(id: 'c4', name: 'Chip Butty', price: 3.60, category: 'CHIPS'),
        Product(id: 'c5', name: 'Potato Fritter', price: 1.20, category: 'CHIPS'),
        Product(id: 'c6', name: 'Salt & Pepper Chips', price: 4.50, category: 'CHIPS'),
        Product(id: 'c7', name: 'Masala Chips', price: 4.50, category: 'CHIPS'),
        Product(id: 's1', name: 'Gravy', price: 2.00, category: 'SAUCES & SIDES'),
        Product(id: 's2', name: 'Fruity Curry', price: 2.00, category: 'SAUCES & SIDES'),
        Product(id: 's3', name: 'Irish Curry', price: 2.00, category: 'SAUCES & SIDES'),
        Product(id: 's4', name: 'Chinese Curry', price: 2.00, category: 'SAUCES & SIDES'),
        Product(id: 's5', name: 'Large Gravy or Curry', price: 2.50, category: 'SAUCES & SIDES'),
        Product(id: 's10', name: 'Bread Roll', price: 0.90, category: 'SAUCES & SIDES'),
        Product(id: 'p1', name: 'Minced Beef Pie', price: 3.80, category: 'PIES & SAUSAGES'),
        Product(id: 'p8', name: 'Small Sausage', price: 1.50, category: 'PIES & SAUSAGES'),
        Product(id: 'p9', name: 'Large Sausage', price: 2.20, category: 'PIES & SAUSAGES'),
        Product(id: 'd1', name: 'Cans', price: 1.70, category: 'DRINKS'),
        Product(id: 'd2', name: 'Bottles', price: 2.40, category: 'DRINKS'),
      ];
      await _saveProducts();
    }

    final String? salesJson = prefs.getString('sales_history');
    if (salesJson != null) {
      final List decoded = jsonDecode(salesJson);
      _salesHistory = decoded.map<SaleRecord>((s) => SaleRecord.fromMap(s as Map<dynamic, dynamic>)).toList();
    }
    
    _listenToTransactions();
    notifyListeners();
  }
  
  Future<void> saveAdminPassword(String password) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('admin_password', password);
    _adminPassword = password;
    notifyListeners();
  }

  void setAdminActionsVisible(bool visible) {
    _showAdminActions = visible;
    notifyListeners();
  }

  void _listenToTransactions() {
    _dbRef.onValue.listen((event) {
      try {
        final data = event.snapshot.value;
        if (data != null) {
          final List<SaleRecord> loadedSales = [];
          if (data is Map) {
            data.forEach((key, value) {
              if (value is Map) {
                loadedSales.add(SaleRecord.fromMap(value, key.toString()));
              }
            });
          } else if (data is List) {
            for (int i = 0; i < data.length; i++) {
              if (data[i] != null && data[i] is Map) {
                loadedSales.add(SaleRecord.fromMap(data[i], i.toString()));
              }
            }
          }
          
          loadedSales.sort((a, b) => b.date.compareTo(a.date));
          _salesHistory = loadedSales;
          _saveSales();
          notifyListeners();
        } else {
          _salesHistory = [];
          _saveSales();
          notifyListeners();
        }
      } catch (e) {
        debugPrint("Error in _listenToTransactions: $e");
      }
    }, onError: (e) {
      // firebase_database has no Windows desktop implementation, so this
      // stream always errors there; fall back to the local sales cache.
      debugPrint("Realtime sync unavailable: $e");
    });
  }

  Future<void> _saveProducts() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('products', jsonEncode(_products.map((p) => p.toMap()).toList()));
  }

  Future<void> _saveSales() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('sales_history', jsonEncode(_salesHistory.map((s) => s.toMap()).toList()));
  }

  void setSearchQuery(String q) {
    _searchQuery = q;
    notifyListeners();
  }

  void selectCategory(String cat) {
    _selectedCategory = cat;
    notifyListeners();
  }

  void selectPayment(PaymentMethod method) {
    _selectedPayment = method;
    notifyListeners();
  }

  void addToCart(Product p) {
    int idx = _cart.indexWhere((item) => item.product.id == p.id);
    if (idx != -1) {
      _cart[idx].quantity++;
    } else {
      _cart.add(CartItem(product: p));
    }
    notifyListeners();
  }

  void updateQty(String id, int delta) {
    int idx = _cart.indexWhere((item) => item.product.id == id);
    if (idx != -1) {
      _cart[idx].quantity += delta;
      if (_cart[idx].quantity <= 0) _cart.removeAt(idx);
      notifyListeners();
    }
  }

  void removeItem(String id) {
    _cart.removeWhere((item) => item.product.id == id);
    notifyListeners();
  }

  void clearCart() {
    _cart.clear();
    notifyListeners();
  }

  double get total => _cart.fold(0.0, (sum, item) => sum + (item.product.price * item.quantity));

  Future<void> addOrUpdateProduct(Product p) async {
    int idx = _products.indexWhere((item) => item.id == p.id);
    if (idx != -1) {
      _products[idx] = p;
    } else {
      _products.add(p);
    }
    await _saveProducts();
    notifyListeners();
  }

  Future<void> deleteProduct(String id) async {
    _products.removeWhere((p) => p.id == id);
    await _saveProducts();
    notifyListeners();
  }

  Future<void> processCheckout({double cashReceived = 0.0, double change = 0.0}) async {
    if (_cart.isEmpty) return;
    
    final sale = SaleRecord(
      id: "#${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}",
      items: List.from(_cart),
      total: total,
      date: DateTime.now(),
      method: _selectedPayment,
      cashReceived: cashReceived,
      change: change,
    );

    try {
      final newRef = _dbRef.push();
      sale.firebaseKey = newRef.key;
      await newRef.set(sale.toMap());
    } catch (e) {
      // Cloud sync unavailable (e.g. firebase_database has no Windows desktop
      // implementation) — keep the sale locally so checkout still completes.
      debugPrint("Cloud sync failed, saving sale locally: $e");
      _salesHistory.insert(0, sale);
      await _saveSales();
      notifyListeners();
    }

    // --- TRIGGER PRINTER ---
    _autoPrintReceipt(sale);

    clearCart();
  }

  void _autoPrintReceipt(SaleRecord sale) async {
    // We pass toMap() to keep PrinterService detached from our models
    await PrinterService().printReceipt(sale.toMap());
  }

  Future<void> deleteSale(String firebaseKey) async {
    try {
      await _dbRef.child(firebaseKey).remove();
    } catch (e) {
      debugPrint("Error deleting sale: $e");
    }
  }

  Future<void> updateSalePayment(String firebaseKey, PaymentMethod newMethod) async {
    try {
      await _dbRef.child(firebaseKey).update({
        'method': newMethod.index,
      });
    } catch (e) {
      debugPrint("Error updating sale: $e");
    }
  }
}

// --- DASHBOARD UI ---
class POSDashboard extends StatefulWidget {
  const POSDashboard({super.key});

  @override
  State<POSDashboard> createState() => _POSDashboardState();
}

class _POSDashboardState extends State<POSDashboard> {
  StreamSubscription? _printerStatusSub;

  @override
  void initState() {
    super.initState();
    _printerStatusSub = PrinterService().statusStream.listen((status) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(status),
            duration: const Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    _printerStatusSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          const LeftSidebar(),
          Expanded(
            child: Column(
              children: [
                const TopHeader(),
                Expanded(
                  child: Row(
                    children: [
                      const Expanded(flex: 7, child: ItemSection()),
                      Container(width: 1, color: const Color(0xFF1E293B)),
                      const Expanded(flex: 3, child: OrderSection()),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class LeftSidebar extends StatelessWidget {
  const LeftSidebar({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<POSProvider>(context);
    final List<Map<String, dynamic>> categories = [
      {'name': 'All Items', 'icon': Icons.grid_view},
      {'name': 'FISH', 'icon': Icons.waves},
      {'name': 'CHIPS', 'icon': Icons.bakery_dining},
      {'name': 'SAUCES & SIDES', 'icon': Icons.soup_kitchen},
      {'name': 'PIES & SAUSAGES', 'icon': Icons.pie_chart},
      {'name': 'DRINKS', 'icon': Icons.local_drink},
    ];

    return Container(
      width: 260,
      color: const Color(0xFF020617),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.all(24),
            child: Text('Categories', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: categories.length,
              itemBuilder: (context, i) {
                bool selected = provider.selectedCategory == categories[i]['name'];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                  child: ListTile(
                    dense: true,
                    leading: Icon(categories[i]['icon'] as IconData, color: selected ? Colors.white : Colors.grey[500], size: 20),
                    title: Text(categories[i]['name'] as String, style: TextStyle(color: selected ? Colors.white : Colors.grey[500], fontSize: 14, fontWeight: selected ? FontWeight.bold : FontWeight.normal)),
                    tileColor: selected ? const Color(0xFF2563EB) : null,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    onTap: () => provider.selectCategory(categories[i]['name'] as String),
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(15),
            child: Column(
              children: [
                // --- ADD FOOD BUTTON ---
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E293B),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 54),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: const BorderSide(color: Color(0xFF334155)),
                    ),
                  ),
                  onPressed: () => _showAddFoodDialog(context),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.fastfood_outlined, size: 22),
                      SizedBox(width: 10),
                      Text('Add Food', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
                const SizedBox(height: 15),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 54),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () => _showProductDialog(context),
                  child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.add, size: 22), SizedBox(width: 10), Text('New Item', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold))]),
                ),
                const SizedBox(height: 15),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0F172A), minimumSize: const Size(double.infinity, 50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                  onPressed: () => _showTransactions(context),
                  child: const Text('Transactions', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showAddFoodDialog(BuildContext context) {
    final provider = Provider.of<POSProvider>(context, listen: false);
    final nameCtrl = TextEditingController();
    final priceCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Food to Order', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Food Name',
                hintText: 'Enter name (optional)',
                labelStyle: TextStyle(color: Colors.grey),
                enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
              ),
              style: const TextStyle(color: Colors.white),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: priceCtrl,
              decoration: const InputDecoration(
                labelText: 'Price (£) *',
                hintText: '0.00',
                labelStyle: TextStyle(color: Colors.blueAccent),
                enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.blueAccent)),
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: const TextStyle(color: Colors.white),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              double? price = double.tryParse(priceCtrl.text);
              if (price == null || price <= 0) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Please enter a valid price')),
                );
                return;
              }
              String name = nameCtrl.text.trim();
              if (name.isEmpty) name = 'Item';

              final tempProduct = Product(
                id: 'custom_${DateTime.now().millisecondsSinceEpoch}',
                name: name,
                price: price,
                category: 'CUSTOM',
              );
              provider.addToCart(tempProduct);
              Navigator.pop(context);
            },
            child: const Text('Add to Order'),
          ),
        ],
      ),
    );
  }

  void _showProductDialog(BuildContext context, {Product? product}) {
    final provider = Provider.of<POSProvider>(context, listen: false);
    final nameCtrl = TextEditingController(text: product?.name);
    final priceCtrl = TextEditingController(text: product?.price.toString());
    String selectedCategory = product?.category ?? 'FISH';

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(product == null ? 'Add New Product' : 'Edit Product'),
          backgroundColor: const Color(0xFF0F172A),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name')),
              TextField(controller: priceCtrl, decoration: const InputDecoration(labelText: 'Price'), keyboardType: TextInputType.number),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: ['FISH', 'CHIPS', 'SAUCES & SIDES', 'PIES & SAUSAGES', 'DRINKS'].contains(selectedCategory) ? selectedCategory : 'FISH',
                dropdownColor: const Color(0xFF0F172A),
                decoration: const InputDecoration(
                  labelText: 'Category',
                  suffixIcon: Icon(Icons.arrow_drop_down, color: Colors.blueAccent),
                ),
                items: ['FISH', 'CHIPS', 'SAUCES & SIDES', 'PIES & SAUSAGES', 'DRINKS'].map((cat) {
                  return DropdownMenuItem(value: cat, child: Text(cat));
                }).toList(),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => selectedCategory = val);
                  }
                },
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () {
                provider.addOrUpdateProduct(Product(
                  id: product?.id ?? DateTime.now().toString(),
                  name: nameCtrl.text,
                  price: double.tryParse(priceCtrl.text) ?? 0.0,
                  category: selectedCategory.toUpperCase(),
                ));
                Navigator.pop(context);
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  void _showTransactions(BuildContext context) {
    Provider.of<POSProvider>(context, listen: false).setAdminActionsVisible(false);
    showDialog(context: context, builder: (context) => const TransactionsDialog());
  }
}

class TopHeader extends StatelessWidget {
  const TopHeader({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<POSProvider>(context, listen: false);
    return Container(
      height: 80,
      color: const Color(0xFF020617),
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        children: [
          const Icon(Icons.menu, color: Colors.white),
          const SizedBox(width: 24),
          Text(DateFormat('hh:mm a').format(DateTime.now()), style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
          const Spacer(),
          Container(
            width: 400,
            height: 44,
            decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(10)),
            child: TextField(
              onChanged: (v) => provider.setSearchQuery(v),
              decoration: const InputDecoration(hintText: 'Search...', prefixIcon: Icon(Icons.search, color: Colors.grey), border: InputBorder.none, contentPadding: EdgeInsets.only(top: 8)),
            ),
          ),
          const Spacer(),
          // --- PRINTER ICON ---
          IconButton(
            icon: const Icon(Icons.print, color: Colors.white),
            tooltip: 'Printer Settings',
            onPressed: () => _showPrinterSettings(context),
          ),
        ],
      ),
    );
  }

  void _showPrinterSettings(BuildContext context) {
    showDialog(context: context, builder: (context) => const PrinterSettingsDialog());
  }
}

class ItemSection extends StatelessWidget {
  const ItemSection({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<POSProvider>(context);
    List<Product> items = provider.products.where((p) {
      final matchesCat = provider.selectedCategory == 'All Items' || p.category.toLowerCase() == provider.selectedCategory.toLowerCase();
      final matchesSearch = provider.searchQuery.isEmpty || p.name.toLowerCase().contains(provider.searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    }).toList();

    Map<String, List<Product>> grouped = {};
    for (var p in items) {
      grouped.putIfAbsent(p.category, () => []).add(p);
    }

    return Container(
      color: const Color(0xFF020617),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(provider.selectedCategory, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 24),
          Expanded(
            child: ListView(
              children: grouped.entries.map((entry) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Row(children: [const Icon(Icons.keyboard_arrow_down, size: 20, color: Colors.grey), const SizedBox(width: 8), Text(entry.key.toUpperCase(), style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 13, letterSpacing: 2))]),
                    ),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 5,
                        childAspectRatio: 1.1,
                        crossAxisSpacing: 14,
                        mainAxisSpacing: 14,
                      ),
                      itemCount: entry.value.length,
                      itemBuilder: (context, i) {
                        final p = entry.value[i];
                        return Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () => provider.addToCart(p),
                            onLongPress: () => _showEditDelete(context, p),
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF1E293B))),
                              padding: const EdgeInsets.all(12),
                              child: Stack(
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white, fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
                                      const SizedBox(height: 8),
                                      Text('£${p.price.toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFF60A5FA), fontWeight: FontWeight.bold, fontSize: 15)),
                                    ],
                                  ),
                                  Positioned(
                                    right: 0,
                                    bottom: 0,
                                    child: Container(padding: const EdgeInsets.all(4), decoration: BoxDecoration(color: const Color(0xFF2563EB), borderRadius: BorderRadius.circular(6)), child: const Icon(Icons.add, size: 16, color: Colors.white)),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 32),
                  ],
                );
              }).toList(),
            ),
          ),
          Row(
            children: [
              OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.pause, size: 22), label: const Text('Hold Order'), style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Color(0xFF1E293B)), padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14))),
              const SizedBox(width: 14),
              OutlinedButton.icon(onPressed: () => provider.clearCart(), icon: const Icon(Icons.delete_outline, size: 22, color: Colors.red), label: const Text('Clear Order', style: TextStyle(color: Colors.red)), style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFF1E293B)), padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14))),
            ],
          )
        ],
      ),
    );
  }

  void _showEditDelete(BuildContext context, Product p) {
    final provider = Provider.of<POSProvider>(context, listen: false);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(p.name),
        backgroundColor: const Color(0xFF0F172A),
        actions: [
          TextButton(onPressed: () {
            Navigator.pop(context);
            _editItem(context, p);
          }, child: const Text('Edit')),
          TextButton(onPressed: () {
            provider.deleteProduct(p.id);
            Navigator.pop(context);
          }, child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
  }

  void _editItem(BuildContext context, Product p) {
    final provider = Provider.of<POSProvider>(context, listen: false);
    final nameCtrl = TextEditingController(text: p.name);
    final priceCtrl = TextEditingController(text: p.price.toString());

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit Item'),
        backgroundColor: const Color(0xFF0F172A),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name')),
            TextField(controller: priceCtrl, decoration: const InputDecoration(labelText: 'Price'), keyboardType: TextInputType.number),
          ],
        ),
        actions: [
          ElevatedButton(onPressed: () {
            provider.addOrUpdateProduct(Product(id: p.id, name: nameCtrl.text, price: double.tryParse(priceCtrl.text) ?? 0.0, category: p.category));
            Navigator.pop(context);
          }, child: const Text('Update')),
        ],
      ),
    );
  }
}

class OrderSection extends StatelessWidget {
  const OrderSection({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<POSProvider>(context);
    return Container(
      color: const Color(0xFF020617),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Current Order', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white)),
              IconButton(
                onPressed: () {
                  provider.addToCart(Product(
                    id: 'bag_fee',
                    name: 'Bag',
                    price: 0.30,
                    category: 'OTHER',
                  ));
                },
                icon: const Icon(Icons.shopping_bag_outlined, color: Colors.blueAccent, size: 28),
                tooltip: 'Add Bag (£0.30)',
              ),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: ListView.builder(
              itemCount: provider.cart.length,
              itemBuilder: (context, i) {
                final item = provider.cart[i];
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(item.product.name, style: const TextStyle(color: Colors.white, fontSize: 14)),
                  subtitle: Text('£${item.product.price} x ${item.quantity}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(onPressed: () => provider.updateQty(item.product.id, -1), icon: const Icon(Icons.remove_circle_outline, size: 20)),
                      Text('${item.quantity}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
                      IconButton(onPressed: () => provider.updateQty(item.product.id, 1), icon: const Icon(Icons.add_circle_outline, size: 20)),
                      const SizedBox(width: 10),
                      Text('£${(item.product.price * item.quantity).toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                    ],
                  ),
                );
              },
            ),
          ),
          const Divider(color: Color(0xFF1E293B)),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Total', style: TextStyle(color: Colors.white, fontSize: 18)), Text('£${provider.total.toStringAsFixed(2)}', style: const TextStyle(fontSize: 24, color: Color(0xFF3B82F6), fontWeight: FontWeight.bold))]),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    provider.selectPayment(PaymentMethod.cash);
                    if (provider.cart.isNotEmpty) {
                      _showCashPaymentPopup(context);
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: provider.selectedPayment == PaymentMethod.cash ? Colors.green : const Color(0xFF0F172A), foregroundColor: Colors.white),
                  child: const Text('CASH'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    provider.selectPayment(PaymentMethod.card);
                    if (provider.cart.isNotEmpty) {
                      provider.processCheckout();
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: provider.selectedPayment == PaymentMethod.card ? Colors.blue : const Color(0xFF0F172A), foregroundColor: Colors.white),
                  child: const Text('CARD'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showCashPaymentPopup(BuildContext context) {
    final provider = Provider.of<POSProvider>(context, listen: false);
    if (provider.cart.isEmpty) return;
    provider.selectPayment(PaymentMethod.cash);

    final TextEditingController cashCtrl = TextEditingController();
    double received = 0.0;

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            double changeAmount = received - provider.total;

            return AlertDialog(
              backgroundColor: const Color(0xFF0F172A),
              title: const Text('Cash Payment', style: TextStyle(fontWeight: FontWeight.bold)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Total Amount: £${provider.total.toStringAsFixed(2)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [5, 10, 20, 50].map((amt) => ElevatedButton(
                      onPressed: () {
                        setState(() {
                          received = amt.toDouble();
                          cashCtrl.text = received.toStringAsFixed(2);
                        });
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1E293B)),
                      child: Text('£$amt'),
                    )).toList(),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: cashCtrl,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Cash Received (£)',
                      border: OutlineInputBorder(),
                      enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF1E293B))),
                    ),
                    onChanged: (val) {
                      setState(() {
                        received = double.tryParse(val) ?? 0.0;
                      });
                    },
                  ),
                  const SizedBox(height: 20),
                  const Text('Change:', style: TextStyle(color: Colors.grey)),
                  Text('£${(changeAmount > 0 ? changeAmount : 0.0).toStringAsFixed(2)}',
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: changeAmount >= 0 ? Colors.green : Colors.redAccent)),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                ElevatedButton(
                  onPressed: received >= provider.total ? () {
                    provider.processCheckout(cashReceived: received, change: changeAmount);
                    Navigator.pop(context);
                  } : null,
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
                  child: const Text('Confirm'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

class TransactionsDialog extends StatefulWidget {
  const TransactionsDialog({super.key});

  @override
  State<TransactionsDialog> createState() => _TransactionsDialogState();
}

class _TransactionsDialogState extends State<TransactionsDialog> {
  PaymentMethod? _filter;

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<POSProvider>(context);
    final history = provider.salesHistory;

    final filteredHistory = _filter == null
        ? history
        : history.where((s) => s.method == _filter).toList();

    double cashTotal = history.where((s) => s.method == PaymentMethod.cash).fold(0, (sum, s) => sum + s.total);
    double cardTotal = history.where((s) => s.method == PaymentMethod.card).fold(0, (sum, s) => sum + s.total);
    double grandTotal = cashTotal + cardTotal;

    return Dialog(
      backgroundColor: const Color(0xFFF8FAFC),
      insetPadding: const EdgeInsets.all(20),
      child: Container(
        width: MediaQuery.of(context).size.width * 0.9,
        height: MediaQuery.of(context).size.height * 0.9,
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('Transactions', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                const SizedBox(width: 32),
                _filterButton('CASH', PaymentMethod.cash, Colors.green),
                const SizedBox(width: 12),
                _filterButton('CARD', PaymentMethod.card, Colors.blue),
                const SizedBox(width: 12),
                _filterButton('ALL', null, Colors.grey),
                
                // HIDDEN BUTTON (Marked red box 1 in image)
                const SizedBox(width: 20),
                GestureDetector(
                  onTap: () => _showPasswordPopup(context),
                  child: Container(
                    width: 100,
                    height: 40,
                    color: Colors.transparent, // Invisible button area
                  ),
                ),
                
                const Spacer(),
                _statCard('Total Cash', '£${cashTotal.toStringAsFixed(2)}', Colors.green),
                const SizedBox(width: 16),
                _statCard('Total Card', '£${cardTotal.toStringAsFixed(2)}', Colors.blue),
                const SizedBox(width: 16),
                _statCard('Total Sales', '£${grandTotal.toStringAsFixed(2)}', Colors.black),
              ],
            ),
            const SizedBox(height: 24),
            Expanded(
              child: Container(
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
                child: Column(
                  children: [
                    _tableHeader(provider.showAdminActions),
                    Expanded(
                      child: filteredHistory.isEmpty
                        ? const Center(child: Text('No transactions found', style: TextStyle(color: Colors.grey)))
                        : ListView.separated(
                          itemCount: filteredHistory.length,
                          separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFE2E8F0)),
                          itemBuilder: (context, i) => _transactionRow(context, filteredHistory[i], provider.showAdminActions),
                        ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close', style: TextStyle(color: Colors.grey)))),
          ],
        ),
      ),
    );
  }

  void _showPasswordPopup(BuildContext context) {
    final provider = Provider.of<POSProvider>(context, listen: false);
    final bool isSetup = provider.adminPassword == null || provider.adminPassword!.isEmpty;
    final TextEditingController passCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text(
          isSetup ? 'Create Admin Password' : 'Enter Admin Password',
          style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
        content: TextField(
          controller: passCtrl,
          obscureText: true,
          autofocus: true,
          style: const TextStyle(color: Colors.black),
          decoration: const InputDecoration(
            hintText: 'Password',
            hintStyle: TextStyle(color: Colors.grey),
            enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
            focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.blue)),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (isSetup) {
                if (passCtrl.text.isNotEmpty) {
                  provider.saveAdminPassword(passCtrl.text);
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Admin password saved successfully!')));
                }
              } else {
                if (passCtrl.text == provider.adminPassword) {
                  provider.setAdminActionsVisible(true);
                  Navigator.pop(context);
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Incorrect password!')));
                }
              }
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  Widget _filterButton(String label, PaymentMethod? method, Color color) {
    bool isSelected = _filter == method;
    return InkWell(
      onTap: () => setState(() => _filter = method),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? color.withValues(alpha: 0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: isSelected ? color : const Color(0xFFE2E8F0)),
        ),
        child: Text(label, style: TextStyle(color: isSelected ? color : Colors.grey, fontWeight: FontWeight.bold, fontSize: 12)),
      ),
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          Text(value, style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _tableHeader(bool showActions) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(color: Color(0xFFF1F5F9), borderRadius: BorderRadius.only(topLeft: Radius.circular(12), topRight: Radius.circular(12))),
      child: Row(
        children: [
          const Expanded(flex: 2, child: Text('Date & Time', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey))),
          const Expanded(flex: 1, child: Text('Order ID', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey))),
          const Expanded(flex: 1, child: Text('Type', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey))),
          const Expanded(flex: 1, child: Text('Items', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey))),
          const Expanded(flex: 1, child: Text('Amount', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey))),
          const Expanded(flex: 1, child: Text('Payment', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey))),
          const Expanded(flex: 1, child: Text('Status', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey))),
          
          // PRINTER ACTION HEADER
          const Expanded(flex: 1, child: Text('Receipt', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey), textAlign: TextAlign.center)),
          
          if (showActions)
            const Expanded(flex: 1, child: Text('Actions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey), textAlign: TextAlign.center))
          else
            const Expanded(flex: 1, child: SizedBox.shrink()),
        ],
      ),
    );
  }

  Widget _transactionRow(BuildContext context, SaleRecord sale, bool showActions) {
    final provider = Provider.of<POSProvider>(context, listen: false);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Expanded(flex: 2, child: Text(DateFormat('dd/MM/yyyy HH:mm').format(sale.date), style: const TextStyle(fontSize: 13, color: Colors.black))),
          Expanded(flex: 1, child: Text(sale.id, style: const TextStyle(fontSize: 13, color: Colors.black))),
          Expanded(flex: 1, child: const Text('Walk-in', style: TextStyle(fontSize: 13, color: Colors.black))),
          Expanded(flex: 1, child: Text('${sale.items.length} Items', style: const TextStyle(fontSize: 13, color: Colors.black))),
          Expanded(flex: 1, child: Text('£${sale.total.toStringAsFixed(2)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.green))),
          Expanded(flex: 1, child: _paymentBadge(sale.method)),
          Expanded(flex: 1, child: _statusBadge()),
          
          // MANUAL PRINT BUTTON
          Expanded(flex: 1, child: IconButton(
            icon: const Icon(Icons.print_outlined, size: 18, color: Colors.grey),
            onPressed: () => PrinterService().printReceipt(sale.toMap()),
          )),
          
          if (showActions)
            Expanded(flex: 1, child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(onPressed: () => _editPayment(context, sale), icon: const Icon(Icons.edit_outlined, size: 18, color: Colors.blue)),
                IconButton(onPressed: () {
                  if (sale.firebaseKey != null) {
                    provider.deleteSale(sale.firebaseKey!);
                  }
                }, icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red)),
              ],
            ))
          else
            const Expanded(flex: 1, child: SizedBox.shrink()),
        ],
      ),
    );
  }

  Widget _paymentBadge(PaymentMethod method) {
    bool isCash = method == PaymentMethod.cash;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: isCash ? Colors.green.withValues(alpha: 0.1) : Colors.blue.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(4)),
        child: Text(isCash ? 'Cash' : 'Card', style: TextStyle(color: isCash ? Colors.green : Colors.blue, fontSize: 12, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _statusBadge() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: Colors.green.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(4)),
        child: const Text('Completed', style: TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold)),
      ),
    );
  }

  void _editPayment(BuildContext context, SaleRecord sale) {
    final provider = Provider.of<POSProvider>(context, listen: false);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        title: const Text('Edit Payment Method', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            RadioListTile<PaymentMethod>(
              title: const Text('Cash', style: TextStyle(color: Colors.black)),
              value: PaymentMethod.cash,
              groupValue: sale.method,
              onChanged: (v) {
                if (sale.firebaseKey != null && v != null) {
                  provider.updateSalePayment(sale.firebaseKey!, v);
                  Navigator.pop(context);
                }
              },
            ),
            RadioListTile<PaymentMethod>(
              title: const Text('Card', style: TextStyle(color: Colors.black)),
              value: PaymentMethod.card,
              groupValue: sale.method,
              onChanged: (v) {
                if (sale.firebaseKey != null && v != null) {
                  provider.updateSalePayment(sale.firebaseKey!, v);
                  Navigator.pop(context);
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}

// --- PRINTER SETTINGS DIALOG ---
class PrinterSettingsDialog extends StatefulWidget {
  const PrinterSettingsDialog({super.key});

  @override
  State<PrinterSettingsDialog> createState() => _PrinterSettingsDialogState();
}

class _PrinterSettingsDialogState extends State<PrinterSettingsDialog> {
  List<Map<String, dynamic>> _devices = [];
  bool _isScanning = false;

  late final TextEditingController _shopNameCtrl;
  late final TextEditingController _addressLineCtrl;
  late final TextEditingController _cityCtrl;
  late final TextEditingController _postcodeCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _serverNameCtrl;
  late final TextEditingController _customerNameCtrl;

  @override
  void initState() {
    super.initState();
    _scanPrinters();
    final settings = ReceiptSettings();
    _shopNameCtrl = TextEditingController(text: settings.shopName);
    _addressLineCtrl = TextEditingController(text: settings.addressLine);
    _cityCtrl = TextEditingController(text: settings.city);
    _postcodeCtrl = TextEditingController(text: settings.postcode);
    _phoneCtrl = TextEditingController(text: settings.phone);
    _serverNameCtrl = TextEditingController(text: settings.serverName);
    _customerNameCtrl = TextEditingController(text: settings.customerName);
  }

  @override
  void dispose() {
    _shopNameCtrl.dispose();
    _addressLineCtrl.dispose();
    _cityCtrl.dispose();
    _postcodeCtrl.dispose();
    _phoneCtrl.dispose();
    _serverNameCtrl.dispose();
    _customerNameCtrl.dispose();
    super.dispose();
  }

  Future<void> _scanPrinters() async {
    setState(() => _isScanning = true);
    final devices = await PrinterService().getAvailablePrinters();
    setState(() {
      _devices = devices;
      _isScanning = false;
    });
  }

  Future<void> _saveReceiptDetails() async {
    await ReceiptSettings().save(
      shopName: _shopNameCtrl.text.trim(),
      addressLine: _addressLineCtrl.text.trim(),
      city: _cityCtrl.text.trim(),
      postcode: _postcodeCtrl.text.trim(),
      phone: _phoneCtrl.text.trim(),
      serverName: _serverNameCtrl.text.trim(),
      customerName: _customerNameCtrl.text.trim(),
    );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Receipt details saved')));
    }
  }

  Widget _receiptField(String label, TextEditingController controller) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        style: const TextStyle(color: Colors.white, fontSize: 14),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(color: Colors.grey, fontSize: 12),
          isDense: true,
          enabledBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF1E293B))),
          focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Colors.blueAccent)),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final selectedName = PrinterService().selectedPrinterName;

    return AlertDialog(
      backgroundColor: const Color(0xFF0F172A),
      title: const Text('Printer Settings', style: TextStyle(fontWeight: FontWeight.bold)),
      content: SizedBox(
        width: 400,
        child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Available Printers', style: TextStyle(color: Colors.grey, fontSize: 13, fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            if (_isScanning)
              const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()))
            else if (_devices.isEmpty)
              const Padding(padding: EdgeInsets.all(20), child: Text('No printers found', style: TextStyle(color: Colors.grey)))
            else
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 200),
                child: Container(
                  decoration: BoxDecoration(border: Border.all(color: const Color(0xFF1E293B)), borderRadius: BorderRadius.circular(8)),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: _devices.length,
                    itemBuilder: (context, i) {
                      final device = _devices[i];
                      final name = device['name'] as String;
                      bool isAures = name.toUpperCase().contains('AURES') || name.toUpperCase().contains('ODP333');
                      bool isSelected = selectedName == name;
                      return ListTile(
                        title: Text(name, style: TextStyle(fontSize: 14, color: isAures ? Colors.blueAccent : Colors.white)),
                        subtitle: Text(device['address'] ?? 'USB', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                        trailing: isSelected 
                          ? const Icon(Icons.check_circle, color: Colors.green)
                          : ElevatedButton(
                              onPressed: () async {
                                await PrinterService().selectPrinter(device);
                                setState(() {});
                              },
                              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1E293B), visualDensity: VisualDensity.compact),
                              child: const Text('Select', style: TextStyle(fontSize: 12)),
                            ),
                      );
                    },
                  ),
                ),
              ),
            const SizedBox(height: 20),
            const Divider(color: Color(0xFF1E293B)),
            const SizedBox(height: 10),
            const Text('Selected Printer:', style: TextStyle(color: Colors.grey, fontSize: 12)),
            const SizedBox(height: 4),
            Text(selectedName ?? 'None Selected', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: selectedName != null ? Colors.green : Colors.red)),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _scanPrinters,
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1E293B)),
                    child: const Text('Refresh'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: selectedName != null ? () async {
                      await PrinterService().printTestReceipt();
                    } : null,
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB)),
                    child: const Text('Test Print'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Divider(color: Color(0xFF1E293B)),
            const SizedBox(height: 10),
            const Text('Receipt Details', style: TextStyle(color: Colors.grey, fontSize: 13, fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            _receiptField('Shop Name', _shopNameCtrl),
            _receiptField('Address Line', _addressLineCtrl),
            _receiptField('City', _cityCtrl),
            _receiptField('Postcode', _postcodeCtrl),
            _receiptField('Phone', _phoneCtrl),
            _receiptField('Server Name', _serverNameCtrl),
            _receiptField('Default Customer Name', _customerNameCtrl),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saveReceiptDetails,
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A)),
                child: const Text('Save Receipt Details'),
              ),
            ),
          ],
        ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
      ],
    );
  }
}
