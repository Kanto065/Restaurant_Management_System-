using Platform.Domain.Common;
using Platform.Domain.Enums;

namespace Platform.Domain.Entities;

public class Table : TenantEntity
{
    public string TableNumber { get; set; } = default!;
    public int Capacity { get; set; }
    public string? Location { get; set; }
    public string QrToken { get; set; } = Guid.NewGuid().ToString("N");
    public bool IsActive { get; set; } = true;

    public Restaurant? Restaurant { get; set; }
}

public class Order : TenantEntity
{
    /// <summary>Short random human-readable order code (e.g. "A3F9K"), unique per restaurant — generated
    /// in PublicOrdersController.GenerateOrderCode. Doesn't reveal order volume the way a sequential
    /// number would, and stays a fixed length regardless of how many orders the restaurant has taken.</summary>
    public string OrderNumber { get; set; } = default!;

    public OrderType OrderType { get; set; }
    public Guid? TableId { get; set; }
    public Table? Table { get; set; }

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public string? CustomerName { get; set; }
    public string? CustomerPhone { get; set; }
    public string? CustomerEmail { get; set; }

    public Guid? DeliveryAddressId { get; set; }
    public CustomerAddress? DeliveryAddress { get; set; }

    public decimal Subtotal { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal ProcessingFee { get; set; }
    public decimal DiscountAmount { get; set; }
    public Guid? VoucherId { get; set; }
    public string? VoucherCodeSnapshot { get; set; }
    public int LoyaltyPointsRedeemed { get; set; }
    public int LoyaltyPointsEarned { get; set; }
    public decimal TotalAmount { get; set; }

    public PaymentMethod PaymentMethod { get; set; }
    /// <summary>Name of a PaymentStatusDefinition row, not an enum - see StatusDefinitions.cs.</summary>
    public string PaymentStatus { get; set; } = default!;
    /// <summary>Name of an OrderStatusDefinition row, not an enum - see StatusDefinitions.cs.</summary>
    public string Status { get; set; } = default!;
    public DateTimeOffset? EstimatedReadyAt { get; set; }
    public string? SpecialRequests { get; set; }
    public OrderSource Source { get; set; } = OrderSource.Web;
    // IsDeleted/CreatedBy/UpdatedBy come from Entity - AppDbContext stamps CreatedBy/UpdatedBy
    // automatically from ICurrentActor, and IsDeleted is filtered out by the global query filter.

    public List<OrderItem> Items { get; set; } = [];
    public List<OrderStatusHistory> StatusHistory { get; set; } = [];
    public List<Payment> Payments { get; set; } = [];
}

public class OrderItem : TenantEntity
{
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }

    public Guid MenuItemId { get; set; }
    public string NameSnapshot { get; set; } = default!;
    public decimal UnitPriceSnapshot { get; set; }
    public int Quantity { get; set; } = 1;
    public string? SpecialInstructions { get; set; }
    public decimal LineTotal { get; set; }

    public List<OrderItemModifier> Modifiers { get; set; } = [];
}

public class OrderItemModifier : TenantEntity
{
    public Guid OrderItemId { get; set; }
    public OrderItem? OrderItem { get; set; }

    public Guid ModifierOptionId { get; set; }
    public string NameSnapshot { get; set; } = default!;
    public decimal PriceDeltaSnapshot { get; set; }
}

public class OrderStatusHistory : TenantEntity
{
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }

    public string Status { get; set; } = default!;
    public Guid? ChangedByUserId { get; set; }
    public string? Note { get; set; }
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}

public class Payment : TenantEntity
{
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }

    public PaymentProvider Provider { get; set; }
    public string? StripePaymentIntentId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "GBP";
    /// <summary>Name of a PaymentStatusDefinition row, not an enum - see StatusDefinitions.cs.</summary>
    public string Status { get; set; } = default!;
    public string? RawEventLogJson { get; set; }
}

/// <summary>Idempotency guard for Stripe webhook processing.</summary>
public class ProcessedPaymentEvent : Common.Entity
{
    public string Provider { get; set; } = "stripe";
    public string EventId { get; set; } = default!;
    public DateTimeOffset ProcessedAt { get; set; } = DateTimeOffset.UtcNow;
}
