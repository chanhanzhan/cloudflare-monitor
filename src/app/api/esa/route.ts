import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import ESA20240910, * as $ESA20240910 from "@alicloud/esa20240910";
import * as $OpenApi from "@alicloud/openapi-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ESAAccountConfig {
  name: string;
  accessKeyId: string;
  accessKeySecret: string;
  sites?: string[];
}

function parseESAAccounts(): ESAAccountConfig[] {
  const accounts: ESAAccountConfig[] = [];

  const singleId = process.env.ESA_ACCESS_KEY_ID;
  const singleSecret = process.env.ESA_ACCESS_KEY_SECRET;
  const singleSites = process.env.ESA_SITES?.split(",").map((s) => s.trim()).filter(Boolean);
  if (singleId && singleSecret) {
    accounts.push({
      name: process.env.ESA_ACCOUNT_NAME || "Aliyun ESA",
      accessKeyId: singleId,
      accessKeySecret: singleSecret,
      sites: singleSites,
    });
  }

  let i = 1;
  while (process.env[`ESA_ACCESS_KEY_ID_${i}`] && process.env[`ESA_ACCESS_KEY_SECRET_${i}`]) {
    const sites = process.env[`ESA_SITES_${i}`]?.split(",").map((s) => s.trim()).filter(Boolean);
    accounts.push({
      name: process.env[`ESA_ACCOUNT_NAME_${i}`] || `Aliyun ESA ${i}`,
      accessKeyId: process.env[`ESA_ACCESS_KEY_ID_${i}`]!,
      accessKeySecret: process.env[`ESA_ACCESS_KEY_SECRET_${i}`]!,
      sites,
    });
    i++;
  }

  return accounts;
}

function percentEncode(str: string) {
  return encodeURIComponent(str)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

function signParams(params: Record<string, string>, accessKeySecret: string) {
  const sortedKeys = Object.keys(params).sort();
  const canonicalized = sortedKeys
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");
  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonicalized)}`;
  const signature = crypto
    .createHmac("sha1", `${accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");
  return signature;
}

async function callEsaApi(
  action: string,
  extraParams: Record<string, string>,
  accessKeyId: string,
  accessKeySecret: string
) {
  const endpoint = "https://esa.cn-hangzhou.aliyuncs.com";
  const params: Record<string, string> = {
    Format: "JSON",
    Version: "2024-09-10",
    AccessKeyId: accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    Timestamp: new Date().toISOString(),
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    Action: action,
    ...extraParams,
  };

  params.Signature = signParams(params, accessKeySecret);
  const query = Object.entries(params)
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  const res = await fetch(`${endpoint}/?${query}`, { method: "GET" });
  return res.json();
}

async function callEsaApiPost(
  action: string,
  bodyParams: Record<string, any>,
  accessKeyId: string,
  accessKeySecret: string
) {
  const endpoint = "https://esa.cn-hangzhou.aliyuncs.com";
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const allParams: Record<string, string> = {
    Format: "JSON",
    Version: "2024-09-10",
    AccessKeyId: accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    Timestamp: timestamp,
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    Action: action,
  };
  for (const [key, value] of Object.entries(bodyParams)) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        allParams[`${key}.${index + 1}`] = String(item);
      });
    } else {
      allParams[key] = String(value);
    }
  }
  const sortedKeys = Object.keys(allParams).sort();
  const canonicalizedQueryString = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&");
  const stringToSign = `POST&${percentEncode("/")}&${percentEncode(canonicalizedQueryString)}`;
  
  const signature = crypto
    .createHmac("sha1", accessKeySecret + "&")
    .update(stringToSign)
    .digest("base64");

  allParams.Signature = signature;
  const query = Object.entries(allParams)
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  console.log("ESA POST Response for", action);
  const res = await fetch(`${endpoint}/?${query}`, { method: "POST" });
  const result = await res.json();
  console.log(JSON.stringify(result, null, 2));
  return result;
}
async function callEsaApiWithArrays(
  action: string,
  simpleParams: Record<string, string>,
  arrayParams: Record<string, string[]>,
  accessKeyId: string,
  accessKeySecret: string
) {
  const endpoint = "https://esa.cn-hangzhou.aliyuncs.com";
  const params: Record<string, string> = {
    Format: "JSON",
    Version: "2024-09-10",
    AccessKeyId: accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    Timestamp: new Date().toISOString(),
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    Action: action,
    ...simpleParams,
  };
  for (const [key, values] of Object.entries(arrayParams)) {
    values.forEach((value, index) => {
      params[`${key}.${index + 1}`] = value;
    });
  }
  console.log(`ESA API params for ${action}:`, JSON.stringify(params, null, 2));

  params.Signature = signParams(params, accessKeySecret);
  const query = Object.entries(params)
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  console.log(`ESA API query string: ${query.substring(0, 500)}...`);

  const res = await fetch(`${endpoint}/?${query}`, { method: "GET" });
  return res.json();
}

