using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace RepositorySearch.Api.Services;

public static class RequestPolicies
{
    public const string Login = "login";
    public const string Search = "search";

    public static IServiceCollection AddRequestPolicies(this IServiceCollection services, IConfiguration configuration)
    {
        var loginLimit = ReadLimit(configuration, "LoginPerMinute", 10);
        var searchLimit = ReadLimit(configuration, "SearchPerUserPerMinute", 8);
        var totalSearchLimit = ReadLimit(configuration, "SearchTotalPerMinute", 10);

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, cancellationToken) =>
            {
                var seconds = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
                    ? Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds)) : 60;
                context.HttpContext.Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
                await Results.Problem(statusCode: 429,
                    detail: $"Too many requests. Please try again in {seconds} seconds.")
                    .ExecuteAsync(context.HttpContext);
            };
            options.AddPolicy(Login, context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => Window(loginLimit)));
            // Use the authenticated account, not a token or session ID: logging in again must not reset this budget.
            options.AddPolicy(Search, context => RateLimitPartition.GetFixedWindowLimiter(
                context.User.FindFirst("sub")?.Value ?? "anonymous", _ => Window(searchLimit)));
            // Both demo accounts share GitHub's unauthenticated outbound quota.
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                context.Request.Method == HttpMethods.Get &&
                string.Equals(context.Request.Path.Value?.TrimEnd('/'), "/api/repositories", StringComparison.OrdinalIgnoreCase)
                    ? RateLimitPartition.GetFixedWindowLimiter("github-search", _ => Window(totalSearchLimit))
                    : RateLimitPartition.GetNoLimiter("other"));
        });
        return services;
    }

    private static FixedWindowRateLimiterOptions Window(int limit) => new()
    {
        PermitLimit = limit,
        Window = TimeSpan.FromMinutes(1),
        QueueLimit = 0,
        AutoReplenishment = true
    };

    private static int ReadLimit(IConfiguration configuration, string name, int fallback)
    {
        var limit = configuration.GetValue($"RequestLimits:{name}", fallback);
        return limit > 0 ? limit : throw new InvalidOperationException($"RequestLimits:{name} must be positive.");
    }
}
