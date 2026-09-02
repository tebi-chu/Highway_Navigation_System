import type { NextConfig } from 'next';

const securityHeaders = [
  { key:'Content-Security-Policy', value:"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com" },
  { key:'Referrer-Policy', value:'no-referrer' },
  { key:'X-Content-Type-Options', value:'nosniff' },
  { key:'X-Frame-Options', value:'DENY' },
  { key:'Permissions-Policy', value:'geolocation=(self), camera=(), microphone=()' },
];

const nextConfig: NextConfig = {
  async headers(){ return [{source:'/:path*',headers:securityHeaders}]; },
};

export default nextConfig;
