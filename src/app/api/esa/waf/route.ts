import { NextRequest, NextResponse } from "next/server";
import ESA20240910, * as $ESA20240910 from "@alicloud/esa20240910";
import * as $OpenApi from "@alicloud/openapi-client";
import * as cache from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL = 3 * 60 * 1000;

/*
ESA WAF 安全防护数据 API
@功能 获取站点的 WAF 规则集列表和规则使用统计
@参数 siteId 站点 ID
@返回 WAF 规则集列表 + 各阶段规则使用统计
*/

/* WAF 阶段中文映射 */
const PHASE_ZH: Record<string, string> = {
  http_custom: "自定义规则",
  http_rate_limiting: "频率限制",
  http_managed: "托管规则",
  http_bot: "Bot 管理",
  http_ip_intelligence: "IP 情报",
};

export async function GET(request: NextRequest) {
  const accessKeyId = process.env.ESA_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ESA_ACCESS_KEY_SECRET;

  if (!accessKeyId || !accessKeySecret) {
    return NextResponse.json({ error: "未配置 ESA 凭证" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  if (!siteId) {
    return NextResponse.json({ error: "缺少 siteId 参数" }, { status: 400 });
  }

  const cacheKey = `esa_waf_${siteId}`;
  const cached = cache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const config = new $OpenApi.Config({
      accessKeyId,
      accessKeySecret,
      endpoint: "esa.cn-hangzhou.aliyuncs.com",
    });
    const client = new ESA20240910(config);

    /* 并行获取各阶段的 WAF 规则集和使用统计 */
    const phases = ["http_custom", "http_rate_limiting", "http_managed", "http_bot"];

    const [rulesetsResults, usageResults] = await Promise.all([
      /* 获取各阶段规则集 */
      Promise.all(phases.map(async (phase) => {
        try {
          const req = new $ESA20240910.ListWafRulesetsRequest({
            siteId: Number(siteId),
            phase,
            pageNumber: 1,
            pageSize: 50,
          });
          const res = await client.listWafRulesets(req);
          const rulesets = res.body?.rulesets || [];
          const siteUsage = res.body?.siteUsage || 0;

          /* 对每个规则集获取其下的规则详情 */
          const enriched = await Promise.all(rulesets.map(async (r: any) => {
            let rules: any[] = [];
            try {
              const rulesReq = new $ESA20240910.ListWafRulesRequest({
                siteId: Number(siteId),
                phase,
                rulesetId: r.id,
                pageNumber: 1,
                pageSize: 50,
              });
              const rulesRes = await client.listWafRules(rulesReq);
              rules = (rulesRes.body?.rules || []).map((rule: any) => {
                let ruleName = rule.ruleName || rule.name || `规则 ${rule.id}`;
                /* 清理规则名称中的 Generated#UUID */
                ruleName = ruleName.replace(/\s*\[Generated#[\w-]+\]/g, "").trim();
                if (!ruleName) ruleName = `规则 ${rule.id}`;
                return {
                  id: rule.id,
                  name: ruleName,
                  status: rule.status,
                  action: rule.action,
                  position: rule.position,
                };
              });
            } catch {}

            /* 清理自动生成的规则集名称 */
            let displayName = r.name || "";
            if (displayName.includes("[Generated#")) {
              displayName = PHASE_ZH[phase] || phase;
            }

            return {
              id: r.id,
              name: displayName,
              status: r.status,
              rules,
              updateTime: r.updateTime,
            };
          }));

          return {
            phase,
            phaseZh: PHASE_ZH[phase] || phase,
            rulesets: enriched,
            totalCount: rulesets.length,
            siteUsage,
          };
        } catch (err: any) {
          return { phase, phaseZh: PHASE_ZH[phase] || phase, rulesets: [], totalCount: 0, error: err?.message };
        }
      })),
      /* 获取各阶段规则使用统计 */
      Promise.all(phases.map(async (phase) => {
        try {
          const req = new $ESA20240910.ListWafUsageOfRulesRequest({
            siteId: Number(siteId),
            phase,
          });
          const res = await client.listWafUsageOfRules(req);
          return {
            phase,
            phaseZh: PHASE_ZH[phase] || phase,
            usage: res.body?.usage || res.body?.sites || [],
          };
        } catch (err: any) {
          return { phase, phaseZh: PHASE_ZH[phase] || phase, usage: [], error: err?.message };
        }
      })),
    ]);

    /* 汇总统计 */
    let totalRulesets = 0;
    let totalRules = 0;
    let enabledRules = 0;

    rulesetsResults.forEach((r) => {
      totalRulesets += r.totalCount;
      r.rulesets.forEach((rs: any) => {
        totalRules += rs.rules?.length || 0;
        rs.rules?.forEach((rule: any) => {
          if (rule.status === "on" || rule.status === "enabled") enabledRules++;
        });
      });
    });

    const result = {
      rulesets: rulesetsResults,
      usage: usageResults,
      summary: { totalRulesets, totalRules, enabledRules },
    };

    cache.set(cacheKey, result, CACHE_TTL);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("ESA WAF API error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Unknown error", rulesets: [], usage: [] },
      { status: 500 }
    );
  }
}
