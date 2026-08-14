using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.OpenApi;
using Platform.Infrastructure;
using Platform.Infrastructure.Multitenancy;
using Platform.Infrastructure.Persistence;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, config) =>
    config.ReadFrom.Configuration(context.Configuration).WriteTo.Console());

builder.Services.AddControllers().AddJsonOptions(options =>
{
    // Without this, enums (OrderStatus, PaymentMethod, ...) serialize as raw integers -
    // admin-frontend and storefront both already assume string values (e.g. "Pending"), so
    // this was a live mismatch, not a preference.
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.Configure<SeedOptions>(builder.Configuration.GetSection(SeedOptions.SectionName));

builder.Services.AddCors(options =>
{
    options.AddPolicy("Default", policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    });
});

builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Platform API", Version = "v1" });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Scheme = "bearer",
        BearerFormat = "JWT",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Description = "Enter a valid JWT access token.",
    });
    options.AddSecurityRequirement(_ => new OpenApiSecurityRequirement
    {
        { new OpenApiSecuritySchemeReference("Bearer", null), new List<string>() },
    });
});

var app = builder.Build();

// Always applies pending migrations and status-definition defaults, regardless of
// Seed:Enabled - those aren't demo data, they're required schema/config for the app to run.
using (var startupScope = app.Services.CreateScope())
{
    var startupDb = startupScope.ServiceProvider.GetRequiredService<AppDbContext>();
    await startupDb.Database.MigrateAsync();
}
await StatusDefinitionSeeder.EnsureDefaultsAsync(app.Services);

// Seeds the first tenant's demo data. Safe to run on every boot (idempotent) - set
// Seed:Enabled=false in production once onboarding is self-service.
if (builder.Configuration.GetValue("Seed:Enabled", true))
{
    var seedOptions = app.Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<SeedOptions>>().Value;
    await DbSeeder.SeedFirstTenantAsync(app.Services, seedOptions);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Serves admin-uploaded images from wwwroot/uploads when using the Local storage provider
// (dev). In production (Storage:Provider=S3), uploads live in the MinIO/S3 bucket instead and
// Caddy proxies /uploads/* straight there, so this middleware is unnecessary - and wwwroot
// may not even exist in that case. wwwroot may not exist yet when the host built its
// static-file provider either way, so (re)create the directory/provider explicitly rather
// than relying on the build-time default.
var storageProvider = builder.Configuration.GetSection("Storage")["Provider"];
if (!string.Equals(storageProvider, "S3", StringComparison.OrdinalIgnoreCase))
{
    var webRootPath = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
    Directory.CreateDirectory(Path.Combine(webRootPath, "uploads"));
    app.Environment.WebRootPath = webRootPath;
    app.Environment.WebRootFileProvider = new PhysicalFileProvider(webRootPath);
    app.UseStaticFiles();
}

app.UseHttpsRedirection();
app.UseCors("Default");

app.UseAuthentication();
// Tenant resolution must run after authentication (it reads JWT claims as a fallback for
// admin/POS traffic that isn't on a customer's branded domain) but before authorization.
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

app.Run();
