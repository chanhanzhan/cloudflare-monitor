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

 interface EOAccountConfig {
  name: string;
  secretId: string;
  secretKey: string;
  zones?: string[]; 
}

function parseEOAccountConfigs(): EOAccountConfig[] {
  const accounts: EOAccountConfig[] = [];
  const singleSecretId = process.env.SECRET_ID;
  const singleSecretKey = process.env.SECRET_KEY;
  const singleZones = process.env.EO_ZONES?.split(",").map(z => z.trim()).filter(Boolean);

  if (singleSecretId && singleSecretKey) {
    accounts.push({
      name: process.env.EO_ACCOUNT_NAME || "EdgeOne",
      secretId: singleSecretId,
      secretKey: singleSecretKey,
      zones: singleZones,
    });
  }
  let index = 1;
  while (process.env[`SECRET_ID_${index}`] && process.env[`SECRET_KEY_${index}`]) {
    const zones = process.env[`EO_ZONES_${index}`]?.split(",").map(z => z.trim()).filter(Boolean);
    accounts.push({
      name: process.env[`EO_ACCOUNT_NAME_${index}`] || `EdgeOne ${index}`,
      secretId: process.env[`SECRET_ID_${index}`]!,
      secretKey: process.env[`SECRET_KEY_${index}`]!,
      zones,
    });
    index++;
  }

  return accounts;
}

export async function GET(request: NextRequest) {
  try {
    const accountConfigs = parseEOAccountConfigs();

    if (accountConfigs.length === 0) {
      return NextResponse.json(
        { error: "请配置 SECRET_ID 和 SECRET_KEY", Zones: [], accounts: [] },
        { status: 200 }
      );
    }

    const allAccounts: { name: string; Zones: unknown[]; overview?: { totalFlux: number; totalRequests: number; totalBandwidth: number; totalHits: number } }[] = [];
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startTime = yesterday.toISOString().slice(0, 19) + "Z";
    const endTime = now.toISOString().slice(0, 19) + "Z";

    for (const config of accountConfigs) {
      const data = await callTencentAPI("DescribeZones", {}, config.secretId, config.secretKey);

      let zones = data.Response?.Zones || [];
      if (config.zones && config.zones.length > 0) {
        const zoneSet = new Set(config.zones.map((z) => z.toLowerCase()));
        zones = zones.filter((zone: { ZoneName?: string }) =>
          zone.ZoneName && zoneSet.has(zone.ZoneName.toLowerCase())
        );
      }

      // 获取所有站点的汇总流量数据
      let overviewData = {
        totalFlux: 0,
        totalBandwidth: 0,
        totalRequests: 0,
        totalHits: 0,
      };

      try {
        // 获取汇总流量数据 (使用 ZoneIds: ["*"] 获取所有)
        const [fluxData, requestData] = await Promise.all([
          callTencentAPI(
            "DescribeTimingL7AnalysisData",
            {
              StartTime: startTime,
              EndTime: endTime,
              MetricNames: ["l7Flow_outFlux"],
              ZoneIds: ["*"],
              Interval: "hour",
            },
            config.secretId,
            config.secretKey
          ),
          callTencentAPI(
            "DescribeTimingL7AnalysisData",
            {
              StartTime: startTime,
              EndTime: endTime,
              MetricNames: ["l7Flow_request"],
              ZoneIds: ["*"],
              Interval: "hour",
            },
            config.secretId,
            config.secretKey
          ),
        ]);

        // 解析流量数据 - API返回格式: Data[].TypeValue[].Detail[].Value
        const fluxDataArr = fluxData.Response?.Data || fluxData.Data || [];
        fluxDataArr.forEach((item: { TypeValue?: Array<{ Detail?: Array<{ Value: number }> }> }) => {
          item.TypeValue?.forEach((tv) => {
            tv.Detail?.forEach((d) => {
              overviewData.totalFlux += d.Value || 0;
            });
          });
        });

        // 解析请求数据
        const requestDataArr = requestData.Response?.Data || requestData.Data || [];
        requestDataArr.forEach((item: { TypeValue?: Array<{ Detail?: Array<{ Value: number }> }> }) => {
          item.TypeValue?.forEach((tv) => {
            tv.Detail?.forEach((d) => {
              overviewData.totalRequests += d.Value || 0;
            });
          });
        });
      } catch (err) {
        console.error("Failed to fetch overview traffic data:", err);
      }

      // 为每个站点添加基本信息
      const zonesWithTraffic = zones.slice(0, 10).map((zone: { ZoneId: string; ZoneName: string; Status: string; ActiveStatus?: string }) => ({
        ...zone,
        // ActiveStatus 才是真正的启用状态
        displayStatus: zone.ActiveStatus || zone.Status,
      }));

      if (zonesWithTraffic.length > 0) {
        allAccounts.push({
          name: config.name,
          Zones: zonesWithTraffic,
          overview: overviewData,
        });
      }
    }

    // 兼容旧格式，同时返回 accounts 和扁平化的 Zones
    const flatZones = allAccounts.flatMap(acc => acc.Zones);
    // 计算总体概览
    const totalOverview = allAccounts.reduce(
      (acc, account) => {
        const overview = (account as { overview?: typeof acc }).overview;
        if (overview) {
          acc.totalFlux += overview.totalFlux;
          acc.totalRequests += overview.totalRequests;
        }
        return acc;
      },
      { totalFlux: 0, totalRequests: 0, totalBandwidth: 0, totalHits: 0 }
    );
    
    return NextResponse.json({ 
      Zones: flatZones, 
      accounts: allAccounts,
      overview: totalOverview,
    });
  } catch (error) {
    console.error("EdgeOne Zones API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", Zones: [], accounts: [] },
      { status: 500 }
    );
  }
}
