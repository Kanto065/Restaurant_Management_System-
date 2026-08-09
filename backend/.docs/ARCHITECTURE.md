# FoodMonk Backend Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT APPLICATIONS                              │
├─────────────────┬──────────────────┬────────────────┬───────────────────┤
│  Owner Dashboard│  Customer Web    │  Mobile App    │  Socket.io Client │
│  (Web/Mobile)   │  (Public URLs)   │  (Optional)    │  (Real-time)      │
└────────┬────────┴────────┬─────────┴────────┬───────┴────────┬──────────┘
         │                 │                  │                │
         │ HTTPS           │ HTTPS            │ HTTPS          │ WSS
         │                 │                  │                │
┌────────▼─────────────────▼──────────────────▼────────────────▼──────────┐
│                         EXPRESS.JS SERVER                                │
│                     (Node.js + Socket.io)                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                      MIDDLEWARE LAYER                          │    │
│  ├────────────┬────────────┬────────────┬────────────┬───────────┤    │
│  │   CORS     │   Helmet   │   Morgan   │Rate Limit  │   Auth    │    │
│  │ (Security) │ (Security) │ (Logging)  │(Protection)│   (JWT)   │    │
│  └────────────┴────────────┴────────────┴────────────┴───────────┘    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                      FEATURE MODULES                           │    │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │   │
│  │  │     AUTH     │  │ RESTAURANT   │  │     FOOD     │         │   │
│  │  ├──────────────┤  ├──────────────┤  ├──────────────┤         │   │
│  │  │ • Login      │  │ • Profile    │  │ • CRUD       │         │   │
│  │  │ • Register   │  │ • Logo       │  │ • Images     │         │   │
│  │  │ • Password   │  │ • Details    │  │ • Categories │         │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘         │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │   │
│  │  │    TABLE     │  │    ORDER     │  │    PUBLIC    │         │   │
│  │  ├──────────────┤  ├──────────────┤  ├──────────────┤         │   │
│  │  │ • CRUD       │  │ • Management │  │ • View Menu  │         │   │
│  │  │ • URLs       │  │ • Status     │  │ • Place Order│         │   │
│  │  │ • QR Ready   │  │ • Statistics │  │ • Track      │         │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘         │   │
│  │                                                                  │   │
│  │  ┌──────────────┐                                               │   │
│  │  │   PAYMENT    │                                               │   │
│  │  ├──────────────┤                                               │   │
│  │  │ • SSLCommerz │                                               │   │
│  │  │ • Callbacks  │                                               │   │
│  │  │ • Validation │                                               │   │
│  │  └──────────────┘                                               │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    SERVICE LAYER                               │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │  Business Logic, Data Validation, Complex Operations           │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    UTILITIES & HELPERS                         │    │
│  ├────────────┬────────────┬────────────┬────────────┬───────────┤    │
│  │    JWT     │   Upload   │   Error    │  Response  │Validation │    │
│  └────────────┴────────────┴────────────┴────────────┴───────────┘    │
│                                                                          │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌────────▼─────────┐  ┌────────▼─────────┐  ┌───────▼──────────┐
│   MONGODB        │  │  FILE SYSTEM     │  │  SSLCOMMERZ      │
│   (Database)     │  │  (Uploads)       │  │  (Payment)       │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ • Owners         │  │ • Restaurant     │  │ • Sandbox Mode   │
│ • Restaurants    │  │   Logos          │  │ • Live Mode      │
│ • Foods          │  │ • Food Images    │  │ • Callbacks      │
│ • Tables         │  │                  │  │ • IPN            │
│ • Orders         │  │                  │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Data Flow Diagrams

### 1. Owner Login Flow
```
Owner App → POST /api/auth/login
         → Controller validates credentials
         → Service checks database
         → Password verified (bcrypt)
         → JWT token generated
         → Token returned to client
         → Client stores token
         → Token used in Authorization header
```

### 2. Customer Order Flow
```
Customer → Scan QR / Visit Table URL
        → GET /api/public/table/:url
        → View Restaurant & Menu
        → Select Items
        → POST /api/public/orders
        → Choose Payment Method
        ┌─────────┴─────────┐
        │                   │
    [CASH]              [ONLINE]
        │                   │
        │              SSLCommerz
        │              Payment Page
        │                   │
        └─────────┬─────────┘
                  │
            Order Created
                  │
         Socket.io Notification
                  │
        Restaurant Owner Notified
```

### 3. Real-time Order Update Flow
```
Owner → Update Order Status
     → PUT /api/orders/:id/status
     → Service updates database
     → Socket.io emits event
     ┌────────┴────────┐
     │                 │
Restaurant Room   Order Room
     │                 │
  Owner App      Customer App
(Real-time)     (Real-time)
```

### 4. File Upload Flow
```
Owner → Upload Logo/Image
     → Multer middleware
     → File validation
     → Save to /uploads
     → Generate unique filename
     → Store path in database
     → Return file URL
     → Serve via /uploads/:filename
```

