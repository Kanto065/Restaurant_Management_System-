using Microsoft.AspNetCore.SignalR;
using Platform.Application.Common;
using Platform.Domain.Enums;

namespace Platform.Infrastructure.Realtime;

public class OrderNotifier(IHubContext<OrderHub> hub) : IOrderNotifier
{
    public Task OrderCreatedAsync(Guid restaurantId, Guid orderId, CancellationToken ct = default) =>
        Send(restaurantId, "OrderCreated", new { orderId }, ct);

    public Task OrderStatusChangedAsync(Guid restaurantId, Guid orderId, OrderStatus status, CancellationToken ct = default) =>
        Send(restaurantId, "OrderStatusChanged", new { orderId, status = status.ToString() }, ct);

    public Task PaymentReceivedAsync(Guid restaurantId, Guid orderId, CancellationToken ct = default) =>
        Send(restaurantId, "PaymentReceived", new { orderId }, ct);

    private Task Send(Guid restaurantId, string method, object payload, CancellationToken ct) =>
        hub.Clients.Group(OrderHub.GroupName(restaurantId.ToString())).SendAsync(method, payload, ct);
}
