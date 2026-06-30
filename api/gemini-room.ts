import { GoogleGenAI } from '@google/genai';

const PROMPT = `You are a professional interior design compositor. You will receive two images.

IMAGE 1 = a real photograph of the user's room.
IMAGE 2 = a photorealistic product photo of a sofa and/or accent chair on a neutral background, showing the exact custom fabrics the user has configured.

YOUR TASK: Produce a single photorealistic interior photograph showing IMAGE 1's room with the furniture from IMAGE 2 naturally placed inside it — looking like a real professional interior photo taken with the furniture already in the room.

INTEGRATION:
- Analyse IMAGE 1's lighting: note the direction of natural light (windows), the warmth of the ambient light, and the direction shadows fall on the floor. Apply this exact same lighting to the furniture.
- Add realistic floor contact shadows beneath each piece that match the shadow direction and softness already visible in IMAGE 1.
- The furniture should look fully grounded in the room — not floating, not pasted on.
- If the floor has a sheen or reflection, show a subtle reflection of the furniture legs.

FABRIC: The fabric color, pattern, and texture must remain identical to IMAGE 2. Lighting effects (highlights, shadows cast by the room's light) should appear on top of the fabric naturally, but do not change the underlying fabric design or color.

ROOM:
- Remove any existing moveable furniture from IMAGE 1 (sofas, chairs, tables, rugs, floor lamps, cushions). Keep all permanent architecture: walls, floor, ceiling, windows, fireplace, wall art, built-in shelving.
- Do not alter the room's colors, lighting, or style in any way.
- Do not add any objects beyond what is shown in IMAGE 2 — no coffee table, no plants, no rug, no decorations.

OUTPUT: One photorealistic image that looks like a professional interior design photograph of IMAGE 1's room with IMAGE 2's furniture seamlessly integrated into it.`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { roomPhoto, furnitureRender } = req.body || {};
  if (!roomPhoto || !furnitureRender) {
    return res.status(400).json({ error: 'Missing roomPhoto or furnitureRender' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY environment variable' });
  }

  const roomBase64 = roomPhoto.replace(/^data:image\/[a-z]+;base64,/, '');
  const furnBase64 = furnitureRender.replace(/^data:image\/[a-z]+;base64,/, '');
  const roomMime = roomPhoto.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
  const furnMime = furnitureRender.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          { inlineData: { data: roomBase64, mimeType: roomMime } },
          { inlineData: { data: furnBase64, mimeType: furnMime } },
          { text: PROMPT },
        ],
      },
    });

    let generatedImageUrl: string | null = null;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!generatedImageUrl) {
      return res.status(500).json({ error: 'No generated image returned from Gemini' });
    }

    return res.status(200).json({ imageUrl: generatedImageUrl });
  } catch (error: any) {
    console.error('gemini-room error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to generate image' });
  }
}
