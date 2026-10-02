import 'package:shared_preferences/shared_preferences.dart';

/// Business details printed on the receipt header (shop name/address/phone)
/// plus the server and default customer labels. Editable from the Printer
/// Settings dialog and persisted locally so they survive app restarts.
class ReceiptSettings {
  static final ReceiptSettings _instance = ReceiptSettings._internal();
  factory ReceiptSettings() => _instance;
  ReceiptSettings._internal();

  String shopName = 'CRISPY COD';
  String addressLine = 'UNIT D LLWYN HELYG RETAIL PARK LLWYN HELYG';
  String city = 'NEATH';
  String postcode = 'SA10 7BZ';
  String phone = '01639635981';
  String serverName = 'Manager';
  String customerName = 'Quick';

  List<String> get addressLines => [addressLine, city, postcode, phone];

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    shopName = prefs.getString('receipt_shop_name') ?? shopName;
    addressLine = prefs.getString('receipt_address_line') ?? addressLine;
    city = prefs.getString('receipt_city') ?? city;
    postcode = prefs.getString('receipt_postcode') ?? postcode;
    phone = prefs.getString('receipt_phone') ?? phone;
    serverName = prefs.getString('receipt_server_name') ?? serverName;
    customerName = prefs.getString('receipt_customer_name') ?? customerName;
  }

  Future<void> save({
    required String shopName,
    required String addressLine,
    required String city,
    required String postcode,
    required String phone,
    required String serverName,
    required String customerName,
  }) async {
    this.shopName = shopName;
    this.addressLine = addressLine;
    this.city = city;
    this.postcode = postcode;
    this.phone = phone;
    this.serverName = serverName;
    this.customerName = customerName;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('receipt_shop_name', shopName);
    await prefs.setString('receipt_address_line', addressLine);
    await prefs.setString('receipt_city', city);
    await prefs.setString('receipt_postcode', postcode);
    await prefs.setString('receipt_phone', phone);
    await prefs.setString('receipt_server_name', serverName);
    await prefs.setString('receipt_customer_name', customerName);
  }
}
