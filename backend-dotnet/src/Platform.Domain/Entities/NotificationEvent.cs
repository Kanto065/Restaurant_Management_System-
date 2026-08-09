using Platform.Domain.Common;
using Platform.Domain.Enums;

namespace Platform.Domain.Entities;

/// <summary>
/// Durable log backing SignalR pushes, so POS/admin clients can reconcile missed
/// events after a reconnect instead of relying on fire-and-forget delivery.
/// </summary>
public class NotificationEvent : TenantEntity
{
    public NotificationEventType Type { get; set; }
    public string PayloadJson { get; set; } = "{}";
    public bool DeliveredToPos { get; set; }
    public bool DeliveredToAdmin { get; set; }
}
