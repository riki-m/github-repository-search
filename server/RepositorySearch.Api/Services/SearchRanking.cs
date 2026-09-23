using System.Text.RegularExpressions;

namespace RepositorySearch.Api.Services;

public static class SearchRanking
{
    public static bool IsValid(string mode) => mode is "best-match" or "inspiration" or "updated";

    public static string? Validate(string query, string mode)
    {
        if (!IsValid(mode)) return "Choose a supported ranking mode.";
        // Do not silently override advanced qualifiers with a conflicting preset.
        if (mode == "inspiration" && Regex.IsMatch(query, @"\b(?:archived|pushed):", RegexOptions.IgnoreCase))
            return "Popular & active adds activity and archive filters. Choose another ranking to use your own pushed: or archived: filters.";
        return null;
    }

    public static (string Query, string? Sort) Build(string query, string mode, DateTimeOffset now)
    {
        // Best match preserves the user's scope; updated changes ordering only.
        // Inspiration adds filters as well as sorting. These signals are not a code-quality score.
        // Rank the full matching set upstream, before pagination. Sorting only the 30
        // downloaded items would miss highly starred repositories on later pages.
        if (mode == "inspiration")
            return ($"{query} archived:false pushed:>={now.UtcDateTime.AddDays(-365):yyyy-MM-dd}", "stars");
        return (query, mode == "best-match" ? null : mode);
    }
}
