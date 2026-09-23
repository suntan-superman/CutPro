import { readCompanyContent, validateCompanyContent } from "./companyContent.js";

const headers = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => Response.json(body, { status, headers });

export function companyContentHandlers({ authorize, createClient }) {
  return {
    async GET() {
      const auth = await authorize();
      if (!auth.ok) return json({ message: auth.message }, auth.status);
      const result = await readCompanyContent(createClient());
      if (!result.available) return json({ message: "Company content could not be loaded. Please retry or check that the company-content migration is installed." }, 503);
      return json(result);
    },
    async PUT(request) {
      const auth = await authorize();
      if (!auth.ok) return json({ message: auth.message }, auth.status);
      if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return json({ message: "Send company content as JSON." }, 415);
      // Bound actual bytes, including chunked requests without Content-Length.
      const reader = request.body?.getReader();
      if (!reader) return json({ message: "Enter company content." }, 400);
      let input;
      try {
        const chunks = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 64 * 1024) {
            await reader.cancel();
            return json({ message: "Company content is too large." }, 413);
          }
          chunks.push(value);
        }
        input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch { return json({ message: "Company content could not be read." }, 400); }
      const validation = validateCompanyContent(input);
      if (!validation.valid) return json({ message: "Review the highlighted fields.", errors: validation.errors }, 422);
      try {
        const client = createClient();
        if (!client) return json({ message: "Company content storage is not configured." }, 503);
        const { data, error } = await client.from("company_content").upsert({
          id: "primary", content: validation.data, updated_by: auth.user.id,
        }).select("content, updated_at").single();
        if (error || !data) return json({ message: "Company content could not be saved. Your edits are still here; please retry." }, 503);
        return json({ ok: true, content: data.content, updatedAt: data.updated_at });
      } catch { return json({ message: "Company content could not be saved. Your edits are still here; please retry." }, 503); }
    },
  };
}
