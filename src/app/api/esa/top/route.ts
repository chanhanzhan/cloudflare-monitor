import { NextRequest, NextResponse } from "next/server";
import ESA20240910, * as $ESA20240910 from "@alicloud/esa20240910";
import * as $OpenApi from "@alicloud/openapi-client";
import * as $dara from "@darabonba/typescript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
ESA TOP 数据查询 API
@功能 通过阿里云 ESA SDK 的 DescribeSiteTopData 接口获取站点维度的 TOP 排行数据
@支持维度 ClientCountryCode/EdgeResponseStatusCode/EdgeCacheStatus/EdgeResponseContentType/ClientBrowser/ClientDevice/ClientOS/ClientRequestMethod/ClientRequestHost/ClientRequestReferer/ClientIP/ClientSSLProtocol/ClientRequestProtocol
*/

export async function GET(request: NextRequest) {
  const accessKeyId = process.env.ESA_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ESA_ACCESS_KEY_SECRET;

  if (!accessKeyId || !accessKeySecret) {
    return NextResponse.json({ error: "未配置 ESA 凭证" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const dimension = searchParams.get("dimension") || "ClientCountryCode";
  const fieldName = searchParams.get("fieldName") || "Traffic";
  const limit = searchParams.get("limit") || "10";

  if (!siteId) {
    return NextResponse.json({ error: "缺少 siteId 参数" }, { status: 400 });
  }

  const now = new Date();
  const startTime = searchParams.get("startTime") || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const endTime = searchParams.get("endTime") || now.toISOString().replace(/\.\d{3}Z$/, "Z");

  try {
    const config = new $OpenApi.Config({
      accessKeyId,
      accessKeySecret,
      endpoint: "esa.cn-hangzhou.aliyuncs.com",
    });
    const client = new ESA20240910(config);

    const req = new $ESA20240910.DescribeSiteTopDataRequest({
      siteId,
      startTime,
      endTime,
      limit,
      fields: [
        new $ESA20240910.DescribeSiteTopDataRequestFields({
          fieldName,
          dimension: [dimension],
        }),
      ],
    });

    const response = await client.describeSiteTopData(req);
    const data = response.body?.data || [];

    /* 解析 TOP 数据为统一格式 */
    const result: { name: string; value: number }[] = [];
    for (const item of data) {
      const detailData = item.detailData || [];
      for (const detail of detailData) {
        const name = detail.dimensionValue || "Unknown";
        const value = Number(detail.value || 0);
        if (name && name !== "ALL") {
          result.push({ name, value });
        }
      }
    }

    return NextResponse.json({
      data: result.sort((a, b) => b.value - a.value),
      dimension,
      fieldName,
      samplingRate: response.body?.samplingRate,
    });
  } catch (error: any) {
    console.error("ESA Top API error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Unknown error", data: [] },
      { status: 500 }
    );
  }
}
