# 📱 Public API Guide - Customer Ordering

This guide explains how customers can place orders using the public API endpoints.

---

## 🔍 Step 1: Get Table Details

When a customer scans a QR code or clicks a table URL, they first need to get the table details and menu.

### Endpoint
```
GET /api/public/table/{tableUrl}
```

### Parameters
- `tableUrl`: The UUID of the table (can be just the UUID or the full URL)

### Examples

**Using UUID only:**
```bash
curl http://localhost:7878/api/public/table/a89d7cc2-d194-425d-9771-642d846a6ea4
```

**Using full URL:**
```bash
curl "http://localhost:7878/api/public/table/http://localhost:7878/api/public/table/a89d7cc2-d194-425d-9771-642d846a6ea4"
```

### Response
```json
{
  "success": true,
  "data": {
    "table": {
      "tableNumber": "T-06",
      "capacity": 6,
      "location": "Outdoor"
    },
    "restaurant": {
      "name": "The Hungry Kitchen",
      "description": "Delicious food...",
      "logo": null,
      "phone": "01712345678",
      "email": "info@hungrykitchen.com"
    },
    "foods": [
      {
        "_id": "6901db804837166e608118c0",
        "name": "Beef Burger",
        "description": "Juicy beef burger...",
        "price": 250,
        "image": null,
        "category": "Main Course",
        "isVegetarian": false,
        "preparationTime": 20
      },
      {
        "_id": "6901db804837166e608118c6",
        "name": "French Fries",
        "price": 100,
        "category": "Snack"
      }
    ]
  }
}
```

---

## 🛒 Step 2: Place Order

Customer selects items from the menu and places an order.

### Endpoint
```
POST /api/public/orders
```

### Request Body

```json
{
  "tableUrl": "a89d7cc2-d194-425d-9771-642d846a6ea4",
  "items": [
    {
      "food": "Beef Burger",
      "quantity": 2,
      "specialInstructions": "No spicy"
    },
    {
      "food": "French Fries",
      "quantity": 1
    }
  ],
  "customerName": "John Doe",
  "customerPhone": "01712345678",
  "customerEmail": "john@example.com",
  "paymentMethod": "cash",
  "specialRequests": "Please serve hot"
}
```

### Field Details

#### Required Fields
- **tableUrl** (string): Table UUID or full URL
  - Can be: `"a89d7cc2-d194-425d-9771-642d846a6ea4"`
  - Or: `"http://localhost:7878/api/public/table/a89d7cc2-d194-425d-9771-642d846a6ea4"`

- **items** (array): List of food items to order
  - **food** (string): **Can be either:**
    - MongoDB ObjectId: `"6901db804837166e608118c0"`
    - Food Name: `"Beef Burger"` *(case-insensitive)*
  - **quantity** (number): Number of items (minimum 1)
  - **specialInstructions** (string, optional): Special cooking instructions

- **paymentMethod** (string): Either `"cash"` or `"online"`

#### Optional Fields
- **customerName** (string): Customer's name
- **customerPhone** (string): Customer's phone number
- **customerEmail** (string): Customer's email (required for online payment)
- **specialRequests** (string): Any special requests for the order

### Example Request

**Using Food Names (Easier for customers):**
```bash
curl -X POST http://localhost:7878/api/public/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableUrl": "a89d7cc2-d194-425d-9771-642d846a6ea4",
    "items": [
      {
        "food": "Beef Burger",
        "quantity": 2,
        "specialInstructions": "No onions"
      },
      {
        "food": "French Fries",
        "quantity": 1
      },
      {
        "food": "Mango Smoothie",
        "quantity": 2
      }
    ],
    "customerName": "N Siddiqui",
    "customerPhone": "01643471297",
    "customerEmail": "naim@gmail.com",
    "paymentMethod": "cash",
    "specialRequests": "Please serve hot"
  }'
```

**Using Food IDs:**
```bash
curl -X POST http://localhost:7878/api/public/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableUrl": "a89d7cc2-d194-425d-9771-642d846a6ea4",
    "items": [
      {
        "food": "6901db804837166e608118c0",
        "quantity": 2
      }
    ],
    "customerName": "N Siddiqui",
    "customerPhone": "01643471297",
    "customerEmail": "naim@gmail.com",
    "paymentMethod": "cash"
  }'
```