async function fetchDefaultInstanceId(
  accessKeyId: string,
  accessKeySecret: string
): Promise<string | null> {
  try {
    const resp = await callEsaApi(
      "ListUserRatePlanInstances",
      { PageNumber: "1", PageSize: "10" },
      accessKeyId,
      accessKeySecret
    );
    const instances =
      resp?.Instances ||
      resp?.Result?.Instances ||
      resp?.Data?.Instances ||
      resp?.Instances?.Instances ||
      [];
    if (Array.isArray(instances) && instances.length > 0) {
      return instances[0].InstanceId || instances[0].instanceId || null;
    }
  } catch (err) {
    console.error("ESA ListUserRatePlanInstances error:", err);
  }
  return null;
}

function normalizeSites(raw: any[]): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => ({
    SiteId: s.SiteId || s.siteId || s.Id || "",
    SiteName: s.SiteName || s.siteName || s.Name || "",
    Status: s.Status || s.status,
    DomainCount: s.DomainCount || s.domainCount,
    Type: s.Type || s.type,
    Coverage: s.Coverage || s.coverage,
    CnameStatus: s.CnameStatus || s.cnameStatus,
    Area: s.Area || s.area,
    AccessType: s.AccessType || s.accessType,
    PlanType: s.PlanType || s.planType || s.RatePlanType || s.ratePlanType,
    InstanceId: s.InstanceId || s.instanceId,
    CreateTime: s.CreateTime || s.createTime || s.GmtCreate || s.gmtCreate,
    UpdateTime: s.UpdateTime || s.updateTime || s.GmtModified || s.gmtModified,
    VerifyStatus: s.VerifyStatus || s.verifyStatus,
    NameServerList: s.NameServerList || s.nameServerList || s.NameServers || s.nameServers,
    ResourceGroupId: s.ResourceGroupId || s.resourceGroupId,
    Description: s.Description || s.description,
  }));
}

function normalizeQuotas(raw: any[]): { quotaName: string; total: number; used: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((q) => ({
    quotaName: q.QuotaName || q.quotaName || q.Name || "",
    total: Number(q.Total || q.total || q.Quota || q.quota || q.QuotaValue || 0),
    used: Number(q.Used || q.used || q.Usage || q.usage || 0),
  }));
}

interface ESARoutine {
  name: string;
  description?: string;
  codeVersion?: string;
  status?: string;
  createTime?: string;
  updateTime?: string;
  env?: string;
  relatedRecord?: string;
}

function normalizeRoutines(raw: any[]): ESARoutine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    name: r.Name || r.name || r.RoutineName || "",
    description: r.Description || r.description || "",
    codeVersion: r.CodeVersion || r.codeVersion || "",
    status: r.Status || r.status || "",
    createTime: r.CreateTime || r.createTime || "",
    updateTime: r.UpdateTime || r.updateTime || "",
    env: r.Env || r.env || "",
    relatedRecord: r.DefaultRelatedRecord || r.relatedRecord || "",
  }));
}

async function fetchRoutineDetail(
  routineName: string,
  accessKeyId: string,
  accessKeySecret: string
): Promise<any> {
  try {
    const resp = await callEsaApi(
      "GetRoutine",
      { Name: routineName },
      accessKeyId,
      accessKeySecret
    );
    return resp || {};
  } catch (err) {
    console.error(`ESA GetRoutine error for ${routineName}:`, err);
    return {};
  }
}

async function fetchRoutines(
  accessKeyId: string,
  accessKeySecret: string,
  fetchDetails: boolean = false
): Promise<{ routines: ESARoutine[]; totalCount: number }> {
  try {
    const resp = await callEsaApi(
      "ListUserRoutines",
      { PageNumber: "1", PageSize: "50" },
      accessKeyId,
      accessKeySecret
    );
    const routinesRaw =
      resp?.Routines ||
      resp?.Result?.Routines ||
      resp?.Data?.Routines ||
      resp?.Routines?.Routine ||
      [];
    const totalCount = resp?.TotalCount || resp?.Result?.TotalCount || routinesRaw.length || 0;
    const basicRoutines = normalizeRoutines(routinesRaw);
    
    // Skip detailed fetching for faster initial load
    if (!fetchDetails) {
      return { 
        routines: basicRoutines.map(r => ({ ...r, status: "deployed" })), 
        totalCount 
      };
    }
    
    // Fetch detailed info only when requested (limit to 5 for performance)
    const detailedRoutines = await Promise.all(
      basicRoutines.slice(0, 5).map(async (routine) => {
        const detail = await fetchRoutineDetail(routine.name, accessKeyId, accessKeySecret);
        const envs = detail?.Envs || [];
        const productionEnv = envs.find((e: any) => e.Env === "production") || envs[0];
        const codeVersions = productionEnv?.CodeDeploy?.CodeVersions || [];
        const latestVersion = codeVersions[0];
        
        return {
          ...routine,
          description: detail?.Description ? Buffer.from(detail.Description, 'base64').toString('utf-8') : routine.description,
          createTime: detail?.CreateTime || routine.createTime,
          relatedRecord: detail?.DefaultRelatedRecord || routine.relatedRecord,
          env: productionEnv?.Env || "",
          codeVersion: latestVersion?.CodeVersion?.toString() || routine.codeVersion,
          status: envs.length > 0 && productionEnv?.CodeDeploy ? "deployed" : routine.status,
        };
      })
    );
    
    // Append remaining routines without details
    const remaining = basicRoutines.slice(5).map(r => ({ ...r, status: "deployed" }));
    return { routines: [...detailedRoutines, ...remaining], totalCount };
  } catch (err) {
    console.error("ESA ListUserRoutines error:", err);
    return { routines: [], totalCount: 0 };
  }
}