## Database Schema Relationships

```
┌─────────────┐
│   Owner     │
│─────────────│
│ _id         │────┐
│ username    │    │
│ password    │    │ 1:1
│ isActive    │    │
└─────────────┘    │
                   │
                   ▼
┌─────────────────────────┐
│   Restaurant            │
│─────────────────────────│
│ _id                     │──┐
│ owner (FK)              │  │
│ name                    │  │
│ description             │  │ 1:N
│ logo                    │  │
│ address                 │  │
└─────────────────────────┘  │
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐     ┌─────────────┐
│    Food     │      │   Table     │     │   Order     │
│─────────────│      │─────────────│     │─────────────│
│ _id         │      │ _id         │◄────│ _id         │
│ restaurant  │      │ restaurant  │     │ restaurant  │
│ name        │◄─┐   │ tableNumber │     │ table (FK)  │
│ price       │  │   │ uniqueUrl   │     │ items[]     │
│ image       │  │   │ capacity    │     │ totalAmount │
│ category    │  │   └─────────────┘     │ status      │
│ isAvailable │  │                       │ payment     │
└─────────────┘  │   ┌─────────────┐     └─────────────┘
                 └───│ Order.items │
                     │─────────────│
                     │ food (FK)   │
                     │ quantity    │
                     │ price       │
                     └─────────────┘
```

## Socket.io Room Architecture

```
┌────────────────────────────────────────────────┐
│              Socket.io Server                  │
├────────────────────────────────────────────────┤
│                                                │
│  ┌──────────────────────────────────────┐     │
│  │     Restaurant Rooms                 │     │
│  │  (restaurant-{restaurantId})         │     │
│  ├──────────────────────────────────────┤     │
│  │  • Restaurant Owner(s)               │     │
│  │  • Receives:                         │     │
│  │    - order-created                   │     │
│  │    - payment-completed               │     │
│  │    - order-updated                   │     │
│  └──────────────────────────────────────┘     │
│                                                │
│  ┌──────────────────────────────────────┐     │
│  │     Order Rooms                      │     │
│  │  (order-{orderId})                   │     │
│  ├──────────────────────────────────────┤     │
│  │  • Customer(s)                       │     │
│  │  • Receives:                         │     │
│  │    - order-status-updated            │     │
│  │    - order-time-updated              │     │
│  └──────────────────────────────────────┘     │
│                                                │
└────────────────────────────────────────────────┘
```

## API Request/Response Flow

```
Client Request
      │
      ▼
┌──────────────┐
│Rate Limiter  │ ──[Too many requests]──> 429 Error
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   CORS       │ ──[Origin blocked]──> 403 Error
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Body Parser   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Auth Check    │ ──[No/Invalid token]──> 401 Error
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Validation    │ ──[Invalid data]──> 400 Error
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Controller    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Service       │ ──[Business logic error]──> 4xx Error
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Database      │ ──[DB error]──> 500 Error
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Response      │
│(JSON)        │
└──────┬───────┘
       │
       ▼
  Client App
```

## Security Layers

```
┌─────────────────────────────────────────┐
│           Security Layers               │
├─────────────────────────────────────────┤
│                                         │
│  1. Rate Limiting                       │
│     └─ 100 requests per 15 minutes     │
│                                         │
│  2. Helmet Headers                      │
│     └─ XSS, CSRF, Clickjacking         │
│                                         │
│  3. CORS Protection                     │
│     └─ Allowed origins only            │
│                                         │
│  4. JWT Authentication                  │
│     └─ Token expiry, verification      │
│                                         │
│  5. Input Validation                    │
│     └─ Joi schemas, sanitization       │
│                                         │
│  6. Password Hashing                    │
│     └─ Bcrypt with salt rounds         │
│                                         │
│  7. File Validation                     │
│     └─ Type, size, sanitization        │
│                                         │
│  8. Error Handling                      │
│     └─ No sensitive data leaks         │
│                                         │
└─────────────────────────────────────────┘
```

## Deployment Architecture (Production)

```
┌──────────────────────────────────────────────────┐
│              Load Balancer / CDN                 │
│                (e.g., Cloudflare)                │
└────────────────────┬─────────────────────────────┘
                     │ HTTPS
                     │
┌────────────────────▼─────────────────────────────┐
│           Reverse Proxy (Nginx)                  │
│         SSL Termination, Caching                 │
└────────────────────┬─────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │                       │
┌────────▼────────┐     ┌────────▼────────┐
│  App Server 1   │     │  App Server 2   │
│  (PM2 Cluster)  │     │  (PM2 Cluster)  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
┌────────▼────┐ ┌────▼─────┐ ┌──▼──────┐
│  MongoDB    │ │  Redis   │ │  S3     │
│  Replica    │ │  (Cache) │ │ (Files) │
│  Set        │ │          │ │         │
└─────────────┘ └──────────┘ └─────────┘
```
