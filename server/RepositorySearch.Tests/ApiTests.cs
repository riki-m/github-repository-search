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
    public Task<SearchResult> Search(string query, CancellationToken cancellationToken)
    {
        if (query == "limited") throw new GitHubException(429, "GitHub is limiting requests.");
        return Task.FromResult(new SearchResult(1, false, [Repository]));
    }
}
public sealed class ApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory factory;
    public ApiTests(ApiFactory factory) => this.factory = factory;
    private async Task<HttpClient> Login(string username = "demo1", string password = "Demo1!Pass")
    {
        var client = factory.CreateClient();
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
        Assert.Equal("mit", bookmark.GetProperty("license").GetProperty("key").GetString());
        Assert.True(bookmark.GetProperty("extra_field").GetProperty("preserved").GetBoolean());
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
}
