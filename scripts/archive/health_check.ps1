$schools = @(
    @{ id = "demo";          host = "demoschool.trendscore.co.ke" },
    @{ id = "jrn-zawadi";    host = "zawadi.trendscore.co.ke" },
    @{ id = "mck";           host = "mck.trendscore.co.ke" },
    @{ id = "merti-cs";      host = "merti-cs.trendscore.co.ke" },
    @{ id = "kambigarba-cs"; host = "kambigarba-cs.trendscore.co.ke" },
    @{ id = "lionscomplex";  host = "lionscomplex.trendscore.co.ke" },
    @{ id = "waso-cs";       host = "waso-cs.trendscore.co.ke" },
    @{ id = "ighs";          host = "ighs.trendscore.co.ke" }
)

Write-Host ""
Write-Host "========================================================"
Write-Host "  TrendSCORE - Post-Deploy Health Check"
$commit = git rev-parse HEAD
Write-Host "  Commit: $commit"
Write-Host "========================================================"
Write-Host ""

$pass = 0
$fail = 0
$dnsFail = 0

foreach ($s in $schools) {
    $url = "https://" + $s.host + "/api/health"
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 12 -ErrorAction Stop
        $status = $r.StatusCode
        if ($status -eq 200) {
            Write-Host ("[OK]      " + $s.id.PadRight(18) + " HTTP " + $status)
            $pass++
        } else {
            Write-Host ("[WARN]    " + $s.id.PadRight(18) + " HTTP " + $status)
            $fail++
        }
    } catch {
        $msg = $_.Exception.Message
        if ($msg -match "resolve|DNS|name") {
            Write-Host ("[DNS-MISS] " + $s.id.PadRight(18) + " DNS not configured")
            $dnsFail++
        } else {
            Write-Host ("[FAIL]    " + $s.id.PadRight(18) + " " + $msg)
            $fail++
        }
    }
}

Write-Host ""
Write-Host "========================================================"
Write-Host ("  Healthy   : " + $pass + " schools")
Write-Host ("  DNS gaps  : " + $dnsFail + " schools (deploy OK, no public DNS)")
Write-Host ("  Failed    : " + $fail + " schools")
Write-Host "========================================================"
Write-Host ""
