$d = Split-Path -Parent $MyInvocation.MyCommand.Path
$ic = [Globalization.CultureInfo]::InvariantCulture
$j = Get-Content "$d\punten.json" -Raw | ConvertFrom-Json
$p = $j.punten
$map = "$d\stukken"
New-Item -ItemType Directory -Force $map | Out-Null
for ($i = 0; $i -lt $p.Count; $i += 100) {
  $f = "$map\$i.json"
  if (Test-Path $f) { continue }
  $stuk = $p[$i..([Math]::Min($i + 99, $p.Count - 1))]
  $la = ($stuk | % { ([double]$_[0]).ToString($ic) }) -join ','
  $lo = ($stuk | % { ([double]$_[1]).ToString($ic) }) -join ','
  $ok = $false
  for ($t = 0; $t -lt 8 -and -not $ok; $t++) {
    try {
      $r = Invoke-WebRequest -Uri "https://api.open-meteo.com/v1/elevation?latitude=$la&longitude=$lo" -TimeoutSec 30 -UseBasicParsing
      [IO.File]::WriteAllText($f, $r.Content)
      $ok = $true
    } catch {
      Write-Output "wacht bij $i ($t): $($_.ErrorDetails.Message)"
      Start-Sleep -Seconds (10 * ($t + 1))
    }
  }
  if (-not $ok) { Write-Output "STOP bij $i"; exit 1 }
  Start-Sleep -Milliseconds 11000
}
Write-Output "KLAAR"
