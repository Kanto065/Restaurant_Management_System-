namespace Platform.Application.Common;

/// <summary>
/// Scoped per-request "who is making this write" context, used to stamp CreatedBy/UpdatedBy on
/// every Entity automatically in AppDbContext.SaveChangesAsync. Resolves to the JWT "sub" claim
/// (the AppUser id, for both staff and customer logins), the POS device id when there's no "sub"
/// (device tokens), or AuditConstants.SystemUserId for anonymous/unauthenticated requests,
/// background jobs, and seeders.
/// </summary>
public interface ICurrentActor
{
    Guid ActorId { get; }
}
