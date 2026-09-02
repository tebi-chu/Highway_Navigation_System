declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    ADMIN_EMAIL: string;
    APP_BASE_URL: string;
    COOKIE_SECURE?: string;
    GOOGLE_MAPS_API_KEY: string;
  }
}
