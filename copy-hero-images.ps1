# Run this script once to copy your AI-generated hero images
# In PowerShell: .\copy-hero-images.ps1

$brain = "C:\Users\heman\.gemini\antigravity\brain\c7ac56f5-be85-4bb7-b734-cc8c111356c7"
$dest  = ".\public\images\hero"

Copy-Item "$brain\slide1_1789478022665.png" -Destination "$dest\slide1.png" -Force
Copy-Item "$brain\slide2_1789478053843.png" -Destination "$dest\slide2.png" -Force
Copy-Item "$brain\slide3_1789478083855.png" -Destination "$dest\slide3.png" -Force

Write-Host "✅ AI hero images copied successfully!" -ForegroundColor Green
