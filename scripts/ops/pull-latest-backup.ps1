<#
Pulls the newest nightly billing backup from the VPS to this laptop (L2C-0-09 offsite copy).

Run daily from Task Scheduler (see the install notes below). Safe to run repeatedly.
- verifies the download by SHA-256 against the file on the server
- keeps the newest 30 local files, deletes older ones
- shows a message box if the pull fails or the newest backup is older than 48 hours

The backups contain real customer data: keep them off cloud-synced folders (OneDrive,
Google Drive, Dropbox) and keep the drive encrypted (BitLocker / Device encryption).

Install (once, PowerShell):
  $a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\Amalgamate\Projects\TrendSCORE\scripts\ops\pull-latest-backup.ps1"'
  $t = New-ScheduledTaskTrigger -Daily -At 9:00AM
  $s = New-ScheduledTaskSettingsSet -StartWhenAvailable
  Register-ScheduledTask -TaskName 'TrendSCORE backup pull' -Action $a -Trigger $t -Settings $s
(-StartWhenAvailable runs a missed task as soon as the laptop is back on.)
#>
param(
  [string]$SshHost   = 'production',
  [string]$RemoteDir = '/srv/zawadi/apps/console-data/billing-backups',
  [string]$LocalDir  = (Join-Path $env:USERPROFILE 'TrendscoreBackups'),
  [int]$KeepFiles    = 30,
  [int]$StaleHours   = 48
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null
$log = Join-Path $LocalDir 'pull.log'

function Log($msg) { "$(Get-Date -Format s) $msg" | Add-Content -Path $log }
function Alert($msg) {
  Log "ALERT: $msg"
  try {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($msg, 'TrendSCORE backup') | Out-Null
  } catch { }
}

try {
  $remoteNewest = (& ssh $SshHost "ls -1t $RemoteDir/nightly-*.sqlite 2>/dev/null | head -1").Trim()
  if (-not $remoteNewest) { throw 'No nightly backup found on the server.' }
  $name  = Split-Path $remoteNewest -Leaf
  $local = Join-Path $LocalDir $name

  if (-not (Test-Path $local)) {
    & scp "${SshHost}:$remoteNewest" $local
    if ($LASTEXITCODE -ne 0) { throw "scp failed with exit code $LASTEXITCODE" }
    $remoteHash = ((& ssh $SshHost "sha256sum $remoteNewest").Split(' ')[0]).ToLower()
    $localHash  = (Get-FileHash -Algorithm SHA256 $local).Hash.ToLower()
    if ($remoteHash -ne $localHash) {
      Remove-Item $local -Force
      throw "Checksum mismatch for $name; the download was deleted."
    }
    Log "pulled $name ($((Get-Item $local).Length) bytes), checksum ok"
  } else {
    Log "already have $name"
  }

  Get-ChildItem $LocalDir -Filter 'nightly-*.sqlite' | Sort-Object Name -Descending |
    Select-Object -Skip $KeepFiles | Remove-Item -Force

  # age comes from the timestamp in the file name (scp resets the file's modified time)
  $newest = Get-ChildItem $LocalDir -Filter 'nightly-*.sqlite' | Sort-Object Name -Descending | Select-Object -First 1
  $stale = $true
  if ($newest -and $newest.Name -match '^nightly-(\d{8}T\d{6})Z\.sqlite\z') {
    $styles = [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal
    $made = [datetime]::ParseExact($Matches[1], 'yyyyMMddTHHmmss', [System.Globalization.CultureInfo]::InvariantCulture, $styles)
    $stale = ((Get-Date).ToUniversalTime() - $made).TotalHours -gt $StaleHours
  }
  if ($stale) {
    Alert "The newest backup is older than $StaleHours hours (or missing). Check the nightly job on the server."
  }
}
catch {
  Alert "Backup pull failed: $($_.Exception.Message)"
  exit 1
}
