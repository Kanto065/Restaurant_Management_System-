namespace Platform.Domain.Enums;

public enum StaffRole
{
    Owner,
    Manager,
    Staff,
    KitchenDisplay,
    // POS-only roles (stored as ints: only append). Blocked from the admin panel.
    Waiter,
    Cashier
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
    Cash,
    /// <summary>Card terminal at the POS, amount entered by hand.</summary>
    Card
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
    Canceled,
    Expired
}

public enum NotificationEventType
{
    NewOrder,
    OrderStatusChanged,
    PaymentReceived,
    EstimatedTimeChanged
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

/// <summary>What a RestaurantDomain serves. Both kinds resolve the tenant from the Host header;
/// the kind tells the super admin panel (and Caddy config) which app sits on that host.</summary>
public enum DomainKind
{
    Storefront,
    Admin
}

// POS enums below are stored as integers - only ever append values.

public enum DeviceType
{
    SunmiTerminal,
    MainPos,
    WaiterTablet
}

/// <summary>Which printer a menu item's ticket goes to.</summary>
public enum PrintRoute
{
    None,
    Kitchen,
    Bar
}

/// <summary>Kitchen/bar progress of one order line. Web orders never read it.</summary>
public enum OrderItemStatus
{
    Pending,
    Sent,
    Ready,
    Served,
    Void
}

public enum PrinterRole
{
    Receipt,
    Kitchen,
    Bar
}

public enum PrinterConnection
{
    Network,
    Usb,
    Windows
}

public enum RefundMethod
{
    Cash,
    Card
}
