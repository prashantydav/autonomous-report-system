import { NextResponse } from "next/server";

import { parseResumeFile } from "../../../../lib/resume-parser";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("resume");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Attach a resume file under the 'resume' field." }, { status: 400 });
    }

    const parsedResume = await parseResumeFile(file);
    return NextResponse.json({ parsedResume });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Resume parsing failed." },
      { status: 500 },
    );
  }
}
