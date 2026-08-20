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
using Platform.Infrastructure.Payments;
using Platform.Infrastructure.Persistence;
using Platform.Infrastructure.Realtime;
using Platform.Infrastructure.Storage;
using Stripe;

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
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentActor, CurrentActor>();

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

                // Browser EventSource (and the Android POS's OkHttp SSE client) can't set a
                // custom Authorization header, so allow the token via query string for the
                // SSE stream path only.
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        if (!string.IsNullOrEmpty(accessToken) &&
                            context.HttpContext.Request.Path.StartsWithSegments("/api/events"))
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
            .AddPolicy("PosDeviceOnly", p => p.RequireClaim("token_type", "device").RequireClaim("scope", "pos"))
            // Orders endpoints POS terminals need directly (list/read/update status) - staff
            // dashboard and paired Sunmi devices both allowed, nothing else.
            .AddPolicy("StaffOrDevice", p => p.RequireAssertion(ctx =>
                ctx.User.HasClaim(c => c.Type == "token_type" && (c.Value == "staff" || c.Value == "device"))));

        services.AddSingleton<SseConnectionManager>();
        services.AddScoped<IOrderNotifier, OrderNotifier>();

        services.Configure<StripeOptions>(configuration.GetSection(StripeOptions.SectionName));
        services.AddSingleton(sp =>
            new StripeClient(sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<StripeOptions>>().Value.SecretKey));

        services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.SectionName));
        var storageProvider = configuration.GetSection(StorageOptions.SectionName)["Provider"];
        if (string.Equals(storageProvider, "S3", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<IFileStorage, S3FileStorage>();
        }
        else
        {
            services.AddScoped<IFileStorage, LocalFileStorage>();
        }

        return services;
    }
}