**Using Full Table URL:**
```bash
curl -X POST http://localhost:7878/api/public/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableUrl": "http://localhost:7878/api/public/table/a89d7cc2-d194-425d-9771-642d846a6ea4",
    "items": [
      {
        "food": "Beef Burger",
        "quantity": 2
      }
    ],
    "customerName": "John Doe",
    "customerPhone": "01712345678",
    "customerEmail": "john@example.com",
    "paymentMethod": "online"
  }'
```

### Success Response

**For Cash Payment:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Order placed successfully",
  "data": {
    "order": {
      "_id": "69025bba8e91c6ebb478a92c",
      "orderNumber": "ORD-20251030-XAI9HH",
      "restaurant": "6901db804837166e608118bd",
      "table": {
        "_id": "6901dbb64ba28f6656e2cc1e",
        "tableNumber": "T-06",
        "location": "Outdoor"
      },
      "items": [
        {
          "food": {
            "_id": "6901db804837166e608118c0",
            "name": "Beef Burger",
            "category": "Main Course"
          },
          "name": "Beef Burger",
          "price": 250,
          "quantity": 2,
          "specialInstructions": "No spicy"
        },
        {
          "food": {
            "_id": "6901db804837166e608118c6",
            "name": "French Fries",
            "category": "Snack"
          },
          "name": "French Fries",
          "price": 100,
          "quantity": 1,
          "specialInstructions": ""
        }
      ],
      "totalAmount": 600,
      "customerName": "N Siddiqui",
      "customerPhone": "01643471297",
      "customerEmail": "naim@gmail.com",
      "paymentMethod": "cash",
      "paymentStatus": "pending",
      "orderStatus": "pending",
      "createdAt": "2025-10-29T18:23:54.324Z"
    },
    "paymentGatewayUrl": null
  }
}
```

**For Online Payment:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Order placed successfully. Redirect to payment gateway.",
  "data": {
    "order": { ... },
    "paymentGatewayUrl": "https://sandbox.sslcommerz.com/EasyCheckOut/..."
  }
}
```

---

## 📊 Step 3: Track Order Status

Customers can track their order status using the order number.

### Endpoint
```
GET /api/public/orders/{orderNumber}
```

### Example
```bash
curl http://localhost:7878/api/public/orders/ORD-20251030-XAI9HH
```

### Response
```json
{
  "success": true,
  "data": {
    "orderNumber": "ORD-20251030-XAI9HH",
    "items": [
      {
        "name": "Beef Burger",
        "quantity": 2,
        "price": 250
      }
    ],
    "totalAmount": 600,
    "orderStatus": "preparing",
    "paymentStatus": "pending",
    "estimatedTime": 20,
    "createdAt": "2025-10-29T18:23:54.324Z"
  }
}
```

---

## 🔄 Real-time Updates with Socket.io

Customers can receive real-time order updates using Socket.io.

### Connect to Socket.io
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:7878');

// Join order room
socket.emit('join-order', {
  orderId: '69025bba8e91c6ebb478a92c'
});

// Listen for status updates
socket.on('order-status-updated', (data) => {
  console.log('Order status:', data.status);
  console.log('Message:', data.message);
});

// Listen for estimated time updates
socket.on('order-time-updated', (data) => {
  console.log('Estimated time:', data.estimatedTime, 'minutes');
});

// Listen for payment completion
socket.on('payment-completed', (data) => {
  console.log('Payment completed for order:', data.orderNumber);
});
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: "Food item not found"
**Problem:** You're using a food name that doesn't exist or is spelled incorrectly.

**Solution:**
1. First call `GET /api/public/table/{tableUrl}` to get the list of available foods
2. Use the exact food name from the response (case-insensitive matching is supported)
3. Or use the food `_id` from the response instead

### Issue 2: "Table not found"
**Problem:** The table URL is incorrect or the table is inactive.

**Solution:**
- Make sure you're using the correct UUID from the QR code or table link
- The API accepts both UUID only or full URL
- Example UUID: `a89d7cc2-d194-425d-9771-642d846a6ea4`

### Issue 3: "Invalid email format"
**Problem:** Email validation failed.

**Solution:**
- Provide a valid email address
- Email is required when using online payment
- Example: `"naim@gmail.com"`

