namespace Platform.Domain.Common;

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
}

public abstract class TenantEntity : Entity, IHasTenant
{
    public Guid RestaurantId { get; set; }
}
