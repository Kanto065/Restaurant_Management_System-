namespace Platform.Domain.Enums;

public enum StaffRole
{
    Owner,
    Manager,
    Staff,
    KitchenDisplay
}

public enum OrderType
{
    DineIn,
    Collection,
    Delivery
}

public enum OrderStatus
{
    Pending,
    Confirmed,
    Preparing,
    Ready,
    OutForDeliveryOrServed,
    Completed,
    Cancelled
}

public enum OrderSource
{
    Web,
    Pos,
    Kiosk
}

public enum PaymentMethod
{
    Card,
    Cash,
    ApplePay,
    GooglePay
}

public enum PaymentStatus
{
    Pending,
    Authorized,
    Paid,
    Failed,
    Refunded,
    PartiallyRefunded
}

public enum PaymentProvider
{
    Stripe,
    Cash
}

public enum SpiceLevel
{
    None,
    Mild,
    Medium,
    Hot,
    ExtraHot
}

public enum LoyaltyTransactionReason
{
    Earned,
    Redeemed,
    Adjusted,
    Expired
}

public enum SubscriptionStatus
{
    Trialing,
    Active,
    PastDue,
    Canceled
}

public enum NotificationEventType
{
    NewOrder,
    OrderStatusChanged,
    PaymentReceived
}

public enum VoucherDiscountType
{
    Percentage,
    FixedAmount
}
