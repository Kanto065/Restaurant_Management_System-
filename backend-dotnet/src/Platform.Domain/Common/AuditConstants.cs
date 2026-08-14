namespace Platform.Domain.Common;

/// <summary>
/// Sentinel actor id for CreatedBy/UpdatedBy audit columns when no staff or customer user is
/// involved - seeders, background jobs, and other system-triggered writes. Kept as a fixed,
/// greppable value (rather than nullable) so the columns can stay NOT NULL.
/// </summary>
public static class AuditConstants
{
    public static readonly Guid SystemUserId = Guid.Empty;
}
