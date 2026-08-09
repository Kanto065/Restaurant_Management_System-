using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Platform.Application.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Infrastructure.Realtime;

public class OrderNotifier(IHubContext<OrderHub> hub, AppDbContext db) : IOrderNotifier
{
    public Task OrderCreatedAsync(Guid restaurantId, Guid orderId, CancellationToken ct = default) =>
        SendAndPersist(restaurantId, NotificationEventType.NewOrder, "OrderCreated", new { orderId }, ct);

    public Task OrderStatusChangedAsync(Guid restaurantId, Guid orderId, OrderStatus status, CancellationToken ct = default) =>
        SendAndPersist(restaurantId, NotificationEventType.OrderStatusChanged, "OrderStatusChanged", new { orderId, status = status.ToString() }, ct);

    public Task PaymentReceivedAsync(Guid restaurantId, Guid orderId, CancellationToken ct = default) =>
        SendAndPersist(restaurantId, NotificationEventType.PaymentReceived, "PaymentReceived", new { orderId }, ct);

    private async Task SendAndPersist(Guid restaurantId, NotificationEventType type, string method, object payload, CancellationToken ct)
    {
        db.NotificationEvents.Add(new NotificationEvent
        {
            RestaurantId = restaurantId,
            Type = type,
            PayloadJson = JsonSerializer.Serialize(payload),
        });
        await db.SaveChangesAsync(ct);

        await hub.Clients.Group(OrderHub.GroupName(restaurantId.ToString())).SendAsync(method, payload, ct);
    }
}
