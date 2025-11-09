# Run Python integration tests
# This runs the test suite in tests/integration/

Write-Host "🧪 Running Integration Tests..." -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found!" -ForegroundColor Red
    Write-Host "Install Python from: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Check if test file exists
$testFile = "tests/integration/test_full_pipeline.py"
if (-not (Test-Path $testFile)) {
    Write-Host "❌ Test file not found: $testFile" -ForegroundColor Red
    exit 1
}

Write-Host "Installing test dependencies..." -ForegroundColor Yellow
pip install boto3 requests -q

Write-Host ""
Write-Host "Running integration tests..." -ForegroundColor Yellow
Write-Host ""

# Run the test
python $testFile

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Green
