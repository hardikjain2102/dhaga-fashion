import { z } from "zod";

export const CATEGORIES = ["Kurta", "Saree", "Dupatta", "Shirt", "Dress"] as const;

const sizeSchema = z
  .object({
    size: z.string().trim().min(1).max(10),
    stock: z.number().int().min(0).max(100_000),
  })
  .strict();

// .strict() rejects unknown fields, so a client cannot slip in "sellerId" or "sellerName".
export const productSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    category: z.enum(CATEGORIES),
    price: z.number().int().min(1).max(1_000_000),
    description: z.string().trim().min(10).max(500),
    swatch: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must look like #aabbcc"),
    sizes: z.array(sizeSchema).min(1).max(8),
  })
  .strict()
  .superRefine((p, ctx) => {
    const seen = new Set<string>();
    for (const s of p.sizes) {
      const key = s.size.toLowerCase();
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["sizes"], message: `Size "${s.size}" is listed twice` });
      seen.add(key);
    }
  });

export const listQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.enum(CATEGORIES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export const idSchema = z.string().uuid();

const stockItem = z
  .object({
    productId: z.string().uuid(),
    size: z.string().min(1).max(10),
    quantity: z.number().int().min(1).max(100),
  })
  .strict();

export const reserveSchema = z
  .object({ orderId: z.string().min(1).max(64), items: z.array(stockItem).min(1).max(20) })
  .strict()
  .superRefine((b, ctx) => {
    const seen = new Set<string>();
    for (const i of b.items) {
      const key = `${i.productId}|${i.size}`;
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["items"], message: "Duplicate product and size" });
      seen.add(key);
    }
  });

export const orderRefSchema = z.object({ orderId: z.string().min(1).max(64) }).strict();