async function fetchEdgeRoutinePlans(
  accessKeyId: string,
  accessKeySecret: string
): Promise<any[]> {
  try {
    const resp = await callEsaApi(
      "ListEdgeRoutinePlans",
      {},
      accessKeyId,
      accessKeySecret
    );
    return resp?.Plans || resp?.Result?.Plans || resp?.Data?.Plans || [];
  } catch (err) {
    console.error("ESA ListEdgeRoutinePlans error:", err);
    return [];
  }
}

async function fetchErService(
  accessKeyId: string,
  accessKeySecret: string
): Promise<any> {
  try {
    const resp = await callEsaApi(
      "GetErService",
      {},
      accessKeyId,
      accessKeySecret
    );
    return resp || {};
  } catch (err) {
    console.error("ESA GetErService error:", err);
    return {};
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fetchDetails = searchParams.get("details") === "true";
    const skipTimeSeries = searchParams.get("skipTimeSeries") === "true";
    
    const accounts = parseESAAccounts();
    if (accounts.length === 0) {
      return NextResponse.json({ error: "请配置 ESA_ACCESS_KEY_ID 与 ESA_ACCESS_KEY_SECRET", accounts: [] });
    }
    const quotaNames = [
      "customHttpCert",
      "transition_rule",
      "waiting_room",
      "https|rule_quota",
      "cache_rules|rule_quota",
      "configuration_rules|rule_quota",
      "redirect_rules|rule_quota",
      "compression_rules|rule_quota",
      "origin_rules|rule_quota",
      "ratelimit_rules|rule_quota",
      "waf_rules|rule_quota",
      "edge_routine|rule_quota",
      "page_rules|rule_quota",
      "origin_rules|rule_quota",
      "ssl_certificates",
      "custom_pages",
      "log_delivery_tasks",
      "custom_log_fields",
    ];

    const payload: {
      accounts: {
        name: string;
        sites: any[];
        quotas: { quotaName: string; total: number; used: number }[];
        totalRequests: number;
        totalBytes: number;
        instanceId?: string;
        quotaSource?: string;
        routines?: ESARoutine[];
        routineCount?: number;
        edgeRoutinePlans?: any[];
        erService?: any;
      }[];
    } = { accounts: [] };

    for (const acc of accounts) {
      // List sites
      const siteRes = await callEsaApi("ListSites", {}, acc.accessKeyId, acc.accessKeySecret);
      const sitesRaw =
        siteRes?.Sites ||
        siteRes?.sites ||
        siteRes?.Result?.Sites ||
        siteRes?.Result?.sites ||
        siteRes?.Data?.Sites ||
        siteRes?.Sites?.Site ||
        siteRes?.Result?.Sites?.Site ||
        siteRes?.Data?.Sites?.Site ||
        [];
      let sites = normalizeSites(sitesRaw);
      if (acc.sites && acc.sites.length > 0) {
        const set = new Set(acc.sites.map((s) => s.toLowerCase()));
        sites = sites.filter((s) => set.has((s.SiteName || "").toLowerCase()) || set.has((s.SiteId || "").toLowerCase()));
      }
      const now = new Date();
      const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
      const endTime = now.toISOString().replace(/\.\d{3}Z$/, "Z");
      
      try {
        const config = new $OpenApi.Config({
          accessKeyId: acc.accessKeyId,
          accessKeySecret: acc.accessKeySecret,
          endpoint: "esa.cn-hangzhou.aliyuncs.com",
        });
        const client = new ESA20240910(config);
        
        // Skip time series for faster initial load
        if (!skipTimeSeries) {
          for (const site of sites) {
            if (site.SiteId) {
              try {
                const request = new $ESA20240910.DescribeSiteTimeSeriesDataRequest({
                  siteId: Number(site.SiteId),
                  startTime: startTime,
                  endTime: endTime,
                  fields: [
                    new $ESA20240910.DescribeSiteTimeSeriesDataRequestFields({ fieldName: "Traffic", dimension: ["ALL"] }),
                    new $ESA20240910.DescribeSiteTimeSeriesDataRequestFields({ fieldName: "Requests", dimension: ["ALL"] }),
                  ],
                });
                
                const response = await client.describeSiteTimeSeriesData(request);
                
                let totalRequests = 0;
                let totalBytes = 0;
                const timeSeriesRequests: { time: string; value: number }[] = [];
                const timeSeriesTraffic: { time: string; value: number }[] = [];
                
                const summaryData = response.body?.summarizedData || [];
                for (const item of summaryData) {
                  const fieldName = item.fieldName || "";
                  if (fieldName === "Requests") totalRequests += Number(item.value || 0);
                  if (fieldName === "Traffic") totalBytes += Number(item.value || 0);
                }
                
                const dataItems = response.body?.data || [];
                for (const item of dataItems) {
                  const fieldName = item.fieldName || "";
                  const detailData = item.detailData || [];
                  for (const point of detailData) {
                    const timeStr = point.timeStamp || "";
                    const value = Number(point.value || 0);
                    if (fieldName === "Requests") timeSeriesRequests.push({ time: timeStr, value });
                    if (fieldName === "Traffic") timeSeriesTraffic.push({ time: timeStr, value });
                  }
                }
                
                site.requests = totalRequests;
                site.bytes = totalBytes;
                site.timeSeriesRequests = timeSeriesRequests;
                site.timeSeriesTraffic = timeSeriesTraffic;
              } catch (err: any) {
                console.error(`ESA SDK error for ${site.SiteId}:`, err?.message || err);
              }
            }
          }
        }
      } catch (sdkErr: any) {
        console.error("ESA SDK init error:", sdkErr?.message || sdkErr);
      }
      let quotas: { quotaName: string; total: number; used: number }[] = [];
      let instanceId =
        sitesRaw?.[0]?.InstanceId ||
        sitesRaw?.[0]?.instanceId ||
        sites?.[0]?.InstanceId ||
        sites?.[0]?.instanceId ||
        (await fetchDefaultInstanceId(acc.accessKeyId, acc.accessKeySecret));
      const firstSiteId = sites?.[0]?.SiteId || sitesRaw?.[0]?.SiteId || sitesRaw?.[0]?.siteId;
      let quotaRes: any = undefined;
      let quotaResSiteOnly: any = undefined;
      let quotaResFallback: any = undefined;

      if (firstSiteId) {
        // QuotaNames is mandatory - use common quota names
        const quotaNamesStr = "customHttpCert,transition_rule,cache_rules|rule_quota,redirect_rules|rule_quota,origin_rules|rule_quota";
        quotaRes = await callEsaApi(
          "ListInstanceQuotasWithUsage",
          { 
            SiteId: String(firstSiteId),
            QuotaNames: quotaNamesStr,
          },
          acc.accessKeyId,
          acc.accessKeySecret
        );
        // API returns: { Quotas: [{ QuotaName, QuotaValue, Usage, SiteUsage }] }
        const quotasRaw = quotaRes?.Quotas || [];
        quotas = normalizeQuotas(quotasRaw);
      }
      // Fetch routines, plans, and erService in parallel for better performance
      const [routinesResult, edgeRoutinePlans, erService] = await Promise.all([
        fetchRoutines(acc.accessKeyId, acc.accessKeySecret, fetchDetails),
        fetchEdgeRoutinePlans(acc.accessKeyId, acc.accessKeySecret),
        fetchErService(acc.accessKeyId, acc.accessKeySecret),
      ]);
      const { routines, totalCount: routineCount } = routinesResult;
      
      // Set routine status based on erService status (Running/Creating/NotOpened)
      const erStatus = erService?.Status || "";
      const routinesWithStatus = routines.map(r => ({
        ...r,
        status: r.status || erStatus || "",
      }));
      
      const totalRequests = sites.reduce((sum, s) => sum + (s.requests || 0), 0);
      const totalBytes = sites.reduce((sum, s) => sum + (s.bytes || 0), 0);

      payload.accounts.push({
        name: acc.name,
        sites: sites.slice(0, 20),
        quotas,
        totalRequests,
        totalBytes,
        instanceId,
        quotaSource: instanceId ? "instance" : "fallback",
        routines: routinesWithStatus.slice(0, 20),
        routineCount,
        edgeRoutinePlans,
        erService,
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("ESA API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", accounts: [] },
      { status: 500 }
    );
  }
}
