import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|alter|create|exec|execute)\b.*\b(from|into|table|database|where|set)\b)/i,
  /(\b(or|and)\b\s+[\d'"]+=\s*[\d'"]=)/i,
  /(--|#|\/\*|\*\/)/,
  /(\bwaitfor\b\s+\bdelay\b)/i,
  /(\bexec\b\s*\()/i,
  /(\bxp_cmdshell\b)/i,
  /(';?\s*(drop|alter|truncate|delete)\s)/i,
  /(\b(char|nchar|varchar|nvarchar)\s*\()/i,
  /(0x[0-9a-fA-F]+)/,
  /(\bconvert\b\s*\()/i,
  /(\bcast\b\s*\()/i,
  /(\bsleep\b\s*\(\s*\d)/i,
  /(\bbenchmark\b\s*\()/i,
  /(\binformation_schema\b)/i,
  /(\bsys\.\b)/i,
  /(\bload_file\b\s*\()/i,
  /(\boutfile\b)/i,
  /(\bdumpfile\b)/i,
];

const XSS_PATTERNS = [
  /(<script[\s>])/i,
  /(javascript\s*:)/i,
  /(on\w+\s*=\s*["'])/i,
  /(<\s*iframe)/i,
  /(<\s*object)/i,
  /(<\s*embed)/i,
  /(<\s*applet)/i,
  /(<\s*form[\s>])/i,
  /(eval\s*\()/i,
  /(document\s*\.\s*(cookie|write|location))/i,
  /(window\s*\.\s*location)/i,
  /(<\s*svg[\s>].*\bon\w+\s*=)/i,
  /(expression\s*\()/i,
  /(url\s*\(\s*["']?\s*javascript)/i,
];

const PATH_TRAVERSAL_PATTERNS = [
  /(\.\.\/)/,
  /(\.\.\\)/,
  /(%2e%2e[%/\\])/i,
  /(%252e%252e)/i,
  /(\/etc\/passwd)/i,
  /(\/proc\/self)/i,
  /(c:\\windows)/i,
];

const COMMAND_INJECTION_PATTERNS = [
  /([;&|`$]\s*(cat|ls|dir|rm|mv|cp|wget|curl|bash|sh|cmd|powershell))/i,
  /(\|\|\s*\w)/,
  /(&&\s*\w)/,
  /(`[^`]*`)/,
  /(\$\([^)]*\))/,
];

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

function checkPatterns(
  value: string,
  patterns: RegExp[],
  category: string
): string | null {
  for (const pattern of patterns) {
    if (pattern.test(value)) {
      return category;
    }
  }
  return null;
}

function scanValue(value: unknown, path: string): string | null {
  if (typeof value === "string") {
    const decoded = decodeMultiple(value);

    let result = checkPatterns(decoded, SQL_INJECTION_PATTERNS, "sql_injection");
    if (result) return `${result} at ${path}`;

    result = checkPatterns(decoded, XSS_PATTERNS, "xss");
    if (result) return `${result} at ${path}`;

    result = checkPatterns(decoded, PATH_TRAVERSAL_PATTERNS, "path_traversal");
    if (result) return `${result} at ${path}`;

    result = checkPatterns(decoded, COMMAND_INJECTION_PATTERNS, "command_injection");
    if (result) return `${result} at ${path}`;
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const result = scanValue(value[i], `${path}[${i}]`);
      if (result) return result;
    }
  } else if (value && typeof value === "object") {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const keyResult = scanValue(key, `${path}.key(${key})`);
      if (keyResult) return keyResult;

      const valResult = scanValue(val, `${path}.${key}`);
      if (valResult) return valResult;
    }
  }
  return null;
}

function decodeMultiple(input: string): string {
  let decoded = input;
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // ignore decode errors
  }
  decoded = decoded.replace(/&#(\d+);/g, (_, num) =>
    String.fromCharCode(parseInt(num, 10))
  );
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  return decoded;
}

async function logThreat(
  supabaseUrl: string,
  supabaseKey: string,
  ip: string,
  threat: string,
  url: string,
  method: string
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from("waf_threat_logs").insert({
      ip_address: ip,
      threat_type: threat,
      request_url: url.substring(0, 2048),
      request_method: method,
      blocked: true,
    });
  } catch {
    // logging failures should not block the response
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const ip = getClientIp(req);

    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({
          blocked: true,
          reason: "rate_limit",
          message: "Too many requests",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let body: unknown = null;
    const contentType = req.headers.get("content-type") || "";

    if (req.method !== "GET" && contentType.includes("application/json")) {
      const text = await req.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          return new Response(
            JSON.stringify({
              blocked: true,
              reason: "malformed_json",
              message: "Invalid request body",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    const url = new URL(req.url);
    const queryString = url.search;
    const urlThreat = scanValue(queryString, "query");

    if (urlThreat) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      EdgeRuntime.waitUntil(
        logThreat(supabaseUrl, supabaseKey, ip, urlThreat, req.url, req.method)
      );

      return new Response(
        JSON.stringify({
          blocked: true,
          reason: urlThreat.split(" at ")[0],
          message: "Request blocked by security filter",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (body) {
      const bodyThreat = scanValue(body, "body");

      if (bodyThreat) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        EdgeRuntime.waitUntil(
          logThreat(
            supabaseUrl,
            supabaseKey,
            ip,
            bodyThreat,
            req.url,
            req.method
          )
        );

        return new Response(
          JSON.stringify({
            blocked: true,
            reason: bodyThreat.split(" at ")[0],
            message: "Request blocked by security filter",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const headersThreat = scanValue(
      req.headers.get("referer") || "",
      "header.referer"
    );
    if (headersThreat) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      EdgeRuntime.waitUntil(
        logThreat(
          supabaseUrl,
          supabaseKey,
          ip,
          headersThreat,
          req.url,
          req.method
        )
      );

      return new Response(
        JSON.stringify({
          blocked: true,
          reason: headersThreat.split(" at ")[0],
          message: "Request blocked by security filter",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        blocked: false,
        message: "Request passed WAF validation",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("WAF error:", error);
    return new Response(
      JSON.stringify({
        blocked: false,
        message: "WAF check completed",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
