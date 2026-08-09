using Platform.Domain.Enums;

namespace Platform.Application.Common;

/// <summary>Pushes realtime order events to the restaurant's admin dashboard and POS terminals.</summary>
public interface IOrderNotifier
{
    Task OrderCreatedAsync(Guid restaurantId, Guid orderId, CancellationToken ct = default);

    Task OrderStatusChangedAsync(Guid restaurantId, Guid orderId, OrderStatus status, CancellationToken ct = default);

    Task PaymentReceivedAsync(Guid restaurantId, Guid orderId, CancellationToken ct = default);
}
