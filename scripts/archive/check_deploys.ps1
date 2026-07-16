$runs = @(
  "27467660774","27466241934","27465224484","27465009531","27461311061",
  "27461154909","27458518268","27433348394","27433319900","27427068650",
  "27423234974","27407153264","27403304041","27403293858","27389047616",
  "27366956578","27364474495","27364471422","27364467550","27364464074",
  "27364461565","27364458864","27363545376","27363542528","27363539336"
)

foreach ($run in $runs) {
  Write-Host "--- Checking run $run ---"
  $log = gh run view $run --repo Amalgamate/trendscore --log 2>&1

  $schoolLine = $log | Select-String "School slug" | Select-Object -First 1
  $tagLine    = $log | Select-String "Image tag" | Select-Object -First 1
  $shaLine    = $log | Select-String "Commit" | Select-Object -First 1

  Write-Host "  School : $schoolLine"
  Write-Host "  Tag    : $tagLine"
  Write-Host "  SHA    : $shaLine"
  Write-Host ""
}
