using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using RepositorySearch.Api.Services;

namespace RepositorySearch.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.ConfigureServices(services =>
    {
        services.RemoveAll<IGitHubSearch>();
        services.AddSingleton<IGitHubSearch, FakeGitHub>();
    });
}
public sealed class FakeGitHub : IGitHubSearch
{
    public int LastPage { get; private set; }
    public string? LastRanking { get; private set; }
    public string? LastQuery { get; private set; }
    public static readonly JsonElement Repository = JsonSerializer.SerializeToElement(new
    {
        id = 42L,
        name = "example",
        full_name = "owner/example",
        owner = new { login = "owner", avatar_url = "https://avatars.githubusercontent.com/u/1" },
        html_url = "https://github.com/owner/example",
        description = "A repository",
        license = new { key = "mit" },
        extra_field = new { preserved = true }
    });
    public Task<SearchResult> Search(string query, CancellationToken cancellationToken, int page = 1, string ranking = "best-match")
    {
        LastPage = page;
        LastRanking = ranking;
        LastQuery = query;
        if (query == "limited") throw new GitHubException(429, "GitHub is limiting requests.");
        if (query == "invalid-schema") return Task.FromResult(new SearchResult(2, false,
            [Repository, JsonSerializer.SerializeToElement(new { id = 99, name = (string?)null })]));
        return Task.FromResult(new SearchResult(1, false, [Repository]));
    }
}
public sealed class ApiTests : IDisposable
{
    [Fact]
    public async Task Malformed_page_is_rejected_before_any_results_are_remembered()
    {
        using var client = await Login();
        var response = await client.GetAsync("/api/repositories?q=invalid-schema");
        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.Contains("unreadable", await response.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync("/api/bookmarks/42", null)).StatusCode);
    }

    [Theory]
    [InlineData(false, "USER")]
    [InlineData(true, "USER in:name")]
    public async Task Name_scope_is_applied_before_paged_search(bool nameOnly, string expected)
    {
        using var client = await Login();
        (await client.GetAsync($"/api/repositories?q=USER&page=2&ranking=inspiration&nameOnly={nameOnly}")).EnsureSuccessStatusCode();
        var github = (FakeGitHub)factory.Services.GetRequiredService<IGitHubSearch>();
        Assert.Equal(expected, github.LastQuery);
        Assert.Equal(2, github.LastPage);
        Assert.Equal("inspiration", github.LastRanking);
    }
    [Theory]
    [InlineData("USER%20in:description", "true")]
    [InlineData("USER%20IN:name", "true")]
    [InlineData("USER", "invalid")]
    public async Task Invalid_scope_is_rejected_before_GitHub(string query, string scope)
    {
        using var client = await Login();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/repositories?q={query}&nameOnly={scope}")).StatusCode);
        Assert.Null(((FakeGitHub)factory.Services.GetRequiredService<IGitHubSearch>()).LastQuery);
    }
    [Fact]
    public async Task Unchecked_scope_preserves_advanced_query()
    {
        using var client = await Login();
        (await client.GetAsync("/api/repositories?q=USER%20in:description")).EnsureSuccessStatusCode();
        Assert.Equal("USER in:description", ((FakeGitHub)factory.Services.GetRequiredService<IGitHubSearch>()).LastQuery);
    }
    [Theory]
    [InlineData("inspiration")]
    [InlineData("updated")]
    public async Task Ranking_is_forwarded_to_GitHub(string ranking)
    {
        using var client = await Login();
        (await client.GetAsync($"/api/repositories?q=test&page=2&ranking={ranking}")).EnsureSuccessStatusCode();
        Assert.Equal(ranking, ((FakeGitHub)factory.Services.GetRequiredService<IGitHubSearch>()).LastRanking);
    }
    [Theory]
    [InlineData("test", "views")]
    [InlineData("test%20archived:true", "inspiration")]
    public async Task Invalid_ranking_does_not_call_GitHub(string query, string ranking)
    {
        using var client = await Login();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/repositories?q={query}&ranking={ranking}")).StatusCode);
        Assert.Null(((FakeGitHub)factory.Services.GetRequiredService<IGitHubSearch>()).LastRanking);
    }
    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("35")]
    [InlineData("1.5")]
    [InlineData("abc")]
    public async Task Invalid_page_is_rejected_without_calling_GitHub(string page)
    {
        using var client = await Login();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/repositories?q=test&page={page}")).StatusCode);
        Assert.Equal(0, ((FakeGitHub)factory.Services.GetRequiredService<IGitHubSearch>()).LastPage);
    }
    [Theory]
    [InlineData("", 1)]
    [InlineData("&page=6", 6)]
    [InlineData("&page=34", 34)]
    public async Task Requested_page_is_forwarded_and_results_can_be_bookmarked(string suffix, int expected)
    {
        using var client = await Login();
        (await client.GetAsync("/api/repositories?q=test" + suffix)).EnsureSuccessStatusCode();
        Assert.Equal(expected, ((FakeGitHub)factory.Services.GetRequiredService<IGitHubSearch>()).LastPage);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/bookmarks/42", null)).StatusCode);
    }
    // Each test gets a fresh limiter budget, matching a fresh application instance.
    private readonly ApiFactory factory = new();
    public void Dispose() => factory.Dispose();
    private async Task<HttpClient> Login(string username = "demo1", string password = "Demo1!Pass",
        WebApplicationFactory<Program>? host = null)
    {
        var client = (host ?? factory).CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { username, password });
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.GetProperty("token").GetString());
        return client;
    }
    [Theory]
    [InlineData("/api/repositories?q=angular")]
    [InlineData("/api/bookmarks")]
    public async Task Protected_routes_reject_anonymous_requests(string route)
    {
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(route)).StatusCode);
    }
    [Fact]
    public async Task Incorrect_credentials_are_rejected()
    {
        using var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { username = "demo1", password = "wrong" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
    [Fact]
    public async Task Invalid_token_is_rejected()
    {
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", "not-a-valid-jwt");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/bookmarks")).StatusCode);
    }
    [Fact]
    public async Task Expired_signed_token_is_rejected()
    {
        using var client = factory.CreateClient();
        var session = factory.Services.GetRequiredService<SessionStore>().Create("demo1");
        var settings = factory.Services.GetRequiredService<TokenSettings>();
        var token = new JwtSecurityToken(TokenSettings.Issuer, TokenSettings.Audience,
            [new Claim("sub", "demo1"), new Claim("sid", session.Id)],
            DateTime.UtcNow.AddHours(-2), DateTime.UtcNow.AddHours(-1),
            new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.Key)), SecurityAlgorithms.HmacSha256));
        client.DefaultRequestHeaders.Authorization = new("Bearer", new JwtSecurityTokenHandler().WriteToken(token));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/bookmarks")).StatusCode);
    }
    [Fact]
    public async Task Full_result_is_preserved_and_parallel_saves_are_idempotent()
    {
        using var client = await Login();
        (await client.GetAsync("/api/repositories?q=example")).EnsureSuccessStatusCode();
        var responses = await Task.WhenAll(Enumerable.Range(0, 12).Select(_ => client.PostAsync("/api/bookmarks/42", null)));
        Assert.All(responses, response => Assert.Equal(HttpStatusCode.NoContent, response.StatusCode));
        var bookmarks = await client.GetFromJsonAsync<JsonElement[]>("/api/bookmarks");
        var bookmark = Assert.Single(bookmarks!);
        Assert.Equal(42, bookmark.GetProperty("id").GetInt64());
        Assert.False(bookmark.TryGetProperty("extra_field", out _));
        var token = new JwtSecurityTokenHandler().ReadJwtToken(client.DefaultRequestHeaders.Authorization!.Parameter);
        var sessionId = token.Claims.Single(c => c.Type == "sid").Value;
        var session = factory.Services.GetRequiredService<SessionStore>().Find(sessionId, "demo1")!;
        var fullBookmark = Assert.Single(session.Bookmarks());
        Assert.Equal("mit", fullBookmark.GetProperty("license").GetProperty("key").GetString());
        Assert.True(fullBookmark.GetProperty("extra_field").GetProperty("preserved").GetBoolean());
    }
    [Fact]
    public async Task Users_and_separate_logins_do_not_share_bookmarks()
    {
        using var first = await Login();
        using var other = await Login("demo2", "Demo2!Pass");
        using var newLogin = await Login();
        (await first.GetAsync("/api/repositories?q=example")).EnsureSuccessStatusCode();
        (await first.PostAsync("/api/bookmarks/42", null)).EnsureSuccessStatusCode();
        Assert.Empty((await other.GetFromJsonAsync<JsonElement[]>("/api/bookmarks"))!);
        Assert.Empty((await newLogin.GetFromJsonAsync<JsonElement[]>("/api/bookmarks"))!);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsync("/api/bookmarks/42", null)).StatusCode);
    }
    [Fact]
    public async Task Unknown_repository_cannot_be_injected()
    {
        using var client = await Login();
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync("/api/bookmarks/999", null)).StatusCode);
    }
    [Theory]
    [InlineData("/api/repositories")]
    [InlineData("/api/repositories?q=%20%20")]
    public async Task Empty_query_is_rejected(string route)
    {
        using var client = await Login();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync(route)).StatusCode);
    }
    [Fact]
    public async Task Upstream_rate_limit_has_a_useful_response()
    {
        using var client = await Login();
        var response = await client.GetAsync("/api/repositories?q=limited");
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Contains("GitHub", await response.Content.ReadAsStringAsync());
    }
    [Fact]
    public async Task Logout_revokes_token_session()
    {
        using var client = await Login();
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/auth/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/bookmarks")).StatusCode);
    }

    [Fact]
    public async Task Search_returns_only_the_fields_used_by_the_gallery()
    {
        using var client = await Login();
        var response = await client.GetFromJsonAsync<JsonElement>("/api/repositories?q=example");
        var item = Assert.Single(response.GetProperty("items").EnumerateArray());
        Assert.Equal("example", item.GetProperty("name").GetString());
        Assert.Equal("owner", item.GetProperty("owner").GetProperty("login").GetString());
        Assert.False(item.TryGetProperty("license", out _));
        Assert.False(item.TryGetProperty("extra_field", out _));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Personal_responses_and_auth_failures_are_not_cached(bool authenticated)
    {
        using var client = authenticated ? await Login() : factory.CreateClient();
        var response = await client.GetAsync("/api/bookmarks");
        Assert.Equal(authenticated ? HttpStatusCode.OK : HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
    }

    [Fact]
    public async Task Login_rate_limit_rejects_excess_attempts_with_retry_guidance()
    {
        using var client = factory.CreateClient();
        for (var i = 0; i < 10; i++)
        {
            using var response = await client.PostAsJsonAsync("/api/auth/login", new { username = "demo1", password = "wrong" });
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        var rejected = await client.PostAsJsonAsync("/api/auth/login", new { username = "demo1", password = "Demo1!Pass" });
        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
        Assert.NotNull(rejected.Headers.RetryAfter);
        Assert.True(rejected.Headers.CacheControl?.NoStore);
        Assert.Contains("try again", await rejected.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Search_budget_is_per_account_and_cannot_be_reset_by_logging_in_again()
    {
        // Isolate the per-account policy from the separately tested shared budget.
        using var host = factory.WithWebHostBuilder(builder => builder.UseSetting("RequestLimits:SearchTotalPerMinute", "100"));
        using var client = await Login(host: host);
        for (var i = 0; i < 8; i++)
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/repositories?q=example")).StatusCode);
        using var newSession = await Login(host: host);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await newSession.GetAsync("/api/repositories?q=example")).StatusCode);
        using var other = await Login("demo2", "Demo2!Pass", host);
        Assert.Equal(HttpStatusCode.OK, (await other.GetAsync("/api/repositories?q=example")).StatusCode);
        // Exhausting search must not prevent reading saved items or signing out.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/bookmarks")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/auth/logout", null)).StatusCode);
    }

    [Fact]
    public async Task Search_has_a_shared_outbound_budget_across_accounts()
    {
        using var first = await Login();
        using var second = await Login("demo2", "Demo2!Pass");
        for (var i = 0; i < 6; i++)
            Assert.Equal(HttpStatusCode.OK, (await first.GetAsync("/api/repositories?q=example")).StatusCode);
        for (var i = 0; i < 4; i++)
            Assert.Equal(HttpStatusCode.OK, (await second.GetAsync("/api/repositories?q=example")).StatusCode);
        var rejected = await second.GetAsync("/api/repositories?q=example");
        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
        Assert.NotNull(rejected.Headers.RetryAfter);
    }
}
