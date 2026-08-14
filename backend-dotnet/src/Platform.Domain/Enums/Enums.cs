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

public enum PaymentProvider
{
    Stripe,
    Cash
}

public enum SpiceLevel
{
    None = 0,
    Mild = 1,
    Medium = 2,
    Hot = 3
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

/// <summary>Industry-standard split: a Variation replaces the item's price (e.g. choosing
/// Chicken vs Lamb changes what the dish costs outright), a Modifier adds to whatever price
/// was already reached (e.g. +£0.50 for extra cheese). Both are still stored identically as a
/// ModifierGroup/ModifierOption with a priceDelta - this only changes how the admin UI treats
/// the group and its price fields, not the underlying pricing math or the public API.</summary>
public enum ModifierGroupType
{
    Modifier,
    Variation
}
