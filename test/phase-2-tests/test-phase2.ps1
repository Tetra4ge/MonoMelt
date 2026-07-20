$ErrorActionPreference = "Stop"
$token = "<YOUR_JWT_TOKEN>"

Write-Host "1. Creating project..."
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}
$body = '{"name": "Phase 2 Test Script", "description": "Automated test", "source_type": "zip", "status": "active"}'
$projRes = Invoke-RestMethod -Uri "http://localhost:4000/api/projects" -Method Post -Headers $headers -Body $body
$projectId = $projRes.data.id
Write-Host "✅ Created Project ID: $projectId"

Write-Host "2. Uploading simple-monolith.zip..."
$uploadHeaders = @{
    "Authorization" = "Bearer $token"
}
$form = @{
    file = Get-Item -Path "d:\openai\simple-monolith.zip"
}
$uploadRes = Invoke-RestMethod -Uri "http://localhost:4000/api/projects/$projectId/sources/zip" -Method Post -Headers $uploadHeaders -Form $form
$jobId = $uploadRes.data.jobId
Write-Host "✅ Upload successful, Job ID: $jobId"

Write-Host "3. Waiting for worker to process..."
Start-Sleep -Seconds 4

Write-Host "4. Checking final status..."
$statusRes = Invoke-RestMethod -Uri "http://localhost:4000/api/projects/$projectId/jobs/$jobId" -Method Get -Headers $uploadHeaders
Write-Host "🎉 Final Job Status: $($statusRes.data.status)"
