import type {ApiResult, ToolDefinition, ToolRequest} from "../shared/types";

export class D3vToolsApi {
  constructor(
    private readonly baseUrl: string,
    private readonly getApiKey: () => Promise<string | null>
  ) {}

  async getCatalog(signal?: AbortSignal): Promise<ToolDefinition[]> {
    const response = await this.request('/api/v1/tools', { signal })
    const body = await response.json() as {
      data?: Array<ToolDefinition & {
        input_type?: ToolDefinition["inputType"];
        desktop_ui?: ToolDefinition["desktopUi"]
      }>
    };
    return (body.data ?? []).map(({input_type, desktop_ui, ...tool}) => ({
      ...tool,
      inputType: tool.inputType ?? input_type,
      desktopUi: tool.desktopUi ?? desktop_ui
    }));
  }

  async execute(category: string, tool: string, payload: ToolRequest): Promise<ApiResult> {
    const body = payload.files?.length ? this.multipartBody(tool, payload) : JSON.stringify(payload);
    const response = await this.request(`/api/v1/tools/${encodeURIComponent(category)}/${encodeURIComponent(tool)}`, {
      method: 'POST',
      body,
      headers: payload.files?.length
          ? {Accept: "application/json"}
          : {"Content-Type": "application/json", Accept: "application/json"}
    })
    const result = await response.json() as ApiResult;
    if (tool === "image-convert" && isConversionJob(result.data)) return this.waitForConversion(result);
    return result;
  }

  private async waitForConversion(result: ApiResult): Promise<ApiResult> {
    const job = result.data as ConversionJob;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const response = await this.request(`/api/v1/conversions/${encodeURIComponent(job.id)}`, {headers: {Accept: "application/json"}});
      const payload = await response.json() as { data: ConversionJob };
      if (payload.data.status === "completed") {
        const files = await Promise.all((payload.data.files ?? []).filter((file) => file.download_url).map(async (file) => {
          const fileResponse = await this.request(file.download_url!, {headers: {Accept: "application/octet-stream"}});
          const data = Buffer.from(await fileResponse.arrayBuffer()).toString("base64");
          return {name: file.name, mime_type: file.mime_type, data_uri: `data:${file.mime_type};base64,${data}`};
        }));
        return {...result, data: {files}};
      }
      if (["failed", "canceled", "expired"].includes(payload.data.status)) throw new Error("Image conversion could not be completed. Check your files and options, then try again.");
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error("Image conversion is taking longer than expected. Please try again later.");
  }

  private multipartBody(tool: string, payload: ToolRequest): FormData {
    const form = new FormData();
    form.set("tool", tool);
    payload.files?.forEach((file) => form.append("files[]", new Blob([file.data], {type: file.type || "application/octet-stream"}), file.name));
    const appendOption = (value: unknown, path: string): void => {
      if (value === undefined || value === null) return;
      if (typeof value === "object" && !Array.isArray(value)) {
        Object.entries(value).forEach(([key, nestedValue]) => appendOption(nestedValue, `${path}[${key}]`));
        return;
      }
      form.set(path, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
    };
    Object.entries(payload.options ?? {}).forEach(([key, value]) => appendOption(value, `options[${key}]`));
    return form;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const apiKey = await this.getApiKey()
    const headers = new Headers(init.headers)
    if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`)
    const url = new URL(path, this.baseUrl)
    const response = await fetch(url, { ...init, headers })
    if (!response.ok) {
      let message = `D3vTools API request failed (${response.status}) at ${url.origin}`
      try {
        const body = await response.clone().json() as { message?: string; errors?: Record<string, string[]> };
        const firstError = Object.entries(body.errors ?? {})[0];
        if (firstError) message = friendlyValidationMessage(firstError[0], firstError[1]?.[0]);
        else if (body.message) message = body.message;
      } catch { /* Keep the status-based message for non-JSON responses. */ }
      throw new Error(message)
    }
    return response
  }
}

interface ConversionJobFile {
  id: number;
  direction?: string;
  name: string;
  mime_type: string;
  download_url: string | null;
  data_uri?: string;
}

interface ConversionJob {
  id: string;
  status: string;
  credit_balance?: number;
  error_message?: string | null;
  files?: ConversionJobFile[];
}

function isConversionJob(value: unknown): value is ConversionJob {
  return typeof value === "object" && value !== null && "id" in value && "status" in value;
}

function friendlyValidationMessage(field: string, fallback?: string): string {
  const messages: Record<string, string> = {
    "files": "Select between 1 and 3 supported image files, up to 5 MB each.",
    "options.format": "Choose a valid output format.",
    "options.quality": "Quality must be between 1 and 100.",
    "options.width": "Width must be between 1 and 10,000 pixels.",
    "options.height": "Height must be between 1 and 10,000 pixels.",
    "options.gif.combine": "Choose whether to combine the GIF frames.",
    "options.gif.frame_rate": "Frame rate must be between 1 and 60.",
    "options.gif.frame_delay": "Frame delay must be between 0.01 and 60 seconds.",
  };
  return messages[field] ?? fallback ?? "Some of the selected options are invalid.";
}
