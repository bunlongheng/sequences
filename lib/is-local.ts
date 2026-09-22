export function isLocal(request: Request): boolean {
  if (process.env.NODE_ENV === "production" && process.env.LOCAL_DEV !== "true") return false;
  const host = request.headers.get('host') || '';
  return /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(host);
}
