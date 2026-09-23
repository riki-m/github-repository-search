using System.Collections.Concurrent;
using System.Text.Json;

namespace RepositorySearch.Api.Services;

public sealed class SessionStore(TimeProvider clock)
{
    private readonly ConcurrentDictionary<string, UserSession> sessions = new();
    private readonly object creationLock = new();

    public UserSession Create(string userId)
    {
        lock (creationLock)
        {
            RemoveExpired();
            if (sessions.Count >= 1000) throw new InvalidOperationException("Session capacity reached.");
            var session = new UserSession(Guid.NewGuid().ToString("N"), userId, clock.GetUtcNow().AddHours(1));
            sessions[session.Id] = session;
            return session;
        }
    }
    public UserSession? Find(string? id, string? userId)
    {
        if (id is null || !sessions.TryGetValue(id, out var session) || session.UserId != userId) return null;
        if (session.ExpiresAt > clock.GetUtcNow()) return session;
        sessions.TryRemove(id, out _);
        return null;
    }
    public void Remove(string id) => sessions.TryRemove(id, out _);
    public void RemoveExpired()
    {
        foreach (var item in sessions)
            if (item.Value.ExpiresAt <= clock.GetUtcNow()) sessions.TryRemove(item.Key, out _);
    }
}
public sealed class SessionCleanup(SessionStore sessions) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        try { while (await timer.WaitForNextTickAsync(stoppingToken)) sessions.RemoveExpired(); }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }
}
public sealed class UserSession(string id, string userId, DateTimeOffset expiresAt)
{
    // One lock makes duplicate checks, capacity checks and inserts atomic for parallel saves.
    private readonly object gate = new();
    private readonly Dictionary<long, JsonElement> recentResults = new();
    private readonly Dictionary<long, JsonElement> bookmarks = new();
    public string Id { get; } = id;
    public string UserId { get; } = userId;
    public DateTimeOffset ExpiresAt { get; } = expiresAt;
    public void Remember(IEnumerable<JsonElement> results)
    {
        lock (gate)
        {
            // Bound search history independently of bookmarks.
            if (recentResults.Count >= 300) recentResults.Clear();
            foreach (var result in results) recentResults[result.GetProperty("id").GetInt64()] = result.Clone();
        }
    }
    public BookmarkResult Bookmark(long repositoryId)
    {
        lock (gate)
        {
            if (bookmarks.ContainsKey(repositoryId)) return BookmarkResult.Saved;
            if (!recentResults.TryGetValue(repositoryId, out var repository)) return BookmarkResult.NotFound;
            if (bookmarks.Count >= 100) return BookmarkResult.LimitReached;
            bookmarks[repositoryId] = repository.Clone();
            return BookmarkResult.Saved;
        }
    }
    public JsonElement[] Bookmarks() { lock (gate) return bookmarks.Values.ToArray(); }
}
public enum BookmarkResult { Saved, NotFound, LimitReached }
