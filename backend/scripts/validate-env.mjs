const REQUIRED_VARS = [
  { key: 'JWT_SECRET', critical: true, description: 'Secret key for JWT tokens (min 32 chars)' },
  { key: 'EMAIL_USER', critical: true, description: 'Email account for sending notifications' },
  { key: 'EMAIL_PASS', critical: true, description: 'App password for email account' },
  { key: 'FRONTEND_URL', critical: true, description: 'Public URL of the frontend application' },
  { key: 'BACKEND_URL', critical: true, description: 'Public URL of the backend API' },
];

const validateEnv = () => {
  const errors = [];
  const warnings = [];

  for (const { key, critical, description } of REQUIRED_VARS) {
    const value = process.env[key]?.trim();
    
    if (!value) {
      if (critical) {
        errors.push(`❌ ${key}: ${description} [REQUIRED]`);
      } else {
        warnings.push(`⚠️  ${key}: ${description} [OPTIONAL]`);
      }
    } else if (key === 'JWT_SECRET' && value.length < 32) {
      warnings.push(`⚠️  ${key}: Should be at least 32 characters for security (current: ${value.length})`);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    if (process.env.ALLOW_INSECURE_JWT_SECRET === 'true') {
      errors.push('❌ ALLOW_INSECURE_JWT_SECRET must not be "true" in production');
    }
    if (!process.env.JWT_SECRET?.trim()) {
      errors.push('❌ JWT_SECRET is mandatory in production environment');
    }
  }

  if (errors.length > 0) {
    console.error('\n🚨 Environment validation failed:\n');
    errors.forEach(err => console.error(err));
    console.error('\nPlease configure the missing environment variables before starting the server.\n');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment warnings:\n');
    warnings.forEach(warn => console.warn(warn));
    console.warn('');
  }

  console.log('✅ Environment variables validated successfully\n');
  return true;
};

export default validateEnv;

if (import.meta.url === `file://${process.argv[1]}`) {
  validateEnv();
}
