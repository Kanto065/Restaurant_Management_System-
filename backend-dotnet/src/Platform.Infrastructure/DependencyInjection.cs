using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Platform.Application.Common;
using Platform.Application.Delivery;
using Platform.Infrastructure.Delivery;
using Platform.Infrastructure.Identity;
using Platform.Infrastructure.Multitenancy;
using Platform.Infrastructure.Payments;
using Platform.Infrastructure.Persistence;
using Platform.Infrastructure.Realtime;
using Platform.Infrastructure.Storage;
using Platform.Infrastructure.Tenancy;
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
        services.AddScoped<TenantProvisioningService>();
        services.AddScoped<Pos.FeatureService>();
        services.AddSingleton<Pos.LicenceSigner>();
        services.AddScoped<Pos.PosOrderSync>();
        services.AddHostedService<Pos.SubscriptionExpiryService>();
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentActor, CurrentActor>();

        services.AddIdentityCore<AppUser>(o =>
            {
                o.Password.RequiredLength = 8;
                // Not unique: a customer can hold separate accounts at different restaurants
                // (see AppUser.CustomerUserName). Look users up by UserName, never FindByEmail.
                o.User.RequireUniqueEmail = false;
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
            .AddPolicy("StaffOnly", p => p.RequireClaim("token_type", "staff")
                .RequireAssertion(ctx => StaffRoles.CanUseAdminPanel(ctx.User)))
            .AddPolicy("CustomerOnly", p => p.RequireClaim("token_type", "customer"))
            .AddPolicy("PlatformSuperAdmin", p => p.RequireClaim("token_type", "platform"))
            .AddPolicy("PosDeviceOnly", p => p.RequireClaim("token_type", "device").RequireClaim("scope", "pos"))
            // Orders endpoints POS terminals need directly (list/read/update status) - staff
            // dashboard and paired Sunmi devices both allowed, nothing else.
            .AddPolicy("StaffOrDevice", p => p.RequireAssertion(ctx =>
                ctx.User.HasClaim("token_type", "device") ||
                (ctx.User.HasClaim("token_type", "staff") && StaffRoles.CanUseAdminPanel(ctx.User))));

        services.AddSingleton<SseConnectionManager>();
        services.AddScoped<IOrderNotifier, OrderNotifier>();

        services.Configure<StripeOptions>(configuration.GetSection(StripeOptions.SectionName));
        services.Configure<PaymentsOptions>(configuration.GetSection(PaymentsOptions.SectionName));
        services.AddSingleton<ISecretProtector, AesGcmSecretProtector>();
        services.AddScoped<IStripeAccountProvider, StripeAccountProvider>();

        services.AddHttpClient<IPostcodeLookup, PostcodesIoLookup>(c =>
        {
            c.BaseAddress = new Uri(configuration["Postcodes:BaseUrl"] ?? "https://api.postcodes.io/");
            c.Timeout = TimeSpan.FromSeconds(8);
        });
        services.AddScoped<DeliveryQuoteService>();
        services.AddScoped<PostcodeGrid>();
        services.AddHttpClient(NamedAreaLookup.NominatimClient, c =>
        {
            c.BaseAddress = new Uri(configuration["Nominatim:BaseUrl"] ?? "https://nominatim.openstreetmap.org/");
            c.Timeout = TimeSpan.FromSeconds(20);
            // OpenStreetMap's usage policy asks every app to identify itself.
            c.DefaultRequestHeaders.UserAgent.ParseAdd("RestaurantPlatform-DeliveryZones/1.0 (+https://www.porttennanttandoori.co.uk)");
        });
        services.AddHttpClient(NamedAreaLookup.PostcodesClient, c =>
        {
            c.BaseAddress = new Uri(configuration["Postcodes:BaseUrl"] ?? "https://api.postcodes.io/");
            c.Timeout = TimeSpan.FromSeconds(8);
        });
        services.AddHttpClient<IRoadDistance, OsrmRoadDistance>(c =>
        {
            c.BaseAddress = new Uri(configuration["Osrm:BaseUrl"] ?? "https://router.project-osrm.org/");
            c.Timeout = TimeSpan.FromSeconds(30);
            c.DefaultRequestHeaders.UserAgent.ParseAdd("RestaurantPlatform-DeliveryZones/1.0 (+https://www.porttennanttandoori.co.uk)");
        });
        services.AddScoped<NamedAreaLookup>();
        services.AddScoped<ZoneToolsService>();

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
