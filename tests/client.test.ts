import {describe, expect, it, vi} from "vitest";
import {D3vToolsApi} from "../src/api/client";

describe('D3vToolsApi catalog normalization', () => {
  it('maps Laravel snake_case input metadata to the renderer contract', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ name: 'Image to Base64', slug: 'image-to-base64', category: 'base64-tools', description: 'Upload an image', type: 'upload', input_type: 'file', tier: 'free' }] }), { status: 200 }))
    const catalog = await new D3vToolsApi('https://d3v.tools', async () => null).getCatalog()
    expect(catalog[0].inputType).toBe('file')
    expect(catalog[0]).not.toHaveProperty('input_type')
    fetchMock.mockRestore()
  })

	it("maps desktop UI metadata to the renderer contract", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
			data: [{
				name: "Image Converter",
				slug: "image-convert",
				category: "image-converters",
				description: "Convert images",
				type: "server",
				input_type: "file",
				desktop_ui: {options: {format: {type: "select", values: ["webp"]}}},
				tier: "premium"
			}]
		}), {status: 200}));
		const catalog = await new D3vToolsApi("https://d3v.tools", async () => null).getCatalog();
		expect(catalog[0].desktopUi?.options?.format).toEqual({type: "select", values: ["webp"]});
		fetchMock.mockRestore();
	});

  it('surfaces a safe API error message', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'This tool requires a premium subscription.' }), { status: 403 }))
    await expect(new D3vToolsApi('http://127.0.0.1', async () => null).getCatalog()).rejects.toThrow('This tool requires a premium subscription.')
    fetchMock.mockRestore()
  })

	it("translates validation fields into friendly messages", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
			message: "The options.gif.combine field must be true or false.",
			errors: {"options.gif.combine": ["The options.gif.combine field must be true or false."]}
		}), {status: 422}));
		await expect(new D3vToolsApi("https://d3v.tools", async () => "test-key").execute("image-converters", "image-convert", {input: "invalid"})).rejects.toThrow("Choose whether to combine the GIF frames.");
		fetchMock.mockRestore();
	});

	it("sends image conversion files as multipart form data", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
			success: true,
			data: {}
		}), {status: 200}));
		const fileData = new TextEncoder().encode("image-data").buffer;
		await new D3vToolsApi("https://d3v.tools", async () => "test-key").execute("image-converters", "image-convert", {
			files: [{name: "input.png", type: "image/png", data: fileData}],
			options: {format: "gif", gif: {combine: false}}
		});
		const request = fetchMock.mock.calls[0][1]!;
		expect(request.body).toBeInstanceOf(FormData);
		expect(new Headers(request.headers).get("Accept")).toBe("application/json");
		const body = request.body as FormData;
		expect(body.get("tool")).toBe("image-convert");
		expect(body.get("options[format]")).toBe("gif");
		expect(body.get("options[gif][combine]")).toBe("0");
		expect((body.get("files[]") as File).name).toBe("input.png");
		fetchMock.mockRestore();
	});
})
