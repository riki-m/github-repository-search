param(
    [string]$ApiBase = 'http://127.0.0.1:5080',
    [ValidateSet('identity','ranking')][string]$Group = 'identity',
    [string]$OutputPath = 'live-search-evidence.json'
)
$ErrorActionPreference = 'Stop'
# Public evaluation fixtures only. Keep the temporary JWT in memory and revoke this test session.
$login = Invoke-RestMethod "$ApiBase/api/auth/login" -Method Post -ContentType 'application/json' -Body '{"username":"demo2","password":"Demo2!Pass"}'
$authorization = @{ Authorization = "Bearer $($login.token)" }
$githubHeaders = @{ 'User-Agent' = 'RepositorySearch-QA'; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28' }
$cases = if ($Group -eq 'identity') {
    @(
        @{ q='HILAN'; page=1; ranking='best-match'; nameOnly=$false },
        @{ q='HILAN'; page=2; ranking='best-match'; nameOnly=$false },
        @{ q='HILAN-TEST'; page=1; ranking='best-match'; nameOnly=$true },
        @{ q='repo:riki-m/Hilan-Test'; page=1; ranking='best-match'; nameOnly=$false }
    )
} else {
    @(
        @{ q='HILAN'; page=1; ranking='updated'; nameOnly=$false },
        @{ q='HILAN'; page=1; ranking='inspiration'; nameOnly=$false }
    )
}
try {
    $evidence = foreach ($case in $cases) {
        $effective = $case.q
        if ($case.nameOnly) { $effective += ' in:name' }
        $sort = ''
        if ($case.ranking -eq 'updated') { $sort = '&sort=updated&order=desc' }
        if ($case.ranking -eq 'inspiration') {
            $effective += ' archived:false pushed:>=' + [DateTime]::UtcNow.AddDays(-365).ToString('yyyy-MM-dd')
            $sort = '&sort=stars&order=desc'
        }
        $directUrl = 'https://api.github.com/search/repositories?q=' + [Uri]::EscapeDataString($effective) + '&per_page=30&page=' + $case.page + $sort
        $apiUrl = "$ApiBase/api/repositories?q=" + [Uri]::EscapeDataString($case.q) + '&page=' + $case.page + '&ranking=' + $case.ranking + '&nameOnly=' + $case.nameOnly.ToString().ToLowerInvariant()
        $direct = Invoke-WebRequest $directUrl -Headers $githubHeaders -SkipHttpErrorCheck
        $server = Invoke-WebRequest $apiUrl -Headers $authorization -SkipHttpErrorCheck
        $gh = $direct.Content | ConvertFrom-Json
        $api = $server.Content | ConvertFrom-Json
        $idsEqual = $null; $cardsEqual = $null
        if ($direct.StatusCode -eq 200 -and $server.StatusCode -eq 200) {
            $idsEqual = (@($gh.items.id) -join ',') -eq (@($api.items.id) -join ',')
            $cardsEqual = $idsEqual
            for ($i=0; $i -lt $api.items.Count -and $cardsEqual; $i++) {
                foreach ($field in @('name','full_name','html_url','description','language','stargazers_count','forks_count','pushed_at','archived')) {
                    if ($api.items[$i].$field -ne $gh.items[$i].$field) { $cardsEqual = $false }
                }
                if ($api.items[$i].owner.login -ne $gh.items[$i].owner.login -or $api.items[$i].owner.avatar_url -ne $gh.items[$i].owner.avatar_url) { $cardsEqual = $false }
            }
        }
        [ordered]@{
            timestampUtc=[DateTime]::UtcNow.ToString('o'); query=$case; directUrl=$directUrl;
            githubStatus=[int]$direct.StatusCode; apiStatus=[int]$server.StatusCode;
            githubTotal=$gh.total_count; apiTotal=$api.totalCount;
            githubIncomplete=$gh.incomplete_results; apiIncomplete=$api.incompleteResults;
            githubCount=@($gh.items).Count; apiCount=@($api.items).Count;
            orderedIdsEqual=$idsEqual; cardFieldsEqual=$cardsEqual;
            targetFound=@($gh.items.full_name) -contains 'riki-m/Hilan-Test';
            githubNames=@($gh.items.full_name); apiNames=@($api.items.full_name);
            errorDetail=$api.detail
        }
    }
    $evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
    $evidence | ForEach-Object { [pscustomobject]@{ Query=$_.query.q; Ranking=$_.query.ranking; Page=$_.query.page; GitHub=$_.githubStatus; API=$_.apiStatus; Total=$_.githubTotal; IDs=$_.orderedIdsEqual; Cards=$_.cardFieldsEqual; Target=$_.targetFound } } | Format-Table
} finally {
    Invoke-WebRequest "$ApiBase/api/auth/logout" -Method Post -Headers $authorization -SkipHttpErrorCheck | Out-Null
}
