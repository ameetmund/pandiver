# Docker JWT Compatibility Fix

## Critical Information - DO NOT REMOVE

This document explains the essential Docker-specific JWT compatibility fixes that are required for authentication to work properly in Docker containers.

## Problem

When running the application in Docker containers, JWT authentication fails due to version incompatibilities between PyJWT versions:

- **Host System**: PyJWT 2.8.0 (from requirements.txt)
- **Docker Container**: PyJWT 2.10.1+ (automatically upgraded by pip)

**Key Issue**: PyJWT 2.10+ has stricter validation that requires JWT subject (`sub`) field to be a string, but our code uses integer user IDs.

## Symptoms

- Login API works fine (`POST /auth/login` returns 200 OK)
- Auth verification fails immediately (`GET /auth/me` returns 401 Unauthorized)
- Error in Docker logs: `"Subject must be a string"`
- Frontend redirects to login after successful login

## Solution

The fix is implemented in `backend/docker-entrypoint.sh` with runtime patches:

### 1. SECRET_KEY Patch
```bash
# Replace hardcoded SECRET_KEY with environment variable
sed -i "s|SECRET_KEY = \"your-secret-key-here\"|SECRET_KEY = \"$SECRET_KEY\"|g" /app/app/main.py
```

### 2. JWT Subject Type Compatibility Patch
```bash
# Convert user ID to string when creating JWT tokens
sed -i 's|"sub": user\.id|"sub": str(user.id)|g' /app/app/main.py

# Convert subject back to integer when verifying JWT tokens
sed -i 's|user_id = payload\.get("sub")|user_id = int(payload.get("sub"))|g' /app/app/main.py
```

## How It Works

### Before Fix (Broken)
1. JWT created with: `{"sub": 4, "exp": 1758159060}` (integer subject)
2. PyJWT 2.10+ validation fails: "Subject must be a string"
3. Auth verification returns 401 Unauthorized

### After Fix (Working)
1. JWT created with: `{"sub": "4", "exp": 1758159060}` (string subject)
2. PyJWT 2.10+ validation passes
3. Subject converted back to integer: `user_id = int("4") = 4`
4. Auth verification works correctly

## Files Modified

1. **backend/requirements.txt**
   - Pinned PyJWT to 2.8.0 with compatibility warning
   - Updated NumPy to >=1.26.0 for Python 3.12 compatibility
   - Added comments referencing this fix

2. **backend/docker-entrypoint.sh**
   - Added SECRET_KEY patching for both main.py and auth.py
   - Added JWT subject type conversion patches for both main.py and auth.py
   - Added JWT token expiration extension (30min → 8 hours for development)
   - Docker-only solution that doesn't affect non-Docker code

3. **docker-compose.dev.yml**
   - Added SECRET_KEY environment variable
   - Uses the entrypoint script
   - Database persistence with volume mounting

4. **backend/Dockerfile.dev**
   - Multi-platform support (x86_64 + ARM64)
   - Copies and executes docker-entrypoint.sh
   - Python 3.12-slim base image

5. **frontend/Dockerfile.dev**
   - Node.js 18-alpine base with security improvements
   - Permission fixes for .next directory
   - Docker entrypoint for URL replacement

6. **frontend/docker-entrypoint.sh**
   - Dynamic API URL replacement for Docker environment
   - Background monitoring for hot reload compatibility

## Testing Verification

To verify the fix is working:

```bash
# 1. Login with existing user (or create new user)
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "ameetmund@gmail.com", "password": "temp123"}'

# 2. Extract token from response (should have "sub": "X" as string and 8-hour expiration)

# 3. Test auth verification (should return user info, not 401)
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" "http://localhost:8000/auth/me"

# 4. Test API key retrieval (should return user's API keys)
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" "http://localhost:8000/auth/api-keys"

# 5. Test PDF endpoints (should work without 401 errors)
curl -X POST "http://localhost:8000/api/v1/pdf-splitter/analyze" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample.pdf"
```

### Frontend Testing
1. Navigate to http://localhost:3000
2. Login with: ameetmund@gmail.com / temp123
3. Verify all dashboard API sections show API keys
4. Test PDF Page Splitter and PDF Translator features
5. Confirm 8-hour token expiration (no frequent logouts)

## Important Notes

⚠️ **DO NOT REMOVE OR MODIFY** these patches without understanding the implications:

1. **PyJWT Version**: Changing PyJWT version can break authentication
2. **Docker Entrypoint**: The runtime patches are essential for Docker compatibility
3. **Non-Docker Impact**: These changes only affect Docker environment
4. **SECRET_KEY**: Must be properly set in docker-compose.dev.yml

## Troubleshooting

If Docker authentication breaks again:

1. Check PyJWT version in container: `docker exec CONTAINER python -c "import jwt; print(jwt.__version__)"`
2. Verify patches applied: `docker logs CONTAINER` should show "✅ SECRET_KEY and JWT patches complete"
3. Test JWT manually: Use debug script to verify token structure
4. Check environment variables: Ensure SECRET_KEY is passed to container

## Future Considerations

- Consider updating main code to use string subjects for PyJWT 2.10+ compatibility
- Or pin PyJWT version in Dockerfile to avoid automatic upgrades
- Monitor PyJWT release notes for breaking changes

---

**Created**: 2025-09-18
**Author**: Docker Authentication Fix
**Status**: CRITICAL - Required for Docker functionality