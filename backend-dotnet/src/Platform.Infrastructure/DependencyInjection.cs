using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Platform.Application.Common;
using Platform.Infrastructure.Identity;
using Platform.Infrastructure.Multitenancy;
using Platform.Infrastructure.Persistence;
using Platform.Infrastructure.Realtime;

namespace Platform.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("Postgres")));

        services.AddMemoryCache();

        services.AddScoped<ICurrentTenant, CurrentTenant>();
        services.AddScoped<ITenantDomainResolver, TenantDomainResolver>();

        services.AddIdentityCore<AppUser>(o =>
            {
                o.Password.RequiredLength = 8;
                o.User.RequireUniqueEmail = true;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.AddSingleton<IJwtTokenService, JwtTokenService>();

        var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
                  ?? throw new InvalidOperationException("Jwt configuration section is missing.");

        services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                // Without this, the handler remaps short claim types ("sub", "role", etc.) to
                // long legacy XML-namespace URIs on the way in, so User.FindFirstValue("sub")
                // returns null even though the token has it. Keep claim types exactly as issued.
                options.MapInboundClaims = false;

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = jwt.Issuer,
                    ValidAudience = jwt.Audience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
                    ClockSkew = TimeSpan.FromSeconds(30),
                };

                // Allow SignalR clients to pass the JWT via query string (WebSocket connections
                // can't set an Authorization header) for the /hubs/* paths only.
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        if (!string.IsNullOrEmpty(accessToken) &&
                            context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                        {
                            context.Token = accessToken;
                        }

                        return Task.CompletedTask;
                    },
                };
            });

        services.AddAuthorizationBuilder()
            .AddPolicy("StaffOnly", p => p.RequireClaim("token_type", "staff"))
            .AddPolicy("CustomerOnly", p => p.RequireClaim("token_type", "customer"))
            .AddPolicy("PosDeviceOnly", p => p.RequireClaim("token_type", "device").RequireClaim("scope", "pos"));

        var signalR = services.AddSignalR();
        var redisConnection = configuration.GetConnectionString("Redis");
        if (!string.IsNullOrWhiteSpace(redisConnection))
        {
            // Backplane so the API can run multiple replicas behind the reverse proxy
            // for zero-downtime deploys without splitting SignalR groups across instances.
            signalR.AddStackExchangeRedis(redisConnection);
        }

        services.AddScoped<IOrderNotifier, OrderNotifier>();

        return services;
    }
}
