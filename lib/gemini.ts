import { GoogleGenAI, Type } from "@google/genai";
import type { ExtractedInvoice } from "./types";
import { CATEGORIES } from "./constants";

// ============================================================
// Gemini Vision 單據提取
// ============================================================
// 用 structured output（responseSchema）保證 return 合法 JSON
// ============================================================

const MODEL = "gemini-2.5-flash"; // Vision + 快 + 免費 tier

function getClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY 未設定");
  return new GoogleGenAI({ apiKey: key });
}

const EXTRACT_PROMPT = `你係專業會計助理。分析呢張收據/單據圖片，提取結構化資料。

規則：
- purchase_date：用 YYYY-MM-DD 格式。如果只有部分日期，盡力推斷。睇唔到就 null。
- store_name：商戶/店舖名稱。
- total_amount：總金額（數字，唔好包貨幣符號）。
- currency：幣別代碼（HKD/USD/JPY/CNY 等），預設 HKD。
- category：消費類別，從以下揀最接近一個：${CATEGORIES.join("、")}。
- payment_method：付款方式（現金/信用卡/八達通/PayMe/支付寶/Visa 等），睇唔到就 null。
- tax：稅項金額（如有），否則 null。
- receipt_number：單號/發票號（如有），否則 null。
- items：逐項貨品 [{name, quantity, price}]。最多 20 項。

只回傳 JSON，唔好加任何解釋文字。`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    purchase_date: { type: Type.STRING, nullable: true },
    store_name: { type: Type.STRING, nullable: true },
    category: { type: Type.STRING, nullable: true },
    total_amount: { type: Type.NUMBER, nullable: true },
    currency: { type: Type.STRING },
    payment_method: { type: Type.STRING, nullable: true },
    tax: { type: Type.NUMBER, nullable: true },
    receipt_number: { type: Type.STRING, nullable: true },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          quantity: { type: Type.STRING, nullable: true },
          price: { type: Type.STRING, nullable: true },
        },
        required: ["name"],
      },
    },
  },
  required: ["currency", "items"],
};

/**
 * 由 base64 圖片提取單據資料
 * @param base64Data 純 base64（唔含 data:image/... prefix）
 * @param mimeType  例 image/jpeg, image/png, application/pdf
 */
export async function extractInvoice(
  base64Data: string,
  mimeType: string,
): Promise<ExtractedInvoice> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: EXTRACT_PROMPT },
          { inlineData: { mimeType, data: base64Data } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini 無回傳內容");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini 回傳唔係合法 JSON：" + text.slice(0, 200));
  }

  return {
    purchase_date: (parsed.purchase_date as string) || null,
    store_name: (parsed.store_name as string) || null,
    category: (parsed.category as string) || null,
    total_amount:
      typeof parsed.total_amount === "number"
        ? parsed.total_amount
        : parsed.total_amount
          ? Number(parsed.total_amount)
          : null,
    currency: (parsed.currency as string) || "HKD",
    payment_method: (parsed.payment_method as string) || null,
    tax:
      typeof parsed.tax === "number"
        ? parsed.tax
        : parsed.tax
          ? Number(parsed.tax)
          : null,
    receipt_number: (parsed.receipt_number as string) || null,
    items: Array.isArray(parsed.items)
      ? (parsed.items as ExtractedInvoice["items"])
      : [],
  };
}