### Issue 4: "Cast to ObjectId failed"
**Problem:** You're passing food name but the system tried to treat it as an ID.

**Solution:** This has been fixed! The API now accepts both:
- Food Names: `"Beef Burger"` (case-insensitive)
- Food IDs: `"6901db804837166e608118c0"`

---

## 📝 Order Status Flow

```
pending → confirmed → preparing → ready → served → completed
                                    ↓
                                cancelled
```

**Status Descriptions:**
- **pending**: Order received, waiting for confirmation
- **confirmed**: Restaurant confirmed the order
- **preparing**: Kitchen is preparing the food
- **ready**: Food is ready for serving
- **served**: Food has been served to the table
- **completed**: Order completed and table cleared
- **cancelled**: Order was cancelled

---

## 💳 Payment Methods

### Cash Payment
- Select `"paymentMethod": "cash"`
- Pay directly to the waiter/cashier
- Order is placed immediately

### Online Payment
- Select `"paymentMethod": "online"`
- **Must provide** `customerEmail`
- Response includes `paymentGatewayUrl`
- Redirect customer to the payment gateway
- After payment, they'll be redirected back with status

---

## 🎯 Best Practices

1. **Always get table details first**
   - Shows available menu items
   - Confirms table is active
   - Provides restaurant information

2. **Use food names for better UX**
   - Easier for customers to understand
   - No need to store food IDs
   - System will find the correct food item

3. **Provide customer contact info**
   - Helps restaurant communicate with customer
   - Email required for online payments
   - Phone helpful for order updates

4. **Handle errors gracefully**
   - Show user-friendly error messages
   - Validate input before sending
   - Provide retry options

5. **Use Socket.io for real-time updates**
   - Better customer experience
   - No need to poll for status
   - Instant notifications

---

## 🧪 Testing

### Test with cURL
```bash
# 1. Get table details
curl http://localhost:7878/api/public/table/a89d7cc2-d194-425d-9771-642d846a6ea4

# 2. Place order
curl -X POST http://localhost:7878/api/public/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableUrl": "a89d7cc2-d194-425d-9771-642d846a6ea4",
    "items": [{"food": "Beef Burger", "quantity": 1}],
    "customerName": "Test User",
    "customerEmail": "test@example.com",
    "paymentMethod": "cash"
  }'

# 3. Track order (use the orderNumber from step 2)
curl http://localhost:7878/api/public/orders/ORD-20251030-XAI9HH
```

---

## 📱 Example Customer App Flow

```javascript
// 1. Customer scans QR code with table URL
const tableUrl = "a89d7cc2-d194-425d-9771-642d846a6ea4";

// 2. Load table details and menu
const response = await fetch(`http://localhost:7878/api/public/table/${tableUrl}`);
const { table, restaurant, foods } = await response.json();

// 3. Display menu to customer
displayMenu(foods);

// 4. Customer selects items
const order = {
  tableUrl: tableUrl,
  items: [
    { food: "Beef Burger", quantity: 2 },
    { food: "French Fries", quantity: 1 }
  ],
  customerName: customerName,
  customerEmail: customerEmail,
  paymentMethod: "online"
};

// 5. Place order
const orderResponse = await fetch('http://localhost:7878/api/public/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(order)
});

const { order: placedOrder, paymentGatewayUrl } = await orderResponse.json();

// 6. If online payment, redirect to gateway
if (paymentGatewayUrl) {
  window.location.href = paymentGatewayUrl;
}

// 7. Connect to Socket.io for real-time updates
const socket = io('http://localhost:7878');
socket.emit('join-order', { orderId: placedOrder._id });

socket.on('order-status-updated', (data) => {
  updateOrderStatus(data.status);
});
```

---

## ✅ Summary

**Key Features:**
- ✅ Accept food names OR IDs in orders
- ✅ Accept full table URL OR just UUID
- ✅ Automatic order number generation
- ✅ Real-time Socket.io updates
- ✅ Cash and online payment support
- ✅ Customer email for payment gateway
- ✅ Special instructions per item
- ✅ Order status tracking

**Customer-Friendly:**
- No authentication required
- Simple API endpoints
- Flexible food identification (name or ID)
- Real-time order tracking
- Clear error messages

---

**Ready to serve customers! 🎉**
