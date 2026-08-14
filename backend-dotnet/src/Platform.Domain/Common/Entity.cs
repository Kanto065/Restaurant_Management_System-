namespace Platform.Domain.Common;

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Who created/last touched this row - stamped automatically by
    /// AppDbContext.SaveChangesAsync from ICurrentActor, never left unset. See AuditConstants
    /// for the "no real user involved" sentinel used by seeders and unauthenticated writes.</summary>
    public Guid CreatedBy { get; set; } = AuditConstants.SystemUserId;
    public Guid UpdatedBy { get; set; } = AuditConstants.SystemUserId;

    /// <summary>Soft-delete flag, filtered out of every query by a global EF Core query filter -
    /// see AppDbContext.ApplyEntityConfiguration. Deletes should always go through this rather
    /// than removing the row, since these are business/audit records.</summary>
    public bool IsDeleted { get; set; }
}

public abstract class TenantEntity : Entity, IHasTenant
{
    public Guid RestaurantId { get; set; }
}
