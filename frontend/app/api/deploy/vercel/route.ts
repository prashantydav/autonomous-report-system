import { NextResponse } from "next/server";
import { z } from "zod";

import { deployPortfolioToVercel } from "../../../../lib/vercel";

const deploySchema = z.object({
  portfolio: z.any(),
  siteName: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = deploySchema.parse(await request.json());
    const deploy = await deployPortfolioToVercel(body.portfolio, body.siteName);
    return NextResponse.json({ deploy });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vercel deployment failed." },
      { status: 500 },
    );
  }
}
