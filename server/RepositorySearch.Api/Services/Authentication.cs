using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace RepositorySearch.Api.Services;

public sealed class DemoUsers
{
    // Public demo fixtures, NOT a production password store.
    private readonly Dictionary<string, byte[]> passwords = new(StringComparer.Ordinal)
    {
        ["demo1"] = SHA256.HashData(Encoding.UTF8.GetBytes("Demo1!Pass")),
        ["demo2"] = SHA256.HashData(Encoding.UTF8.GetBytes("Demo2!Pass"))
    };
    public bool Validate(string username, string password)
    {
        var candidate = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        var exists = passwords.TryGetValue(username, out var expected);
        return CryptographicOperations.FixedTimeEquals(candidate, expected ?? new byte[32]) && exists;
    }
}
public sealed record TokenSettings(string Key)
{
    public const string Issuer = "repository-search-api";
    public const string Audience = "repository-search-client";
}
public sealed class TokenService(TokenSettings settings, TimeProvider clock)
{
    public string Issue(UserSession session)
    {
        var token = new JwtSecurityToken(TokenSettings.Issuer, TokenSettings.Audience,
            [new Claim("sub", session.UserId), new Claim("sid", session.Id)],
            clock.GetUtcNow().UtcDateTime, session.ExpiresAt.UtcDateTime,
            new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.Key)), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
