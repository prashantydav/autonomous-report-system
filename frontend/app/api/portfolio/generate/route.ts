import { NextResponse } from "next/server";
import { z } from "zod";

import { generatePortfolioDocument } from "../../../../lib/portfolio-generator";

const requestSchema = z.object({
  resume: z.any(),
  template: z.enum(["minimal", "ai-engineer", "freelancer", "modern"]),
  theme: z.enum(["light", "dark"]),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const portfolio = await generatePortfolioDocument(body.resume, body.template, body.theme);
    return NextResponse.json({ portfolio });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Portfolio generation failed." },
      { status: 500 },
    );
  }
}
