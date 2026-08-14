using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Http;
using Platform.Application.Common;
using Platform.Domain.Common;

namespace Platform.Infrastructure.Identity;

/// <summary>Scoped (per-request) implementation of ICurrentActor - reads the current JWT off
/// HttpContext.User rather than being explicitly Set() like ICurrentTenant, since there's no
/// separate resolution step needed (the claim is already there once auth has run).</summary>
public class CurrentActor(IHttpContextAccessor httpContextAccessor) : ICurrentActor
{
    public Guid ActorId
    {
        get
        {
            var user = httpContextAccessor.HttpContext?.User;
            if (user?.Identity?.IsAuthenticated != true)
                return AuditConstants.SystemUserId;

            if (Guid.TryParse(user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var userId))
                return userId;

            // Device tokens (POS terminals) carry no "sub" claim - fall back to the device id so
            // device-driven writes are still traceable to a specific terminal, not just "System".
            if (Guid.TryParse(user.FindFirst("device_id")?.Value, out var deviceId))
                return deviceId;

            return AuditConstants.SystemUserId;
        }
    }
}
