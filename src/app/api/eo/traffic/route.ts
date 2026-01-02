import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

function buf2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return buf2hex(hash);
}

async function hmacSha256(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyData = typeof key === "string" ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
}

function getDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString().slice(0, 10);
}

async function callTencentAPI(
  action: string,
  payload: Record<string, unknown>,
  secretId: string,
  secretKey: string
) {
  const service = "teo";
  const host = "teo.tencentcloudapi.com";
  const region = "ap-guangzhou";
  const version = "2022-09-01";
  const algorithm = "TC3-HMAC-SHA256";
  const timestamp = Math.floor(Date.now() / 1000);
  const date = getDate(timestamp);

  const payloadStr = JSON.stringify(payload);
  const hashedPayload = await sha256(payloadStr);

  const httpMethod = "POST";
  const canonicalUri = "/";
  const canonicalQuerystring = "";
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalRequest = `${httpMethod}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;

  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = await sha256(canonicalRequest);
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

  const secretDate = await hmacSha256(`TC3${secretKey}`, date);
  const secretService = await hmacSha256(secretDate, service);
  const secretSigning = await hmacSha256(secretService, "tc3_request");
  const signatureBuffer = await hmacSha256(secretSigning, stringToSign);
  const signature = buf2hex(signatureBuffer);

  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Host: host,
      "X-TC-Action": action,
      "X-TC-Version": version,
      "X-TC-Region": region,
      "X-TC-Timestamp": timestamp.toString(),
      Authorization: authorization,
    },
    body: payloadStr,
  });

  return response.json();
}

const ORIGIN_PULL_METRICS = [
  "l7Flow_outFlux_hy",
  "l7Flow_outBandwidth_hy",
  "l7Flow_request_hy",
  "l7Flow_inFlux_hy",
  "l7Flow_inBandwidth_hy",
];

const SECURITY_METRICS = [
  "ccAcl_interceptNum",
  "ccManage_interceptNum",
  "ccRate_interceptNum",
];

const TOP_ANALYSIS_METRICS = [
  "l7Flow_outFlux_country",
  "l7Flow_outFlux_province",
  "l7Flow_outFlux_statusCode",
  "l7Flow_outFlux_domain",
  "l7Flow_outFlux_url",
  "l7Flow_outFlux_resourceType",
  "l7Flow_outFlux_sip",
  "l7Flow_outFlux_referer",
  "l7Flow_outFlux_referers",
  "l7Flow_outFlux_ua_device",
  "l7Flow_outFlux_ua_browser",
  "l7Flow_outFlux_ua_os",
  "l7Flow_outFlux_ua",
  "l7Flow_request_country",
  "l7Flow_request_province",
  "l7Flow_request_statusCode",
  "l7Flow_request_domain",
  "l7Flow_request_url",
  "l7Flow_request_resourceType",
  "l7Flow_request_sip",
  "l7Flow_request_referer",
  "l7Flow_request_referers",
  "l7Flow_request_ua_device",
  "l7Flow_request_ua_browser",
  "l7Flow_request_ua_os",
  "l7Flow_request_ua",
];

export async function GET(request: NextRequest) {
  const secretId = process.env.SECRET_ID;
  const secretKey = process.env.SECRET_KEY;

  if (!secretId || !secretKey) {
    return NextResponse.json(
      { error: "Missing EdgeOne credentials" },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const metric = searchParams.get("metric") || "l7Flow_flux";
  const startTime = searchParams.get("startTime") || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 19) + "Z";
  const endTime = searchParams.get("endTime") || new Date().toISOString().slice(0, 19) + "Z";
  const interval = searchParams.get("interval");
  const zoneId = searchParams.get("zoneId");
  const zoneIds = zoneId ? [zoneId] : ["*"];

  try {
    let action: string;
    let params: Record<string, unknown>;

    if (TOP_ANALYSIS_METRICS.includes(metric)) {
      action = "DescribeTopL7AnalysisData";
      params = {
        StartTime: startTime,
        EndTime: endTime,
        MetricName: metric,
        ZoneIds: zoneIds,
      };
    } else if (ORIGIN_PULL_METRICS.includes(metric)) {
      action = "DescribeTimingL7OriginPullData";
      params = {
        StartTime: startTime,
        EndTime: endTime,
        MetricNames: [metric],
        ZoneIds: zoneIds,
      };
      if (interval && interval !== "auto") {
        params.Interval = interval;
      }
    } else if (SECURITY_METRICS.includes(metric)) {
      action = "DescribeWebProtectionData";
      params = {
        StartTime: startTime,
        EndTime: endTime,
        MetricNames: [metric],
        ZoneIds: zoneIds,
      };
      if (interval && interval !== "auto") {
        params.Interval = interval;
      }
    } else {
      action = "DescribeTimingL7AnalysisData";
      params = {
        StartTime: startTime,
        EndTime: endTime,
        MetricNames: [metric],
        ZoneIds: zoneIds,
      };
      if (interval && interval !== "auto") {
        params.Interval = interval;
      }
    }

    const data = await callTencentAPI(action, params, secretId, secretKey);
    return NextResponse.json(data.Response || {});
  } catch (error) {
    console.error("EdgeOne Traffic API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
