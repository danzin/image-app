export function isRequestLogPersistenceEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const configured = env.REQUEST_LOG_PERSISTENCE_ENABLED;
  if (configured !== undefined) {
    return configured === "true";
  }

  return env.NODE_ENV !== "production";
}
