# docTR on ARM64 Fix Documentation

## Root Cause Analysis

The issue was caused by a multi-stage Docker build problem where the `/opt/doctr-venv` directory created in the `deps` stage was not being reliably copied to the `runtime` stage, leading to the error:

```
[Errno 2] No such file or directory: '/opt/doctr-venv/bin/python'
```

### Primary Issues Identified:

1. **Inconsistent Docker Cache Behavior**: The runtime stage would sometimes reuse cached layers that didn't include the `/opt/doctr-venv` directory
2. **Non-Resilient Probe Logic**: The health probe would fail completely if `DOCTR_PY` environment variable pointed to a non-existent file
3. **Environment Variable Management**: Stale environment variables could persist between runs, causing incorrect interpreter selection

## Solution Implemented

### 1. Dockerfile Changes

**Deps Stage:**
- Always create `/opt/doctr-venv` virtual environment
- Install TensorFlow + docTR only on ARM64 architectures
- Use `TARGETARCH` build argument for reliable architecture detection

**Runtime Stage:**
- Added `RUNTIME_CACHE_BUST` build argument to force rebuilds when dependencies change
- Always copy `/opt/doctr-venv` from deps stage (even if empty on x86)
- Removed hardcoded `DOCTR_PY` environment variable from Dockerfile

### 2. run.sh Script Improvements

**Environment Variable Management:**
- Clear stale variables: `unset CV_DOCTR_PYTHON DOCTR_PY`
- Set `DOCTR_BACKEND=tensorflow` and `DOCTR_PY=/opt/doctr-venv/bin/python` on ARM64
- Set `DOCTR_BACKEND=pt` and unset `DOCTR_PY` on x86
- Added cache busting with timestamp to ensure runtime rebuilds

### 3. Probe Logic Hardening

**Interpreter Selection:**
- Priority order: `python_path` → `DOCTR_PY` → `sys.executable`
- Check if interpreter file exists before using it
- Fall back to `sys.executable` if specified path is missing

**Backend Detection:**
- Default to PyTorch backend unless explicitly set to TensorFlow
- Avoid importing TensorFlow on PyTorch backend paths
- Keep probe lightweight with `pretrained=False` and short timeout

## Files Modified

### [`cv_parser_service/Dockerfile`](cv_parser_service/Dockerfile)
- Enhanced deps stage to always create `/opt/doctr-venv`
- Added `RUNTIME_CACHE_BUST` build argument
- Removed hardcoded `DOCTR_PY` environment variable

### [`run.sh`](run.sh)
- Improved environment variable handling
- Added cache busting mechanism
- Clear stale environment variables before setting new ones

### [`cv_parser_service/main.py`](cv_parser_service/main.py)
- Hardened `_run_subproc_probe()` to handle missing interpreters
- Improved interpreter selection logic with fallback to `sys.executable`
- Simplified `_probe_doctr()` to use the resilient probe function

## Verification Commands

After implementing the fix, run these commands to verify:

```bash
# Force clean rebuild
./run.sh down
docker rmi cv-parser-deps:3.2.0 cv-parser-service 2>/dev/null || true
./run.sh up --doctr

# Check if /opt/doctr-venv exists in container
docker exec -it cv-parser-service-dev bash -lc '
  ls -l /opt/doctr-venv/bin/python || echo "MISSING";
  python -c "import sys,platform; print(sys.executable, platform.machine())"
'

# Check service status
./run.sh status
# Expected: {engine:"doctr", selected:"doctr", available:true}
```

## Expected Outcomes

- **ARM64**: `/opt/doctr-venv/bin/python` exists, `DOCTR_PY` points to it, status shows `available: true` (TF backend)
- **x86**: `DOCTR_PY` unset, PT backend used, status shows `available: true`
- **Resilience**: Probes never fail on missing interpreter; they fall back to `sys.executable`
- **Deterministic Builds**: Changing dependencies properly invalidates runtime cache

## Prevention Measures

1. **Always create the venv** in deps stage regardless of architecture
2. **Always copy the venv** to runtime stage even if empty
3. **Resilient probe logic** that handles missing files gracefully
4. **Cache busting** to ensure runtime rebuilds when deps change
5. **Proper environment variable cleanup** to avoid stale values

This solution ensures the docTR OCR engine works reliably on both ARM64 and x86 architectures while maintaining proper fallback behavior when components are missing.