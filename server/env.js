// Load a local .env file (if present) into process.env for the API server.
try {
  process.loadEnvFile?.('.env');
} catch {
  // No .env file: rely on the process environment.
}
