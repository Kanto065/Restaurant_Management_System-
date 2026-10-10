namespace Platform.Application.Common;

public interface ICardPayments
{
    /// <summary>False when the restaurant has no Stripe account to take card payments with.</summary>
    Task<bool> IsAvailableAsync(Guid restaurantId, CancellationToken ct = default);
}
